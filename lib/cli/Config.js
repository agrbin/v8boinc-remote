/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs');

module.exports = function Config(path, cli, done) {
  var config = {},
    fallback = null,
    that = this,
    changed = false,
    writeOptions = {encoding : 'ascii', mode : 384 }; // 0600 in octal

  this.get = function (key, def, silent) {
    if (config.hasOwnProperty(key)) {
      return config[key];
    }
    if (fallback) {
      return fallback.get(key, def, silent);
    }
    if (!silent) {
      cli.info("config key " + key + " not present");
    }
    return def;
  };

  this.set = function (key, value) {
    if (config[key] !== value) {
      changed = true;
    }
    config[key] = value;
  };

  this.setFallback = function (config) {
    if (!(config instanceof Config)) {
      throw "Config::setFallback needs Config as only argument";
    }
    fallback = config;
  };

  function noConfig(reason) {
    cli.info("no config file at " + path + ": " + reason);
    cli.info("creating an empty one");
    fs.writeFile(
      path,
      JSON.stringify(config),
      writeOptions,
      function (err) {
        if (err) {
          return done(
            "couldn't initialize config file. firstly "
              + path + reason + ", and when trying to write new file "
              + err
          );
        }
        done(null, that);
      }
    );
  }

  fs.readFile(path, function (err, data) {
    if (err) {
      return noConfig(" file doesn't exists");
    }
    try {
      config = JSON.parse(data);
    } catch (ex) {
      return noConfig(" is not json: " + ex);
    }
    done(null, that);
  });

  process.on('exit', function () {
    if (changed) {
      fs.writeFileSync(
        path,
        JSON.stringify(config, null, 2) + "\n",
        writeOptions
      );
    }
  });
};

