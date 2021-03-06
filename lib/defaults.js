/*jslint indent: 2, plusplus: true*/
"use strict";

module.exports = {
  project : 'http://v8boinc.fer.hr/v8boinc/',
  app_name : 'jsapp',
  rpc_handler_path : '/submit_rpc_handler.php',
  rpc_timeout : 5000,
  batch_main_loop_interval : 5000,

  max_jobs_in_batch: 10,
  max_files_size_in_batch: 500*1e6,
};
