// APIs for project info & ops
angular.module('common')
.factory('projFactory', ['$http','$q',
function($http, $q) {

    'use strict';


    /*************************************
    *************** API ******************
    **************************************/
    var API = {
        //Internal Variables
        __currProject:          currProject,
        currProjUrl :           currProjUrl,
        currProjectUnsafe :     function() { return currProject; },
        clearCurrProject:       clearCurrProject,

        //list
        getOrgProjectList:      listProjectsByOrgId,
        getUserProjectList:     listProjectsByUserId,

        //read projectdocument
        getProjectDoc:          getProjectDoc,
        getOrgIdForProjId:      getOrgIdForProjId,

        //edit project
        updateProject:          updateProject,
        removeProject:          removeProject,
        cloneProject:           cloneProject,
        changeProjectOrg:       changeProjectOrg,

        //edit users
        inviteMember:           function(){return;},
        removeMember:           removeMember,

        //data
        // getProjectData:          getData,
        downloadNetworksData: downloadNetworksData,

        //reindex
        reIndexForES:           reIndexForES,

        //edit snapshots
        addSnapshot:            addSnapshot,
        updateSnapshot:         updateSnap,
        updateSnapshotSequence: updateSnapshotSequence,
        removeSnapshot:         removeSnap,

        //edit pins
        addNewPin:              function(){return;},
        updatePin:              function(){return;},
        removePin:              function(){return;},

        getProjectSettings       : getProjectSettings,
        bakeSelections           : bakeSelections,
        setProjSettingsForPlayer : setProjSettingsForPlayer,
        getClusterDescr          : getClusterDescr,
        getClusterSuggestion     : getClusterSuggestion,

        //current project
        currProject: function(){
            if(currProject){
                //console.log('[projFactory.currProject] cached result');
                return $q.when(currProject);
            } else {
                //console.log('[projFactory.currProject] promised result');
                return currProjectDefer.promise;
            }
        }
    };




    /*************************************
    ********* Local Data *****************
    **************************************/
    var currProject = null;
    var currProjectDefer = $q.defer();
    var projectSettings = null;
    // Default project settings for new projects
    var _defProjSettings = {
        theme: 'light',
        //STAGE
        backgroundColor: '#ffffff',//'rgb(255,255,255)',
        labelColor: '#000000',//colorStr([0, 0, 0]),
        labelOutlineColor : '#ffffff', //colorStr([255, 255, 255]),
        nodesTitle: 'Nodes',
        snapGenMap: {},
        selectionData: {
            genCount: 0,
            selections: []
        }
    };




    /*************************************
    ********* Core Functions *************
    **************************************/

    function currProjUrl() {
        if(!currProject) {
            return null;
        }
        return '/api/orgs/' + currProject.org.ref + '/projects/' + currProject._id;
    }

    function clearCurrProject() {
        currProject = null;
        currProjectDefer = $q.defer();
    }

    function bakeSelections () {
        return $http.post('/api/orgs/' + currProject.org.ref + '/projects/' + currProject._id + '/dataset/bake_groups')
            .then(function(respData) { return respData.data; });
    }

    function reIndexForES(orgRef, projRef) {
        return $http.post('/api/orgs/' + orgRef + '/projects/' + projRef + '/reindex')
            .then(function(respData) { return respData.data; });
    }

    function getProjectSettings() {
        return _.clone(projectSettings) || {};
    }
    function getClusterDescr (networkId, attrId, clusterId) {
        return clusterId.length > 0 && networkId.length > 0  && attrId.length > 0
                ? _.get(projectSettings, 'clusterMeta.' + networkId + '.' + attrId + '.' + clusterId + '.descr', null) : null;
    }
    function getClusterSuggestion (networkId, attrId, clusterId) {
        return clusterId.length > 0 && networkId.length > 0  && attrId.length > 0
                ? _.get(projectSettings, 'clusterMeta.' + networkId + '.' + attrId + '.' + clusterId + '.suggestion', null) : null;
    }

    function setProjSettingsForPlayer(settings) {
        projectSettings = _.clone(settings);
    }

    function changeProject(project) {
        currProject = project;
        projectSettings = _.isObject(project.settings) ? project.settings : _defProjSettings;

        currProjectDefer.resolve(currProject);
    }

    //ADMIN ACCESS ONLY
    // function listAll(callback) {
    //     return $http.get('/api/projects').then(function(response) {
    //         callback(response.data);
    //     });
    // }

    //PROJECT LISTS

    //logged-in-user.must-have(ORG.readAccessProj)
    function listProjectsByOrgId(orgId, callback) {
        return $http.get('/api/orgs/' + orgId + '/projects').then(function(response) {
            callback(response.data);
        });
    }

    function listProjectsByUserId(userId, callback) {
        return $http.get('/api/user/' + userId + '/projects').then(function(response) {
            callback(response.data);
        });
    }

    //logged-in-user.must-have(PROJ.readAccess)
    function getProjectDoc(orgId, projId) {
        //returns a promise
        console.log('[projectFactory.getProjectDoc]');
        return $http.get('/api/orgs/' + orgId + '/projects/' + projId)
                .then(
                    function(response) {
                        //update current project
                        changeProject(response.data);

                        //expect new project document
                        return response.data;
                    },
                    function(err) {
                        return $q.reject(err);
                    }
                );
    }

    // Used for direct project loading when org id is not available
    function getOrgIdForProjId(projId) {
        return $http.get('/api/orgs?projectId=' + projId)
        .then(function(response) {
            return response.data.orgId;
        });
    }

    function downloadNetworksData(orgId, projId, postObj, progressCallback){

        function upload(url, fileData, progressCbk){
            var xhr = new XMLHttpRequest();
            xhr.open("POST", url);
            xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
            return $q(function(resolve, reject){
                xhr.onload = function(){ resolve(xhr.responseText); };
                xhr.onerror = reject;
                xhr.onprogress = function(progressEvent) {
                    var totalSize = xhr.getResponseHeader('MP-Response-Length');
                    progressCbk((progressEvent.loaded*100/totalSize).toFixed(2));
                };
                xhr.send(JSON.stringify(fileData));
                progressCbk(0.1);
            });
        }

        return upload('/api/orgs/' + orgId + '/projects/' + projId + '/nwdownload', postObj, progressCallback || _.noop);
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function updateProject(orgId, projId, updateParams) {
        //descr
        //picture
        //tags
        //------
        //org
        //owner
        //layers
        //snapshots
        //users
        //versions
        //players
        //pins
        //activty

        var postData = updateParams;

        console.log('[projFactory.update] attempting proj update -> ',postData);
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId, postData)
        .then(function(response) {
            console.log('[projFactory.update] post success');
            currProject = response.data;
            //expect updated project document
            return response.data;
        });
    }
    //logged-in-user.must-have(PROJ.writeAccess)
    function cloneProject(orgId, projId, callback) {
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId + '/clone').then(function(response) {
            console.log('[projFactory.cloneProject]  projId:[' + projId + ']');
            callback(response.data);
        });
    }

    function changeProjectOrg(orgId, projId, newOrgId) {
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId + '/cloneToOrg', {newOrg: newOrgId})
        .then(function(response) {
            console.log(response.data);
            return $http.delete('/api/orgs/' + orgId + '/projects/' + projId);
        }).then(function(response) {
            console.log(response.data);
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.deleteAccess)
    function removeProject(orgId, projId, callback) {
        return $http.delete('/api/orgs/' + orgId + '/projects/' + projId).then(function(response) {
            console.log('[projFactory.removeProject]  projId:[' + projId + ']');
            callback(response.data);
        });
    }

    //logged-in-user.must-have(ORG.manageUserAccess)
    function removeMember(orgId, projId, userId, callback){
        return $http.get('/api/orgs/' + orgId + '/projects/' + projId + '/kickout/' + userId).then(function(response) {
            console.log('[projFactory.removeMember]  projId:[' + projId + ']');
            callback(response.data);
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function addSnapshot(orgId, projId, snapshot){
        //console.log('[projFactory.addSnapshot] attempting to add a snapshot to project -> ' + JSON.stringify(snapshot));
        return $http.post('/api/orgs/' + orgId + '/projects/' + projId + '/snapshots', snapshot)
        .then(function(response) {
            // currProject.snapshots.push(response.data);
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function updateSnap(orgId, projId, snapshot) {
        var postData = {};
        postData.snapshot = snapshot;
        var url = '/api/orgs/' + orgId + '/projects/' + projId + '/snapshots/' + snapshot.id;
        return $http.post(url, postData)
        .then(function(result){
            return result.data;
        });
    }

    function updateSnapshotSequence(orgId, projId, snapshotIdArr){
        var url = '/api/orgs/' + orgId + '/projects/' + projId + '/snapshots/sequence';
        return $http.post(url, {arr:snapshotIdArr})
        .then(function(result){
            //expect new snapshot array
            //update currProject
            currProject.snapshots = result.data;
            return currProject.snapshots;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function removeSnap(orgId, projId, snapId){
        console.log('[projFactory.create] attempting to delete a snapshot -> ' + snapId);
        return $http.delete('/api/orgs/' + orgId + '/projects/' + projId + '/snapshots/' + snapId)
        .then(function(response) {
            return response.data.delId;
        });
    }

    //API
    return API;
}
]);
