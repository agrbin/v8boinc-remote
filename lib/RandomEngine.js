/*jslint indent: 2, plusplus: true*/
"use strict";

var rnd = {

  alphabet : "0123456789abcefghkmnpqrstuxwz",

  random : function () {
    return Math.random();
  },

  getChar : function () {
    return rnd.alphabet[Math.floor(rnd.random() * rnd.alphabet.length)];
  },

  getString : function (len) {
    var it, sol = '';
    len = len || 16;
    for (it = 0; it < len; ++it) {
      sol = sol + rnd.getChar();
    }
    return sol;
  },

  getName : function (prefix, len) {
    prefix = prefix || '';
    return prefix + rnd.getString(len);
  },

};

module.exports = rnd;
