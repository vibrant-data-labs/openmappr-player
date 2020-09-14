'use strict';
var ObjectID = require('mongodb').ObjectID;
var _        = require('lodash');
var Promise = require("bluebird");
var Globals = require('./globals');

var _tasks = {};
var _sockets = {};

var io = Globals.io;

// Version 2 notes
// user : socket :: 1 : 1
// user : task :: M : N
// we want to send task messages to each user interested in it.
// user opens recipe panel, he gets to see all updates for tasks in progress.

// function setup (server, credentials, cb) {
//  if(io) {
//      throw new Error("io has already been initialized!!", io);
//  }
//  if(credentials){
//      io = require('socket.io')(server, credentials);
//      console.log("[JobTracker.setup] socket initialized over https");
//  } else {
//      io = require('socket.io')(server);
//      console.log("[JobTracker.setup] socket initialized over http");
//  }
//  if(cb) { cb(null, io); }
// }

function create(name, id) {
    // return a new task
    var newTask = {
        'name': name,
        'id': id || new ObjectID().toString(),
        'status': 'running',
        'result': null,
        'completion': 0
    };
    var namespace  = "/" + newTask.id;
    console.log("namespace", namespace);
    _sockets[newTask.id] = io().of(namespace);
    // also listen on the beanstalkd
    _sockets[newTask.id].on('connection', function (socket){
        console.log("connected to the socket for taskId", newTask.id.slice());
    });
    _tasks[newTask.id] = newTask;
    return newTask;
}

function isUpdatable (taskId) {
    return _tasks[taskId].status !== 'cancelled' && _tasks[taskId].status !== 'failure' && _tasks[taskId].status !== 'deleted';
}


function update(taskId, status, result, completion){
    if(_tasks[taskId].status === 'cancelled') {
        throw new Error("Task has been cancelled");
    }
    if(_tasks[taskId].status === 'failure') {
        throw new Error("Task has been declared a failure");
    }
    if(_tasks[taskId].status === 'deleted') {
        throw new Error("Task has been deleted");
    }
    _tasks[taskId].status = status;
    _tasks[taskId].result = result;
    _tasks[taskId].completion += completion;
    _sockets[taskId].emit(taskId , _tasks[taskId]);
    return _tasks[taskId];
}

function notify(taskId, payload){
    _tasks[taskId].status = 'notification';
    _tasks[taskId].result =  payload;
    _sockets[taskId].emit(taskId , _tasks[taskId]);
    if(payload.completion) {
        _tasks[taskId].completion = payload.completion;
    }
    return _tasks[taskId];
}

function remove(taskId){
    var task = _tasks[taskId];
    if(task && isUpdatable(taskId)) {
        task.status = 'removed';
        _sockets[taskId].emit(taskId , _tasks[taskId]);
    }
    delete _sockets[taskId];
    delete _tasks[taskId];
    return true;
}

function pendingTasks(){
    return _.values(_tasks);
}

function get(taskId){
    return _tasks[taskId];
}

///////
/// Athena Event Handler
///////

function pipeAthenaEvents (taskId, athenaES) {
    console.log("pipeAthenaEvents from beanstalkd to socketio: ", taskId);
    var id = '' + taskId;

    athenaES.on('data', function(payload) {
        // console.log("pipeAthenaEvents: Got payload:", payload);
        // var id = '' + payload.id;
        // if(payload.type === 'create' && payload.name && id ) {
        //  if(!get(id)) {
        //      console.warn('Job with the id:' + id + ' does not exist!');
        //      create(payload.name, id);
        //  } else {
        //      console.info('Channel for id: ' + id + ' already exists :)');
        //  }
        // }
        // else
        if(payload.type === 'update' && id && payload.status) {
            var completion = typeof payload.completion != "number" ? parseInt(payload.completion,10) : payload.completion;
            console.log("[Athena][update]", payload.result);
            update(id, payload.status, payload.result, completion);
        }
        else if(payload.type === 'delete' && id) {
            remove(id);
        }
        else if(payload.type === 'error' && id) {
            update(id, payload.status, payload.result, 0);
            remove(id);
        }
        else if(payload.type === 'notify' && id) {
            console.log("[Athena][notify]", payload.msg);
            notify(id, payload);
        }
        else {
            console.log("invalid event", payload);
        }
    });
    athenaES.on('error', function(data) {
        console.log("pipeAthenaEvents: error:", data);
        data.result && console.warn("Athena Error:", data.result);
        update(id, data.status, data.result, 0);
        remove(id);
    });
    athenaES.on('end', function(err) {
        remove(id);
    });
}
///////
/// Recipe Engine Event Handler
///////

function pipeRecipeEngineEvents (taskId, machine) {
    console.log("pipeRecipeEngineEvents from RecipeEngine to socketio: ", taskId);
    var id = '' + taskId;
    machine.on('progress', function(data) {
        data.evt_type = "progress";
        update(id, 'running', data, data.completion);
    });
    machine.on('info', function(msg) {
        notify(id, msg);
    });
    machine.on('end', function(data){
        update(id, 'completed', data, 100);
        remove(id);
    });
    machine.on('error', function(data) {
        update(id, 'failed', data, 0);
        remove(id);
    });
    machine.on(machine.VALIDATION_FAILED, function(msg) {
        notify(id, msg);
        update(id, 'failed', msg, 0);
        remove(id);
    });
}

function waitOnPromise(taskId, promise, eventStream) {
    if(!taskId) throw new Error('Task Id is null');
    if(!promise) throw new Error('promise is null');
    update(taskId, 'running', {msg: 'started listening to promise'}, 1);
    promise.reflect().then(inspection => {
        if(inspection.isFulfilled()) {
            update(taskId, 'completed', inspection.value(), 100);
        } else {
            update(taskId, 'failed', inspection.reason(), 0);
        }
    });
    eventStream.on('progress', msg => {
        notify(taskId, msg);
    });
    eventStream.on('error', error => console.error(error));
    return null;
}

module.exports = {
    create: create,
    pipeAthenaEvents : pipeAthenaEvents,
    pipeRecipeEngineEvents : pipeRecipeEngineEvents,
    update: update,
    remove: remove,
    isUpdatable : isUpdatable,
    pendingTasks: pendingTasks,
    get: get,
    waitOnPromise : waitOnPromise
};
