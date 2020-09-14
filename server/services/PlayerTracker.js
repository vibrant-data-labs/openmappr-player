'use strict';
var _        = require('lodash'),
    Globals  = require('./globals');

/**
 * this is duplicate of PlayerTracker
 */
var io = Globals.io,
    namespace = "/player_tracker",
    PlayerTracker = null;

function setupTracker () {
    console.log("[PlayerTracker] Setup namespace for Players: " + namespace);
    PlayerTracker = io().of(namespace);
    PlayerTracker.on('connection', function(socket) {
        console.log("New Connection to Player Tracker engine");
        // subscribe to project updates
        socket.on("subscibe_project_updates", function(data) {
            console.log("[PlayerTracker] Got data: ", data);
            if(data.projectId) {
                console.log("[PlayerTracker] Subscribed to channel: ", data.projectId);
                socket.join(data.projectId);
                socket.emit('subscribed_project_updates', data);
            }
        });
    });
}


function Message (projectId, status, data) {
    this.taskId = projectId.toString();
    this.status = status;
    this.data = data;
}

function update(projectId, status, data){
    var payload = new Message(projectId, status, data);
    PlayerTracker.to(projectId).emit('updated', payload);
    return payload;
}

function notify(projectId, status, data, msg_type){
    var payload  = new Message(projectId, status, data);
    PlayerTracker.to(projectId).emit(msg_type, payload);
    return payload;
}

module.exports = {
    setupTracker,
    update : update,
    notify : notify
};
