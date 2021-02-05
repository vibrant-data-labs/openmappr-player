'use strict';

var _  = require('lodash');
var Promise = require('bluebird');
var md5         = require('md5');

var PlayerDB = require('../schemas/player_schema'),
    mapping          = require('../../mapping.json'),
    UIDUtils         = require('../services/UIDUtils.js');

// the default player template
function genPlayerObj(projName) {
    return {
        playerUrl: null, // let server assign name - till we have ui + validation
        picture: 'https://s3-us-west-1.amazonaws.com/mappr-misc/icons/player_icon_default.png',
        settings: {
            allowJoin: false,
            showModal: false,
            fontClass: '',
            modalIntroHtml: '<h1>'+ projName +'</h1><div>Each of the 1000 nodes in this mapp represents ...</div><div>They are linked with each other if they are similar across the following attributes</div><div>a) Attribute 1</div><div>b) Attribute 2</div><h1></h1>',
            modalTitle: projName,
            searchAlg: 'naive',
            neighborhoodDegree: 0,
            startPage: 'modal',
            modalSubtitle: '',
            modalLogo: '',
            modalBackground: '',
            modalDescription: '',
            highlightColor: '#e21186',
            simpleSplash: true,
            showHeader: true,
            headerType: 'simple',
            headerHtml: '<h1>' + projName + '</h1>',
            headerImageUrl: '',
            headerTitle: projName,
            facebookShare: false,
            twitterShare: false,
            showSearch: true,
            colorTheme: 'light',
            showPanels: true,
            panelLayoutType: 'interactive', //'static'
            autoPlay: false,
            totalDuration: 1000,
            snapTransition: 'tween',
            creativeCommons: 'none',
            showTimeline: true,
            showSnapDescrs: true,
            // minimizeSnapDescrs: false,
            timelineType: 'bottom',
            snapDuration: 10,
            showSnapToolitips: false,
            showExportBtn: true
        }
    };
}

function buildPlayer(reqBody, userId, project, callback) {
    console.log('[player_model.buildPlayer] attempting to build default player ');

    var newPlayer =     genPlayerObj(project.projName);
    newPlayer.org =     {ref: project.org.ref};
    newPlayer.project = {ref: project._id};
    newPlayer.owner =   {ref: userId};
    newPlayer.metrics = {viewCount:0, likes: 0};
    newPlayer.isDisabled = true;
    newPlayer.isPrivate = false;
    newPlayer.directAccess = true;
    newPlayer.access_token = md5(UIDUtils.generateShortUID6());
    newPlayer.dateCreated = Date.now();
    newPlayer.dateModified = Date.now();
    newPlayer.buildVer = mapping.version;
    if(reqBody.descr) newPlayer.descr     = reqBody.descr;
    if(reqBody.picture) newPlayer.picture = reqBody.picture;
    if(reqBody.tags) newPlayer.tags       = reqBody.tags;
    if(reqBody.settings) {
        _.assign(newPlayer.settings, reqBody.settings);
    }

    checkUrlAvailable(reqBody.playerUrl , function(err, result) {
        if(err) {
            return callback(err);
        }
        newPlayer.playerUrl = result ? reqBody.playerUrl : 'play-' + UIDUtils.generateShortUID4();
        callback(null, newPlayer);
    });
}

function add(player, callback) {
    //console.log(player);
    //console.log('[player_model.add]' + JSON.stringify(player));
    var instance = new PlayerDB(player);

    instance.save(function(err, doc) {
        if (err) {
            console.log('[player_model.add] Database Error: could not add new player',err);
            callback(err, false);
        } else {
            //console.log(doc);
            callback(null, doc);
        }
    });
}

// function listAll(callback) {
//  return PlayerDB.find({}, function(err, docs) {
//      if (err) {
//          callback(err, false);
//      } else {
//          console.log('[player_model.listAll]' + docs.length);
//          callback(null, docs);
//      }
//  });
// }

function listById(id, callback) {
    return PlayerDB.findOne({
        _id: id
    }, function(err, doc) {
        if (err) {
            console.error('[player_model.listById] Error: ' + err);
            callback(err, false);
        } else {
            callback(null, doc);
        }
    });
}

function listByProjectId(projId, callback) {
    PlayerDB.findOne({"project.ref": projId}, null, {sort: {date_created: -1}})
    .exec(function(err, doc) {
        if (err) {
            console.error('[player_model.listByProjectId] Error: ' + err);
            callback(err, false);
        } else {
            if(doc){
                callback(null, doc);
            } else {
                // console.log('[player_model.listByProjectId] ' + projId, ' - no players found');
                callback('No Players Found', false);
            }
        }
    });
}

function listByPlayerUrl(playerUrl, callback) {
    return PlayerDB.find({playerUrl: playerUrl}, null, {sort:{date_created: -1}})
    .exec(function(err, doc) {
        if (err) {
            console.log('[player_model.listByPlayerUrl] Error: ' + err);
            callback(err, false);
        } else {
            if(doc){
                callback(null, doc[0]);
            } else {
                callback(new Error('Player Not Found'), false);
            }
        }
    });
}

// function updateById(id, updateParams, callback) {
//  //remove "_id" param if updating
//  // updateParams = updateParams.toObject();
//  delete updateParams._id;
//  console.log("player_"+id+": "+JSON.stringify(updateParams));
//  PlayerDB.update({
//      _id: id
//  }, updateParams, {
//      multi: false
//  }, function(err, numberAffected, raw) {
//      if (err) {
//          console.log('[player_model.update] Error updating : ' + err);
//          callback(err, false);
//      } else {
//          console.log('[player_model.update] The number of updated documents was %d', numberAffected);
//          console.log('[player_model.update] [id:' + id + ']  The raw response from Mongo was: ', raw);
//          callback(null, 'Success: Player updated');
//      }
//  });
// }

//update all players that have the ids listed and contain the snapshot to be updated
function updateSnapshot(ids, snap, callback) {
    console.log('ids: '+JSON.stringify(ids));
    // This merge is complex, simply because of the hack that is playerMaker
    // 1) Snapshot name / descr / picture were only saved in the player's snapshots
    // 2) picture could actually be saved anywhere
    // Until playerMaker is fixed, there is nothing that can be done except merge based on herusitcs

    PlayerDB.update({
        _id:{ $in : ids },
        'snapshots.id':snap.id
    }, {$set:{'snapshots.$':snap}}, {
        multi: true
    }, function(err, numberAffected, raw) {

        if (err) {
            console.log('[player_model.updateSnapshot] Error updating : ' + err);
            callback(err);
        } else {
            console.log('[player_model.updateSnapshot] The number of updated documents was %d', numberAffected);
            console.log('[player_model.updateSnapshot] [snap.id:' + snap.id + ']  The raw response from Mongo was: ', raw);
            callback(null, snap);
        }
    });
}

// function removeSnapshot(ids, snapId, callback) {
//  console.log('ids: '+JSON.stringify(ids));
//  PlayerDB.update({
//      _id:{ $in : ids }
//  }, {$pull: {'snapshots': {'id': snapId}}}, {
//      multi: true
//  }, function(err, numberAffected, raw) {

//      if (err) {
//          console.log('[player_model.deleteSnapshot] Error updating : ' + err);
//          callback(err, false);
//      } else {
//          console.log('[player_model.deleteSnapshot] The number of updated documents was %d', numberAffected);
//          console.log('[player_model.deleteSnapshot] [snap.id:' + snapId + ']  The raw response from Mongo was: ', raw);
//          callback(null, 'Success: Snapshot deleted in all players');
//      }
//  });
// }

function removeById(id, callback) {
    console.log('[player_model.removeById] id: ' + id);
    PlayerDB.remove({
        _id: id
    },
    function(err) {
        if (err) {
            console.log('[player_model.RemoveById] Error:' + err);
            callback(err, false);
        } else {
            console.log('[player_model.removeById] id: ' + id + ' deleted');
            callback(null, '[player_model.removeById] id: ' + id + ' deleted');
        }
    });
}

function checkUrlAvailable(url, callback) {

    //if player name is shorter than 3 letters - deny
    //other rules can go here
    if(typeof url === "undefined" || url === null || url.length < 3) {
        return callback(null, false);
    }
    PlayerDB.find({playerUrl: url}, {_id: 1}, function(err, result) {
        if(err) {
            return callback(err);
        }
        console.log('result: ' + JSON.stringify(result));
        callback(null, !result || result.length === 0);
    }).limit(1);
}

//API
var api = {
    buildPlayer : buildPlayer,
    add:                add,
    // listAll:         listAll,
    listById:           listById,
    listByProjectId:    listByProjectId,
    listByPlayerUrl:    listByPlayerUrl,
    // updateById:          updateById,
    removeById:         removeById,
    updateSnapshot:     updateSnapshot,
    // removeSnapshot:  removeSnapshot,
    checkUrlAvailable:  checkUrlAvailable
};
module.exports = Promise.promisifyAll(api);
