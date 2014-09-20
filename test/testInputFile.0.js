var iff = require('../lib/InputFile.js'),
  test = require('./test.js');

var inputs = [
  {path: './test/rsrc/sample.txt'},
  {string: 'anton'},
  {json:  {a:1,b:2}},
  {function: function main(x) {return x*x*x;}},
  {local: 'literal'},
  {local_staged: 'literal'},
  {semilocal: 'literal'},
  {inline: 'literal'},
  {remote: 'literal'}
];

var results = [
  {mode: 'inline', source : 'YW50b24=', gzipped: false, md5: false},
  {mode: 'inline', source : 'YW50b24=', gzipped: false, md5: false},
  {mode: 'inline', source : 'eyJhIjoxLCJiIjoyfQ==', gzipped: false, md5: false},
  {mode: 'inline', source : 'ZnVuY3Rpb24gbWFpbih4KSB7cmV0dXJuIHgqeCp4O30=', gzipped: false, md5: false},
  {mode: 'local', source : 'literal', gzipped: false, md5: false},
  {mode: 'local_staged', source : 'literal', gzipped: false, md5: false},
  {mode: 'semilocal', source : 'literal', gzipped: false, md5: false},
  {mode: 'inline', source : 'literal', gzipped: false, md5: false},
  {mode: 'remote', source : 'literal', gzipped: false, md5: false}
];

function eok(it) {
  return function (err, data) {
    if (err) {
      return test.fail(err);
    }
    data = data.toObject();
    if (JSON.stringify(results[it]) !== JSON.stringify(data)) {
      console.log("expected, ", results[it]);
      console.log("got, ", data);
      return test.fail("test " + it + " mismatch");
    }
  }
}

function getMain() {
  return function main(x) {return x*x*x;}
}

for (var it = 0; it < inputs.length; ++it) {
  iff.buildInputFile(inputs[it], eok(it));
}

iff.buildInputFiles(inputs, function (err, result) {
  if (err) {
    return test.fail(err);
  }
  result = result.map(function (x) {return x.toObject();});
  if (JSON.stringify(result) !== JSON.stringify(results)) {
    return test.fail("buildInputFiles didn't return same result");
  }
});

var error_inputs = [
  5,
  'asdf',
  console.log,
  null,
  {a: 5} ,
  {function: console.log} ,
  {local: 5} ,
  {function: 5}
], erlen = 0;

function neok(err, data) {
  if (++erlen > error_inputs.length) {
    test.fail("neok called too many times!");
  }
  if (!err) {
    test.fail("error expected, got result : " + data);
  }
}

for (var it = 0; it < error_inputs.length; ++it) {
  iff.buildInputFile(error_inputs[it], neok);
}

iff.buildInputFiles(error_inputs, function (err, result) {
  if (err.length !== error_inputs.length) {
    test.fail("buildInputFiles produced less errors than expected.");
  }
});

