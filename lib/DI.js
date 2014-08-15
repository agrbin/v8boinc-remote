/*jslint indent: 2, plusplus: true*/
"use strict";

function TrivialDependencyInjector() {
  var deps = {};

  this.set = function (name, what) {
    deps[name] = what;
  };

  this.get = function (name) {
    if (deps.hasOwnProperty(name)) {
      return deps[name];
    }
    return require(name);
  };
}

module.exports = new TrivialDependencyInjector();

