/*jslint indent: 2, plusplus: true*/
"use strict";

var fs = require('fs'),
  di = require('../lib/DI.js'),
  requestMocked = false;

console.log(process.argv[1].split('/').slice(-1).join('') + ':');

function mangleDefaults(what) {
  var defs = require('../lib/defaults.js');
  for (var key in what) {
    defs[key] = what[key];
  }
  di.set('./defaults.js', defs);
}

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

function getSniffer(filename) {
  var structured = [],
    filenameJson = filename + '.json';

  if (requestMocked) {
    return function() {};
  }

  fs.truncateSync(filename, 0);
  fs.truncateSync(filenameJson, 0);

  function a(body) {
    return (body[body.length - 1] !== '\n') ? body + '\n' : body;
  }

  return function (sent, body) {
    body = censorAuth(body);
    if (sent) {
      structured.push( {request: body, response: null} );
      fs.appendFileSync(
        filename,
        "==============\n" + a(body) + "--------------\n"
      );
    } else {
      structured[structured.length - 1].response = body;
      fs.writeFileSync(
        filenameJson,
        JSON.stringify(structured)
      );
      fs.appendFileSync(
        filename,
        a(body) + "==============\n\n\n\n"
      );
    }
  };
}

function mangleRandomToDeterministic(seed) {
  var rnd = di.get('../lib/RandomEngine.js'), cnt = seed || 0;

  rnd.random = function () {
    cnt = Math.abs((cnt * 3313 + 0xbabadeda) % 0xffffffff);
    return cnt / 0xffffffff;
  };

  di.set('../lib/RandomEngine.js', rnd);
}

function mockRequest(trafficFilename) {
  var traffic,
    request,
    it = 0;;

  requestMocked = true;
  traffic = JSON.parse(fs.readFileSync(trafficFilename));

  function getResponse(body) {
    body = censorAuth(body);
    if (it === traffic.length) {
      throw "no more mocked request/response pairs";
    }
    if (traffic[it].request === body) {
      return traffic[it++].response;
    }
    return null;
  }

  function request(url, options, callback) {
    var body = null, response = null;

    if (options instanceof Function) {  
      callback = options;
      body = url;
    } else {
      body = options.form.request;
    }

    if (body === null) {
      throw "in mocked response, couldn't get body";
    }

    if ((response = getResponse(body)) === null) {
      throw "in mocked response, unexpected request: " + body;
    }
    
    setTimeout(function () {
      callback(null, {body:response}, response); 
    }, 0);
  }

  request.post = request;
  di.set('request', request);
}

function getAuth() {
  if (requestMocked) {
    return '00000000000000000000000000000000';
  } else {
    return fs.readFileSync('test/rsrc/authenticator.key',
                           {encoding:'ascii'}).trim();
  }
}


module.exports.getAuth = getAuth;
module.exports.getSniffer = getSniffer;
module.exports.mockRequest = mockRequest;
module.exports.mangleDefaults = mangleDefaults;
module.exports.mangleRandomToDeterministic = mangleRandomToDeterministic;


module.exports.expectTrue = function (x) {
  if (!x) {
    console.log(x);
    throw "this was expected to be true";
  }
};

module.exports.expectFalse = function (x) {
  if (x) {
    console.log(x);
    throw "this was expected to be false";
  }
};

module.exports.expectEq = function (x, y) {
  if (x != y) {
    console.log(x, y);
    throw "this was expected to be eq";
  }
};

module.exports.expectEqq = function (x, y) {
  if (x !== y) {
    console.log(x, y);
    throw "this was expected to be eqq";
  }
};
