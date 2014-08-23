v8boinc(1) -- User Manual
=========================

## SYNOPSIS

    v8boinc --help
    v8boinc <command>
            [--help|-h]
            [--config=<path>|-h <path>]
            [--minor|-m] [--major|-M] [--hold|-H]
            [--save|-s] [--suppress|-S] [--limit=<value>|-j <value]
            [--trace|-w]
            [--debug|-d] [--time|-t] [--less|-L] [--log=<path>|-l <path>]
            [<args>]

## DESCRIPTION

`v8boinc` is a command line program that lets you develop and deploy parallel
applications for V8-BOINC system.

While V8-BOINC system only supports tasks consisted of one `.js` file and one
input `.json` file, `v8boinc` program enables writing a modular applications
using well-known node module system.

Other than using multiple files to develop application, `v8boinc` includes
functionality to unit test the application in exact same environment that is
used on volunteer hosts.

In this document we use the term **application** to denote scientific
distributed application that will be deployed on V8-BOINC system.

## COMMANDS AND WORKFLOW

Commands are (in order of normal workflow):

* **authenticate MASTER_URL**
* **benchmark**
* **init APPLICATION-NAME**
* **test**
* **estimate**
* **run**

Before starting to use `v8boinc` on a new machine, one needs to `authenticate`
and `benchmark` the machine. Authentication step requires that user has an
account on a V8-BOINC server that has submission privileges. Benchmark will
estimate speed of current machine in order to later estimate work load of each
job submitted.

When starting to develop an application for the first time, you need to chdir
to root of the application (or in an empty dir) and issue `v8boinc init`.
This will create hidden `.v8boinc` dir and `app.json` with some configuration
parameters. This command will also download `jsapp` executable for your
platform and verifiy its digital signature. This is a statically compiled
wrapper around V8 that simply runs the script from working directory. See
`v8boinc-jsapp(1)` for more info.

The development cycle is:

* `v8boinc test` while all unit tests are good.
* `v8boinc estimate` while workload of one task is good
* `v8boinc run`!
* connect all of your devices to V8-BOINC and ask your friends to do the same!

`v8boinc estimate` tries to estimate number of floating points operations
required to finish one task. This number is then sent to BOINC server which
will use it to do the job scheduling.

All commands can be shortened to first leter, eg. `v8boinc r` is equivalent to
`v8boinc run`. `run` command will also repeat `test` and `estimate` commands
and proceed only if those commands returned no errors.

The rest of the document shows directory structure of an application and
afterwards, description of each command with flags is presented.

## APPLICATION ANATOMY

    -- git ignored:
    | .v8boinc/
    | | bin/
    | | | jsapp
    | | test-results/
    | | bundles/
    | node_modules/
    -- not ignored:
    [package.json]
    | app.json
    | main.js
    | lib/
    | | *.js
    | input/
    | | *.in.json
    | output/
    | | *.out.json
    | | *.error
    | test/
    | | *.in.json
    | | *.out.json

This diagram shows directory structure of an application. Ignored `.v8boinc`
directory contains `jsapp` executable that runs unit tests, bundles that are
concating whole application code with required modules to one file and unit
test results from last test run.

`main.js` file must `module.exports` a function called `main`. This is a entry
point to your application. This function will be invoked with input object and
returned value will act as an output object. If you want to have function
`main` in some other file change `main` field in `app.json`.

From your code you can use `require` functionality and require anything that is
pure JavaScript. For example, you can't `require("child_process")` because we
can't run that from browser.

Folder `lib/` is used for your libraries just like in ordinary node packages.
Use `npm install --save [package-name]` when you want to use some external
package that will later be installed easily with `npm install` when positioned
in root directory of your app. 

In `test/` you should put `X.in.json` and `X.out.json` pairs that are matching
inputs and outputs from your application. It is required to have at least one
test in order to submit jobs to remote server. Note that these tests will be
started locally. There is a bug that causes all tests to take at least 2
seconds to execute.

`input/` directory should contain real tasks that you want to process in
distributed manner. These files are in same format as your unit tests. The only
difference is that there can be (should be) large number of these tasks and
they can consume significant processing time to process. Other than that,
everything is the same like with unit tests.

`output/` will contain results from running an application distributed, eg.
after `v8boinc run` finishes. These files will have same base name as input
counterparts but extension will be `.out.json` if everything went well or
`.error` if there was an error while processing a task in the wild.

You may choose to have scripts that will produce all the input files or to git
ignore output files and to process them to some other location after the
computatino is finished. It is expected that number of these files will be
huge.

## v8boinc authenticate SERVER-URL [AUTHENTICATOR-KEY]

This command will create global config file with authenticator and submission
server URL.

In order to get an authenticator, navigate to V8-BOINC aware server and then:

* log in or create an account (link is in upper right corner)
* ask submit permissions from server administrator
* click on your account, then account keys
* use 32 char string as your authenticator-key

Args and flags.

  **SERVER-URL**
      BOINC master url of the V8-BOINC project in use.

  **[AUTHENTICATOR]**
      Authenticator key for user that is using V8-BOINC server. If omitted, key
      will be prompted through tty like a password.

  **--config=PATH** default `~/.v8boinc.conf`
      Makes use of different path for global config file. If different config
      file is in use than all future invocations should have that flag active.

## v8boinc benchmark

Benchmark command will estimate speed of current machine and write it to main
config file (`~/.v8boinc.conf`). This data will later be used to estimate
load required by submitted jobs.

## v8boinc init NAME [DESCRIPTION]

This command will create `.gitignore` file, internally used `.v8boinc` folder
and minimal `app.json` for your scientific application and download and
verify binaries used to test the application locally.

While `.v8boinc` is git ignored, you must call this command each time you
start working on a freshly cloned app.

  **NAME** default is basename of current directory
      Name to write into app.config. It is used only to name some internal
      files and directories.

  **[DESCRIPTION]**
      Describe yourslef what you're doing. It will be written to `app.json`.

## v8boinc test [TEST-FILES]

Test will bundle up all `.js` files in your application root directory and
create bundled `main.js` that contains your whole application.

Code will then be executed against test files from arguments or all tests in
`test/` if no arguments specified.

All test that didn't crashed will have results written to
`.v8boinc/test-results/`.

  **[TEST_FILES]**
      Tests to run. If omitted all tests in `test/` directory will be
      used.

  **-s, --save**
    Without this flag, if there is a `.in.json` test file without matching
    `.out.json` file, that test will be marked as failed.
    With this flag active, produced output will be written as correct test
    result and test will pass.

  **-S, --suppress**
    Suppress outputing failed test outputs to a console. Helps if tests have
    large input/output files. All (not crashed) test results are always
    available in `.v8boinc/test-results/*.out.json`.

  **-j <NUM>, --limit=<NUM>** default $(nproc)
    Run this number of tests in parallel.

  **-H, --hold**
    With every run of tests, build version of your application is increased.
    This causes `.v8boinc/bundles` to pile up with earlier snapshots of your
    application which can consume a disk space. This flag causes version to
    hold still.
    Versions are written in `app.json`.

  **-m, --minor**
    Bump application minor version.

  **-M, --major**
    Bump application major version.


## v8boinc estimate [INPUT-FILE]

This command will create a bundle and run the application on first input file
in `input/` dir or file name in command line argument. Execution will be
stopped when `boinc_fraction_done` is called with argument equal or larger than
0.01.

Estimated processing power will be determined based on above running time and
benchmark results for this machine.

  **[INPUT_FILE]**
      You may choose an input file that will be used to estimate work load. If
      this argument is omitted, first input file from `input/` directory will
      be used.

## v8boinc run

Run will firstly invoke `v8boinc test && v8boinc estimate` with all flags
passed to run invocation. If those subcommands return no errors, submition of
tasks from `input/` to remote server will commence.

After all tasks were submitted, process will wait for all results to return
and write their output to `output/`. If task produced an error, its output
will have `.error` extension and contents will have the error details.

If you hit Ctrl+C (or send SIGINT) to this process while there are pending
results, all submitted jobs will be canceled on server.

If you hit Ctrl+C twice, or kill a process in any other way, you may left
active tasks on server. Try not to do this.

## FLAGS THAT CONTROL OUTPUT

  **-w <path>, --trace=<path>**
    Write all request/response HTTP pairs into a file for debugging purposes.
    Trace file will not contain authenticator key which is sent over wire.

  **-d, --debug**
    Print some more debugging info. They are not much usefull.

  **-t, --time**
    Output timestamp prepended to every line. Useful for long running jobs.

  **-L, --less**
    Don't output `INFO` lines.

  **-l <path>, --log=<path>**
    Additionally, output everything to a log file.

## SEE ALSO

* v8boinc-jsapp(1)
* v8boinc-model(7)

