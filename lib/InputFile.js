/*jslint indent: 2, plusplus: true*/
"use strict";

var di = require('./DI.js'),
  defaults = di.get('./defaults.js'),
  xml = di.get('./XmlHelper.js'),
  fs = di.get('fs'),
  request = di.get('request');

/*
 * from http://boinc.berkeley.edu/trac/wiki/RemoteJobs
 *
 * local: the file is on the BOINC server and is not staged. It's specified by
 * its full path.
 * 
 * local_staged: the filed has been staged on the BOINC server. It's specified
 * by its physical name.
 *
 * semilocal: the file is on a data server that's accessible to the BOINC server
 * but not necessarily to the outside world. The file is specified by its URL.
 * It will be downloaded by the BOINC server during job submission, and served
 * to clients from the BOINC server.
 * 
 * inline: the file is included in the job submission request XML message. It
 * will be served to clients from BOINC server. source must be base64 encoded
 * version of the file
 *
 * remote: the file is on a data server other than the BOINC server, and will
 * be served to clients from that data server. It's specified by the URL, the
 * file size, and the file MD5.
 *
 * mine!
 * 
 * path: the file is on this server from which this script is run. file will be
 * loaded into memory synced and it will be served as inline.
 *
 * js_function: TODO for main.js
 * js_object: TODO for in.json
 */

var fileCache = {};

function InputFile(mode, source) {

  if (mode === 'path') {
    if (fileCache.hasOwnProperty(source)) {
      source = fileCache[source];
    } else {
      source = fileCache[source] = fs.readFileSync(source, {encoding : 'base64'});
    }
    mode = 'inline';
  }

  if (mode === 'function') {
    if (!(source instanceof Function && source.name === 'main')) {
      throw "source isn't instance of function or name of function isn't main";
    }
    mode = 'inline';
    source = new Buffer(source.toString()).toString('base64');
  }

  if (mode === 'json') {
    mode = 'inline';
    source = new Buffer(JSON.stringify(source)).toString('base64');
  }

  this.mode = mode;
  this.source = source;

}

InputFile.prototype.toObject = function () {
  return {mode: this.mode, source: this.source};
};

InputFile.prototype.getSerializedSize = function () {
  return this.source.toString().length;
};


module.exports = InputFile;
