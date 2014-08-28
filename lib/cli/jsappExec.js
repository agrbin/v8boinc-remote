/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  request = require('request'),
  Tail = require('always-tail'),
  child_process = require('child_process'),
  async = require('async'),
  os = require('os'),
  crypto = require('crypto'),
  ssl = require('openssl-wrapper'),
  readJsonFile = require('./FileHelper.js').readJsonFile,
  progress_line = 'boinc_fraction_done called with: ';

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
  // i didn't compile for 64bit darwin, this is a bypass
  if (p === 'darwin') {
    return 'i686-apple-darwin';
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
              fs.chmod.bind(null, path + '/jstest', 493), //0755),
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
        new Buffer(desc.file_signature, 'base64'),
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
      stream.pipe(fs.createWriteStream(path + '/jstest'));
    });
  });
};

function run(v8Dir, mainPath, inputPath, onProgress, onResult, warn) {
  var testName = "test_slot_" + Math.random().toString().substr(2, 10),
    slotPath = v8Dir + '/' + testName + '/';

  function done(err, result) {
    async.parallel([
      fs.unlink.bind(null, slotPath + 'jstest'),
      fs.unlink.bind(null, slotPath + 'in.json'),
      fs.unlink.bind(null, slotPath + 'out.json'),
      fs.unlink.bind(null, slotPath + 'main.js'),
      fs.unlink.bind(null, slotPath + 'stderr.txt')
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
      cpStdErr = cpResult[1],
      lines = stderrTxtBuffer.toString().split('\n');

    // strip away that boinc_fraction_done lines.
    lines = lines.filter(function (line) {
      return line.substr(0, progress_line.length) !== progress_line;
    });

    readJsonFile(slotPath + 'out.json', function (err, out) {
      if (err) {
        done({
          // readingOutput : err.err,
          runningJsapp : cpStdErr.toString(),
          jsappStdout : cpStdOut.toString(),
          stderrTxt : lines.join('\n'),
        });
      } else {
        done(null, out);
      }
    });
  }

  function invokeJsapp(callback) {
    var tail = new Tail(slotPath + 'stderr.txt', '\n', {interval: 50}),
      lines = 0, t0 = new Date().getTime(),
      warningPrinted = false;

    child_process.execFile(
      slotPath + 'jstest',
      { cwd: slotPath, encoding: 'ascii' },
      function (err, res) {
        var msg;
        tail.unwatch();
        if (err) {
          msg = err.code ?
              "jstest exited with status " + err.code
              : "jstest process was killed.";
          return callback(null, ['', msg]);
        }
        if (warningPrinted) {
          warn(
            "WARN: too much stderr output. "
              + "call boinc_fraction_done or print less often. "
              + "this warning is printed when more than 1000 stderr lines "
              + "are created per second."
          );
        }
        callback(null, res);
      }
    );
    tail.watch();
    tail.on('line', function (line) {
      lines++;
      if (!warningPrinted && lines / (new Date().getTime() - t0) > 1) {
        warningPrinted = true;
      }
      if (line.substr(0, progress_line.length) === progress_line) {
        var frac = Number(line.substr(progress_line.length));
        if (frac >= 0 && frac <= 1) onProgress(frac);
      }
    });
  }

  async.series([
    fs.mkdir.bind(null, slotPath),
    fs.symlink.bind(null, mainPath, slotPath + 'main.js'),
    fs.symlink.bind(null, inputPath, slotPath + 'in.json'),
    fs.symlink.bind(null, v8Dir + '/bin/jstest', slotPath + 'jstest'),
    fs.writeFile.bind(null, slotPath + 'stderr.txt', ''),
    invokeJsapp,
    // run child process
    fs.readFile.bind(null, slotPath + 'stderr.txt')
  ], function (err, results) {
    if (err) {
      return done(err);
    }
    processResult(results[5], results[6]);
  });
};

module.exports.run = run;
