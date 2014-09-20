var di = require('../lib/DI.js'),
  test = require('./test.js');

test.mangleRandomToDeterministic(0x0019);
test.mangleDefaults({
  max_jobs_in_batch : 100,
  batch_main_loop_interval : 1
});
test.mockRequest('./test/rsrc/mock/testV8Boinc.1.traffic.json');

var V8Boinc = require('./..'),
  v8b = new V8Boinc(
    {
      project : 'http://v8boinc.fer.hr/v8boinc/',
      authenticator : test.getAuth()
    },
    test.getSniffer('./test/rsrc/mock/testV8Boinc.1.traffic')
  );

v8b.initialize(function (err) {
  test.expectFalse(err);

  var batch = v8b.newBatch();

  function addJob(it) {
    batch.addJob(
      {function: function main(x) {return x*x}},
      {json: it},
      1000, // rsc_est_fpops
      function (err, result, onProcessed) {
        test.expectFalse(err);
        test.expectEq(result, it * it)
        onProcessed(null);
      }
    );
  }

  for (var it = 2; it < 10; addJob(it++));

  batch.submit(null, function (err) {
    test.expectFalse(err);
  });
});
