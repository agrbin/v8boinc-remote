#!/usr/bin/env node
/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  cli = require('cli'),
  defaults = require('../lib/cli/defaults.js'),
  Config = require('../lib/cli/Config.js'),
  Sniffer = require('../lib/cli/Sniffer.js'),
  mangleCli = require('../lib/cli/mangleCli.js'),
  V8Boinc = require('../lib/V8Boinc.js');

cli
  .enable('version')
  .setUsage(defaults.mainUsage)
  .setApp('v8boinc', '0.0.8')
  .parse(
    defaults.commonFlags,
    defaults.commands
  );

mangleCli(cli);

cli.main(function (args, options) {
  var module, config, app;

  module = require('../lib/cli/' + cli.command + '.js');
  config = new Config(options.config, cli, function (err) {
    if (err) {
      return cli.fatal(err);
    }

    app = {
      globalConfig : config,
      args : args,
      options : options,
      cli : cli,
      V8Boinc : V8Boinc
    };

    if (options.trace) {
      cli.info("logging http requests to " + options.trace);
      cli.info("warning: this log contains authenticator key in plain text");
      app.sniffer = Sniffer.getSniffer(options.trace, cli.fatal);
    }

    app.logger = function (level, msg) {
      var levels = [cli.info, cli.error, cli.fatal];
      if (!options.debug) {
        levels[0] = function () {};
      }
      level = (level >= 0 && level <= 2) ? level : 2;
      levels[level](msg);
    };

    cli.getModuleUsage = function (code) {
      cli.setUsage(module.usage);
      cli.parse(defaults.commonFlags, []);
      cli.getUsage(code);
    };

    if (options.help) {
      cli.getModuleUsage(0);
    } else {
      module.main(app, function (err) {
        if (err) {
          return cli.info("WARN: " + JSON.stringify(err));
        }
        cli.ok("looks like everything went just fine.");
      });
    }
  });
});

