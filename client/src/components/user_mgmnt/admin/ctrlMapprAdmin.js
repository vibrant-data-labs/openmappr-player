angular.module('mappr')
.controller('MapprAdminCtrl', ['$scope', '$location', 'userFactory', 'orgFactory', '$uibModal', '$log', '$q', 'uiService', 'AuthService',
function($scope, $location, userFactory, orgFactory, $uibModal, $log, $q, uiService, AuthService) {
    'use strict';

    /*************************************
    ******** Local Data ******************
    **************************************/
    var logPrefix = '[ctrlMapprAdmin: ] ';


    /*************************************
    ****** SCOPE Bindings   **************
    **************************************/

    // Scope vars

    // Scope functions
    $scope.openOrgCreateModal =  openOrgCreateModal;
    $scope.openOrgEditModal = openOrgEditModal;
    $scope.openOrgRemoveModal = openOrgRemoveModal;
    $scope.openOrgUsersModal = openOrgUsersModal;
    $scope.openOrgProjectsModal = openOrgProjectsModal;
    $scope.openUserCreateModal = openUserCreateModal;
    $scope.openUserDeleteModal = openUserDeleteModal;
    $scope.openUserEditModal = openUserEditModal;
    $scope.openUserOrgsModal = openUserOrgsModal;
    $scope.setAdminUserSection = setAdminUserSection;

    $scope.logout = function(){
        console.group('[ctrlDashboard] logout start');
        AuthService.logout()
        .then(function(){
            orgFactory.clearCache();
            userFactory.clearCache();
            console.groupEnd();
            $location.path('/');
        });
    };



    /*************************************
    ****** Event Listeners ***************
    **************************************/
    // None yet



    /*************************************
    ****** Classes *************
    **************************************/

    // Class 1
    function Org(org) {
        this.org = org;
        this.orgName = org.orgName || '';
        this.createdAt = org.createdAt || '';
        this.owner = org.owner;
        this.projects = org.projects;
        this.users = org.users;
        this.settings = _.clone(org.settings);
        if(_.isEmpty(this.settings)) {
            this.settings = {
                userLimit: 5,
                projectLimit: 10,
                datapointsLimit: 1000,
                storageLimit: 0 // for future use
            };
        }
    }

    Org.prototype.add = function() {
        var self = this;
        var postObj = {
            orgName: $scope.newOrgVM.orgName,
            settings: $scope.newOrgVM.settings
        };

        orgFactory.addOrg(postObj)
        .then(function(res) {
            console.debug(res);
            self.org = res;
            _.assign(self, _.pick(res, ['orgName', 'createdAt', 'owner', 'projects', 'users']));
            self.settings = _.clone(res.settings);
            $scope.orgVMs.push($scope.newOrgVM);
            uiService.log('Org ' + res.orgName + ' added successfully!');
        },
        function(err) {
            var errMsg = '';
            console.error(logPrefix, err);
            if(err.data == 'OrgAlreadyExists') {
                errMsg = 'Org ' + self.orgName + ' already exists!';
            }
            else {
                errMsg = 'Could not add Org!';
            }
            uiService.logError(errMsg);
        });
    };

    Org.prototype.edit = function() {
        if(!$scope.selOrgVM) throw new Error('Org not selected');
        var self = this,
            fieldsToUpdate = ['orgName', 'settings'];

        orgFactory.editOrg($scope.selOrgVM.org._id, _.pick($scope.selOrgVM, fieldsToUpdate))
        .then(function(res) {
            _.assign($scope.selOrgVM.org, res);
            uiService.log('Org ' + res.orgName + ' edited successfully!');
        },
        function() {
            _.assign(self, _.pick(self.org, ['orgName', 'createdAt', 'owner', 'projects', 'users']));
            self.settings = _.clone(self.org.settings);
            uiService.logError('Could not edit org!');
        });
    };

    Org.prototype.remove = function() {
        if(!$scope.selOrgVM) throw new Error('Org not selected');

        orgFactory.deleteOrg($scope.selOrgVM.org._id)
        .then(function() {
            _.remove($scope.orgVMs, 'org._id', $scope.selOrgVM.org._id);
            uiService.log('Org ' + $scope.selOrgVM.orgName + ' removed successfully!');
        }, function() {
            uiService.logError('Could not delete org ' + $scope.selOrgVM.orgName);
        });
    };

    Org.prototype.addUser = function() {
        if(!$scope.selOrgVM) throw new Error('Org not selected');
        var self = this;

        orgFactory.inviteUserToOrg($scope.selOrgVM.org._id, $scope.newOrgUser)
        .then(function(response){
            console.log(logPrefix + 'user invited to org', response);
            $scope.selOrgVM.users.pending.push(response);
            uiService.log('User invited to join ' + $scope.selOrgVM.orgName);
        })
        .catch(function(err) {
            var errMsg = '';
            console.error(logPrefix, err);
            if(err.data == 'userLimitExceeded') {
                errMsg = 'This Org can\'t have more than ' + self.settings.userLimit + ' users. Please contact Mappr support team for further assistance.';
                uiService.logError();
            }
            else if(err.data == 'UserAlreadyMember') {
                errMsg = 'User is already a member!';
            }
            else if(err.data == 'UserAlreadyInvited') {
                errMsg = 'User has already been invited';
            }
            else {
                errMsg = 'Could not send invite to ' + $scope.newOrgUser.email;
            }
            uiService.log(errMsg);
        });

    };

    Org.prototype.cancelUserInvite = function(user) {
        var self = this;

        orgFactory.cancelUserInvite($scope.selOrgVM.org._id, {invitedUser: {email: user.email}})
        .then(function(response){
            console.log(logPrefix + 'user invite cancelled', response);
            _.remove(self.users.pending, 'email', user.email);
            uiService.log('User invite cancelled to join ' + $scope.selOrgVM.orgName);
        })
        .catch(function(err) {
            console.error(logPrefix, err);
            uiService.logError('Could not cancel invite of ' + $scope.newOrgUser.email);
        });
    };

    Org.prototype.removeUser = function(user) {
        if(!$scope.selOrgVM) throw new Error('Org not selected');

        orgFactory.removeUserFromOrg($scope.selOrgVM.org._id, user.ref)
        .then(function(response){
            console.log(logPrefix, response);
            _.remove($scope.selOrgVM.users.members, 'ref', user.ref);


            // Remove org from User VM
            var userVM = _.find($scope.userVMs, 'user._id', user.ref);
            // if(!userVM) throw new Error('User ' + user.email + ' not found');
            console.log('user: ', user);
            console.log('loggedInUser: ', $scope.loggedInUser);
            if(userVM) {
                _.remove(userVM.orgs, 'ref', $scope.selOrgVM.org._id);
            } else if(user.ref === $scope.loggedInUser._id) {
                //remove and reload orgs for user since user no longer a part of the current org
                _.remove($scope.loggedInUser.orgs, 'ref', $scope.selOrgVM.org._id);
                $location.path('/user-projects');
                $scope.user.loadInitial();
            }
            uiService.log('User ' + user.name + ' removed from ' + $scope.selOrgVM.orgName);
        })
        .catch(function(err) {
            console.error(logPrefix, err);
            uiService.logError(err.data || err);
        });
    };

    Org.prototype.updateUserRole = function(user) {
        if(!$scope.selOrgVM) throw new Error('Org not selected');

        orgFactory.updateUserOrgRole($scope.selOrgVM.org._id, user.ref, {newUserRole: user.role})
        .then(function(response){
            console.log(logPrefix + 'user role updated', response);
            uiService.log('User ' + user.name + ' role changed to ' + user.role);
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in updating user role', err);
            uiService.logError('Could not update user role');
        });
    };


    // Class 2
    function User(user) {
        this.user = user;
        this.name = user.name;
        this.first_name = user.first_name;
        this.last_name = user.last_name;
        this.dateCreated = user.dateCreated;
        this.email = user.email;
        this.isActive = user.isActive;
        this.orgs = user.orgs;
        this.projects = user.projects;
        if(user.local && user.local.password) {
            this.password = user.local.password;
            this.localUser = true;
        }
        else {
            this.localUser = false;
        }
    }

    User.prototype.addToSystem = function() {
        throw new Error('Implementation not complete');
        // var self = this;

        // userFactory.createUser(_.pick(newUserVM, ['first_name','last_name', 'email']))
        // .then(function(res) {
        //     self.user = res;
        //     _.assign(self, _.pick(res, ['first_name', 'last_name', 'createdAt', 'email', 'projects', 'orgs']));
        //     $scope.userVMs.push($scope.newUserVM);
        //     console.log(logPrefix + 'new user created', res);
        //     uiService.log('User ' + res.first_name + ' ' + res.last_name + ' created successfully!');
        // },
        // function(err) {
        //     uiService.logError('Could not create user!');
        //     console.error(logPrefix, err);
        // });
    };

    User.prototype.deleteFromSystem = function() {
        if(!$scope.selUserVM) throw new Error('User not selected');

        userFactory.deleteUser($scope.selUserVM.user._id)
        .then(function(response){
            console.log(logPrefix + 'user deleted', response);
            _.remove($scope.userVMs, 'user._id', $scope.selUserVM.user._id);
            uiService.log('User ' + $scope.selUserVM.name + ' deleted from system.');
            $scope.selUserVM = null;
        })
        .catch(function(err) {
            console.error(logPrefix + 'could not delete user', err);
            uiService.logError('Could not delete user');
        });
    };

    User.prototype.edit = function() {
        if(!$scope.selUserVM) throw new Error('User not selected');
        var self = this;
        var fieldsToUpdate = ['first_name','last_name', 'email', 'isActive'];
        if($scope.selUserVM.password != $scope.selUserVM.user.local.password) {
            fieldsToUpdate.push('password');
        }

        userFactory.updateUser($scope.selUserVM.user._id, _.pick($scope.selUserVM, fieldsToUpdate))
        .then(function(res) {
            console.log(logPrefix + 'user updated', res);
            _.assign(self, _.pick(res, fieldsToUpdate));
            self.user = res;
            uiService.log('User ' + $scope.selUserVM.name + ' updated successfully!');
        })
        .catch(function(err) {
            console.error(logPrefix + 'could not update user', err);
            uiService.logError('Could not update user');
        });
    };


    /*************************************
    ****** Initialise ********************
    **************************************/
    init();


    /*************************************
    ********* Core Functions *************
    **************************************/
    function init() {
        var path = $location.path();
        if(path === '/admin') {
            getAllUsers();
            getAllOrgs();
        }
        else if(path === '/owner') {
            initForOrgAdmin();
        }

    }

    function initForOrgAdmin() {
        $scope.newOrgUser = {
            name: '',
            email: '',
            role: 'member'
        };

        $q.all([
            orgFactory.currOrg(),
            userFactory.currUser()
        ])
        .then(function(vals) {
            $scope.selOrgVM = new Org(vals[0]);
            $scope.loggedInUser = _.cloneDeep(vals[1]);
        });

    }

    function getAllOrgs() {
        return orgFactory.listAll()
        .then(function(res) {
            $scope.orgVMs = _.map(res, function(org) {
                return new Org(org);
            });
            console.log(logPrefix + 'org VMs: ', $scope.orgVMs);
        });
    }

    function suggestOrgObj() {
        return {
            orgName: 'Org-' + ($scope.orgVMs.length + 1),
            settings: {
                userLimit: 5,
                projectLimit: 10,
                datapointsLimit: 1000,
                storageLimit: 0 // for future use
            }
        };
    }


    function getAllUsers() {
        return userFactory.listAll()
        .then(function(users) {
            $scope.userVMs = _.map(users, function(user) {
                return new User(user);
            });
            console.log(logPrefix + 'user VMs: ', $scope.userVMs);
        });
    }

    function openOrgCreateModal() {
        $scope.newOrgVM = new Org(suggestOrgObj());

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/orgAddModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {
                // items: function() {
                //  return $scope.items;
                // }
            }
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openOrgEditModal(orgVM) {
        $scope.selOrgVM = orgVM;

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/orgEditModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openOrgRemoveModal(orgVM) {
        $scope.selOrgVM = orgVM;

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/orgRemoveModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openOrgUsersModal(orgVM) {
        $scope.selOrgVM = orgVM;
        $scope.newOrgUser = {
            name: '',
            email: '',
            role: ''
        };

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/orgUsersModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openOrgProjectsModal(orgVM) {
        $scope.selOrgVM = orgVM;

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/orgProjectsModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openUserCreateModal() {
        $scope.newUserVM = new User({});

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/userAddModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openUserDeleteModal(userVM) {
        $scope.selUserVM = userVM;

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/userDeleteModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openUserEditModal(userVM) {
        $scope.selUserVM = userVM;

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/userEditModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function openUserOrgsModal(userVM) {
        $scope.selUserVM = userVM;

        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/userOrgsModal.html",
            size: 'lg',
            scope: $scope,
            resolve: {}
        });
        modalInstance.result.then(function() {

        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

    function setAdminUserSection(sect) {
        $scope.adminUserSection = sect;
    }

}
]);