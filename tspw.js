#!/usr/bin/env node

/**
    Typescript Watcher (https://github.com/lochrist/tspw)

    Utility to start multiple typescript watchers at once.

    Lots of projects (like Stingray editor) have multiple tsconfig.json files.
    Typescript only support a single tsconfig when run with the --watch switch.
    `tspw` allows you to start multiple watchers at once on multiple "projects" (directories or tsconfig.json).
    VsCode can easily be configured to start `tspw` as a task.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const version = require('./package.json').version;
const helpStr = `
Version ${version}
Syntax: tspw [options]

Tspw switches:
--compile <folder or projects> : Compile a tsconfig.json or all tsconfig.json in a folder (recursively). You can use this switch multple time.
--watch <folder or projects> : Watch a tsconfig.json or all tsconfig.json in a folder (recursively). This is the default mode of tspw.
--simulate : print what watchers/compilers would be started

Typescript switches:
--tsc (-t) <pathToTsc> : where to find tsc. By default look for typescripts in local node_modules then for globally installed (%APPDATA%/npm/node_modules/typescript/bin/tsc)
--tsc-args <args> : custom parameters to pass to tsc. Should be specified between "" (ex: "--allowJs true")

Examples:

// Watch:
// All equivalent commands to watch the current folder:
> tspw --watch .
> tspw .
> tspw

// Passing arguments to tsc when starting a watcher:
> tspw --tsc-args "--allowJs true --alwaysStrict true"

// Compile:

// Start parallel compilation of all tsconfig.json in plugins folder
> tspw --compile editor/plugins

// Start compilation of core/tsconfig.json. When it is done start parallel compilation of all tsconfig.json in plugins folder
> tspw --compile editor/core --compile editor/plugins

// Same as above but start watchers for all of editor tsconfig.json after compilation is done.
> tspw --compile editor/core --compile editor/plugins --watch editor
`;

Promise.series = function (items, next, initialValue) {
    return items.reduce((p, item, key) => {
        return p.then(pr => {
            return next ? next(item, pr, key) : item;
        });
    }, Promise.resolve(initialValue));
};

function findAllRecursiveProjects(dir, results) {
    let entries = fs.readdirSync(dir);
    let childDirs = [];
    for (let e of entries) {
        if (e === 'tsconfig.json') {
            results.push(path.join(dir, 'tsconfig.json'));
            continue;
        }
        let absEntry = path.resolve(dir, e);
        if (fs.statSync(absEntry).isDirectory()) {
            childDirs.push(absEntry);
        }
    }

    for (let childDir of childDirs) {
        findAllRecursiveProjects(childDir, results);
    }
    return results;
}

function resolvePath(potentialPath) {
    let result = {};
    if (!fs.existsSync(potentialPath)) {
        result.errorMsg = "path does not doesn't exists: " + potentialPath;
    } else if (fs.statSync(potentialPath).isDirectory()) {
        result.projects = [];
        findAllRecursiveProjects(potentialPath, result.projects);
    } else if (path.basename(potentialPath) !== 'tsconfig.json') {
        result.errorMsg = "path is not tsconfig.json file";
    } else {
        result.projects = [potentialPath];
    }

    return result;
}

function resolvePathArg(args, i) {
    let result = {};
    if (i >= args.length) {
        result.errorMsg = 'no path specified';
        return result;
    } 
    
    let potentialPath = args[i + 1];
    if (potentialPath.startsWith('-')) {
        result.errorMsg = 'not a valid path: ' + potentialPath;
        return result;
    } 

    let p = path.resolve(potentialPath);
    return resolvePath(p);
}

function extractOpts() {
    let argv = process.argv.slice(2);
    let opts = {
        simulate: false,
        compile: false,
        compilationBatches: [],
        watch: false,
        watchProjects: [],
        tsc: null,
        tscargs: null
    };
    let errorMsg;
    for (let i = 0; i < argv.length; ++i) {
        let param = argv[i];
        if (param === '-a' || param === '--tsc-args') {
            if (i + 1 < argv.length) {
                opts.tscargs = argv[++i];
            } else {
                return 'No tsc-args specified with option ' + param;
            }
        } else if (param === '-t' || param === '--tsc') {
            if (i + 1 < argv.length) {
                opts.tsc = path.resolve(argv[++i]);
                if (!fs.existsSync(opts.tsc) || fs.statSync(opts.tsc).isDirectory() || path.basename(opts.tsc) !== 'tsc') {
                    return "tsc is not valid: " + opts.tsc;
                }
            } else {
                return 'No tsc path specified' + param;
            }
        } else if (param === '--simulate') {
            opts.simulate = true;
        } else if (param === '--compile') {
            opts.compile = true;
            let pathResult = resolvePathArg(argv, i);
            if (pathResult.errorMsg) {
                return pathResult.errorMsg;
            }
            ++i;

            opts.compilationBatches.push({
                src: argv[i],
                projects: pathResult.projects
            });
        } else if (param === '--watch') {
            opts.watch = true;

            let pathResult = resolvePathArg(argv, i);
            if (pathResult.errorMsg) {
                return pathResult.errorMsg;
            }
            ++i;

            opts.watchProjects = opts.watchProjects.concat(pathResult.projects);
        } else if (param === '--help') {
            opts.help = true;
            console.log(helpStr);
            process.exit(0);
        } else if (!opts.compile && !opts.watch) {
            // Default with path arguments is watch
            opts.watch = true;
            while (i < argv.length) {
                let pathResult = resolvePath(argv[i]);
                if (pathResult.errorMsg) {
                    return pathResult.errorMsg;
                }
                opts.watchProjects = opts.watchProjects.concat(pathResult.projects);
                ++i;
            }
        } else {
            return 'Unhandled parameters: ' + param;
        }
    }

    if (errorMsg) {
        console.error('error: ' + errorMsg);
        console.log('\r\n' + helpStr);
        process.exit(1);
        return null;
    }

    if (!opts.compile && !opts.watch) {
        // Assume a watch in current dir:
        opts.watch = true;
        let pathResult = resolvePath('.');
        if (pathResult.errorMsg) {
            return pathResult.errorMsg;
        }
        opts.watchProjects = opts.watchProjects.concat(pathResult.projects);
    }

    if (!opts.tsc) {
        let absRoot = path.resolve(path.dirname(process.argv[1]));
        let pathExploded = path.parse(absRoot);
        let dir = pathExploded.dir;
        while (dir !== pathExploded.root && dir !== '.') {
            let base = path.basename(dir);
            if (base === 'node_modules') {
                let tsDir = path.join(dir, 'typescript', 'bin', 'tsc');
                if (fs.existsSync(tsDir)) {
                    opts.tsc = tsDir;
                    break;
                }
            }
            dir = path.dirname(dir);
        }

        if (!opts.tsc) {
            opts.tsc = path.join(process.env.APPDATA, 'npm', 'node_modules', 'typescript', 'bin', 'tsc');
        }
    }

    if (!fs.existsSync(opts.tsc)) {
        return 'No tsc installation found. Try npm install -g typescript';
    } else {
        console.log('typescript: ', opts.tsc);
    }

    return opts;
}

function makePromise(functor) {
    return new Promise((resolve, reject) => {
        functor((err, result) => {
            if (err) {
                return reject(err);
            }
            return resolve(result);
        });
    });
}

function makeTscArgs(tspwOpts, cmdArgs) {
    let tscArgs = [tspwOpts.tsc].concat(cmdArgs);
    if (tspwOpts.tscargs) {
        tscArgs = tscArgs.concat(tspwOpts.tscargs.split(' '));
    }
    return tscArgs;
}

function compileBatch(tspwOpts, batch) {
    if (!batch.src.endsWith('json')) {
        console.log('Start Compilation for: ', batch.src);
    }
    return Promise.all(batch.projects.map(project => {
        let processArgs = makeTscArgs(tspwOpts, ['-p', project]);
        if (tspwOpts.simulate) {
            console.log(`Simulate Compiling ` + processArgs.join(' '));
            return Promise.resolve();
        }
        console.log(`Compiling ${project}...`);
        return makePromise(endCb => child_process.execFile(process.execPath, processArgs, endCb));
    }));
}

function tspwExecute(tspwOpts) {
    return Promise.resolve().then(() => {
        // Compilation step
        if (!tspwOpts.compile || tspwOpts.compilationBatches.length === 0) {
            return;
        }

        // Compile each project in a batch in parallel, but wait for the batch to end before starting another one:
        return Promise.series(tspwOpts.compilationBatches, batch => compileBatch(tspwOpts, batch)).then( () => {
            console.log('Compilation done');
        });
    }).then(() => {
        // Watch Step:
        if (!tspwOpts.watch || tspwOpts.watchProjects.length === 0) {
            return;
        }

        for (let p of tspwOpts.watchProjects) {
            let processArgs = makeTscArgs(tspwOpts, ['-p', p, '-w']);
            if (opts.simulate) {
                console.log('Simulate watching: ' + processArgs.join(' '));
                continue;
            }

            console.log('Watching: ' + p);
            const tsc = child_process.execFile(process.execPath, processArgs);
            tsc.on('error', (e) => console.error(e));
            tsc.stdout.on('data', (data) => console.log(data));
            tsc.stderr.on('data', (data) => console.error(data));
        }
    });
}

let opts = extractOpts();
if (typeof opts === 'string') {
    console.error('error: ' + opts);
    console.log('\r\n' + helpStr);
    process.exit(1);
    return null;
}

tspwExecute(opts);