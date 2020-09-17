angular.module('mappr')
.service('AuthService', ['$http', '$cookieStore', '$location', '$q', 'orgFactory', 'userFactory', 'USER_ROLES',
function($http, $cookieStore, $location, $q, orgFactory, userFactory, USER_ROLES) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.isAuthorized = isAuthorized;
    this.isLoggedIn = isLoggedIn;
    this.isAdmin = isAdmin;
    this.isOwner = isOwner;
    this.register = register;
    this.login = login;
    this.logout = logout;
    this.reset = reset;
    this.startPswdReset = startPswdReset;
    this.resetPassword = resetPassword;
    this.changepassword = changepassword;
    this.subscribe = subscribe;
    this.acceptInviteFromOrg = acceptInviteFromOrg;


    /*************************************
    ********* Local Data *****************
    **************************************/
    var currentUser = readCookie('user', {_id: '', role: USER_ROLES.anon});
    var userPassword = ''; //Used to store password locally for future auto-login
    console.log('user:', currentUser._id);

    this.user = currentUser;





    /*************************************
    ********* Core Functions *************
    **************************************/

    function readCookie(name, defs) {
        var res = null;
        try {
            res = $cookieStore.get('user') || defs;
        } catch(e) {
            console.warn('Unable to read cookie. Bad cookie: ' + name);
            console.error(e);
            res = defs;
        }
        return res;
    }

    function changeUser(user) {
        _.assign(currentUser, user);
        //console.log('[AuthService.changeUser] userFactory.currentUser: ');
    }

    function isAuthorized(reqAccessArr) {
        // User has 2 roles:
        // 1) Top leven role = user.role = {title, bitMask} = {'user', 2}/{'admin', 4}
        // 2) Role for an organisation = org.users.members[i].role = owner/member

        var role = _.get(currentUser, 'role.title') || currentUser.role;

        if(reqAccessArr.length === 1
          && (reqAccessArr[0] == USER_ROLES.owner || reqAccessArr[0] == 'isOwner')) {
            return this.isOwner();
        }
        else {
            if(_.indexOf(reqAccessArr, role) > -1) {
                return $q.when('Authorized');
            }
            else {
                return $q.reject('Not authorized');
            }
        }

    }

    function isLoggedIn(user) {
        if (user === undefined) user = currentUser;
        // console.log('[AuthService.isLoggedIn] currentUser: ' + JSON.stringify(currentUser));
        return user.role.title == USER_ROLES.user || user.role.title == USER_ROLES.admin;
    }

    function isAdmin(user) {
        if (typeof user === 'undefined') user = currentUser;
        return user.role.title == USER_ROLES.admin;
    }

    function isOwner() {
        return $q.all([userFactory.currUser(), orgFactory.currOrg()])
        .then(function(vals) {
            if(vals[1].users && _.contains(['owner', 'isOwner'], _.find(vals[1].users.members, 'ref', currentUser._id).role)) {
                return true;
            }
            else {
                return $q.reject(false);
            }
        }, function() {
            return $q.reject(false);
        });
    }

    function register(user) {
        user.role = user.role || USER_ROLES.user;
        console.log(user);
        return $http.post('/auth/register', user)
            .then(function(doc) {
                // console.log('[AuthService.register.success] user: ' + JSON.stringify(doc));
                changeUser(doc);
                currentUser.isNew = true;
                return doc;
            })
            .catch(function(err) {
                console.error('[AuthService.register.error] ', err);
            });
    }

    function login(user) {
        //If user details not passed, login using current user
        if(!user) {
            user = {
                email: currentUser.email,
                password: userPassword,
                rememberme: true
            };
        }

        userPassword = user.password;

        if(user.email && user.password) {
            return $http.post('/auth/local', user)
            .then(function(res) {
                var data = res.data;
                // console.log('[AuthService.login] user: ' + JSON.stringify(data));
                changeUser(data);
                return data;
            });
        }

    }

    function logout() {
        return $http.get('/auth/logout')
            .then(function(response) {
                console.log('[AuthService.logout: ]  user logged out!');
                changeUser({
                    _id: '',
                    role: USER_ROLES.anon
                });

                $cookieStore.put('user', {
                    _id: '',
                    role: USER_ROLES.anon
                });
                return response.data;
            });
    }

    function reset(email, callback) {
        var postData = {
            'email': email
        };
        return $http.post('/reset', postData).then(function(response) {
            callback(response.data);
        });
    }

    function startPswdReset(postData) {
        if(!_.get(postData, 'email')) throw new Error('Email required');
        return $http.post('/auth/send_reset_email/', postData)
        .then(function(response) {
            return response.data;
        });
    }

    function resetPassword(postData) {
        return $http.post('/auth/reset_password/', postData)
        .then(function(response) {
            return response.data;
        });
    }

    function changepassword(password, next, error) {
        var postData = {
            'password': password
        };
        return $http.post('/change_password/', postData).success(function(doc) {
            next(doc);
        }).error(error);
    }

    function subscribe(email, callback) {
        var postData = {
            'email': email
        };
        return $http.post('/subscribe', postData).then(function(response) {
            callback(response.data);
        });
    }

    function acceptInviteFromOrg(orgId, token, callback) {
        // console.log('[AuthService.acceptInviteFromOrg] ' + '/api/orgs/' + orgId + '/accept/' + token);
        return $http.get('/api/orgs/' + orgId + '/accept/' + token).then(function(response) {
            callback(response.data);
        });
    }

}
]);
