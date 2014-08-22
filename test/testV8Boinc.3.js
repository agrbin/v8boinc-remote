var di = require('../lib/DI.js'),
  test = require('./test.js');

test.mangleRandomToDeterministic(0x0007);
test.mangleDefaults({
  max_jobs_in_batch : 6,
  batch_main_loop_interval : 1 
});
test.mockRequest('./test/rsrc/mock/testV8Boinc.3.traffic.json');

var V8Boinc = require('./..'),
  v8b = new V8Boinc(
    {
      project : 'http://v8boinc.fer.hr/v8boinc/',
      authenticator : test.getAuth()
    },
    test.getSniffer('./test/rsrc/mock/testV8Boinc.3.traffic')
  );

v8b.initialize(function (err) {
  test.expectFalse(err);

  var batch = v8b.newBatch();

  function expectError(err, result) {
    test.expectTrue(err);
  }

  // this job must fail because result will always be different
  // while server submits multiple copies of each job to different
  // workers, and results are not the same job must be flagged as
  // erroneous.
  function addNonDeterministic(it) {
    batch.addJob(
      {function: function main(x) {return new Date().getTime();}},
      {json: it},
      1000, // rsc_est_fpops
      expectError
    );
  }

  // this job will fail because it throws an exception..
  function addExceptionJob(it) {
    batch.addJob(
      {function: function main(x) {throw x;}},
      {json: 'this is an exception from job ' + it},
      1000, // rsc_est_fpops
      expectError
    );
  }

  // this is OK job. it must return valid result
  function addOkJob(it) {
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

  for (var it = 2; it < 5; ++it) {
    addOkJob(it++);
    addOkJob(it++);
    addOkJob(it++);
    addExceptionJob(it++);
    addOkJob(it++);
    addOkJob(it++);
    addNonDeterministic(it++);
    addOkJob(it++);
    addOkJob(it++);
  }

  batch.submit(null, function (err) {
    test.expectFalse(err);
  });
});
