'use strict';
var _        = require('lodash'),
    Globals  = require('./globals');

/**
 * this is duplicate of JobTracker but moves it to version 2. Specific for recipe engine
 */
var io = Globals.io,
    namespace = "/recipe_tracker",
    recipeTracker = null;

var jobStatus = {};

// Version 2 notes
// user : socket :: 1 : 1
// user : task :: M : N
// we want to send task messages to each user interested in it.
// when user opens recipe panel, he gets to see all updates for tasks in progress.
// when he opens a particular recipe, he sees all the updates to this task
//
// all connect to /recipe_tracker namespace. for each namespace, we have a room for each task.
// When a client connects, he requests with a


function setupTracker () {
    console.log("[RecipeTracker] Setup namespace for recipes: " + namespace);
    recipeTracker = io().of(namespace);
    recipeTracker.on('connection', function(socket) {
        console.log("New Connection to Recipe Tracker engine");
        // subscribe to task events
        socket.on("subscribe_task", function(data) {
            console.log("[RecipeTracker] Got data: ", data);
            if(data.taskId) {
                console.log("[RecipeTracker] Subscribed to channel: ", data.taskId);
                socket.join(data.taskId);
                socket.emit('subscribed_task', data);
            }
        });
        // other things like subscribe all active recipes in an org
    });
}


function Job (taskId, status, result, completion) {
    this.taskId = taskId;
    this.status = status;
    this.result = result;
    this.completion = completion || 0;
}

function update(taskId, status, result, completion){
    var job = jobStatus[taskId];
    if(!job) {
        job = jobStatus[taskId] = new Job(taskId, status, result, completion);
    }
    if(job.status === 'cancelled') {
        throw new Error("Job has been cancelled");
    }
    if(job.status === 'failure') {
        throw new Error("Job has been declared a failure");
    }
    if(job.status === 'deleted') {
        throw new Error("Job has been deleted");
    }
    job.status = status;
    job.result = result;
    job.completion += completion;
    recipeTracker.to(taskId).emit(job.status, job);
    return job;
}

function notify(taskId, payload){
    var job = jobStatus[taskId];
    if(!job) {
        job = jobStatus[taskId] = new Job(taskId);
    }
    job.status = 'notification';
    job.result =  payload;

    if(payload.completion) {
        job.completion = payload.completion;
    }

    recipeTracker.to(taskId).emit(job.status, job);
    return job;
}

function remove(taskId){
    recipeTracker.to(taskId).emit('removed', jobStatus[taskId]);
    delete jobStatus[taskId];
    return true;
}

function pendingTasks(){
    return _.values(jobStatus);
}

function get(taskId){
    return jobStatus[taskId];
}

///////
/// Recipe Engine Event Handler
///////

function pipeRecipeEngineEvents (run, runEventStream, machine) {
    console.log("pipeRecipeEngineEvents from RecipeEngine to socketio: ", run.taskId);
    var id = '' + run.taskId;
    machine.on('progress', function(data) {
        data.evt_type = "progress";
        update(id, 'running', data, data.completion);
    });
    machine.on('info', function(msg) {
        notify(id, msg);
    });
    machine.on('end', function(data){
        // only if job is stil there.
        if(get(id)) {
            update(id, 'completed', data, 100);
            remove(id);
        }
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
    runEventStream.on('run_updated', function(run) {
        update(id, 'run_updated', _.pick(run, ["name", "recipe", "org", "createdAt", "modifiedAt", "isSuccessful", "isRunning", "taskId", "phasesBegun", "phasesEnd"]));
    });
}
module.exports = {
    setupTracker,
    pipeRecipeEngineEvents : pipeRecipeEngineEvents,
    update: update,
    remove: remove,
    get: get,
    pendingTasks
};
