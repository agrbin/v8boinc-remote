/*jslint indent: 2, plusplus: true*/
"use strict";

var di = require('./DI.js'),
  defaults = di.get('./defaults.js');

function V8BoincWaiter(
  gateway,
  jobCallbacks,
  activeBatches,
  log,
  warn
) {
  var mainLoop,
    mainLoopTimer,
    N = Object.keys(jobCallbacks).length;

  this.getFractionDone = function () {
    return 1 - (Object.keys(jobCallbacks).length / N);
  };

  this.abortAll = function (done) {
    var id,
      errors = [],
      left = Object.keys(activeBatches).length;
    function almostDone(err) {
      if (err) {
        errors.push(err);
      }
      if (--left === 0) {
        done(errors.length ? errors.join() : null);
      }
    }
    warn("sending kill batch to all batches.");
    for (id in activeBatches) {
      if (activeBatches.hasOwnProperty(id)) {
        gateway.killBatch(id, almostDone);
      }
    }
    clearTimeout(mainLoopTimer);
    if (!left) {
      done();
    }
  };

  /*
   * [ wu_v8boinc_remote_0049419950: '189',
   *   wu_v8boinc_remote_1527669958: '189',
   *     wu_v8boinc_remote_8190691398: '189' ]
   */
  function checkJobsForErrors(jobsToCheck, done) {
    var jobNames = Object.keys(jobsToCheck),
      iterator = -1,
      callbacksToDelete = [],
      iterate,
      errd = 0;

    function onDetails(err, job) {
      var callback = jobCallbacks[jobNames[iterator]];
      if (err) {
        warn(err);
      } else if (job.error_resultid) {
        ++errd;
        callback(job, null);
        callbacksToDelete.push(jobNames[iterator]);
        activeBatches[jobsToCheck[jobNames[iterator]]]--;
      }

      iterate();
    }

    iterate = function () {
      if (++iterator === jobNames.length) {
        callbacksToDelete.map(function (name) {
          delete jobCallbacks[name];
        });
        done(errd);
      } else {
        log("checking job for error " + jobNames[iterator] + "..");
        gateway.getJobDetails(jobNames[iterator], onDetails);
      }
    };

    iterate();
  }

  /*
   * [ wu_v8boinc_remote_0049419950: '189',
   *   wu_v8boinc_remote_1527669958: '189',
   *     wu_v8boinc_remote_8190691398: '189' ]
   */
  function downloadResults(results, done) {
    var jobNames = Object.keys(results),
      iterator = -1,
      errors = [],
      success = 0,
      callbacksToDelete = [],
      iterate;

    function onProcessed(err) {
      if (err) {
        errors.push(err);
      } else {
        // don't try to download this result again.
        callbacksToDelete.push(jobNames[iterator]);
        activeBatches[results[jobNames[iterator]]]--;
        success++;
      }

      iterate();
    }

    function onDownload(err, result) {
      var callback = jobCallbacks[jobNames[iterator]];
      if (err) {
        errors.push(err);
        return iterate();
      }
      callback(null, result, onProcessed);
    }

    iterate = function () {
      if (++iterator === jobNames.length) {
        callbacksToDelete.map(function (name) {
          delete jobCallbacks[name];
        });
        done(errors.length ? errors.join() : null, success);
      } else {
        log("downloading " + jobNames[iterator] + "..");
        gateway.getJobResult(jobNames[iterator], onDownload);
      }
    };

    iterate();
  }

  function getResultsToDownload(done) {
    var errors = [],
      batchIds = Object.keys(activeBatches),
      batchIterator = -1,
      resultsToDownload = {},
      jobsToCheck = {},
      iterateBatches;

    function onBatchStatus(err, result, batchStatus) {
      var it, result_id, name, batchId = batchIds[batchIterator];
      if (err) {
        errors.push(err);
      } else {
        for (it = 0; it < result.length; ++it) {
          result_id = Number(result[it].canonical_instance_id);
          name = result[it].name;
          // don't download if there is no callback for it
          if (jobCallbacks.hasOwnProperty(name)) {
            if (result_id > 0) {
              resultsToDownload[name] = batchId;
            } else if (Number(batchStatus.nerror_jobs) && result_id === 0) {
              // this job may be in error state.
              jobsToCheck[name] = batchId;
            }
          }
        }
      }
      iterateBatches();
    }

    iterateBatches = function () {
      if (++batchIterator === batchIds.length) {
        done(
          errors.length ? errors.join() : null,
          resultsToDownload,
          jobsToCheck
        );
      } else {
        gateway.getBatchStatus(batchIds[batchIterator], onBatchStatus);
      }
    };

    iterateBatches();
  }

  function killBatches(ids, done) {
    var iterator = -1, errors = [];
    function iterate() {
      if (++iterator === ids.length) {
        done(errors.length ? errors.join() : null);
      } else {
        gateway.killBatch(ids[iterator], function (err) {
          // log error and continue with iteration
          if (err) {
            errors.push(err);
          }
          iterate();
        });
      }
    }
    iterate();
  }

  function retireBatches(success, moreAwaitingCb) {
    var id, toDelete = [], len = 0;
    if (!success) {
      return moreAwaitingCb();
    }
    for (id in activeBatches) {
      if (activeBatches.hasOwnProperty(id)) {
        if (Number(activeBatches[id]) === 0) {
          toDelete.push(id);
        }
        ++len;
      }
    }
    toDelete.map(function (id) {
      log("batch retired " + id + ".");
      delete activeBatches[id];
      return id;
    });
    killBatches(toDelete, function (err) {
      if (err) {
        // it is ok to continue.
        // it means that resources are not cleaned up on server.
        // we need to clean them manually
        warn(err);
      }
      if (toDelete.length !== len) {
        log("there are still active batches.");
        moreAwaitingCb();
      }
    });
  }

  function scheduleMainLoop() {
    if (mainLoopTimer) {
      clearTimeout(mainLoopTimer);
    }
    mainLoopTimer = setTimeout(mainLoop, defaults.batch_main_loop_interval);
  }

  function finish(err, success) {
    if (err) {
      log("Error: " + err);
      scheduleMainLoop();
    } else {
      retireBatches(success, scheduleMainLoop);
    }
  }

  mainLoop = function () {
    getResultsToDownload(function (err, results, jobsToCheck) {
      if (err) {
        return finish(err);
      }
      if (Object.keys(results).length) {
        log(Object.keys(results).length + " results ready to download.");
      }
      downloadResults(results, function (err, success) {
        if (err) {
          return finish(err);
        }
        if (success) {
          log(success + " results successfully committed.");
        }
        checkJobsForErrors(jobsToCheck, function (errd) {
          finish(null, success + errd);
        });
      });
    });
  };

  scheduleMainLoop();
}

module.exports = V8BoincWaiter;