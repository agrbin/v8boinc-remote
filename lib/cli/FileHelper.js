/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  path = require('path'),
  async = require('async'),
  glob = require('glob');

function isFile(file, done) {
  fs.exists(file, done);
}

function rel(file) {
  return path.relative(process.cwd(), file);
}

module.exports.isFile = isFile;
module.exports.rel = rel;

module.exports.readJsonFile = function (file, done) {
  fs.readFile(file, {encoding : 'ascii'}, function (err, data) {
    var parsed;
    if (err) {
      return done({type: 0, err: err});
    }
    try {
      parsed = JSON.parse(data);
    } catch (ex) {
      return done({type: 1, err: ex});
    }
    done(null, parsed);
  });
};

// pattern may be list of files or glob string
// onResult will be called with error on error or if no files
// were found.
// result is array of file names relative to cwd
module.exports.exploreFiles = function (pattern, logInfo, onResult) {
  var solutions = [];

  function info(msg) {
    if (logInfo) {
      logInfo(msg);
    }
  }

  function processGlob(done) {
    glob(pattern, function (err, files) {
      if (err) {
        return done(err);
      }
      solutions = files;
      done();
    });
  }

  function processList(done) {
    async.each(
      pattern,
      function (file, done) {
        isFile(file, function (exists) {
          if (exists) {
            solutions.push(path.resolve(file));
          } else {
            info("file '" + file + "' from pattern doesn't exists");
          }
          done(null);
        });
      },
      done
    );
  }

  function onProcessed(err) {
    if (err) {
      return onResult(err);
    }
    if (solutions.length) {
      onResult(null, solutions);
    } else {
      onResult("there are no files matching the pattern "
                + pattern + ".");
    }
  }

  if (typeof pattern === 'string') {
    return processGlob(onProcessed);
  }
  if (pattern instanceof Array) {
    return processList(onProcessed);
  }
  onResult('pattern should be string or array');
};
