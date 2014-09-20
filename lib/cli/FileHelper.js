/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  path = require('path'),
  async = require('async'),
  crypto = require('crypto'),
  glob = require('glob');

function isFile(file, done) {
  fs.exists(file, done);
}

function rel(file) {
  return path.relative(process.cwd(), file);
}

function MD5File(file, callback) {
  var stream = fs.createReadStream(file),
    hash = crypto.createHash('md5');
  hash.setEncoding('hex');
  stream.on('error', callback);
  stream.on('end', function () {
    hash.end();
    return callback(null, hash.read());
  });
  stream.pipe(hash);
};

module.exports.isFile = isFile;
module.exports.rel = rel;
module.exports.MD5File = MD5File;

// dir is public dir visible on url url.
module.exports.stageFile = function (
  mode, dir, url, file, inputGzipped, semiCallback
) {
  var md5file = file.substr(0, file.length - 3) + '.md5',
    md5 = null;

  function callback(err, result) {
    if (err) {
      return semiCallback(err);
    }
    if (inputGzipped) {
      result["gzipped"] = true;
    }
    return semiCallback(null, result);
  }

  if (mode === 'path') {
    return callback(null, {path: file});
  }

  if (inputGzipped && fs.existsSync(md5file)) {
    md5 = fs.readFileSync(md5file).toString().trim();
  }

  async.series([
    fs.stat.bind(null, file),
    (md5 ? function (cb) {cb();} : MD5File.bind(null, file)),
  ], function (err, results) {
    var targetLink, name, ret = {};
    if (err) {
      return callback(err);
    }
    if (md5) {
      results[1] = md5;
    }
    name = "mf_" + results[1];
    url += (url.substr(-1) === '/' ? '' : '/') + name;

    if (mode === 'remote') {
      ret[mode] = {
        url: url,
        nbytes: results[0].size,
        md5: results[1],
      };
    } else {
      ret[mode] = url;
    }

    targetLink = path.resolve(dir + "/" + name);
    fs.lstat(targetLink, function (err, result) {
      async.series([
        (result && result.isSymbolicLink()) ?
          function (callback) {callback();} :
          fs.symlink.bind(null, file, targetLink, callback),
      ], function (err, result) {
        if (err) {
          console.log("make sure that target dir exists.");
          return callback(err);
        } else {
          return callback(null, ret);
        }
      });
    });
  });
};

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
