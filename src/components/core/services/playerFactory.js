/**
* APIs for player related ops
*/
angular.module('common')
.service('playerFactory', ['$q', '$http', 'projFactory',
function($q, $http, projFactory) {
    "use strict";



    /*************************************
    *************** API ******************
    **************************************/
    this.currPlayer =       getCurrPlayer;
    this.clear =            clear;
    this.getPlayer =        getPlayerDoc;
    this.getPlayerById =    getPlayerDocById;
    this.getPlayerLocally = getPlayerDocLocally;
    this.getPlayerUnsafe =  function() { return currPlayer; };
    this.getPlayersByProj = getPlayersDocsByProj;
    this.loadPlayerFromS3 = loadPlayerFromS3;
    //edit Player
    this.createPlayer =     addDoc;
    this.updatePlayer =     updateDoc;
    this.finalisePlayer =   finalisePlayer;
    // this.disablePlayer  =        disablePlayer;
    // this.enablePlayer  =             enablePlayer;
    this.updatePlayersSnap = updateDocsSnap;
    this.removePlayer =      removeDoc;
    this.checkUrlAvailable = checkUrlAvailable;
    this.regenerateAccessToken = regenerateAccessToken;
    this.downloadSelection = downloadSelection;


    /*************************************
    ********* Local Data *****************
    **************************************/
    var currPlayer = null;
    var currPlayerDefer = null;



    /*************************************
    ********* Core Functions *************
    **************************************/

    function clear() {
        currPlayer = null;
    }

    //public access
    function getPlayerDoc(playerUrlStr) {
        //returns a promise
        console.log('[playerFactory.getPlayerDoc]');
        return $http.get('/api/players/' + playerUrlStr).then(function(response) {
            console.log(response);
            if(response.status === 500){
                currPlayerDefer.reject('Some error');
                return null;
            } else {
                //expect the player document
                currPlayer = response.data;
                currPlayerDefer && currPlayerDefer.resolve && currPlayerDefer.resolve(currPlayer);
                return currPlayer;
            }
        });
    }

    function getPlayerDocLocally() {
        console.log('[playerFactory.getPlayerDocLocally]');
        return $http.get(DATA_PATH + 'settings.json?t=' + Date.now()).then(function(response) {
            _.forEach(response.data.snapshots, (snap) => {
                if (!snap.layout.settings.drawClustersCircle) {
                    snap.layout.settings.drawClustersCircle = false;
                }

                if (!snap.layout.settings.nodeClusterAttr) {
                    snap.layout.settings.nodeClusterAttr = snap.layout.settings.nodeColorAttr;
                }
            });
            if(response.status === 500) {
                currPlayerDefer.reject('Some error');
                return null;
            } else {
                //expect the player document
                currPlayer = response.data;
                currPlayerDefer && currPlayerDefer.resolve && currPlayerDefer.resolve(currPlayer);
                return currPlayer;
            }
        });
    }

    function loadPlayerFromS3(playerUrl) {
        return $http.get(playerUrl + 'playerObj.json')
            .then(function(response) {
                console.log('S3 player Obj- ', response.data);
                currPlayer = response.data;
                return response.data;
            });
    }

    //logged-in-user.must-have(PROJ.readAccess)
    function getPlayerDocById(orgId, playerId) {
        //returns a promise
        console.log('[playerFactory.getPlayerDoc]');
        return $http.get('/api/orgs/' + orgId + '/players/' + playerId)
        .then(function(response){
            return response.data;
        });
    }

    // Finalises the player
    function finalisePlayer(orgId, projId, playerObj) {
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId + '/players/' + playerObj._id + '/finalise', playerObj)
        .then(function(response){
            currPlayer = response.data;
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.readAccess)
    function getPlayersDocsByProj(orgId, projId) {
        //returns a promise
        console.log('[playerFactory.getPlayerDoc]');
        return $http.get('/api/orgs/' + orgId + '/projects/' + projId + '/players')
        .then(function(response){
            if(_.isObject(response.data)) {
                currPlayer = response.data;
                return currPlayer;
            }
            else {
                return $q.reject('No player');
            }
        });
    }

    //logged-in-user.must-have(ORG.writeAccess && PROJ.writeAccess)
    function addDoc(orgId, projectId, playerParams){
        var postData = playerParams;
        console.log('[playerFactory.addDoc]');
        console.log(postData);
        //return promise
        return $http.post('/api/orgs/' + orgId + '/projects/' + projectId + '/players', postData)
        .then(function(response){
            currPlayer = response.data;
            return currPlayer;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function updateDoc(orgId, projId, playerObj){
        var postData = playerObj;
        var playerId = playerObj._id;
        //return promise
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId + '/players/' + playerId, postData)
        .then(function(response){
            currPlayer = response.data;
            return response.data;
        });
    }

    //for all players containing the snap, update the snap in each player
    function updateDocsSnap(orgId, projId, playerIds, snapshot) {
        var postData = {};
        postData.playerIds = playerIds;
        postData.snapshot = snapshot;
        //return promise
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId + '/snapshots/update_players', postData)
        .then(function(response){
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function removeDoc(orgId, projId, playerId) {
        //return promise
        return $http.delete('/api/orgs/' + orgId + '/projects/' + projId + '/players/' + playerId)
        .then(function(response) {
            //response is coming back with quotes added
            return {playerId: response.data.replace(/\"/g, "")};
        });
    }

    //check if player url has already been taken
    function checkUrlAvailable(url) {
        var postData = {
            url:url
        };
        //return promise
        return $http.post('/api/players/checkurlavailable', postData)
        .then(function(response) {
            return response.data;
        });
    }

    function regenerateAccessToken(orgId, projId, playerId, currToken) {
        var postData = {
            currentAccessToken: currToken
        };
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId + '/players/' + playerId + '/regenToken', postData)
        .then(function(response) {
            return response.data;
        }, function() {
            return $q.reject('Could not regenrate token');
        });
    }

    function downloadSelection(playerId, postObj, callback){
        return $http.post('/api/players/' + playerId + '/downloadSelection', postObj)
        .success(function(response) {
            callback(response);
        }).error(function(error) {
            callback(null, error);
        });
    }

    function getCurrPlayer(isPlayer){
        if(currPlayer){
            console.log('orgFactory.getCurrPlayer cached result');
            return $q.when(currPlayer);
        }
        else {
            if(isPlayer) {
                currPlayerDefer = $q.defer();
                return currPlayerDefer.promise;
            }
            else {
                return projFactory.currProject()
                .then(function(proj) {
                    return getPlayersDocsByProj(proj.org.ref, proj._id);
                })
                .then(function(playerDoc) {
                    if(_.isEmpty(playerDoc)) {
                        return $q.reject('No player');
                    }
                    else {
                        currPlayer = playerDoc;
                        return playerDoc;
                    }
                }, function(err) {
                    return $q.reject(err);
                });
            }
        }
    }

}
]);
