/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  async = require('async'),
  glob = require('glob'),
  path = require('path'),
  fh = require('./FileHelper.js'),
  isFile = fh.isFile,
  exploreFiles = fh.exploreFiles,
  readJsonFile = fh.readJsonFile,
  jsappExec = require('./jsappExec.js');

module.exports = function Tester(app, bundledObj, onFinish) {
  var testSummarize = {
      success: 0,
      failed: 0,
      crashed: 0,
      processed: 0,
      total: 0
    },
    dashes = '------------------------------------------';

  // take string file as test input and test if output match exists.
  // test if file has exstension '.in.json'
  // output is array [] if file doesn't have .in.json
  // [file] if there is no matching .out.json
  // [in_file, out_file] if there is a matching output
  function getOutNameFromIn(file) {
    return file.replace(/in\.json$/, 'out.json');
  }

  function getTestPair(file, done) {
    var ofile = getOutNameFromIn(file);
    if (file === ofile) {
      app.cli.info("file '" + file + "' should have .in.json extension");
      done(null, []);
    }
    isFile(ofile, function (exists) {
      if (exists) {
        done(null, [file, ofile]);
      } else {
        done(null, [file]);
      }
    });
  }

  // result is { err:, success:, expected:, got: }
  function runTest(test, done) {
    if (test.length === 0) {
      done(null, {});
    }

    function judge(err, out) {
      var resultObj = {err: err, test: test[0]};
      testSummarize.processed++;
      app.cli.progress(testSummarize.processed / testSummarize.total);
      if (err) {
        return done(null, resultObj);
      }
      resultObj.got = out;
      resultObj.expected = undefined;
      resultObj.success = false;
      if (test.length === 2) {
        readJsonFile(test[1], function (err, expected) {
          if (err) {
            resultObj.err = {readingExpectedOutput: err};
          } else {
            resultObj.expected = expected;
            if (JSON.stringify(expected) === JSON.stringify(out)) {
              resultObj.success = true;
            }
          }
          done(null, resultObj);
        });
      } else {
        done(null, resultObj);
      }
    }

    jsappExec.run(
      app.config.get('root-dir') + '/.v8boinc',
      bundledObj.bundledMainJs,
      test[0],
      judge
    );
  }

  function demistifyTestResult(result, done) {
    var key;
    app.cli.info(dashes);
    if (result.err) {
      app.cli.error('test ' + fh.rel(result.test) + ' crashed.');
      testSummarize.crashed++;
      for (key in result.err) {
        if (result.err.hasOwnProperty(key) && result.err[key]) {
          app.cli.error(result.err[key]);
        }
      }
    } else if (result.expected === undefined) {
      app.cli.error('test ' + fh.rel(result.test) + ' misses expected output.');
      if (!app.options.save) {
        testSummarize.failed++;
        app.cli.info('use --save option to save this result as expected');
      } else {
        testSummarize.success++;
        fs.writeFile(
          getOutNameFromIn(result.test),
          JSON.stringify(result.got),
          function (err) {
            if (err) {
              app.cli.error("couldn't write test output to file: " + err);
            } else {
              app.cli.ok(
                fh.rel(getOutNameFromIn(result.test))
                  + " written due to --save"
              );
            }
          }
        );
      }
      if (!app.options.suppress) {
        app.cli.info('got result:');
        app.cli.info(result.got);
      }
    } else if (result.success === false) {
      testSummarize.failed++;
      app.cli.error('test ' + fh.rel(result.test) + ' failed.');
      if (!app.options.suppress) {
        app.cli.info('got result:');
        app.cli.info(result.got);
        app.cli.info('expected result:');
        app.cli.info(result.expected);
      }
    } else {
      testSummarize.success++;
      app.cli.ok(fh.rel(result.test) + ' ok.');
    }
    if (result.got) {
      fs.writeFile(
        app.config.get('root-dir')
          + '/.v8boinc/test-results/'
          + path.basename(getOutNameFromIn(result.test)),
        JSON.stringify(result.got, null, 2),
        done
      );
    } else {
      done();
    }
  }

  function runTests(err, tests) {
    var limit = app.options.limit;
    if (err) {
      return app.cli.fatal(err);
    }
    testSummarize.total = tests.length;

    function getChainedMap(processor) {
      return function (done) {
        async.mapLimit(tests, limit, processor, function (err, result) {
          if (err) {
            return done(err);
          }
          tests = result;
          done();
        });
      };
    }

    app.cli.info("running " + tests.length
                 + " tests using --limit=" + limit + " concurrency.");
    app.cli.progress(0);
    async.series(
      [
        getChainedMap(getTestPair),
        getChainedMap(runTest),
      ],
      function (err) {
        if (err) {
          return onFinish(err);
        }
        async.eachSeries(tests, demistifyTestResult, function (err) {
          if (err) {
            onFinish(err);
          }
          app.cli.info(dashes);
          if (testSummarize.failed || testSummarize.success) {
            app.cli.info('test outputs written to .v8boinc/test-results/');
          }
          onFinish(null, testSummarize);
        });
      }
    );
  }

  (function () {
    var pattern;
    if (app.args.length) {
      pattern = app.args;
    } else {
      pattern = app.config.get('root-dir') + '/test/*.in.json';
    }
    exploreFiles(pattern, app.cli.info, runTests);
  }());
};
