/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  async = require('async'),
  resolve = require('path').resolve,
  Config = require('./Config.js');

function getAppRootDir(app, done) {
  var prefix = "./", it = 0;

  async.forever(
    function (next) {
      fs.readdir(prefix + ".v8boinc", function (err) {
        if (err) {
          // ne postoji ?
          prefix += "../";
          ++it;
          next(it > 32 ? true : null);
        } else {
          next(prefix);
        }
      });
    },
    function (path) {
      if (path === true) {
        return done("no parent directories contain .v8boinc dir");
      }
      done(null, path);
    }
  );
}

var cachedConfig = null;

function getAppConfig(app, done) {
  if (cachedConfig !== null) {
    return done(null, cachedConfig);
  }
  getAppRootDir(app, function (err, path) {
    var config;
    if (err) {
      return done(err);
    }
    cachedConfig = new Config(path + "app.json", app.cli, function (err) {
      if (err) {
        return done(err);
      }
      cachedConfig.setFallback(app.globalConfig);
      app.config = cachedConfig;
      cachedConfig.set('root-dir', resolve(path));
      done(null);
    });
  });
}

function requireAppConfig(app, done) {
  getAppConfig(app, function (err) {
    if (err) {
      app.cli.error("couldn't locate .v8boinc in any of parent directories.");
      app.cli.info("have you called 'v8boinc init' ?");
      return app.cli.fatal(err);
    }
    done();
  });
}


function getV8Boinc(app, done) {
  var v8b = new app.V8Boinc(
    {
      project: app.globalConfig.get('project', null, true),
      authenticator : app.globalConfig.get('authenticator', null, true)
    },
    app.sniffer,
    app.logger
  );
  v8b.initialize(function (err) {
    return done(err, err ? null : v8b);
  });
}

function requireV8Boinc(app, done) {
  getV8Boinc(app, function (err, v8boinc) {
    if (err) {
      app.cli.error(err);
      app.cli.info('try "v8boinc authenticate --help"!');
      return app.cli.fatal("couldn't communicate with boinc server.");
    }
    app.v8b = v8boinc;
    return done();
  });
}

module.exports.getV8Boinc = getV8Boinc;
module.exports.getAppRootDir = getAppRootDir;
module.exports.getAppConfig = getAppConfig;
module.exports.requireAppConfig = requireAppConfig;
module.exports.requireV8Boinc = requireV8Boinc;

