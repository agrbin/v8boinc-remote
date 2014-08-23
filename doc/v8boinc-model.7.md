v8boinc-model(7) -- User manual
===============================

## DESCRIPTION

Here you can learn about V8-BOINC distributed computing model. As name already
suggests, the system is built upon JavaScript engine V8 and infrastructure for
network computing - BOINC. In shortest terms, system provides user with
capability to run massivelly parallel JavaScript application across various
devices.

Document starts with technical part about computing model itself, and continues
with theoritical part that explains how V8-BOINC executes tasks from end to
end.

## A task

V8-BOINC task is consisted of two input files.

  - main.js
  - in.json

Input file `main.js` contains a function `main` in global scope that will be
executed with only argument that is parsed from `in.json`. Its return value
will be serialized to a `out.json` file which will represent an output.

JavaScript code beneath function `main` can make use of function
`boinc_fraction_done` to notify user volunteer about task computation progress.
This function is defined in environment that will start a V8-BOINC task. It
receives one numeric argument from 0 to 1 that represents a fraction of work
done. When using `v8boinc` program to submit a task, reporting a fraction of
work done is required.

It is required that task always returns same result when started. This means
that use of `Math.random` and `Date` functions will lead to errors.
Deterministic tasks help us to militigate effects of malicious volunteers or
volunteers with broken CPUs.

## Applications

V8-BOINC task can be used in embarassingly parallel applications. These
applications include simulations with various parameters, evolutionary
algorithms and other problems where computation time to process input data
overweights network time to download inputs and upload outputs.

## Something about BOINC

BOINC is a platform for volunteer computing. Volunteers can install BOINC
client on their computer and choose a scientific project to participate in.
Their client will then download digitally signed executable from master server
and start it when client's machine is idle.

Scientist are using BOINC to submit programs that are doing some kind of
scientific computation. More about BOINC on their home page:

    http://boinc.berkeley.edu/

## Nothing about V8

.

## Something about V8-BOINC

V8-BOINC was built in order to solve a challenge in volunteer computing called
cross-platform development. When one wants to make use of BOINC it is necessary
to port application's executable to all targeted platforms where application
will be started. This means additional porting effort to be able to use maximum
number of volunteer userbase.

Having JavaScript engine available on almost all platforms out there, V8-BOINC
is a wrapper that wraps JavaScript task into a BOINC task making it possible to
start on all major platforms without any porting effort.

Except for lack of porting, JavaScript virtual machine offers isolation
mechanism similar to solutions that are wrapping whole virtual images into a
BOINC task. While those solutions can start application written in other
languages, they hold an assumtion that user volunteer will have appropriate
hypervisor installed locally which differentiates this solution from V8-BOINC
approach. In V8-BOINC whole JavaScript virtual machine (statically compiled V8)
is sent to a client over wire. It is surprising that this taks no more than
10MB of bandwidth.

Additionally, having the tasks implemented in JavaScript it is logical to
provide volunteers an option to participate in project by just visiting a web
page, instead of having to install a BOINC client program. This part of the
system is called `browser-port`.

With `browser-port` and V8 wrapper V8-BOINC task can be started on machines
that run Internet browser or machines that can run BOINC client. This includes
smartphones, tablets, game consoles, desktops, and even routers. It is exciting
that you can write and submit a single JavaScript function that will run on all
these devices, isn't it?


