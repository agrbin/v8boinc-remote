/*jslint indent: 2, plusplus: true*/
"use strict";

module.exports = function Version(str, warn) {
  var nums = [0, 0, 1],
    that = this;

  function decode() {
    var arr = str.split('.');
    if (!str.length) {
      return warn("version not defined yet, initialized to 0.0.1");
    }
    if (arr.length !== 3) {
      return warn("couldn't decode version from string: " + str);
    }
    nums = arr;
  }

  this.bumpBuild = function () {
    nums[2]++;
    return that;
  };

  this.bumpMinor = function () {
    nums[1]++;
    nums[2] = 1;
    return that;
  };

  this.bumpMajor = function () {
    nums[0]++;
    nums[1] = 0;
    nums[2] = 1;
    return that;
  };

  this.encode = function () {
    return nums.join('.');
  };

  decode();
};
