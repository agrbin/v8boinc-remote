/*jslint indent: 2, plusplus: true*/
"use strict";

var hd = require('heredoc'),
  os = require('os');

function home() {
  return process.env.HOME;
}

module.exports = {

  waitIntervalMs : 5000,

  mainUsage : hd(function () {/*
  v8boinc [OPTIONS] <command> [ARGS]

    v8boinc is CLI application for submision and result retrieval from v8boinc.
    type 'v8boinc <command> --help' for help about specific command or see man
    v8boinc.
*/}),

  // flags that all commands are parsing
  commonFlags : {
    debug:   ['d', 'Enable debug info'],
    help:   ['h', 'Get help and usage details'],
    config:   ['c', 'Use different config file',
      'path', home() + '/.v8boinc.conf'],
    trace:   ['w', 'Log all http communication to file', 'path'],
    minor:   ['m', 'Bump application minor version'],
    major:   ['M', 'Bump application major version'],
    hold:   ['H', "Don't increase app version with every test."],
    save:   ['s', 'Save test result as expected if .out.json is missing'],
    suppress:   ['S', "Suppress output of got/expected test data."],
    limit:   ['j', 'Concurrency when testing', 'NUMBER', os.cpus().length],
    time:   ['t', 'Prepend timestamp before each output'],
    less:   ['L', "Don't output INFO level messages"],
    log:   ['l', 'Log output to a file', 'PATH'],
  },

  commands : {
    'authenticate': 'Register with some v8boinc server',
    'benchmark': 'Calcluate speed of current host',
    'init': 'Initialize v8boinc app folder',
    'test': 'Test application locally',
    'estimate': 'Estimate est_rsc_fpops, eg. required processing power',
    'run': 'Run the experiment and wait for results',
  },

  gitIgnoreContent : [".v8boinc", "node_modules", ""].join("\n")

};

