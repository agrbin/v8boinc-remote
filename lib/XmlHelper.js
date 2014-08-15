/*jslint indent: 2, plusplus: true*/
"use strict";

var xml2js = require('xml2js');

/**
 * note how toXml and fromXml are not inverse functions
 * behavior is matched to submit.inc from boinc source code.
 */
function XmlHelper() {

  function isSimple(obj) {
    return {'boolean': 1, 'string': 1, 'number' : 1}
      .hasOwnProperty(typeof obj);
  }

  function spaces(d) {
    return new Array(d + 1).join('  ');
  }

  function open(name, d) {
    return spaces(d) + "<" + name + ">\n";
  }

  function close(name, d) {
    return spaces(d) + "</" + name + ">\n";
  }

  function simple(name, value, d) {
    return spaces(d) + "<" + name + ">" + value + "</" + name + ">\n";
  }

  function toXmlHelper(obj, tagName, depth) {
    var sol = "", key, it;
    depth = depth || 0;

    if (isSimple(obj)) {
      // pod value
      sol = simple(tagName, obj, depth);
    } else if (obj instanceof Array) {
      // array
      if (tagName.substr(-1, 1) !== 's') {
        throw "array values should have simple plural key name";
      }
      tagName = tagName.substr(0, tagName.length - 1);
      for (it = 0; it < obj.length; ++it) {
        sol += toXmlHelper(obj[it], tagName, depth);
      }
    } else if (typeof obj === 'object') {
      // object
      sol += open(tagName, depth);
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          sol += toXmlHelper(obj[key], key, depth + 1);
        }
      }
      sol += close(tagName, depth);
    } else {
      throw "unexpected object type: " + typeof obj;
    }

    return sol;
  }

  this.toXml = function (obj, tagName, cb) {
    try {
      cb(null, toXmlHelper(obj, tagName, 0));
    } catch (err) {
      cb(err, null);
    }
  };

  this.toXmlSynced = function (obj, tagName) {
    return toXmlHelper(obj, tagName, 0);
  };

  this.fromXml = function (str, cb) {
    xml2js.parseString(str, {async: true}, cb);
  };

}

module.exports = new XmlHelper();

