'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const version = '1.0.0';
const helpStr = `
Version ${version}
Syntax: watch-typescript [options]

Examples:   watch-typescript -r .
            watch-typescript -p .\editor\core .\plugins\log_console\tsconfig.json
            watch-typescript -r . -tsc .\node_modules\typscript\bin\tsc
            watch-typescript -r . -tsc-args "--allowJs true --alwaysStrict true"

--root (-r) <rootdir> : <rootdir> and all resursive directory willl be scanned for tsconfig.json
--projects (-p) <projectDirOrFile1> <projectDirOrFile2> ... : Start watcher on the list of dir or files
--tsc (-t) <pathToTsc> : where to find tsc. By default look for globally installed.
--tsc-args <args> : string to pass to tsc
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
        } else {
            errorMsg = 'Unhandled parameters: ' + param;
            break;
        }
    }

    if (!opts.tsc) {
        opts.tsc = path.join(process.env.APPDATA, 'npm', 'node_modules', 'typescript', 'bin', 'tsc');
        if (!fs.existsSync(opts.tsc)) {
            errorMsg = 'No tsc installation found. Try npm install -g typescript';
        }
    }

    if (errorMsg) {
        console.log(errorMsg);
        return null;
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
    console.log(opts);

    let projects = [];
    if (opts.root) {
        projects = findAllRecursiveProjects(opts.root, []);
    } else if (opts.tsconfigs) {
        projects = opts.tsconfigs;
    }

    for (let p of projects) {
        let args = [opts.tsc, '-w', '-p', p];
        if (opts.tscargs) {
            args.push(opts.tscargs);
        }
        console.log('Watching: ', p);
        if (opts.simulate) {
            console.log(args.join(' '));
            continue;
        }

        const tsc = child_process.execFile(process.execPath, args);
        tsc.on('close', () => {
            console.log('closing');
        });

        tsc.on('error', (e) => {
            console.log(e);
        });

        tsc.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        tsc.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
        });
    }
}

let opts = extractOpts();
if (opts === null || opts.help) {
    console.log(helpStr);
} else {
    watchTypeScript(opts);
}
