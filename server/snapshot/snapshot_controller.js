'use strict';
var _           = require('lodash');

var projModel = require("../project/proj_model.js"),
    playerModel          = require("../player/player_model.js"),
    generateShortUID6 = require('../services/UIDUtils').generateShortUID6;

function returnSnapWithId(project, snapId){
    var found = null;
    for (var i = project.snapshots.length - 1; i >= 0; i--) {
        if(project.snapshots[i].id == snapId){
            found = project.snapshots[i];
            break;
        }
    }
    return found;
}



var api = {
    addProjectSnapshot: function(req, res) {
        var p = req.body;
        var newSnap = {
            id           : "snap-" + generateShortUID6(),
            snapName     : p.snapName,
            descr        : p.descr,
            audio        : p.audio,
            type         : p.type,
            embed        : p.embed,
            text         : p.text,
            picture      : p.picture,
            author       : {ref: req.user._id},
            layout       : p.layout,
            networkId    : p.networkId,
            ndSelState   : p.ndSelState,
            edSelState   : p.edSelState,
            camera       : p.camera,
            pinnedAttrs  : [],
            pinState     : p.pinState,
            dateModified : Date.now(),
            isDeleted    : false,
            isEnabled    : p.isEnabled,
            processSelection: p.processSelection
        };

        req.project.snapshots.push(newSnap);
        //console.log(req.project.snapshots);
        req.project.save(function(err, projDoc){
            if(err){
                console.log(err);
                return res.status(500).json(err);
            }
            res.status(200).json(newSnap);
        });
    },

    updateProjectSnapshot: function(req, res) {
        var p = req.body.snapshot;
        console.log('update snap request: ' + p.id);
        console.log("NetworkID: ",p.networkId);
        var updatedSnap = {
            id           : p.id,
            snapName     : p.snapName || 'snapshot',
            subtitle     : p.subtitle || '',
            summaryImg   : p.summaryImg || '',
            descr        : p.descr || '',
            audio        : p.audio || '',
            picture      : p.picture || '',
            type         : p.type || '',
            text         : p.text || '',
            embed        : p.embed || '',
            author       : { ref : req.user._id },
            layout       : p.layout,
            networkId    : p.networkId,
            ndSelState   : p.ndSelState,
            edSelState   : p.edSelState,
            camera       : p.camera,
            pinnedAttrs  : p.pinnedAttrs,
            pinState     : p.pinState,
            dateModified : Date.now(),
            isDeleted    : false,
            isEnabled    : p.isEnabled,
            processSelection: p.processSelection
        };
        projModel.updateSnapshot(req.project.id, updatedSnap, function(err, snap){
            if(err){
                console.warn('[updateProjectSnapshot] Error in updating project:' ,err);
                return res.status(500).send(err);
            }
            if(req.body.updatePlayer) {
                playerModel.listByProjectId(req.project.id, function(err, players) {
                    if(err) {
                        console.warn("[updateProjectSnapshot] Unable to fetch players for project: ", req.project.id);
                        return res.status(200).json(updatedSnap);
                    }
                    var playerIds = _.reduce(players, function(acc, p) { acc.push(p._id); return acc; }, []);
                    console.log("Project updated, updating players: ", playerIds);
                    playerModel.updateSnapshot(playerIds, updatedSnap, function(err, result) {
                        if(err){
                            console.warn('[updateProjectSnapshot] Error in updating players:' ,err);
                            return res.status(500).send('unable to save players. ' + err);
                        }
                        console.log("Project and players updated");
                        res.status(200).json(updatedSnap);
                    });
                });
            } else {
                console.log("Project updated");
                res.status(200).json(updatedSnap);
            }
        });
    },
    updateSnapshotsInPlayers: function(req, res){
        var playerIds = req.body.playerIds;
        var snap = req.body.snapshot;
        console.log("[updateSnapshotsInPlayers] PlayerIds: ", playerIds);
        // console.log("[updateSnapshotsInPlayers] snapshot: ", snap);
        console.log("[updateSnapshotsInPlayers] body keys: ", _.keys(req.body));
        if(!playerIds || !snap) {
            res.status(400).json("No playerId or snapshot provided");
        }
        playerModel.updateSnapshot(playerIds, snap, function(err, result) {
            if(err){
                return res.status(500).json('unable to save players. ', err);
            }
            res.status(200).json(result);
        });
    },
    removeProjectSnapshot: function(req, res) {
        var foundIndex = -1;
        for (var i = req.project.snapshots.length - 1; i >= 0; i--) {
            if (req.project.snapshots[i].id == req.params.snapId) {
                req.project.snapshots.splice(i, 1);
                foundIndex = i;
                break;
            }
        }

        if (foundIndex != -1) {
            req.project.save(function(err, projDoc) {
                if (err) {
                    console.log(err);
                    return res.status(500).json(err);
                }
                res.status(200).json({delId: req.params.snapId});
            });
        } else {
            res.status(500).send('snapshot not found in project');
        }
    },

    updateProjectSnapshotSequence: function(req, res) {
        var newSequenceOfSnapIds = req.body.arr;
        var newSnapArray = [];
        //console.log(newSequenceOfSnapIds);

        var snap = null;

        for (var i = 0, l = newSequenceOfSnapIds.length ; i < l; i++) {
            snap = returnSnapWithId(req.project, newSequenceOfSnapIds[i]);
            if(snap){
                newSnapArray.push(snap);
            }
        }

        req.project.snapshots = newSnapArray;
        req.project.save(function(err, savedProj){
            if(err){
                return res.status(500).json('unable to save new snapshots sequence. ' + err);
            }
            res.status(200).json(savedProj.snapshots);
        });
    }
};
module.exports = api;
