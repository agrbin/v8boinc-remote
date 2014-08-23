v8boinc-jsapp(1) -- User Manual
===============================

## SYNOPSIS

    jsapp

## DESCRIPTION

This binary is not intended to be started manually. If you're still dying to do
so, read this document first.

Executable takes JavaScript script and JSON encoded input file, executes `main`
function in script with object deserialized from input file and serializes
returned value to output file.

Executable is compiled to work with BOINC API, like in BOINC client and is
statically linked against all used libraries including Google's V8 to run
JavaScript.

Normal environment for this binary is BOINC client program.

## FILES

There are two input files consumed by this executable:

* main.js
* in.json

Output files that may or may not appear in working directory after executable
finishes are:

* out.json
* stderr.txt
* boinc_finish_called
* boinc_lockfile

`main.js` is an input file that should contain valid JavaScript code with
function main available in global scope.

`in.json` is an input file that should contain valid JSON object.

`stderr.txt`, `boinc_finish_called` and `boinc_lockfile` are files related to
BOINC API, and they appear because `jsapp` is nothing else but native BOINC
application.

`stderr.txt` will contain error messages if something went wrong.

`boinc_finish_called` is an empty file that will be touched when `jsapp` exists
intentionally.

`boinc_lockfile` is an empty file that will be present when `jsapp` is running.

## COMPILATION

We compiled this executable for Windows, Linux and Mac on "normal" processors
and for Linux running MIPS.

Executable is statically compiled against **old libc** implementation resulting
in increased portability over various environments.

Size of executable is not bigger than 10Mb.

## EXIT STATUS

The exit status is 0 if and only if there were no errors and `out.json` was
written.

## KNOWN BUGS

There is a timeout in BOINC API that causes `jsapp` to have ~2 seconds of delay
when running outside BOINC client.

