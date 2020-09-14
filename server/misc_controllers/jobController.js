'use strict';
var JobTracker = require('../services/JobTracker');

module.exports = {
    create : function(req, res) {
        var jobName = req.body.name;
        var taskId = req.body.taskId;
        if(jobName && jobName.length > 0 && taskId && taskId.length > 0) {
            var job = JobTracker.create(jobName, taskId);
            res.json(200,job);
        } else {
            res.json(400, {
                error : 'Invalid or no name/taskId given:' + req.body
            });
        }
    },
    find: function (req, res){
        res.json(JobTracker.pendingTasks());
    },

    findOne: function (req, res){
        console.log(req.params.id);
        var job = JobTracker.get(req.params.id);
        console.log("Found JOB: ", job);
        if(job) {
            res.status(200).json(job);
        } else {
            res.status(400).send(`Job with Id: ${req.params.id} not running`);
        }
    },

    dummy: function (req, res){
        var newJob = JobTracker.create();

        var timer1 = setInterval(function (){
            JobTracker.update(newJob.id, 'running', null, 4);
        }, 1000);

        var timer2 = setInterval(function(){
            var job = JobTracker.get(newJob.id);
            if(job.completion >= 100){
                JobTracker.update(newJob.id, 'completed', "done", 0);
                clearInterval(timer2);
                clearInterval(timer1);
            }
        }, 1000);

        res.json(200, newJob);
    },

    destroy: function (req, res){
        var taskId = req.params.id;
        var job = JobTracker.get(taskId);
        if(job && job.status === 'running') {
            console.log("cancelling already running job");
            res.json(JobTracker.update(taskId, "cancelled", null, 0));
        } else {
            console.log("Removing non running job:", job);
            job = JobTracker.remove(taskId);
            res.json(job);
        }
    }
};