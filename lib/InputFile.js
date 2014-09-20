/*jslint indent: 2, plusplus: true*/
"use strict";

var di = require('./DI.js'),
  fs = di.get('fs');

function InputFile(mode, source, gzipped, md5) {
  this.data = {
    mode: mode,
    source: source,
    gzipped: gzipped ? true : false,
    md5: md5 ? md5 : false,
  };
}

InputFile.prototype.toObject = function () {
  return this.data;
};

InputFile.prototype.getSerializedSize = function () {
  return this.data.source.toString().length;
};

var possibleModes = {
  path : "load file from disk and send it inline",
  json : "stringify given object and send it inline",
  string : "send this string inline",
  function : "renames function to 'main' and sends it's body inline",
  local : "file is on remote v8boinc server",
  local_staged : "file is staged on remote v8boinc server",
  semilocal : "file can be fetched from remote v8boinc server",
  inline : "send this string. you must base64 encode yourself.",
  remote : "file will be fetched by clients from url"
};

/*
 * from http://boinc.berkeley.edu/trac/wiki/RemoteJobs
 *
 * local: the file is on the BOINC server and is not staged. It's specified by
 * its full path.
 * 
 * local_staged: the filed has been staged on the BOINC server. It's specified
 * by its physical name.
 *
 * semilocal: the file is on a data server that's accessible to the BOINC server
 * but not necessarily to the outside world. The file is specified by its URL.
 * It will be downloaded by the BOINC server during job submission, and served
 * to clients from the BOINC server.
 * 
 * inline: the file is included in the job submission request XML message. It
 * will be served to clients from BOINC server. source must be base64 encoded
 * version of the file
 *
 * remote: the file is on a data server other than the BOINC server, and will
 * be served to clients from that data server. It's specified by the URL, the
 * file size, and the file MD5.
 *
 * mine!
 * 
 * path: the file is on this server from which this script is run. file will be
 * loaded into memory synced and it will be served as inline.
 *
 * function
 * json
 */

function buildInputFile(template, semiDone) {
  var mode, value;

  function done(err, result) {
    if (err) {
      return semiDone(err);
    }
    if (template.hasOwnProperty('gzipped')) {
      result.toObject().gzipped = true;
    }
    if (template.hasOwnProperty('md5')) {
      result.toObject().md5 = template.md5;
    }
    semiDone(null, result);
  }

  function toBase64(str) {
    return new Buffer(str).toString('base64');
  }

  function report(msg) {
    done("coludn't construct input file from template "
         + JSON.stringify(template)
         + ". error: " + msg);
  }

  function construct(mode, source) {
    return new InputFile(mode, source);
  }

  function checkFunction(x) {
    if (!(x instanceof Function)) {
      return report("function value is not a function");
    }
    if (x.name !== 'main') {
      return report("function name should be 'main'");
    }
    return true;
  }

  function loadFile(path, onSuccess) {
    fs.readFile(path, {encoding : 'base64'}, function (err, data) {
      if (err) {
        return report(err);
      }
      onSuccess(data);
    });
  }

  function getUsedMode() {
    var key;
    if (!(template instanceof Object && typeof template === 'object')) {
      return report("template should be plain object!");
    }
    for (key in possibleModes) {
      if (possibleModes.hasOwnProperty(key)) {
        if (template.hasOwnProperty(key)) {
          return key;
        }
      }
    }
    report("template doesn't have key that matches any possible mode");
  }

  mode = getUsedMode();
  if (typeof mode !== 'string') {
    return;
  }
  value = template[mode];

  switch (mode) {
  case 'path':
    return loadFile(value, function (base64Data) {
      return done(null, construct(
        'inline',
        base64Data
      ));
    });
  case 'string':
    return done(null, construct(
      'inline',
      toBase64(value)
    ));
  case 'json':
    return done(null, construct(
      'inline',
      toBase64((JSON.stringify(value)))
    ));
  case 'function':
    return checkFunction(value) && done(null, construct(
      'inline',
      toBase64(value.toString())
    ));
  case 'local':
  case 'local_staged':
  case 'semilocal':
  case 'inline':
  case 'remote':
    return typeof value === 'string' ?
        done(null, construct(mode, value)) :
        report("type of mode value should be string!");
  }
}

function buildInputFiles(templates, done) {
  var it = -1, errors = [], results = [];

  function iterate() {
    if (++it === templates.length) {
      return done(errors.length ? errors : null, results);
    }
    buildInputFile(templates[it], function (err, result) {
      if (err) {
        errors.push(err);
      } else {
        results.push(result);
      }
      iterate();
    });
  }

  iterate();
}


module.exports.InputFile = InputFile;
module.exports.buildInputFile = buildInputFile;
module.exports.buildInputFiles = buildInputFiles;
module.exports.possibleModes = possibleModes;
