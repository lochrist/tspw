# typescript-watcher

Utility to start multiple typescript watchers at once.

## Rationale
Lots of projects (like Stingray editor) have multiple tsconfig.json files. VsCode watcher task will only start a single watcher. typescript-watcher allows you to start multiple watchers at once. VsCode can start typescript-watcher as a task.

## Usage
```
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
```