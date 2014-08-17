/*jslint indent: 2, plusplus: true*/
"use strict";

var di = require('./DI.js'),
  defaults = di.get('./defaults.js'),
  InputFile = di.get('./InputFile.js').InputFile,
  buildInputFiles = di.get('./InputFile.js').buildInputFiles,
  V8BoincWaiter = di.get('./V8BoincWaiter.js'),
  Random = di.get('./RandomEngine.js');

/*
 * used to submit multiple jobs with onresult callbacks.
 */
function V8BoincBatch(gateway, logger) {
  var jobQueue = [],
    jobCallbacks = {},
    activeBatches = {},
    waiter;

  function log(err) {
    if (logger) {
      logger(0, err);
    }
  }

  function warn(err) {
    if (logger) {
      logger(1, err);
    }
  }

  function submitHelper(jobs, done) {
    gateway.submitJobs(jobs, Random.getName('batch_'), function (err, batchId) {
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

  /**
   * onResult can be a function that doens't use it's scope.
   * such function would require everything used in place.
   * in that case, we can hibernate batch state to disk and recover.
   */
  this.addJob = function (mainJs, inJson, rsc_fpops_est, onResult) {
    if (waiter) {
      return onResult("can't add jobs: already submitted. use another batch");
    }
    jobQueue.push({
      rsc_fpops_est : rsc_fpops_est,
      main_js : mainJs,
      in_json : inJson,
      name : Random.getName('wu_'),
      callback : onResult
    });
  };

  this.submit = function (onSubmitCallback, submitProgress) {
    var it = -1, submitted = 0, cumSize = 0, toSend = [], errors = [],
      totalToSubmit = jobQueue.length;

    function onSubmit(err, result) {
      if (err && submitted) {
        warn("some batches already submitted. " +
             JSON.stringify(activeBatches) +
             " clean them manually.");
      }
      onSubmitCallback(err, result);
    }

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
          if (submitProgress) {
            submitProgress(submitted / totalToSubmit);
          }
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

    function buildJobInputFiles(it, done) {
      var job = jobQueue[it];
      buildInputFiles([job.main_js, job.in_json], function (err, files) {
        if (err) {
          return done(err);
        }
        job.main_js = files[0];
        job.in_json = files[1];
        job.est_size = files[0].getSerializedSize() +
          files[1].getSerializedSize();
        done(null, job);
      });
    }

    function iterate() {
      if (++it === jobQueue.length) {
        return send(finish);
      }
      buildJobInputFiles(it, function (err, job) {
        if (err) {
          return onSubmit(err);
        }

        toSend.push(job);
        cumSize += job.est_size;
        if (toSend.length >= defaults.max_jobs_in_batch ||
            cumSize >= defaults.max_files_size_in_batch) {
          send(iterate);
        } else {
          iterate();
        }
      });
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

