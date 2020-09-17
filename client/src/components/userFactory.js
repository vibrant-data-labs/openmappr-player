angular.module('mappr')
.service('userFactory', ['$http','$q', 
function($http, $q) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    //super admin only
    this.listAll = listAll;
    this.listAll = listAll;
    this.listById = listById;
    this.listByEmail = listByEmail;
    this.addUserFromAdmin = addUserFromAdmin;
    this.joinOrg = joinOrg; //duplicate of orgthis.add member
    this.leaveOrg = leaveOrg;
    // this.joinProject = function(userId, orgId, token, callback) {};
    this.leaveProject = leaveProject;
    this.deleteUser = deleteUser;
    this.updateUser = updateUser;
    this.updateCurrUser = updateCurrUser;
    this.updatePassword = updatePassword;
    this.clearCache = function(){
        changeUser(null);
        console.log('userFactory.clearCache', currUser);
    };
    this.currUser = getCurrUser;
    this.currUserUnsafe = function() { return currUser; };
    this._currentUser  = function() { return currUser ; };



    /*************************************
    ********* Local Data *****************
    **************************************/
    var currUser = null;
    var currUserDefer = $q.defer();



    /*************************************
    ********* Core Functions *************
    **************************************/

    function changeUser(user) {
        currUser = user;
        currUserDefer.resolve(currUser);
        //console.log('[userFactory.changeUser] userFactory.currUser changed: ' + (Date.now() - timeStart) + ' %O', currUser);
    }

    function listAll() {
        return $http.get('/api/admin/users')
        .then(function(response) {
            return response.data;
        });
    }

    // function login(email, password) {
    //     var postData = {
    //         'email': email,
    //         'password': password
    //     };
    //     return $http.post('/login', postData).then(function(response) {
    //         return response.data;
    //     });
    // }

    function listById(userId) {
        return $http.get('/api/users/' + userId).then(function(response) {
            changeUser(response.data);
            return response.data;
        });
    }

    function listByEmail(email) {
        return $http.get('/api/users/' + email).then(function(response) {
            changeUser(response.data);
            return response.data;
        });
    }

    function addUserFromAdmin(user, callback) {
        console.log('[userFactory.addUserFromAdmin] ' + JSON.stringify(user));
        return $http.post('/api/users/', user).then(function(response) {
            console.log('[userFactory.addUserFromAdmin]');
            console.log(response.data);
            callback(response.data);
        });
    }

    function joinOrg(userId, orgId, token, callback) {
        console.log('/api/users/' + userId + '/orgs/' + orgId + '/accept/' + token);
        return $http.get('/api/users/' + userId + '/orgs/' + orgId + '/accept/' + token).then(function(response) {
            //currently the server just redirects to '/user' on successful OrgJoin
            //response data will be html - essentially garbage
            return callback(response.data);
        });
    }

    function leaveOrg(userId, orgId, callback) {
        return $http.delete('/api/users/'+userId+'/orgs/' + orgId).then(function(response) {
            console.log(response.data);
            return callback(response.data);
        });
    }

    function leaveProject(userId, orgId, projId, callback) {
        return $http.delete('/api/users/' + userId + '/orgs/' + orgId + '/projects/' + projId).then(function(response) {
            console.log('[userFactory.leave]  projId:[' + projId + ']');
            callback(response.data);
        });
    }

    function deleteUser(userId) {
        return $http.delete('/api/admin/users/' + userId)
        .then(function(resp) {
            return resp.data;
        });
    }

    function updateUser(userId, user) {
        return $http.post('/api/admin/users/' + userId, {user: user})
        .then(function(resp) {
            return resp.data;
        });
    }

    function updateCurrUser(updatedUserObj) {
        if(_.isEmpty(updatedUserObj)) { throw new Error('User object empty'); }
        var propsToUpdate = ['name', 'first_name', 'last_name', 'picture', 'gender', 'bio'];
        return $http.post('/api/users/' + currUser._id, {user: _.pick(updatedUserObj, propsToUpdate)})
        .then(function(resp) {
            changeUser(resp.data);
            return resp.data;
        });
    }

    function updatePassword(currPassword, newPassword) {
        if(!currPassword || !newPassword) { throw new Error('Both passwords not specified'); }
        return $http.post('/api/users/' + currUser._id + '/updateAuthInfo', {
            newPassword: newPassword,
            currPassword: currPassword
        })
        .then(function(resp) {
            changeUser(resp.data);
            return resp.data;
        });
    }

    function getCurrUser(){
        if(currUser){
            console.log('[userFactory.getCurrUser] cached result');
            return $q.when(currUser);
        } else {
            console.log('[userFactory.getCurrUser] promised result');
            return currUserDefer.promise;
        }
    }

}
]);