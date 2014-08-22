var di = require('../lib/DI.js'),
  test = require('./test.js');

var V8Boinc = require('./..'),
  v8b = new V8Boinc(
    {
      project : 'http://v8boinc.fer.hr/v8boinc/',
      authenticator : test.getAuth()
    },
    test.getSniffer('tmp')
  );

/*
v8b.initialize(function (err) {
  test.expectFalse(err);
  v8b.getCodeSignPublicKey(function (err, pubkey) {
    v8b.getLatestExecutable('i686-pc-linux-gnu', function (err, data) {
      console.log(err,  data );
    });
  });
});
*/
