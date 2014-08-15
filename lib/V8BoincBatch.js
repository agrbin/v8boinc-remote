/*jslint indent: 2, plusplus: true*/
"use strict";

var di = require('./DI.js'),
  defaults = di.get('./defaults.js'),
  InputFile = di.get('./InputFile.js'),
  V8BoincWaiter = di.get('./V8BoincWaiter.js');

/*
 * used to submit multiple jobs with onresult callbacks.
 */
function V8BoincBatch(gateway, logger) {
  var jobQueue = [],
    jobCallbacks = {},
    activeBatches = {},
    waiter;

  function randomName(p) {
    return p + "_v8boinc_remote_" + Math.random().toString().substr(2, 10);
  }

  function log(err) {
    logger && logger(0, err);
  }

  function warn(err) {
    logger && logger(1, err);
  }

  function submitHelper(jobs, done) {
    gateway.submitJobs(jobs, randomName('batch'), function (err, batchId) {
      var it;
      if (err) {
        return done(err);
      }
      batchId = batchId.batch_id;
      activeBatches[batchId] = jobs.length;
      for (it = 0; it < jobs.length; ++it) {
        jobCallbacks[jobs[it].name] = jobs[it].callback;
      }
      done(null);
    });
  }

  function tryToInputFile(file, onResult) {
    if (file instanceof InputFile) {
      return file;
    }
    if (file instanceof Object &&
        file.hasOwnProperty('mode') &&
        file.hasOwnProperty('source')) {
      return new InputFile(file.mode, file.source);
    }
    onResult("can't parse input file " + file);
  }


  /**
   * onResult can be a function that doens't use it's scope.
   * such function would require everything used in place.
   * in that case, we can hibernate batch state to disk and recover.
   */
  this.addJob = function (mainJs, inJson, rsc_fpops_est, onResult) {
    var job = {
      rsc_fpops_est : rsc_fpops_est,
      main_js : tryToInputFile(mainJs),
      in_json : tryToInputFile(inJson),
      name : randomName('wu')
    };
    job.est_size = job.main_js.getSerializedSize()
                  + job.in_json.getSerializedSize();
    if (waiter) {
      return onResult("can't add jobs: already submitted. use another batch");
    }
    jobQueue.push(job);
    job.callback = onResult;
  };

  this.submit = function (onSubmit) {
    var it = -1, submitted = 0, cumSize = 0, toSend = [], errors = [];

    if (waiter) {
      onSubmit("can't submit. already submitted");
    } else {
      waiter = true;
    }

    function send(done) {
      if (!toSend.length) {
        return done();
      }
      submitHelper(toSend, function (err) {
        if (err) {
          errors.push(err);
        } else {
          jobQueue = jobQueue.slice(toSend.length);
          submitted += toSend.length;
          it = -1;
        }
        cumSize = 0;
        toSend = [];
        return done();
      });
    }

    function finish() {
      if (Object.keys(activeBatches).length) {
        waiter = new V8BoincWaiter(
          gateway,
          jobCallbacks,
          activeBatches,
          log,
          warn
        );
      }
      return onSubmit(errors.length ? errors.join() : null, submitted);
    }

    function iterate() {
      if (++it === jobQueue.length) {
        return send(finish);
      }
      toSend.push(jobQueue[it]);
      cumSize += jobQueue[it].est_size;
      if (toSend.length >= defaults.max_jobs_in_batch ||
          cumSize >= defaults.max_files_size_in_batch) {
        send(iterate);
      } else {
        iterate();
      }
    }

    iterate();
  };

  this.getFractionDone = function () {
    if (!(waiter instanceof V8BoincWaiter)) {
      throw "call this only after submit";
    }
    return waiter.getFractionDone();
  };

  this.abortAll = function (done) {
    waiter.abortAll(done);
  };
}

module.exports = V8BoincBatch;

