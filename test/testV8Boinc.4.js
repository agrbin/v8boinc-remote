var di = require('../lib/DI.js'),
  test = require('./test.js');

test.mangleRandomToDeterministic(0x0007);
test.mangleDefaults({
  max_jobs_in_batch : 6,
  batch_main_loop_interval : 1 
});
test.mockRequest('./test/rsrc/mock/testV8Boinc.4.traffic.json');

var V8Boinc = require('./..'),
  v8b = new V8Boinc(
    {
      project : 'http://v8boinc.fer.hr/v8boinc/',
      authenticator : test.getAuth()
    },
    test.getSniffer('./test/rsrc/mock/testV8Boinc.4.traffic')
  );

v8b.initialize(function (err) {
  test.expectFalse(err);

  /*
  v8b.getLatestExecutable('i686-pc-linux-gnu', function (err, desc) {
    if (err) {
      return console.log(err);
    }
    console.log(desc);
  });
 */
});
