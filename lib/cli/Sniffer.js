/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  async = require('async');

module.exports.getSniffer = function (filename, onFatal) {

  var Q = async.queue(function (task, callback) {
    task.a.push(callback);
    task.f.apply(null, task.a);
  }, 1);

  Q.push({f: fs.truncate, a: [filename, 0]}, function (err) {
    if (err) {
      onFatal(err);
    }
  });

  function censorAuth(body) {
    var c = "--auth-censored--";
    return body
      .replace(
        /<authenticator>[a-f0-9]{32}<\/authenticator>/g, c
      )
      .replace(
        /auth_str=[a-f0-9]{32}/g, c
      );
  }

  function append(what) {
    Q.push({f: fs.appendFile, a: [filename, what]});
  }

  function addNewline(body) {
    return (body[body.length - 1] !== '\n') ? body + '\n' : body;
  }

  return function (sent, body) {
    body = censorAuth(body);
    if (sent) {
      append("==============\n" + addNewline(body) + "--------------\n");
    } else {
      append(addNewline(body) + "==============\n\n\n\n");
    }
  };
};

