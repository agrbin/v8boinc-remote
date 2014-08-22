/*jslint indent: 2, plusplus: true*/
"use strict";

var hd = require('heredoc'),
  common = require('./common.js'),
  jsappExec = require('./jsappExec.js'),
  Config = require('./Config.js'),
  defaults = require('./defaults.js'),
  fs = require('fs'),
  async = require('async');

module.exports.usage = hd(function () {/*
v8boinc init NAME [DESCRIPTION]

  This command will create .gitignore file, internally used .v8boinc folder and minimal app.json for your scientific application.
*/});

module.exports.main = function (app) {
  var args = app.args;

  app.cli.info("--> v8boinc init")
  ;
  if (args.length < 1) {
    args[0] = process.cwd().split('/').slice(-1)[0];
    app.cli.info("name missing, using '" +
                 args[0] + "' as your application name");
  }

  function haveApp(appConfig) {
    appConfig.setFallback(app.globalConfig);
    app.config = appConfig;
    app.config.set('created', new Date().toString());
    app.config.set('root-dir', process.cwd());
    app.config.set('version', '0.0.1');
    app.config.set('name', args[0]);
    if (args[1]) {
      app.config.set('description', args[1]);
    }
    app.cli.info('you can change name and description in app.json');

    common.requireV8Boinc(app, function () {
      var txt = 'downloading jsapp version for your os.. ';
      app.cli.spinner(txt);
      jsappExec.downloadJsapp(
        app.v8b,
        app.config.get('public-key'),
        '.v8boinc/bin',
        function (err) {
          app.cli.spinner(txt + (err ? '[fail]\n' : '[ok]\n'), true);
          if (err) {
            return app.cli.fatal(err);
          }
          app.cli.ok('app.json initialized in ' + process.cwd());
        }
      );
    });
  }

  function initialize() {
    async.series(
      [
        function (done) {
          return new Config("app.json", app.cli, done);
        },
        fs.writeFile.bind(null, '.gitignore', defaults.gitIgnoreContent),
        fs.mkdir.bind(null, '.v8boinc'),
        fs.mkdir.bind(null, '.v8boinc/bundles'),
        fs.mkdir.bind(null, '.v8boinc/test-results'),
      ],
      function (err, results) {
        if (err) {
          return app.cli.fatal(err);
        }
        haveApp(results[0]);
      }
    );
  }

  common.getAppRootDir(app, function (err, dir) {
    if (!err) {
      return app.cli.fatal(dir + ".v8boinc already exists. init already called.");
    }
    initialize();
  });
};
