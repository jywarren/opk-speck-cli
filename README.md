Node Speck Gateway
==================

A Node.js gateway for the CMU CREATE Lab Speck particle sensor.  This initial version only writes to a CSV.

Usage
=====

Run the gateway with:

    node index.js

Or, if you use [nodemon](https://github.com/remy/nodemon):

    nodemon index.js
    
Either way, if you want to see info and error messages, prepend the run command with `DEBUG=info,error`, like this:

    DEBUG=info,error node index.js

Or:

    DEBUG=info,error nodemon index.js

If you want to connect to a Speck on a particular port, use something like this:

    SPECK_PATH=0001:0005:00 DEBUG=info,error node index.js

