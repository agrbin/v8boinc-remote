var di = require('../lib/DI.js'),
  test = require('./test.js');

test.mangleRandomToDeterministic(0x0002);
test.mangleDefaults({
  max_jobs_in_batch : 100,
  batch_main_loop_interval : 1
});
test.mockRequest('./test/rsrc/mock/testV8Boinc.2.traffic.json');

var V8Boinc = require('./..'),
  v8b = new V8Boinc(
    {
      project : 'http://v8boinc.fer.hr/v8boinc/',
      authenticator : test.getAuth()
    },
    test.getSniffer('./test/rsrc/mock/testV8Boinc.2.traffic')
  );

v8b.initialize(function (err) {
  test.expectTrue(err);
});
