/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  request = require('request'),
  child_process = require('child_process'),
  async = require('async'),
  os = require('os'),
  crypto = require('crypto'),
  ssl = require('openssl-wrapper'),
  readJsonFile = require('./FileHelper.js').readJsonFile;

function getPlatform() {
  var p = os.platform(), a = os.arch();
  if (p === 'linux' && a === 'ia32') {
    return 'i686-pc-linux-gnu';
  }
  if (p === 'linux' && a === 'x64') {
    return 'x86_64-pc-linux-gnu';
  }
  if (p === 'win32') {
    return 'windows_intelx86';
  }
  if (p === 'darwin' && a === 'ia32') {
    return 'i686-pc-linux-gnu';
  }
  if (p === 'darwin' && a === 'x64') {
    return 'x86_64-apple-darwin';
  }
}

module.exports.downloadJsapp = function (v8b, publicKey, path, done) {
  v8b.getLatestExecutable(getPlatform(), function (err, desc) {
    var hash;

    if (err) {
      done("couldn't fetch jsapp file details");
    }

    function checkSignatureAndLink(sig, key) {
      // openssl rsautl -inkey code_sign_public.pem -pubin -in signature.bin
      var sigFile = path + '/signature',
        keyFile = path + '/key';

      async.series(
        [
          fs.writeFile.bind(null, sigFile, sig),
          fs.writeFile.bind(null, keyFile, key),
          ssl.exec.bind(null,
                        'rsautl',
                        {inkey: keyFile, pubin: null, in: sigFile})
        ],
        function (err, buffer) {
          var digest = buffer[2];
          if (err) {
            return done(err);
          }
          if (hash.read() !== digest.toString('ascii')) {
            done("digital signature of downloaded executable not valid");
          } else {
            async.series([
              fs.chmod.bind(null, path + '/' + desc.name, 755),
              fs.symlink.bind(null, desc.name, path + '/jsapp')
            ], done);
          }
        }
      );
    }

    function onDownload(err) {
      if (err) {
        return done(err);
      }
      checkSignatureAndLink(
        new Buffer(desc.file_signature_openssl, 'base64'),
        new Buffer(publicKey, 'ascii')
      );
    }

    fs.mkdir(path, function (err) {
      if (err) {
        return done(err);
      }
      var stream = request(desc.url);
      hash = crypto.createHash('md5');
      hash.setEncoding('hex');
      stream.on('end', onDownload);
      stream.on('error', done);
      stream.pipe(hash);
      stream.pipe(fs.createWriteStream(path + '/' + desc.name));
    });
  });
};

module.exports.run = function (v8Dir, mainPath, inputPath, onResult) {
  var testName = "test_slot_" + Math.random().toString().substr(2, 10),
    slotPath = v8Dir + '/' + testName + '/';

  function done(err, result) {
    async.parallel([
      fs.unlink.bind(null, slotPath + 'jsapp'),
      fs.unlink.bind(null, slotPath + 'in.json'),
      fs.unlink.bind(null, slotPath + 'out.json'),
      fs.unlink.bind(null, slotPath + 'main.js'),
      fs.unlink.bind(null, slotPath + 'stderr.txt'),
      fs.unlink.bind(null, slotPath + 'boinc_finish_called'),
      fs.unlink.bind(null, slotPath + 'boinc_lockfile'),
    ], function () {
      fs.rmdir(slotPath, function (rmErr) {
        if (rmErr) {
          console.log("couldn't remove slot dir " + slotPath + ": ", rmErr);
        }
        onResult(err, result);
      });
    });
  }

  function processResult(cpResult, stderrTxtBuffer) {
    var cpStdOut = cpResult[0],
      cpStdErr = cpResult[1];

    readJsonFile(slotPath + 'out.json', function (err, out) {
      if (err) {
        done({
          // readingOutput : err.err,
          runningJsapp : cpStdErr.toString(),
          jsappStdout : cpStdOut.toString(),
          stderrTxt : stderrTxtBuffer.toString()
        });
      } else {
        done(null, out);
      }
    });
  }

  function invokeJsapp(callback) {
    child_process.execFile(
      slotPath + 'jsapp',
      { cwd: slotPath, encoding: 'ascii' },
      function (err, res) {
        var msg;
        if (err) {
          msg = err.code ?
              "jsapp exited with status " + err.code
              : "jsapp process was killed.";
          return callback(null, ['', msg]);
        }
        callback(null, res);
      }
    );
  }

  async.series([
    fs.mkdir.bind(null, slotPath),
    fs.symlink.bind(null, mainPath, slotPath + 'main.js'),
    fs.symlink.bind(null, inputPath, slotPath + 'in.json'),
    fs.symlink.bind(null, v8Dir + '/bin/jsapp', slotPath + 'jsapp'),
    invokeJsapp,
    // run child process
    fs.readFile.bind(null, slotPath + 'stderr.txt')
  ], function (err, results) {
    if (err) {
      return done(err);
    }
    processResult(results[4], results[5]);
  });
};
