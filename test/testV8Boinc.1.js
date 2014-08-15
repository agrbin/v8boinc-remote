var di = require('../lib/DI.js'),
  V8Boinc = di.get('../V8Boinc.js'),
  fs = di.get('fs');

fs.truncateSync('test/traffic', 0);
function sniff(sent, body) {
  fs.appendFileSync('test/traffic',
    (sent ? ">>>>>>>>>>" : "<<<<<<<<") + "\n" + body + "\n\n");
}

var v8b = new V8Boinc({
  project : 'http://v8boinc.fer.hr/v8boinc/',
  authenticator : 'f25c003c8ca331e2c2a80b109f339269'
}, sniff);

function main(input) {
  return input + input + input;
}

v8b.initialize(function (err) {
  if (err) {
    return console.log(err);
  }

  var batch = v8b.newBatch();

  var main_js = {mode:'function', source: main};
  var main_js2 = {mode:'path', source:'slot/main.js'};
  var main_js3 = {mode: 'path', source:'slot/main3.js'};
  var in_json = {mode: 'json', source:44};

  // cudna greska s xml-om kad je unsuported mode.
  function done(err, result) {
    console.log(err, result);
  }

  function cb(err, result, done) {
    if (err) return console.log("job errd!", err);
    console.log("job finished! ", result);
    done(null);
  }

  for (var i = 0; i < 3; ++i) {
    batch.addJob(main_js, in_json, 1000, cb);
  }

  batch.submit(function (err, result) {
    if (err) {
      return console.log(err);
    }
    console.log("submitted " + result + " jobs");
  });

  process.on('SIGINT', function () {
    batch.abortAll(function (err) {
      if (err) console.log(err);
      process.exit(err ? 1 : 0);
    });
  });

});

// test sending multiple batches
//
// test what happens if you submit return new Date().toString();
