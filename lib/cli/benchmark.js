/*jslint indent: 2, plusplus: true*/
"use strict";

var hd = require('heredoc'),
  async = require('async'),
  common = require('./common.js');

module.exports.usage = hd(function () {/*
v8boinc benchmark

  This command will estimate speed of current machine and write it to main config file.
  This data will later be used to estimate load required by submitted jobs.

*/});

module.exports.main = function (app, done) {
  var estimateSpeed;

  app.cli.info("--> v8boinc benchmark");

  // callback will get number of miliseconds, duration of this job.
  function doWork(iterations) {
    var it, sol = 0, t = new Date().getTime();
    for (it = 1; it <= iterations; ++it) {
      sol += 1 / it;
    }
    return (new Date().getTime()) - t;
  }

  function start() {
    // warm up
    var power = 100;
    app.cli.info("doing 1e5 iterations for warm up");
    doWork(1e5);
    app.cli.info("estimating number of iterations that takes up more than 1s");

    async.forever(
      function (next) {
        var t = doWork(power);
        if (t > 1000) {
          next(t);
        } else {
          power *= 2;
          next(null);
        }
      },
      function gotPower(time) {
        app.cli.info(power + " iterations takes " + time + " ms");
        estimateSpeed(power);
      }
    );
  }

  estimateSpeed = function (iter) {
    var it, sum = 0, t, N = 5, speed;
    app.cli.info("doing " + N + " such experiments");
    for (it = 0; it < N; ++it) {
      t = doWork(iter);
      app.cli.info(it + 1 + ". took " + t + " ms");
      sum += (1000 * iter / t);
    }
    speed = Math.round(sum / N);
    app.cli.ok("measured speed is " + speed + " FLOPS. written to config.");
    app.globalConfig.set("machine-fpops", speed);
    done();
  };

  start();
};


