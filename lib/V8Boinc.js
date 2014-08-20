/*jslint indent: 2, plusplus: true*/
"use strict";

var di = require('./DI.js'),
  defaults = di.get('./defaults.js'),
  xml = di.get('./XmlHelper.js'),
  md5 = di.get('MD5'),
  InputFile = di.get('./InputFile.js'),
  V8BoincBatch = di.get('./V8BoincBatch.js'),
  request = di.get('request');

/*

interface:

  .initialize(done)

  .submitJobs(jobs, batchName, onSubmit)

  .getActiveBatches(done)
  .getBatchStatus(batchId, done)
  .getJobDetails(jobName, done)
  .getJobResult(jobName, done);

  .abortBatch(batchId, done)
  .killBatch(batchId, done)

  .getLatestExecutable(platform, done)
  .getCodeSignPublicKey(done)

  .newBatch()
    .addJob(mainJs, inJson, rsc_fpops_est, done)
    .submit(onSubmit)
    .getFractionDone()

 sniffer(isRequest, body)
*/

module.exports = function (options, sniffer, logger) {
  var that = this;

  function sniff(isRequest, body) {
    if (sniffer) {
      sniffer(isRequest, body);
    }
  }

  /*
   * simple xml object will have unique keys but values will be 1 element arrays.
   * strip out arrays
   */
  function simplifyXmlObject(obj) {
    var key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = obj[key][0];
      }
    }
    return obj;
  }

  function downloadUrl(url, done) {
    sniff(true, options.project + url);
    request(
      options.project + url,
      function (err, response, body) {
        var parsed;
        sniff(false, body);
        if (err) {
          return done(err);
        }
        try {
          parsed = JSON.parse(body);
        } catch (ex) {
          return done(
            "couldn't parse out.json " + ex + "response: "
              + JSON.stringify(response)
          );
        }
        done(null, parsed);
      }
    );
  }

  function doHttp(body, done) {
    sniff(true, body);
    request.post(
      options.project + defaults.rpc_handler_path,
      { form: {request: body} },
      function (err, response, body) {
        sniff(false, body);
        if (err) {
          return done(err, response);
        }
        xml.fromXml(body, function (err, data) {
          if (err) {
            return done("coludnt parse response xml: "
                        + err + "\n\n, original: " + body);
          }
          if (data.hasOwnProperty('error')) {
            return done(simplifyXmlObject(data.error));
          }
          return done(null, data);
        });
      }
    );
  }

  function buildRequestXml(rootName, payloadKey, payloadValue) {
    var obj = { authenticator : options.authenticator };
    if (payloadKey) {
      obj[payloadKey] = payloadValue;
    }
    return xml.toXmlSynced(obj, rootName);
  }

  /**
   * [ { id: '23731',
   *   name: 'job_2458247547',
   *   canonical_instance_id: '0',
   *   n_outfiles: '1' },
   *   { id: '23732',
   *   name: 'job_9895339508',
   *   canonical_instance_id: '26987',
   *   n_outfiles: '1' },
   *   { id: '23733',
   *   name: 'job_4180160199',
   *   canonical_instance_id: '26988',
   *   n_outfiles: '1' } ]
   */
  this.getBatchStatus = function (batchId, done) {
    doHttp(
      buildRequestXml('query_batch', 'batch_id', batchId),
      function (err, result) {
        if (err) {
          return done(err);
        }
        done(null, result.batch.job.map(simplifyXmlObject), {
          nerror_jobs: result.batch.nerror_jobs[0],
          fraction_done: result.batch.fraction_done[0],
          credit_estimate: result.batch.credit_estimate[0]
        });
      }
    );
  };

  this.getJobDetails = function (jobName, done) {
    doHttp(
      buildRequestXml('query_completed_job', 'job_name', jobName),
      function (err, result) {
        if (err) {
          return done(err);
        }
        done(null, simplifyXmlObject(result.completed_job));
      }
    );
  };

  // this job should be returned from getBatchStatus
  this.getJobResult = function (jobName, done) {
    downloadUrl(
      "/get_output.php?cmd=workunit_file&wu_name="
        + jobName + "&file_num=0&auth_str="
        + options.authenticator,
      done
    );
  };

  this.submitJobs = function (jobs, batch_name, done) {
    function serializeJob(job) {
      var est = job.rsc_fpops_est;
      if (!job.hasOwnProperty('name')) {
        return "job should have name!";
      }
      if (!est || typeof est !== 'number' || est < 100 || est > 1e20) {
        return "job should have numberic rsc_fpops_est property elem [100, 1e20]";
      }
      if (!(job.in_json instanceof InputFile.InputFile)) {
        return "job.in_json should be instance of InputFile";
      }
      if (!(job.main_js instanceof InputFile.InputFile)) {
        return "job.main_js should be instance of InputFile";
      }
      return {
        rsc_fpops_est : est,
        name : job.name,
        input_files : [
          job.main_js.toObject(),
          job.in_json.toObject()
        ]
      };
    }
    doHttp(
      buildRequestXml('submit_batch', 'batch', {
        app_name : options.app_name,
        batch_name : batch_name,
        jobs : jobs.map(serializeJob)
      }),
      done
    );
  };

  /*
  1: in progress
  2: completed (all jobs either succeeded or had fatal errors)
  3: aborted
  4: retired
  */
  this.getActiveBatches = function (done) {
    function active(batch) {
      return batch.state !== '4';
    }
    function prettify(batch) {
      var it,
        nums = ['id', 'njobs', 'fraction_done', 'nerror_jobs',
          'credit_estimate', 'credit_canonical', 'create_time',
          'expire_time', 'est_completion_time', 'completion_time'],
        stateMap = {
          1: 'in_progress',
          2: 'completed',
          3: 'aborted',
          4: 'retired'
        };
      for (it = 0; it < nums.length; ++it) {
        batch[nums[it]] = Number(batch[nums[it]]);
      }
      batch.state = stateMap[batch.state];
      return batch;
    }
    doHttp(
      buildRequestXml('query_batches'),
      function (err, result) {
        if (err) {
          return done(err);
        }
        done(
          null,
          result.batches.batch
            .map(simplifyXmlObject)
            .filter(active)
            .map(prettify)
        );
      }
    );
  };

  this.abortBatch = function (batchId, done) {
    doHttp(
      buildRequestXml('abort_batch', 'batch_id', batchId),
      function (err) {
        if (err) {
          return done(err);
        }
        done(null);
      }
    );
  };

  this.killBatch = function (batchId, done) {
    that.abortBatch(batchId, function (err) {
      if (err) {
        return done(err);
      }
      doHttp(
        buildRequestXml('retire_batch', 'batch_id', batchId),
        function (err) {
          if (err) {
            return done(err);
          }
          done(null);
        }
      );
    });
  };

  this.initialize = function (done) {
    doHttp(
      buildRequestXml('submit_batch', 'batch', {
        app_name : options.app_name,
        batch_name : 'test credentials',
        jobs : []
      }),
      function (err) {
        if (err.error_msg === 'trying to submit empty batch') {
          done(null);
        } else {
          done(err.hasOwnProperty('error_msg') ?
               err.error_msg : err);
        }
      }
    );
  };

  this.newBatch = function () {
    return new V8BoincBatch(that, logger);
  };

  this.getCodeSignPublicKey = function (done) {
    doHttp(
      buildRequestXml('get_code_sign_public_key', 'foo', 'bar'),
      function (err, data) {
        if (err) {
          return done(err);
        }
        done(null, data.public_key);
      }
    );
  };

  this.getLatestExecutable = function (platform, done) {
    doHttp(
      buildRequestXml('get_jsapp_executable', 'platform', platform),
      function (err, data) {
        var it, file;
        if (err) {
          return done(err);
        }
        data = data.latest_version;
        for (it = 0; it < data.file_info.length; ++it) {
          if ('executable' in data.file_info[it]) {
            file = simplifyXmlObject(data.file_info[it]);
          }
        }
        file.file_signature_openssl = data.file_signature_openssl[0].trim();
        return done(
          file ? null : "object return doesn't contain executable descriptors",
          file
        );
      }
    );
  };

  (function () {
    if (typeof options !== 'object') {
      throw "options should be object";
    }

    options.project = options.project || defaults.project;
    options.app_name = options.app_name || defaults.app_name;
  }());

};

