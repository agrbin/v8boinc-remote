/*jslint indent: 2, plusplus: true*/
"use strict";

var hd = require('heredoc'),
  common = require('./common.js'),
  defaults = require('./defaults.js'),
  Bundle = require('./Bundle.js'),
  Tester = require('./Tester.js');

module.exports.usage = hd(function () {/*
v8boinc test [test-files]

  This command will bundle up all .js files in your application root directory and create bundled main.js that contains your whole application.

  Code will then be executed against test files from arguments or all tests in test/ if no arguments specified.

  If there is a .in.json test file without .out.json file in same directory test will be marked as failed. If you add --save flag, produced output will be written as correct test result.

  If tests have large output files, add --suppress flag to skip printing output contents on console.

  All test that didn't crashed have results written to .v8boinc/test-results/.

  Build version is increased with every test, bypass this with --hold.
*/});

module.exports.main = function (app, done) {

  app.cli.info("--> v8boinc test");
  function onFinish(err, sum) {
    if (err) {
      done(err);
      return app.cli.fatal(err);
    }
    if (sum.crashed || sum.failed) {
      done("there were failed/crashed unit tests.");
      app.cli.fatal("there were failed/crashed unit tests.");
    } else {
      app.cli.ok('all tests passed');
      done();
    }
  }

  function onBundle(err, bundled) {
    if (err) {
      return app.cli.fatal(err);
    }
    app.bundle = bundled;
    // what if there are no tests?
    return new Tester(app, bundled, onFinish);
  }

  common.requireAppConfig(app, function () {
    return new Bundle(app, onBundle);
  });
};
