'use strict';

/**
 * Common services used across mappr.
 */

var io = null;


function setupIO (server, credentials, cb) {
    if(io) {
        throw new Error("io has already been initialized!!", io);
    }
    if(credentials){
        io = require('socket.io')(server, credentials);
        console.log("[Globals.setup] socket initialized over https");
    } else {
        io = require('socket.io')(server);
        console.log("[Globals.setup] socket initialized over http");
    }
    if(cb) { cb(null, io); }
}

module.exports = {
    setupIO,
    io : function() {return io; }
};