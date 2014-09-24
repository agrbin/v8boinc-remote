/*jslint indent: 2, plusplus: true*/
"use strict";

var hd = require('heredoc'),
  read = require('read'),
  common = require('./common.js');

module.exports.usage = hd(function () {/*
v8boinc authenticate SERVER-URL [AUTHENTICATOR-KEY]

  This command will on success create ~/.v8boinc.conf file with authenticator
  and submission server URL.

  Currently there is deployed v8boinc server at http://v8boinc.fer.hr/v8boinc/.
  You should navigate to that page, and then:
    - log in or create an account (link is in upper right corner)
    - ask submit permissions from anton.grbin [at] gmail.com 
    - click your account, then account keys
    - use 32 char string as your authenticator-key

  SERVER-URL is BOINC master url of the project. In our case it is the URL listed above.

  If you don't provide authenticator-key thorugh shell you will be prompted to write it like a password.
*/});

module.exports.main = function (app) {
  var args = app.args;

  app.cli.info("--> v8boinc authenticate");

  function onInit(err, v8b) {
    if (err) {
      app.cli.error("couldn't communicate to v8boinc server");
      return app.cli.fatal(err);
    }
    app.cli.ok("authentication successful.");
  }

  function onAuth(err, authenticator) {
    if (err || authenticator.length !== 32) {
      return app.cli.fatal(
        err || "authenticator should be 32 char string"
      );
    }

    app.globalConfig.set('project', args[0]);
    app.globalConfig.set('authenticator', authenticator);
    common.getV8Boinc(app, true, onInit);
  }

  common.getV8Boinc(app, true, function (err, v8b) {
    if (err) {
      if (args.length !== 1 && args.length !== 2) {
        app.cli.fatal("authenticate requires 1 or 2 arguments!");
      }
      if (args.length === 1) {
        return read({prompt: 'Authenticator key: ', silent: true}, onAuth);
      }
      onAuth(null, args[1]);
    } else {
      app.cli.info("delete ~/.v8boinc.conf if you want to re-auth");
      app.cli.fatal("already authenticated.");
    }
  });

};
