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

Examples:   tspw -r .
            tspw -p .\editor\core .\plugins\log_console\tsconfig.json
            tspw -r . --tsc .\node_modules\typscript\bin\tsc
            tspw -r . --tsc-args "--allowJs true --alwaysStrict true"
            tspw --compile -r editor/ --tsc editor/node_modules/typescript/bin/tsc --tsc-args "--listEmittedFiles --noEmitOnError"

--root (-r) <rootdir> : <rootdir> and all resursive directory willl be scanned for tsconfig.json
--projects (-p) <projectDirOrFile1> <projectDirOrFile2> ... : Start watcher on the list of project dirrectories or tsconfig.json files
--tsc (-t) <pathToTsc> : where to find tsc. By default look for globally installed (%APPDATA%/npm/node_modules/typescript/bin/tsc)
--tsc-args <args> : custom parameters to pass to tsc. Should be specified between "" (ex: "--allowJs true")
--compile : Compile projects and exit (do not start watchers)
--simulate : print what watchers would be started
`;

function extractOpts() {
    let argv = process.argv.slice(2);
    let opts = {};
    let errorMsg;
    for (let i = 0; i < argv.length; ++i) {
        let param = argv[i];
        if (param === '-p' || param === '--projects') {
            opts.tsconfigs = [];
            while (i + 1 < argv.length && !argv[i + 1].startsWith('-') && !errorMsg) {
                let p = path.resolve(argv[++i]);
                if (!fs.existsSync(p)) {
                    errorMsg = "tsconfig is not doesn't exists: " + p;
                } else if (!fs.statSync(p).isDirectory()) {
                    if (path.basename(p) !== 'tsconfig.json') {
                        errorMsg = "tsconfig is not tsconfig.json file or a directory: " + p;
                    }
                } else if (!fs.existsSync(path.join(p, 'tsconfig.json'))) {
                    errorMsg = "directory doesn't contain a tsconfig.json file: " + p;
                }
                opts.tsconfigs.push(p);
            }

            if (errorMsg) {
                break;
            } else if (opts.tsconfigs.length === 0) {
                errorMsg = 'No project specified with option ' + param;
                break;
            }
        } else if (param === '-a' || param === '--tsc-args') {
            if (i + 1 < argv.length) {
                opts.tscargs = argv[++i];
            } else {
                errorMsg = 'No tsc-args specified with option ' + param;
                break;
            }
        } else if (param === '-r' || param === '--root') {
            if (i + 1 < argv.length) {
                opts.root = path.resolve(argv[++i]);
                if (!fs.existsSync(opts.root) || !fs.statSync(opts.root).isDirectory()) {
                    errorMsg = "root dir doesn't exists or is not a directory: " + opts.root;
                    break;
                }
            } else {
                errorMsg = 'No root dir specified with option ' + param;
                break;
            }
        } else if (param === '-t' || param === '--tsc') {
            if (i + 1 < argv.length) {
                opts.tsc = path.resolve(argv[++i]);
                if (!fs.existsSync(opts.tsc) || fs.statSync(opts.tsc).isDirectory() || path.basename(opts.tsc) !== 'tsc') {
                    errorMsg = "tsc is not valid: " + opts.tsc;
                    break;
                }
            } else {
                errorMsg = 'No tsc path specified' + param;
                break;
            }
        } else if (param === '--simulate') {
            opts.simulate = true;
        } else if (param === '--compile') {
            opts.compile = true;
        } else if (param === '--help') {
            opts.help = true;
            console.log(helpStr);
            process.exit(0);
        } else {
            errorMsg = 'Unhandled parameters: ' + param;
            break;
        }
    }

    if (errorMsg) {
        console.error('error: ' + errorMsg);
        console.log('\r\n' + helpStr);
        process.exit(1);
        return null;
    }

    if (!opts.root && !opts.tsconfigs) {
        // Assume we want to watch at root:
        opts.root = path.resolve('.');
    }

    if (!opts.tsc) {
        opts.tsc = path.join(process.env.APPDATA, 'npm', 'node_modules', 'typescript', 'bin', 'tsc');
        if (!fs.existsSync(opts.tsc)) {
            errorMsg = 'No tsc installation found. Try npm install -g typescript';
        }
    }

    return opts;
}

function findAllRecursiveProjects(dir, results) {
    let entries = fs.readdirSync(dir);
    let childDirs = [];
    for (let e of entries) {
        if (e === 'tsconfig.json') {
            results.push(dir);
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

function watchTypeScript(opts) {
    let projects = [];
    if (opts.root) {
        projects = findAllRecursiveProjects(opts.root, []);
    } else if (opts.tsconfigs) {
        projects = opts.tsconfigs;
    }

    for (let p of projects) {
        let args = [opts.tsc, '-p', p];
        if (!opts.compile) {
            args.push('-w');
            console.log('Watching: ', p);
        } else {
            console.log(`Compiling ${p}...`);
        }
        if (opts.tscargs) {
            args = args.concat(opts.tscargs.split(' '));
        }
        if (opts.simulate) {
            console.log(args.join(' '));
            continue;
        }

        if (opts.compile) {
            try {
                console.log(child_process.execFileSync(process.execPath, args).toString());
            } catch (err) {
                if (err.stderr.toString())
                    console.error(err.stdout.toString());
                console.error(`Failed to compile ${p}:\r\n${err.stdout.toString()}\r\n`);
                process.exit(1);
            }
        } else {
            const tsc = child_process.execFile(process.execPath, args);
            tsc.on('error', (e) => console.error(e));
            tsc.stdout.on('data', (data) => console.log(data));
            tsc.stderr.on('data', (data) => console.error(data));
        }
    }
}

let opts = extractOpts();
watchTypeScript(opts);