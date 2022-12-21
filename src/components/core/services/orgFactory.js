/**
* Organisation related APIs
*/
angular.module('common')
.service('orgFactory', ['$http','$q', 'uiHelper',
function($http, $q, uiHelper) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.listAll = listAll;
    this.listById = listById;
    this.getOrgProjectsDetails = getOrgProjectsDetails;
    this.getOrgSurveysDetails = getOrgSurveysDetails;
    this.getOrgPublicDetails = getOrgPublicDetails;
    this.listByOrgName = listByOrgName;
    this.listByMember = listByMember;
    this.updateOrg = updateOrg;
    this.removeOwner = removeOwner;
    this.listAllOrgMembers = listAllOrgMembers;
    this.removeOrgMember = removeOrgMember;
    this.updateOrgMember = updateOrgMember;
    this.removeOrgPending = removeOrgPending;
    this.listAllOrgProjects = listAllOrgProjects;
    this.listOrgProjectById = listOrgProjectById;
    this.org = currOrg; //Marked for removal
    this.clearCache = clearCache;
    this.currOrg = getCurrOrg;
    this.currOrgUnsafe = currOrgUnsafe;
    this.addUserToOrg = addUserToOrg;
    this.addOrg = addOrg;
    this.editOrg = editOrg;
    this.deleteOrg = deleteOrg;
    this.inviteUserToOrg = inviteUserToOrg;
    this.cancelUserInvite = cancelUserInvite;
    this.updateUserOrgRole = updateUserOrgRole;
    this.removeUserFromOrg = removeUserFromOrg;

    /*************************************
    ********* Local Data *****************
    **************************************/
    var timeStart = null; //perfomance
    var currOrg = null;
    var currOrgDefer = $q.defer();



    /*************************************
    ********* Core Functions *************
    **************************************/

    function changeOrg(org) {
        currOrg = org;
        currOrgDefer.resolve(currOrg);
        //console.log('[orgFactory.changeOrg] new org loaded in ' + (Date.now() - timeStart) + ' %O',  currOrg);
    }

    //org
    //admin access only
    function listAll() {
        return $http.get('/api/admin/orgs')
        .then(function(response) {
            return response.data;
        });
    }

    //user access
    function listById(orgId) {
        timeStart = Date.now();
        return $http.get('/api/orgs/' + orgId).then(function(response) {
            changeOrg(response.data);
            return response.data;
        });
    }

    function getOrgProjectsDetails(orgId) {
        return $http.get('/api/orgs/' + orgId + '/projectsDetails')
        .then(function(response) {
            // Modify contents here
            _.each(response.data, function(projInfo) {
                projInfo.playerUrl = uiHelper.getDocProtocol() + '//' + uiHelper.getDomain() + '/play/' + projInfo.playerUrl;
            });
            return response.data;
        });
    }

    function getOrgSurveysDetails(orgId) {
        return $http.get('/api/orgs/' + orgId + '/surveysDetails')
        .then(function(response) {
            return response.data;
        });
    }

    function getOrgPublicDetails(id) {
        return $http.get('/api/orgs/' + id + '/profile')
        .then(function(response) {
            return response.data;
            //console.log('[orgFactory.listById]  userId:[' + id + ']');
            //console.log(response.data);
            // changeOrg(response.data);
            // callback(response.data);
        });
    }

    function listByOrgName(orgName, callback) {
        timeStart = Date.now();
        return $http.get('/api/admin/orgs/' + orgName).then(function(response) {
            console.log('[orgFactory.listByOrgName]  orgName:[' + orgName + ']');
            changeOrg(response.data);
            callback(response.data);
        });
    }

    function listByMember() {
        return null;
    }

    function updateOrg(){
        //TODO: server side is not done
        // return $http.put('/api/orgs/'+orgItem.ref).then(function(response) {
        //  console.log('[orgFactory.updateOrg]  orgName:[' + orgName + '] updated');
        //  callback(response);
        // });
        return null;
    }

    //user management

    function removeOwner() {
        return null;
    }

    function listAllOrgMembers(orgId, callback){
        return $http.get('/api/orgs/'+orgId+'/users').then(function(response){
            return callback(response.data);
        });
    }

    function removeOrgMember(orgId, userId, callback) {
        return $http.delete('/api/orgs/'+orgId+'/members/' + userId).then(function(response) {
            return callback(response.data);
        });
    }

    function updateOrgMember(orgId, userId, callback) {

        var postData = {};
        return $http.put('/api/orgs/'+orgId+'/users/' + userId, postData).then(function(response) {
            callback(response.data);
        });
    }

    function removeOrgPending(orgId, token, callback) {
        return $http.delete('/api/orgs/'+orgId+'/invite/' + token).then(function(response) {
            return callback(response.data);
        });
    }

    //projects
    function listAllOrgProjects(orgId, projId, callback) {
        return $http.get('/api/orgs/' + orgId + '/projects/' + projId).then(function(response) {
            callback(response.data);
        });
    }

    function listOrgProjectById(orgId, projId, callback) {
        return $http.get('/api/orgs/' + orgId + '/projects/' + projId).then(function(response) {
            callback(response.data);
        });
    }

    function clearCache(){
        changeOrg(null);
        console.log('orgFactory.clearCache', currOrg);
    }

    function getCurrOrg(){
        if(currOrg){
            //console.log('[orgFactory.getCurrOrg] cached result');
            return $q.when(currOrg);
        } else {
            //console.log('[orgFactory.getCurrOrg] promised result');
            return currOrgDefer.promise;
        }
    }

    function currOrgUnsafe() {
        return currOrg;
    }

    function addUserToOrg(orgId, user){
        var postData = {
            userToAdd: user
        };

        return $http.post('/api/orgs/'+orgId+'/user', postData)
        .then(function(response) {
            return response.data;
        });

    }


    /**
    * ADMIN APIs
    */
    function addOrg(postData) {

        return $http.post('/api/admin/orgs', postData)
        .then(function(response) {
            console.log('[orgFactory.addOrg]  orgName:[' + response.orgName + '] added');
            console.log(response.data);
            return response.data;
        });
    }

    function editOrg(orgId, postData) {

        return $http.post('/api/admin/orgs/' + orgId, postData)
        .then(function(response) {
            console.log('[orgFactory.addOrg]  orgName:[' + response.orgName + '] updated');
            console.log(response.data);
            return response.data;
        });
    }

    function deleteOrg(orgId){
        return $http.delete('/api/admin/orgs/'+orgId)
        .then(function(response) {
            console.log('[orgFactory.deleteOrg]  orgName:[' + response.orgName + '] deleted');
        });
    }

    function inviteUserToOrg(orgId, user){
        var postData = {
            userToAdd: user
        };

        return $http.post('/api/admin/orgs/'+orgId+'/user', postData)
        .then(function(response) {
            return response.data;
        });

    }

    function cancelUserInvite(orgId, postObj) {
        return $http.post('/api/admin/orgs/'+orgId+'/user/cancelinvite', postObj)
        .then(function(response) {
            return response.data;
        });
    }

    function updateUserOrgRole(orgId, userId, postObj) {
        return $http.post('/api/admin/orgs/'+orgId+'/user/' + userId, postObj)
        .then(function(resp) {
            return resp.data;
        });
    }

    function removeUserFromOrg(orgId, userId){

        return $http.delete('/api/admin/orgs/'+orgId+'/user/' + userId);
        // .then(function(response) {
        //  return response.data;
        // });

    }

}
]);
