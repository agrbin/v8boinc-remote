/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  request = require('request'),
  path = require('path'),
  async = require('async'),
  crypto = require('crypto'),
  glob = require('glob');

// async friendly version of exists
function isFile(file, done) {
  fs.exists(file, done.bind(this, null));
}

function rel(file) {
  return path.relative(process.cwd(), file);
}

function MD5File(file, md5file, callback) {
  fs.exists(md5file, function (result) {
    if (result) {
      async.waterfall([
        fs.readFile.bind(null, md5file),
        function (ret, callback) {callback(null, ret.trim());}
      ], callback);
    } else {
      var stream = fs.createReadStream(file),
        hash = crypto.createHash('md5');
      hash.setEncoding('hex');
      stream.on('error', callback);
      stream.on('end', function () {
        hash.end();
        return callback(null, hash.read());
      });
      stream.pipe(hash);
    }
  });
};

module.exports.isFile = isFile;
module.exports.rel = rel;
module.exports.MD5File = MD5File;

// dir is public dir visible on url url.
module.exports.stageFile = function (
  mode, dir, url, file, inputGzipped, callback
) {
  if (mode === 'path') {
    return callback(null, {
      path: file,
      gzipped: inputGzipped,
    });
  }

  function getMD5File(file) {
    return (inputGzipped ?
      file.substr(0, file.length - 3) + '.md5' :
      file + '.md5');
  }

  async.waterfall([
    MD5File.bind(null, file, getMD5File(file)),
    function statFile(md5, callback) {
      var name, ret;
      md5 = md5.trim();
      name = "mf_" + md5;
      ret = {
        md5: md5,
        basename: name,
        url: url + name,
        linkname: path.resolve(path.resolve(dir + name)),
      };
      fs.stat(file, function (err, result) {
        ret.stat = result;
        callback(err, ret);
      });
    },
    function checkLinkIsHealthy(ret, callback) {
      async.series([
        fs.lstat.bind(null, ret.linkname),
        isFile.bind(null, ret.linkname),
      ], function (err, r) {
        ret.linkexists = !err && r[0].isSymbolicLink();
        ret.linkok = ret.linkexists && r[1];
        callback(null, ret);
      });
    },
    function deleteUnhealthyLink(ret, callback) {
      if (ret.linkexists && !ret.linkok) {
        fs.unlink(ret.linkname, function (err) {
          ret.linkexists = false;
          callback(err, ret);
        });
      } else {
        callback(null, ret);
      }
    },
    function createSymlink(ret, callback) {
      if (!ret.linkexists) {
        fs.symlink(file, ret.linkname, function (err) {
          callback(err, ret);
        });
      } else {
        callback(null, ret);
      }
    },
  ], function (err, ret) {
    if (err) {
      return callback(err);
    }
    var sol = {
      url: ret.url,
      gzipped: inputGzipped,
      nbytes: ret.stat.size,
      md5: ret.md5,
    };
    sol[mode] = sol.url;
    callback(null, sol);
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
        isFile(file, function (err, exists) {
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

module.exports.checkPublicDirReachable = function (app, dir, url, done) {
  var secret = Math.random().toString().substr(2);
  async.series([
    fs.writeFile.bind(null, dir + secret, secret),
    request.bind(null, url + secret),
    fs.unlink.bind(null, dir + secret),
  ], function (err, results) {
    if (err) {
      done(err);
    }
    if (results[1].length && results[1][0].body !== secret) {
      app.cli.info(results[1][0].body);
      done("retrieved file is not expected.");
    }
    done(null);
  });
};
