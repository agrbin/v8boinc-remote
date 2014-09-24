/*jslint indent: 2, plusplus: true*/
"use strict";

// TODO: makni sto netreba.
var hd = require('heredoc'),
  fs = require('fs'),
  path = require('path'),
  exec = require('child_process').exec,
  async = require('async'),
  fh = require('./FileHelper.js'),
  estimate = require('./estimate.js'),
  test = require('./test.js'),
  common = require('./common.js'),
  defaults = require('./defaults.js');

module.exports.usage = hd(function () {/*
v8boinc run

  This command will do the following things:
    - run unit tests in test/ on the current application snapshot
    - determine rsc_fpops_est based on the 1% of execution of first input/ file
    - submit all the input files together with bundled application to v8boinc
    - wait for all results to return and write them to output/
      results that didn't crash will be named as *.out.json, while crashed
      results will have *.error filename.

  If you hit Ctrl+C (send SIGTERM) to this process while there are pending
  results, all submitted jobs will be canceled on server.
*/});

module.exports.main = function (app, done) {
  var batch = null,
    status = {submitted: 0, processed: 0, success: 0, error : 0},
    waitInterval = null;

  app.cli.info("--> v8boinc run");

  if (app.args.length !== 0) {
    return app.cli.fatal("this command takes no arguments");
  }

  function getPattern() {
    return app.config.get('root-dir')
        + (app.options.gzipped ? '/input/*.in.json.gz' : '/input/*.in.json');
  }

  function addHold(callback) {
    app.options.hold = true;
    callback();
  }

  function humanError(err) {
    return err.explain + "\n-----------\n"
        + err.stderr_out + "\n----------\n"
        + JSON.stringify({
          exit_status : err.exit_status,
          elapsed_time : err.elapsed_time,
          cpu_time : err.cpu_time,
          error_resultid : err.error_resultid
        }, null, 2) + "\n";
  }

  function checkOutputEmpty(callback) {
    var dir = app.config.get('root-dir') + '/output';
    fs.readdir(dir, function (err, files) {
      if (err) {
        app.cli.info("can't read output/. where will I put the results?!");
        return callback(err);
      }
      files = files.filter(function (file) {
        return file.substr(-9) === '.out.json' || file.substr(-6) === '.error';
      });
      if (files.length) {
        return callback("backup and empty " + fh.rel(dir) + "/ first");
      }
      callback();
    });
  }

  function getResultWriter(inputPath) {
    var basename = path.basename(inputPath,
        (app.options.gzipped ? ".in.json.gz" : ".in.json")),
      outputDir = app.config.get('root-dir') + '/output/',
      basePath = outputDir + basename;
    return function (err, out, callback) {
      // only if we succeed in writing log to disk, we may increment
      // status counters.
      function done(fserr) {
        if (!fserr) {
          status.processed++;
          (err ? status.error++ : status.success++)
        }
        callback(fserr);
      }
      if (err) {
        fs.writeFile(basePath + '.error', humanError(err), done);
      } else {
        fs.writeFile(basePath + '.out.json',
                      JSON.stringify(out, null, 2) + "\n",
                      done);
      }
    };
  }

  function submit(callback) {
    batch = app.v8b.newBatch();

    function stageFile(path, gzipped, done) {
      var desc, mode = 'path', dir = null, url = null;
      if (app.options.publicdir) {
        mode = "semilocal";
        dir = app.options.publicdir.dir;
        url = app.options.publicdir.url
      }
      fh.stageFile(mode, dir, url, path, gzipped, done);
    }

    function addJob(path, callback) {
      async.series([
        stageFile.bind(null, app.bundle.bundledMainJs, false),
        stageFile.bind(null, path, app.options.gzipped),
      ], function (err, results) {
        if (err) {
          return callback(err);
        }
        batch.addJob(
          results[0],
          results[1],
          Math.max(1000, app.config.get('estimated-fpops')),
          getResultWriter(path)
        );
        callback();
      });
    }

    fh.exploreFiles(getPattern(), app.cli.info, function (err, files) {
      if (err) {
        return callback(err);
      }
      app.cli.info(files.length + " tasks to submit...");
      async.series([
        async.eachSeries.bind(null, files, addJob),
        batch.submit.bind(null, app.cli.progress)
      ], function (err, results) {
        status.submitted = err ? 0 : results[1];
        callback(err);
      });
    });
  }

  function submitSuccess(callback) {
    app.cli.ok(status.submitted + " tasks submitted.");
    var received = false;

    process.on('SIGINT', function () {
      app.cli.info("^C received.");
      if (received) {
        app.cli.info("killed. did you left large amount of jobs on server?");
        process.exit(1);
      } else {
        received = true;
      }
      app.cli.info("aborting ongoing batches.. (again to kill)");
      clearInterval(waitInterval);
      batch.abortAll(function (err) {
        if (err) {
          app.cli.info("while trying to cancel ongoing batches.");
          app.cli.error(err);
        } else {
          app.cli.info("aborted ongoing batches.");
        }
      });
    });
    callback();
  }

  function wait(callback) {
    app.cli.info("waiting for task results...");
    waitInterval = setInterval(function () {
      app.cli.progress(batch.getFractionDone());
      if (status.submitted === status.processed) {
        clearInterval(waitInterval);
        callback();
      }
    }, defaults.waitIntervalMs);
  }

  function showStatus(callback) {
    if (status.error) {
      app.cli.error(status.error + " tasks returned error.");
    }
    if (status.success) {
      app.cli.ok(status.success + " tasks completed.");
    }
    if (status.processed) {
      app.cli.info("look in "
                    + fh.rel(app.config.get('root-dir') + '/output')
                    + "/ for results.");
    }
    callback();
  }

  function checkPublicdirOk(callback) {
    var desc, url, dir;
    if (app.options.publicdir) {
      desc = app.options.publicdir.split(':');
      if (desc.length < 2) {
        callback("publicdir must be of format dir:url");
      }
      dir = desc[0];
      url = desc.slice(1).join(':');
      dir += (dir.substr(-1) == '/' ? '' : '/');
      if (url.substr(-1) !== '/') {
        app.cli.info("WARN: your url dosen't end with /");
      }
      app.cli.info("testing if publicdir is reachable");
      app.options.publicdir = {dir: dir, url: url};
      fh.checkPublicDirReachable(app, dir, url, function (err) {
        if (err) {
          app.cli.fatal(err);
        } else {
          app.cli.ok(
            "using " + dir + " == " + url + " for file upload"
          );
        }
        callback(err);
      });
    } else {
      callback();
    }
  }

  function configGzipToOptions(callback) {
    if (app.options.gzipped && !app.config.get('gzipped', false, true)) {
      app.cli.info("hint: you may add --gzipped into app.json, with "
          + " { gzipped : true }, field");
    } else if (app.config.get('gzipped', false, true)) {
      app.options.gzipped = true;
    }
    callback();
  }

  async.series(
    [
      common.requireAppConfig.bind(null, app),
      configGzipToOptions,
      checkOutputEmpty,
      checkPublicdirOk,
      common.requireV8Boinc.bind(null, app, true),
      test.main.bind(null, app),
      addHold,
      estimate.main.bind(null, app),
      submit,
      submitSuccess,
      wait,
      showStatus
    ],
    function (err) {
      if (err) {
        return done(err);
      }
      if (status.error) {
        return done("some tasks returned error.");
      }
      if (!status.success) {
        return done("not one of the task returend successfully.."
                   + " not one of them!");
      }
      done();
    }
  );
};

