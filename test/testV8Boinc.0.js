var V8Boinc = require('./..'),
  test = require('./test.js');

if (V8Boinc instanceof Function) {
} else {
  console.log("V8Boinc is not instanceof Function");
  process.exit(1);
}
