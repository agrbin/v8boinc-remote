var fh = require('../lib/cli/FileHelper.js'),
  fe = fh.exploreFiles;

function gg(msg) {}

fe('/*', gg, function (err, files) {
  if (err) {
    return console.log("error", err)
  }
  if(files.length) {
    gg('ok');
  }
});

fe(['package.json', 'test/testExploreFiles.js'], gg, function (err, files) {
  if (err) {
    return console.log("error", err)
  }
  if (files.length === 2) {
    gg('ok');
  }
});

fe(['sdf'], null, function (err, files) {
  if (err) {
    gg('ok');
  }
});
