# tspw

Utility to start multiple typescript watchers at once.

## Rationale
Lots of projects (like Stingray editor) have multiple tsconfig.json files. Typescript only support a single tsconfig when run with the --watch switch. 

`tspw` allows you to start multiple watchers at once on multiple "projects" (directories or tsconfig.json).

VsCode can easily be configured to start `tspw` as a task.

## Usage
```
Syntax: tspw [options]

Examples:   tspw -r .
            tspw -p .\editor\core .\plugins\log_console\tsconfig.json
            tspw -r . -tsc .\node_modules\typscript\bin\tsc
            tspw -r . -tsc-args "--allowJs true --alwaysStrict true"

--root (-r) <rootdir> : <rootdir> and all resursive directory willl be scanned for tsconfig.json
--projects (-p) <projectDirOrFile1> <projectDirOrFile2> ... : Start watcher on the list of dir or files
--tsc (-t) <pathToTsc> : where to find tsc. By default look for globally installed.
--tsc-args <args> : string to pass to tsc
--simulate : print what watchers would be started
```