# tspw

Utility to start multiple typescript watchers at once.

## Rationale
Lots of projects (like Stingray editor) have multiple tsconfig.json files. Typescript only support a single tsconfig when run with the --watch switch. 

`tspw` allows you to start multiple watchers at once on multiple "projects" (directories or tsconfig.json).

VsCode can easily be configured to start `tspw` as a task.

## Usage
```
Version ${version}
Syntax: tspw [options]

Examples:   tspw
            tspw -r .
            tspw -p .\editor\core .\plugins\log_console\tsconfig.json
            tspw -r . --tsc .\node_modules\typscript\bin\tsc
            tspw -r . --tsc-args "--allowJs true --alwaysStrict true"
            tspw --compile -r editor/ --tsc editor/node_modules/typescript/bin/tsc --tsc-args "--listEmittedFiles --noEmitOnError"

--root (-r) <rootdir> : <rootdir> and all resursive directory willl be scanned for tsconfig.json. By default, look for current dir.
--projects (-p) <projectDirOrFile1> <projectDirOrFile2> ... : Start watcher on the list of project dirrectories or tsconfig.json files
--tsc (-t) <pathToTsc> : where to find tsc. By default look for typescripts in local node_modules then for globally installed (%APPDATA%/npm/node_modules/typescript/bin/tsc)
--tsc-args <args> : custom parameters to pass to tsc. Should be specified between "" (ex: "--allowJs true")
--compile : Compile projects and exit (do not start watchers)
--simulate : print what watchers would be started
```