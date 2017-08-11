# tspw

Utility to start multiple typescript watchers at once.

## Rationale
Lots of projects (like Stingray editor) have multiple tsconfig.json files. Typescript only support a single tsconfig when run with the --watch switch. 

`tspw` allows you to start multiple watchers at once on multiple "projects" (directories or tsconfig.json).

VsCode can easily be configured to start `tspw` as a task.

## Usage
```
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
```