'use strict';

var _           = require('lodash'),
    Promise     = require('bluebird'),
    md5         = require('md5'),
    fs          = require('fs');

var UploadAPI        = require('../services/UploadAPI'),
    playerModel      = require("./player_model"),
    projModel        = require("../project/proj_model"),
    UIDUtils         = require('../services/UIDUtils.js'),
    dataUtils        = require("../utils/dataUtils.js"),
    DSModel          = require("../datasys/datasys_model"),
    NetworkDataCache = require("../services/NetworkDataCache.js"),
    mapping          = require('../../mapping.json');

module.exports = {

    create: function(req, res) {
        console.log('[player_controller.create] attempting to create player ');
        var p = req.body;
        playerModel.buildPlayerAsync(p, req.user._id, req.project)
        .then(function (newPlayer) {
            console.log( '[player_controller.create] Creating player: ', newPlayer.playerUrl, ' creation details - project:', newPlayer.project.ref);
            return playerModel.addAsync(newPlayer);
        }).then(function (playerDoc) {
            console.log('[player_controller.create] Success.');
            res.status(200).send(playerDoc);
        }).catch(function (err) {
            console.error( '[player_controller.create] Error in Creating player: ',err);
            res.status(500).send(err);
        });
    },

    read: function(req, res) {
        res.status(200).json(req.player);
    },

    readByProjId: function(req, res) {
        // console.log(`[player_controller.readByProjId]#############\nParams : ${JSON.stringify(req.params,null,4)}\n#############`);
        playerModel.listByProjectId(req.params.pid, function(err, docs) {
            if (err) {
                console.log('[player_controller.readByProjId] error ' + err);
                return res.status(500).send(err);
            }
            res.status(200).send(docs);
        });
    },
    // mounted directly by top router
    renderPlayer:function(req, res) {
        var skipVerString = !!req.query.skipver;
        var dataPath = req.query.data_path;
        var playerParams = req.params[0].split('/');
        console.log('playerParams');
        playerModel.listByPlayerUrl(playerParams[0], function(err, docs) {

            if (err || typeof docs === "undefined" || docs.length === 0) {
                console.log('[player_controller.readByUrl] error ' + err);
                return res.render('404.jade');
            }
            console.log('[player_controller.readByUrl] done');
            //console.log(docs);
            if(docs.isDisabled) {
                console.log('[player_controller.readByUrl] player disabled');
                return res.render('404.jade');
            }

            projModel.listByIdAsync(docs.project.ref).then((proj) =>{
                if(!docs.isPrivate) { return renderIndex(docs, proj); }
                if(!docs.directAccess) { return renderIndex(docs, proj); }
                // Direct access via URL which has access key
                if(!req.query.access_token || req.query.access_token != docs.access_token) {
                    // Wrong access key or no access key for direct access
                    res.render('404.jade');
                } else {
                    renderIndex(docs, proj);
                }
            });
        });

        function renderIndex(playerObj, projectObj) {
            var role = 'anon',
                _id = '',
                playerBuildVer = playerObj.buildVer || '';
            // TODO: WTF is this for?
            if (req.user) {
                role = req.user.role;
                _id = req.user._id;
                console.log('[player_controller.renderPlayer] _id: ', _id);
                res.cookie('user', JSON.stringify({
                    '_id': _id,
                    'role': role
                }));
            }

            //page title
            var title = playerObj.settings.headerTitle;
            if(title) {
                title += ' - Mappr';
            } else {
                title = 'Mappr';
            }
            //immediate background color
            var bkgrndColor = '#fff';
            if(playerObj.settings.colorTheme == 'dark') {
                bkgrndColor = '#000';
            }
            var playerInfo = {
                playerLoadInfo: JSON.stringify({
                    isPublicPlayer: !playerObj.isPrivate,
                    playerBuildVer: playerBuildVer,
                    directAccess: playerObj.directAccess,
                    isFinal: playerObj.isFinal
                }),
                playerTitle: title,
                backgroundColor: bkgrndColor,
                colorTheme: playerObj.settings.colorTheme,
                snapshotImg: projectObj.snapshots[0].summaryImg || '/img/openmappr_socialmedia.png',
                playerDataPath: dataPath
            };

            console.log("[player_controller.renderPlayer] skipVerString: ", skipVerString);
            if(req.app.get('env') == 'production') {
                if(playerBuildVer && !skipVerString) {
                    playerInfo['player_prefix_index'] = mapping.s3Url + 'build-' + playerBuildVer;
                }
                else {
                    playerInfo['player_prefix_index'] = mapping.s3Url + 'build-' + mapping.version;
                }
            }
            else {
                playerInfo['player_prefix_index'] = '';
            }

            res.render('index_player.jade', playerInfo);
        }
    },

    //Non cache edition - will be replaced
    readByUrl: function(req, res) {
        playerModel.listByPlayerUrl(req.params.urlStr, function(err, docs) {
            // fetch project
            // then assign project's snapshot / dataset / network keys to the player and send it
            if (err || typeof docs === "undefined" || docs.length === 0) {
                console.log('[player_controller.readByUrl] error ' + err);
                return res.status(500).send('player not found', err);
            }

            console.log('[player_controller.readByUrl] done');
            //console.log(docs);
            if(!docs.isPrivate) {
                return sendDoc();
            }
            if(docs.directAccess) {
                if(!req.query.access_token || req.query.access_token != docs.access_token) {
                    console.log(req.query.access_token, docs.access_token);
                    res.render('404.jade');
                } else {
                    sendDoc();
                }
            } else {
                if(!req.query.access_token || req.query.access_token != docs.access_token) {
                    res.status(403).send('Invalid access key');
                } else {
                    sendDoc();
                }
            }

            function sendDoc() {
                var projectP = projModel.listByIdAsync(docs.project.ref);
                projectP
                    .then(function(project){
                        var proj = project.toObject();
                        var player = docs.toObject();
                        player.snapshots = proj.snapshots;
                        player.dataset = proj.dataset;
                        player.networks = proj.networks;
                        player.projSettings = proj.settings;
                        return player;
                    })
                    .then(function(player) {
                        res.status(200).send(player);
                    })
                    .catch(err => res.status(500).send(err));
                if(!docs.metrics.viewCount) {
                    docs.metrics.viewCount = 0;
                }
                docs.metrics.viewCount = docs.metrics.viewCount + 1;
                docs.save(function(err, player){
                    console.log('[player_controller.readByUrl] viewCount:' + player.metrics.viewCount);
                });
            }
        });
    },

    downloadSelection: function(req, res) {
        var logPrefix = "[player_controller.downloadSelection] ";
        var p = req.body;
        if(!p.networkId) {
            return res.status(500).send('Need network Id');
        }
        var dataFilters = {
            nodesFilter: function(n) {return n;},
            linksFilter: function(n) {return n;}
        };
        if(p.selectionData) {
            dataFilters.nodesFilter = function(entities) {
                return _.filter(entities, function(entity) {
                    return p.selectionData.nodeIds.indexOf(entity.id) > -1;
                });
            };
            dataFilters.linksFilter = function(entities) {
                return _.filter(entities, function(entity) {
                    return p.selectionData.linkIds.indexOf(entity.id) > -1;
                });
            };
        }

        var projectP = projModel.listByIdAsync(req.player.project.ref);

        projectP
            .then(function(project) {
                console.log(logPrefix + 'reading data for datasetId: ', project.dataset.ref);

                var datasetP = DSModel.readDataset(project.dataset.ref, false);
                var networkP = DSModel.readNetwork(p.networkId, false, false);

                return Promise.join(datasetP, networkP, function(dataset, network) {
                    var fileGenerator = dataUtils.generateNetworksXLSX;

                    fileGenerator(dataset, [network], dataFilters, p.fileNamePrefix, function(fileData) {
                        res.status(200).send(fileData);
                    });
                    return null;
                });
            })
            .catch(function(errr) {
                var err = errr.stack || errr;
                console.error("[getDataset] Error in fetching. ", err);
                res.status(500).send(err);
            });
    },
    update: function(req, res) {
        var p = req.body;

        if(p.playerUrl) req.player.playerUrl       = p.playerUrl;
        if(p.descr) req.player.descr               = p.descr;
        if(p.picture) req.player.picture           = p.picture;
        if(p.tags) req.player.tags                 = p.tags;
        if(p.settings) req.player.settings         = _.cloneDeep(p.settings);
        if(p.isDisabled   != null) req.player.isDisabled    = p.isDisabled;
        if(p.isPrivate    != null) req.player.isPrivate     = p.isPrivate;
        if(p.isEditable   != null) req.player.isEditable    = p.isEditable;
        if(p.directAccess != null) req.player.directAccess  = p.directAccess;
        if(p.access_token) req.player.access_token = p.access_token;

        req.player.dateModified = Date.now();
        req.player.save(function(err, savedPlayer){
            if (err) {
                return res.status(500).json('Error updating player:' + err);
            }
            res.status(200).send(savedPlayer);
        });
    },

    finalisePlayer: function(req, res) {
        var playerObj = req.body;
        var finalPlayersTmpDir = '././final_players/';
        var playerDir = finalPlayersTmpDir + playerObj.playerUrl + '/';
        if(!fs.existsSync(finalPlayersTmpDir)) {
            fs.mkdirSync(finalPlayersTmpDir);
        }
        if(!fs.existsSync(playerDir)) {
            fs.mkdirSync(playerDir);
        }

        var datasetP = DSModel.readDataset(req.project.dataset.ref, false);
        var networksP = Promise.all(_.map(req.project.networks, function(networkObj) {
            return DSModel.readNetwork(networkObj.ref, false, false);
        }));

        Promise.join(datasetP, networksP)
        .then(function(dataArr) {
            var ds = dataArr[0];
            var nwsArr = dataArr[1];
            playerObj.isFinal = true;
            playerObj.dateModified = Date.now();
            playerObj.snapshots = req.project.snapshots;
            playerObj.dataset = req.project.dataset;
            playerObj.networks = req.project.networks;
            playerObj.projSettings = req.project.settings;

            var dsJsonP = NetworkDataCache.writeFileAsync(playerDir + 'dataset.json', JSON.stringify(ds, null), false);
            var nwJsonP = NetworkDataCache.writeFileAsync(playerDir + 'networks.json', JSON.stringify(nwsArr, null), false);
            var plJsonP = NetworkDataCache.writeFileAsync(playerDir + 'playerObj.json', JSON.stringify(playerObj, null), false);

            return Promise.all([dsJsonP, nwJsonP, plJsonP]);
        })
        .then(function() {
            return UploadAPI.uploadDirToS3(playerDir, playerObj.playerUrl);
        })
        .then(function() {
            NetworkDataCache.deleteFolderRecursive(playerDir);

            req.player.dateModified = playerObj.dateModified;
            req.player.isFinal = playerObj.isFinal;

            return new Promise(function(resolve, reject) {
                req.player.save(function(err, savedPlayer){
                    if (err) {
                        reject('Error updating player:' + err);
                    } else {
                        resolve(savedPlayer);
                    }
                });
            });

        })
        .then(function(finalisedPlayer) {
            res.status(200).send(finalisedPlayer);
        })
        .catch(function(err) {
            console.log('Finalising player failed');
            console.error(err);
            NetworkDataCache.deleteFolderRecursive(playerDir);
            res.status(500).send('Error finalising player: ' + err);
        });
    },

    regenerateAccessToken: function(req, res) {
        var p = req.body;
        if(p.currentAccessToken === req.player.access_token) {
            req.player.access_token = md5(UIDUtils.generateShortUID6());
            req.player.dateModified = Date.now();
            req.player.save(function(err, savedPlayer){
                if (err) {
                    res.status(500).json('Error updating player:' + err);
                } else {
                    res.status(200).send({newAccessToken: savedPlayer.access_token});
                }
            });
        }
        else {
            res.status(500).json('Tokens do not match');
        }
    },

    updateSnapshotSequence: function(req, res) {
        module.exports.authorizeEntityWriteAccess(req, res, function() {
            var newSequenceOfSnapIds = req.body.arr;
            var newSnapArray = [];
            //console.log(newSequenceOfSnapIds);

            var snap = null;

            for (var i = 0, l = newSequenceOfSnapIds.length ; i < l; i++) {
                snap = returnSnapWithId(req.player, newSequenceOfSnapIds[i]);
                if(snap){
                    newSnapArray.push(snap);
                }
            }

            req.player.snapshots = newSnapArray;
            req.player.save(function(err, savedPlayer){
                if(err){
                    res.status(500).json('unable to save new snapshots sequence. ' + err);
                } else {
                    res.status(200).json(savedPlayer.snapshots);
                }
            });
        });
    },
    updateSnapshotsInPlayers: function(req, res){
        module.exports.authorizeEntityWriteAccess(req, res, function() {
            var playerIds = req.body.playerIds;
            var snap = req.body.snap;
            console.log("[updateSnapshotsInPlayers] PlayerIds: ", playerIds);
            // console.log("[updateSnapshotsInPlayers] snapshot: ", snap);

            playerModel.updateSnapshot(playerIds, snap, function(err, result) {
                if(err){
                    res.status(500).json('unable to save players. ', err);
                } else {
                    res.status(200).json(result);
                }
            });
        });
    },

    checkUrlAvailable: function(req, res) {
        if(!req.body.url) return res.status(500).send('Need url to check');

        playerModel.checkUrlAvailableAsync(req.body.url)
        .then(result => {
            console.log('[player_controller.checkUrlAvailable: ] is url available for ' + req.body.url + ' : ' + result);
            res.status(200).send({isAvailable: result});
        })
        .catch(err => {
            console.error('[player_controller.checkUrlAvailable ] ', err);
            res.status(500).send(err);
        });
    },

    updateDisabledStatus: function(req, res){
        var p = req.body;
        if(p.isDisabled != null) req.player.isDisabled = p.isDisabled;
        req.player.dateModified = Date.now();
        req.player.save(function(err, savedPlayer){
            if (err) {
                res.status(500).send('Error updating player:' + err);
            } else {
                res.status(200).send(savedPlayer);
            }
        });
    }
};
