var xml = require('../lib/XmlHelper.js'),
  hd = require('heredoc'),
  tests = [
    {
      input: ['val', 'test'],
      output: '<test>val</test>\n'
    },
    {
      input: [5, 'test'],
      output: '<test>5</test>\n'
    },
    {
      input: [{a:5}, 'test'],
      output: '<test>\n  <a>5</a>\n</test>\n'
    },
    {
      input: [{b:6, as:[1,2]}, 'test'],
      output: hd(function() {/*
<test>
  <b>6</b>
  <a>1</a>
  <a>2</a>
</test>
      */})
    },
  ];

for (var it = 0; it < tests.length; ++it) {
  tests[it].input.push(function (err, got) {
    if (err) {
      console.log("test " + it + " failed. input:");
      console.log( tests[it].input );
      console.log("error: " + err);
      return;
    }
    if (got !== tests[it].output) {
      console.log("test " + it + " failed. input:");
      console.log( tests[it].input );
      console.log("got:");
      console.log(got);
      console.log("expected:");
      console.log(tests[it].output);
    }
  });
  xml.toXml.apply(null, tests[it].input);
}

var x = hd(function() {/*
<?xml version="1.0" encoding="ISO-8859-1" ?>
<completed_job>
   <error_mask>0</error_mask>
   <error_resultid>28191</error_resultid>
   <exit_status>84</exit_status>
   <elapsed_time>11.071491</elapsed_time>
   <cpu_time>0.008</cpu_time>
   <stderr_out><![CDATA[

&lt;core_client_version&gt;7.3.13&lt;/core_client_version&gt;
&lt;![CDATA[
&lt;message&gt;
process exited with code 84 (0x54, -172)
&lt;/message&gt;
&lt;stderr_txt&gt;
Error in file: blob:http%3A//browser.v8boinc.fer.hr/6d76501e-2597-4cb7-91f9-9f11e52a2c54
line: 2
Description: Uncaught ovo je greska iz main.js16:43:45 (32572): called boinc_finish

&lt;/stderr_txt&gt;
]]&gt;
   ]]></stderr_out>
</completed_job>
*/});

/*
xml.fromXml(x, function (err, done) {
  if (err) {
    return console.log("error", err);
  }
  console.log(done);
});
*/

/*
xml.fromXml("<t><h>3</h></t>", function (err, result) {
  if (err) {
    console.log(err);
    return;
  }
  console.log( result );
});

console.log(xml.toXml( 'val', 'test' ));
console.log(xml.toXml( true, 'test' ));
console.log(xml.toXml( 6.6, 'test' ));
console.log(xml.toXml( { a: 5}, 'test' ));

console.log(xml.toXml({
  a: 5,
  bs: [1, 2, 3]
}, 'test' ));
*/
