var fs = require('fs');

module.exports = function (cli) {
  var error = cli.error,
    fatal = cli.fatal,
    info = cli.info,
    ok = cli.ok;

  function zeroes(num) {
    return (num < 10 ? '0' : '') + num;
  }

  function date() {
    var now = new Date();
    'year/mm/dd hh:mm:ss';
    return [
      [now.getMonth(), now.getDate()]
        .map(zeroes).join('-'),
      [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(zeroes).join(':')
    ].join(" ");
  }

  function pre(k, func, strfunc, msg) {
    if (cli.options.time) {
      process.stderr.write(date() + " ");
    }
    msg = Array(6-k).join(" ") + msg;
    func(msg);
    if (cli.options.log) {
      fs.appendFile(
        cli.options.log,
        date() + " " + strfunc + " " + msg + "\n",
        function () {}
      );
    }
  }

  cli.error = function (msg) {
    pre(5, error, 'error', msg);
  };

  cli.fatal = function (msg) {
    pre(5, fatal, 'fatal', msg);
  };

  cli.info = function (msg) {
    pre(4, info, 'info', msg);
  };

  cli.ok = function (msg) {
    pre(2, ok, 'ok', msg);
  };

  if (cli.options.log) {
    cli.info("log is written to " + cli.options.log);
  }
  if (cli.options.less) {
    cli.info = function () {};
  }
};

