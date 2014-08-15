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
  {mode: 'inline', source : 'YW50b24='},
  {mode: 'inline', source : 'YW50b24='},
  {mode: 'inline', source : 'eyJhIjoxLCJiIjoyfQ=='},
  {mode: 'inline', source : 'ZnVuY3Rpb24gbWFpbih4KSB7cmV0dXJuIHgqeCp4O30='},
  {mode: 'local', source : 'literal'},
  {mode: 'local_staged', source : 'literal'},
  {mode: 'semilocal', source : 'literal'},
  {mode: 'inline', source : 'literal'},
  {mode: 'remote', source : 'literal'}
];

function eok(it) {
  return function (err, data) {
    if (err) {
      return test.fail(err);
    }
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

