/*jslint indent: 2, plusplus: true*/
"use strict";

var hd = require('heredoc'),
  async = require('async'),
  common = require('./common.js'),
  defaults = require('./defaults.js'),
  fh = require('./FileHelper.js'),
  jsappExec = require('./jsappExec.js'),
  Bundle = require('./Bundle.js'),
  benchmark = require('./benchmark.js');

module.exports.usage = hd(function () {/*
v8boinc estimate [input-files]

  This command will create bundle and run the application on first input file in input/ dir or file name in command line argument. Execution will be stopped when boinc_fraction_done is called with argument equal or larger than 0.01.

  Estimated processing power will be determined based on above running time and
 based on benchmarks for this machine.
*/});

module.exports.main = function (app, done) {
  var bundledObj;

  app.cli.info("--> v8boinc estimate");

  function extrapolate(err, duration, done) {
    var matches = err.stderrTxt.match(/__v8boinc__bfd__\|([.0-9]+)\|/),
      p;
    if (duration < 1000) {
      app.cli.info("WARN: test went too fast. estimate may be wrong");
    }
    if (!matches) {
      done(
        "test crashed from some other reason "
          + "than boinc_fraction_done passed threshold"
      );
    }
    p = Number(matches[1]);
    p = duration / p / 1000;
    app.cli.info("estimate running time is "
                + Math.round(p) + "s");
    done(null, app.config.get('machine-fpops') * p);
  }

  function runOne(file, done) {
    var timer = new Date().getTime();
    app.cli.info('running 1% of bundled main with input '
                  + fh.rel(file) + "...");

    app.cli.progress(0);
    function onProgress(fraction) {
      app.cli.progress(fraction);
    }

    jsappExec.run(
      app.config.get('root-dir') + '/.v8boinc',
      bundledObj.bundledMainJs,
      file,
      onProgress,
      function (err) {
        app.cli.progress(1);
        if (!err) {
          return done(
            "you must call boinc_fraction_done(x), where x >= 0.01 eventually"
          );
        }
        extrapolate(err, new Date().getTime() - timer, done);
      },
      app.cli.info
    );
  }

  function isItOk(fpops) {
    var best = "use workload between 2e9 and 1e11 for best results";
    if (fpops < 2e9) {
      app.cli.info("WARN: estimated fpops too small. " + best);
    }
    if (fpops > 1e11) {
      app.cli.info("WARN: estimated fpops too large. " + best);
    }
    return Math.round(fpops / 1e8) * 1e8;
  }

  function average(list) {
    var it, sum = 0;
    for (it = 0; it < list.length; ++it) {
      sum += list[it];
    }
    return isItOk(Math.round(sum / list.length));
  }

  function run(err, files) {
    if (err) {
      return app.cli.fatal(err);
    }
    // use just first file.
    files = files.slice(0, 1);
    async.mapSeries(files, runOne, function (err, result) {
      var est;
      if (err) {
        return app.cli.fatal(err);
      }
      est = average(result);
      app.config.set('estimated-fpops', est);
      app.cli.info('estimated workload is ' + est + ' floating point ops');
      app.cli.ok(
        "required estimated number of operations written to app.json"
      );
      done();
    });
  }

  function onBundle(err, bundled) {
    bundledObj = bundled;
    if (err) {
      return app.cli.fatal(err);
    }
    var pattern;
    if (app.args.length) {
      pattern = app.args;
    } else {
      pattern = app.config.get('root-dir') + '/input/*.in.json';
    }
    fh.exploreFiles(pattern, app.cli.info, run);
  }

  function boinc_fraction_done(arg) {
  }

  common.requireAppConfig(app, function () {
    app.options.preJs = hd(function () {/*
      var __v8boinc_bp = boinc_fraction_done;
      var boinc_fraction_done = function (arg) {
        if (arg >= 0.01) {
          throw "__v8boinc__bfd__|" + arg.toString() + "|";
        }
        __v8boinc_bp(arg * 100);
      }
    */});

    app.options.mainName = 'main.1p.js';
    if (!app.config.get('machine-fpops')) {
      app.cli.info("benchamrk was not run yet. invoking 'v8boinc benchmark'");
      benchmark.main(app, function () {
        return new Bundle(app, onBundle);
      });
    } else {
      return new Bundle(app, onBundle);
    }
  });
};
