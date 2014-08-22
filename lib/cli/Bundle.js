/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  hd = require('heredoc'),
  async = require('async'),
  fh = require('./FileHelper.js'),
  Config = require('./Config.js'),
  Version = require('./Version.js'),
  Browserify = require('browserify'),
  bundlePreamble = hd(function () {/*
var window = window || this;
*/});


module.exports = function Bundle(app, onFinish) {
  var version = new Version(app.config.get('version', '', true), app.cli.info),
    rootDir = app.config.get('root-dir'),
    bundlePath,
    options = app.options;

  function getMainFile() {
    var mainFile = app.config.get('main', 'main.js', true);
    if (mainFile.substr(0, 2) === './') {
      return rootDir + mainFile.substr(1);
    }
    return rootDir + '/' + mainFile;
  }

  function getBundlePath() {
    if (options.minor) {
      version.bumpMinor();
    } else if (options.major) {
      version.bumpMajor();
    } else if (!options.hold) {
      version.bumpBuild();
    }
    app.config.set('version', version.encode());
    if (!app.config.get('name')) {
      return app.cli.fatal('write name of your app into app.json');
    }
    bundlePath = rootDir + '/.v8boinc/bundles/'
      + app.config.get('name') + '-' + version.encode()
      + '/' + (app.options.mainName || 'main.js');
    return bundlePath;
  }

  function onWriteFile(err) {
    if (err) {
      return app.cli.fatal(err);
    }
    app.cli.ok('bundle written to ' + fh.rel(bundlePath));
    onFinish(null, {
      module : getMainFile(),
      bundledMainJs : bundlePath
    });
  }

  function onBundle(err, data) {
    if (err) {
      app.cli.error("while bundling scientific app");
      return app.cli.fatal(err);
    }
    fs.mkdir(
      bundlePath.split('/').slice(0, -1).join('/'),
      function (err) {
        if (err) {
          if (options.hold) {
            app.cli.info("--hold is active, writing over last bundle");
          } else {
            app.cli.error("while creating dir for " + bundlePath);
            return app.cli.fatal(err);
          }
        }
        if (app.options.preJs) {
          bundlePreamble = options.preJs + bundlePreamble;
        }
        fs.writeFile(bundlePath, bundlePreamble, function (err) {
          if (err) {
            return err(onWriteFile);
          }
          fs.appendFile(bundlePath, data, onWriteFile);
        });
      }
    );
  }

  function startBundling() {
    var browserify = Browserify({
      standalone : 'main'
    });
    browserify.add(getMainFile());
    app.cli.info('Bundling application into one file..');
    browserify.bundle(onBundle);
  }

  function checkMainExposes() {
    var module;
    try {
      module = require(getMainFile());
    } catch (err) {
      app.cli.info(
        "if your main file is not called main.js "
          + "add name field into your app.json"
      );
      return app.cli.fatal(err);
    }
    if (typeof module !== 'function') {
      return app.cli.fatal("your main program must module.exports a function");
    }
    if (module.name !== 'main') {
      return app.cli.fatal("your main program must export a function "
                            + "called main.");
    }
  }

  getBundlePath();
  checkMainExposes();
  startBundling();
};


