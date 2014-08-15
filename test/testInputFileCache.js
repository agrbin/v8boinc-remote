var di = require('../lib/DI.js');

function testCache() {
  var called = 0;

  di.set('fs', {
    readFileSync : function () {
      ++called;
      return "test";
    }
  });

  var InputFile = di.get('../lib/InputFile.js');
  var f = new InputFile('path', 'package.json'),
    g = new InputFile('path', 'package.json');

  if (called !== 1) {
    console.log("fail. cache doesn't work");
  }
  if (f.toObject().source !== "test") {
    console.log("fail. expected test to be returend");
  }
}


testCache();
