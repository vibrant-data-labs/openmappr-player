angular.module('mappr')
    .controller('DashboardCtrl', ['$scope', '$timeout', '$rootScope', '$q', '$location', '$window', '$uibModal', '$log', 'mappToSurveyService', 'AuthService', 'userFactory', 'orgFactory', 'projFactory', 'surveyTemplateFactory', 'uiService', 'dataService', 'svgRenderService', 'BROADCAST_MESSAGES', 'networkService', 'snapshotService', 'recipeService',
        function($scope, $timeout, $rootScope, $q, $location, $window, $uibModal, $log, mappToSurveyService, AuthService, userFactory, orgFactory, projFactory, surveyTemplateFactory, uiService, dataService, svgRenderService, BROADCAST_MESSAGES, networkService, snapshotService, recipeService) {
            'use strict';

            /*************************************
             ************ Local Data **************
             **************************************/
            var logPrefix = "[ctrlDashboard] ";
            var surveyBaseUrl = 'https://koala.mappr.io/survey/';


            /*************************************
             ********* Scope Bindings *************
             **************************************/
            /**
             *  Scope data
             */
            $scope.tempData = null;
            //user
            $scope.user = {
                current: null,
                pendingOrgInvites: [],
                pendingProjInvites: [],
                isOrgOwner: false,

                getCurrent: function() {
                    userFactory.currUser()
                        .then(function(user) {
                            console.log('[ctrlDashboard] projFactory.getCurrent resolved to :' + user.userName);
                            $scope.user.selected = user;
                            return user;
                        });
                },

                refreshRole: function() {
                    var self = this;
                    AuthService.isOwner()
                        .then(function() {
                            self.isOrgOwner = true;
                        }, function() {
                            self.isOrgOwner = false;
                        });
                },

                loadInitial: function(callback) {

                    var userId = AuthService.user._id,
                        self = this;
                    console.log('$scope.user.loadInitial', userId);
                    if (userId === '') {
                        return;
                    } else {
                        var timeStart = Date.now();
                        userFactory.listById(userId)
                            .then(function(response) {
                                console.log('[' + (Date.now() - timeStart) + '] [ctrlDashboard] user loaded %O', response);
                                $scope.user.current = response;
                                $scope.user.current.picture = $scope.user.current.picture || 'https://s3-us-west-1.amazonaws.com/mappr-misc/icons/profile_icon_120x120.jpg';
                                $scope.user.current.pendingOrgInvites = _.filter($scope.user.current.orgs, function(org) {
                                    return org.isPending === true;
                                });
                                $scope.org.loadInitial();
                                self.refreshRole();
                                $rootScope.$broadcast(BROADCAST_MESSAGES.user.loggedIn);
                                //callback
                                if (typeof callback === 'function') callback();
                            });
                    }
                }
            };

            //org
            $scope.org = {
                selected: null,
                projectSearchKey: '',
                surveySearchKey: '',
                orgSearchKey: '',
                projectSortType: 'dateModified',
                surveySortType: 'dateModified',
                orgSortType: 'dateModified',
                projectSortReverse: true,
                surveySortReverse: true,
                orgSortReverse: true,
                uiNameField: '',
                addNewOrg: false,
                hasPlayerInfo: false,
                hasSurveyInfo: false,
                userAuthorised: true,

                setSort: function(type) {
                    switch ($scope.ui.getPage()) {
                        case 'user-projects':
                            this.projectSortType = (type == 'alpha') ? 'projName' : 'dateModified';
                            console.debug('type: ', type, 'sortType: ', this.projectSortType);
                            this.projectSortReverse = this.projectSortType == 'dateModified';
                            break;
                        case 'user-surveys':
                            this.surveySortType = (type == 'alpha') ? 'surveyName' : 'dateModified';
                            this.surveySortReverse = this.surveySortType == 'dateModified';
                            break;
                        case 'user-orgs':
                            this.orgSortType = (type == 'alpha') ? 'orgName' : 'dateModified';
                            this.orgSortReverse = this.orgSortType == 'dateModified';
                            break;
                        case 'user-recipes':
                            $scope.recipeDash.sortType = (type == 'alpha') ? 'orgName' : 'dateModified';
                            $scope.recipeDash.sortReverse = $scope.recipeDash.sortType == 'dateModified';
                            break;
                    }
                },

                getCurSortType: function() {
                    switch ($scope.ui.getPage()) {
                        case 'user-projects':
                            return (this.projectSortType == 'dateModified') ? 'date' : 'alpha';
                        case 'user-surveys':
                            return (this.surveySortType == 'dateModified') ? 'date' : 'alpha';
                        case 'user-orgs':
                            return (this.orgSortType == 'dateModified') ? 'date' : 'alpha';
                    }
                },

                loadInitial: function() {

                    var userId = AuthService.user._id;
                    var self = this;
                    console.log('$scope.user.loadInitial', userId);
                    if (userId === '') {
                        throw new Error('User not logged in, can\'t load org');
                    } else {
                        userFactory.currUser()
                            .then(function(user) {
                                var orgIdP;
                                var pathSplitArr = $location.path().split('/');
                                console.log('org.load initial', user);
                                $scope.user.current = user;
                                // If project opened directly, load the project org
                                if (pathSplitArr[1] == 'projects') {
                                    if (!pathSplitArr[2]) throw new Error('Project URL has no project ID');
                                    orgIdP = projFactory.getOrgIdForProjId(pathSplitArr[2]);
                                } else if (user.lastSignedIn.orgId) {
                                    orgIdP = $q.when(user.lastSignedIn.orgId);
                                } else {
                                    orgIdP = $q.when(user.orgs[0].ref);
                                }
                                return orgIdP.then(function(orgId) {
                                    return orgFactory.listById(orgId);
                                });
                            })
                            .then(function(res) {
                                if (res.orgName) {
                                    $scope.notify('info', 'Opening folder: ' + res.orgName + '.');
                                }
                                $scope.org.selected = res;
                                $rootScope.$broadcast(BROADCAST_MESSAGES.org.loaded);
                                console.log('[ctrlDashboard.loadInitial] current org: ', res);
                                return orgFactory.getOrgProjectsDetails(res._id);
                            })
                            .then(function(orgProjsDetails) {
                                if (!_.isEmpty(orgProjsDetails)) {
                                    self.hasPlayerInfo = true;
                                    _.each(self.selected.projects, function(orgProj) {
                                        //HACK: if projsdetails (player details) not found - turn off the enable switch to not display icon.
                                        orgProj.playerInfo = orgProjsDetails[orgProj.ref] || {
                                            enabled: false
                                        };
                                    });
                                } else {
                                    console.warn('No projects in org');
                                }

                                // return orgFactory.getOrgSurveysDetails(orgId);
                            })
                            .catch(function(err) {
                                if (err.status == 403) {
                                    $scope.org.userAuthorised = false;

                                    // Load default org on moving to dashboard
                                    var x = $scope.$on('$locationChangeStart', function() {
                                        if ($location.path() == '/user-projects') {
                                            x();
                                            loadDefaultOrg($scope.user.current);
                                        }
                                    });
                                } else {
                                    loadDefaultOrg($scope.user.current);
                                    uiService.logError('Could not load current organization. Loading default organization.');
                                }
                                console.error(logPrefix + 'something went wrong, org could not be loaded', err);
                            });
                    }
                },

                enterOrgEditMode: function(orgItem) {
                    orgItem.edit = true;
                    $scope.org.selected = orgItem;
                },

                //needs to be finished on server
                updateOrg: function(orgItem) {
                    orgFactory.updateOrg(orgItem)
                        .then(function(res) {
                            if (!res.error) {
                                $scope.org.selected.edit = false;
                            }
                        });
                },

                selectByRef: function(orgId, next) {
                    var self = this;
                    console.log('[ctrlDashboard.selectByRef] ');
                    orgFactory.listById(orgId)
                        .then(function(res) {
                            //authorized?
                            if (res === '403') {
                                console.log('not authorized to load lastSignedIn org! switching to default');
                                loadDefaultOrg($scope.user.current);
                                return $q.when(null);
                            } else {
                                $scope.project.clearLoadedProject();
                                $scope.notify('info', 'Opening folder: ' + res.orgName + '.');
                                $scope.org.selected = res;
                                $rootScope.$broadcast(BROADCAST_MESSAGES.org.loaded);
                                self.hasPlayerInfo = false;
                                console.log('[ctrlDashboard.selOrgByRef] current org: ', res);
                                if (res.projects.length < 1) {
                                    $scope.notify('warning', 'Create a new project to get started!');
                                    return $q.when(null);
                                } else {
                                    return orgFactory.getOrgProjectsDetails(orgId);
                                }
                            }
                        }).then(function(orgProjsDetails) {
                            if (!_.isEmpty(orgProjsDetails)) {
                                self.hasPlayerInfo = true;
                                _.each(self.selected.projects, function(orgProj) {
                                    //HACK: if projsdetails (player details) not found - turn off the enable switch to not display icon.
                                    orgProj.playerInfo = orgProjsDetails[orgProj.ref] || {
                                        enabled: false
                                    };
                                });
                            } else {
                                console.warn('No projects in org');
                            }
                            $scope.user.refreshRole();
                        }, function(err) {
                            console.error('[ctrlDashboard.selOrgByRef] Could not get detailed projects info.');
                            console.log(err);
                        }).then(function() {
                            if (typeof next !== "undefined") next();
                        });
                },

                getCurrent: function() {
                    orgFactory.currOrg()
                        .then(function(org) {
                            console.log('[ctrlDashboard] orgFactory.getCurrent resolved to :' + org.projName);
                            $scope.org.selected = org;
                            return org;
                        });
                },

                createNew: function(name) {
                    var orgName = name || uiService.getRandName();
                    console.log('[ctrlDashboard.createNewOrg] ' + orgName);
                    orgFactory.addOrg(orgName, null)
                        .then(function(orgDocs) {
                            $scope.notify('success', 'New folder ' + orgDocs.orgName + ' created!');
                            //update $scope.user
                            $scope.user.current.orgs.push({
                                ref: orgDocs._id,
                                owner: orgDocs.owner,
                                orgName: orgDocs.orgName,
                                role: 'isOwner',
                                dateJoined: orgDocs.createdAt,
                                isPending: false,
                                token: ''
                            });
                            $scope.org.uiNameField = ''; //cleans up the createOrg input fields in UI
                            $scope.org.selectByRef(orgDocs._id);
                            return orgDocs;
                        })
                        .then(function() {
                            $scope.org.getCurrent();
                        });
                },

                deleteByRef: function(orgId) {
                    console.log('[ctrlDashboard.org.deleteOrg] ');
                    orgFactory.deleteOrg(orgId, function() {
                        console.log('[ctrlDashboard.org.deleteOrg.callback] ');
                        $scope.notify('success', 'Organization deleted');
                    });

                    for (var i = 0, l = $scope.user.current.orgs.length; i < l; i++) {
                        if ($scope.user.current.orgs[i].ref === orgId) {
                            $scope.user.current.orgs.splice(i, 1);
                        }
                    }
                },

                joinByRef: function(orgId, token) {
                    console.log('[ctrlDashboard.joinByRef] ');
                    userFactory.joinOrg($scope.user.current._id, orgId, token, function() {
                        console.log('[ctrlDashboard.joinByRef] done..updating scope orgList [' + $scope.user.current.orgs.length + ']');

                        //breaking pattern (scope is updated with server response usually).
                        //the server in this case does not return a response but
                        //server.orgcontroller.acceptInvite() redirects to '/user'.
                        //this was done to allow for a single function
                        //to handle invitation acceptance via external urls (emails) as well.

                        //find org in scope and update it
                        for (var i = 0, l = $scope.user.current.orgs.length; i < l; i++) {
                            // console.log($scope.user.orgs[i].ref, orgId, $scope.user.orgs[i].ref === orgId);
                            if ($scope.user.current.orgs[i].ref === orgId) {
                                $scope.user.current.orgs[i].isPending = false;
                                break;
                            }
                        }
                        //update local clients org pending list
                        $scope.user.current.pendingOrgInvites = _.filter($scope.user.current.orgs, function(org) {
                            return org.isPending === true;
                        });

                        //select the newly joined org
                        $scope.org.selectByRef(orgId);
                    });
                },

                leaveByRef: function(orgId) {
                    console.log('[ctrlDashboard.org.leaveByRef] ');
                    userFactory.leaveOrg($scope.user._id, orgId, function(response) {
                        //remove from $scope
                        $scope.user.current.orgs = response;
                        console.log('[ctrlDashboard.org.leaveByRef] done ');
                    });
                },

                addUsers: function(orgId) {
                    $scope.org.selectByRef(orgId, function() {
                        //the OrgUsersModal has an isolated scope
                        //it reads current selected org from the injected orgFactory
                        $scope.org.openOrgUsersModal();
                    });
                },

                openOrgUsersModal: function() {
                    var modalInstance;
                    modalInstance = $uibModal.open({
                        templateUrl: "#{server_prefix}#{view_path}/components/user_mgmnt/admin/orgUsersModal.html",
                        controller: 'orgUsersModalCtrl',
                        size: 'lg',
                        resolve: {
                            // items: function() {
                            //  return $scope.items;
                            // }
                        }
                    });
                    modalInstance.result.then(function(selectedOrg) {
                        $scope.selectedOrg = selectedOrg;
                    }, function() {
                        $log.warn("Modal dismissed at: " + new Date());
                    });
                }
            };

            //projects
            $scope.project = {
                selected: null,
                openMapSummary: true,
                deleteInfo: [],
                batchAr: [],
                batchInd: 0,
                batchInfo: [],

                getProjectDetails: function(projectRef) {
                    if ($scope.project.selected && projectRef == $scope.project.selected._id) {
                        //ignore - project already loaded
                        console.log("[ctrlDashboard.getProjectDetails] ", $scope.project.selected);
                    } else {
                        console.log("[ctrlDashboard.getProjectDetails] " + projectRef);
                        projFactory.getProjectDoc($scope.org.selected._id, projectRef)
                            .then(function(result) {
                                $scope.project.selected = result;
                            });
                    }
                },

                //gets info about the project for deletion
                getProjectDeleteInfo: function(projectRef) {
                    orgFactory.currOrg()
                        .then(function(currOrg) {
                            return projFactory.getProjectDoc(currOrg._id, projectRef);
                        }).then(function(projDoc) {
                            console.log('projDoc for deletion: ', projDoc);

                            //passed to deleteConfirm directive
                            $scope.project.deleteInfo = [{
                                name: 'Number of Networks: ',
                                val: '' + projDoc.networks.length
                            }, {
                                name: 'Number of Snapshots: ',
                                val: '' + projDoc.snapshots.length
                            }];
                        });


                },

                selectProject: function(project) {

                    if ($scope.project.selected && project._id == $scope.project.selected._id) return;

                    switch (uiService.getPage()) {
                        case 'project':
                            $scope.project.open(project);
                            break;
                        case 'user-projects':
                        default:
                            orgFactory.currOrg()
                                .then(function(orgDocs) {
                                    return projFactory.getProjectDoc(orgDocs._id, project._id);
                                })
                                .then(function(projDocs) {
                                    $scope.project.selected = projDocs;
                                    return $scope.project.selected;
                                });
                            break;
                    }
                },
                reIndexForES: function(projRef) {
                    console.log(logPrefix + 'reIndexing' + projRef + 'for ElasticSearch');
                    orgFactory.currOrg()
                        .then(function(orgDocs) {
                            return projFactory.reIndexForES(orgDocs._id, projRef);
                        })
                        .then(function(response) {
                            console.log('[ctrlDashboard] ' + response);
                            if (response.datasetId) uiService.logSuccess(response.result);
                            else uiService.logError('Project could not be reindexed. Contact admin.');
                        });
                },
                //add or remove element to array
                toggleToBatch: function(ref) {
                    if (this.batchAr.indexOf(ref) === -1) {
                        this.batchAr.push(ref);
                    } else {
                        this.batchAr.splice(this.batchAr.indexOf(ref), 1);
                    }
                },

                clearLoadedProject: function() {
                    $scope.project.selected = null;
                    $location.path('/user-projects');
                },

                batchDelete: function() {
                    $scope.project.removeProject($scope.project.batchAr[$scope.project.batchInd], function() {
                        $scope.project.batchInd++;
                        if ($scope.project.batchInd === $scope.project.batchAr.length) {
                            //clear the batch
                            $scope.project.clearBatch();
                            uiService.log('Finished deleting projects!');
                        } else {
                            $scope.project.batchDelete();
                        }
                    });
                },

                getBatchInfo: function() {
                    $scope.project.batchInfo = [];
                    var projs = _.filter($scope.org.selected.projects, function(proj) {
                        return $scope.project.batchAr.indexOf(proj.ref) !== -1;
                    });
                    _.forEach(projs, function(proj) {
                        console.log('proj: ', proj);
                        $scope.project.batchInfo.push({
                            name: "Project: ",
                            val: proj.projName
                        });
                    });
                },

                batchMove: function() {
                    $scope.project.openUserOrgsModal(null, true);
                },

                clearBatch: function() {
                    _.forEach($scope.org.selected.projects, function(proj) {
                        proj.isBatched = false;
                    });
                    $scope.project.batchAr = [];
                    $scope.project.batchInd = 0;
                    $scope.project.batchInfo = [];
                },

                createProjAndEnter: function() {
                    var self = this;
                    this.addNewProject()
                        .then(function(orgProject) {
                            //Open project
                            self.open(orgProject);
                        });
                },

                addNewProject: function(projName) {
                    console.log("[ctrlDashboard.addNewProject]");
                    var self = this;

                    return orgFactory.currOrg()
                        .then(function(currentOrg) {
                            var newProj = {
                                projName: projName || 'untitled map ' + Math.round(Math.random() * 1000),
                                descr: '',
                                picture: '',
                                tags: []
                            };

                            return projFactory.createProject(currentOrg._id, newProj);
                        })
                        .then(function(projDocs) {
                            if (!projDocs._id) throw new Error('Project has no id');
                            return self._addNewProjToCurrentOrg(projDocs);
                        });
                },

                open: function(proj) {
                    if (!_.isObject(proj)) {
                        throw new Error("Project to open not passed");
                    }
                    proj = _.isObject(proj) ? proj : null;
                    var projectRef = proj.ref;

                    //a way to allow bootstrap components (dropdown) to work within this div
                    //because the events need to bubble up
                    $scope.project.selected = _.find($scope.org.selected.projects, 'ref', proj.ref);
                    console.log("[ctrlDashboard.openProject] " + projectRef);
                    //REVIEW: IS GETTING PROJECT DETAILS NECESSARY HERE?
                    // $scope.project.getProjectDetails(projectRef);
                    $location.path('/projects/' + projectRef);
                },

                _addNewProjToCurrentOrg: function(projDocs) {
                    var newProj = {
                        ref: projDocs._id,
                        projName: projDocs.projName,
                        picture: projDocs.picture,
                        owner: {
                            ref: projDocs.owner.ref
                        },
                        members: projDocs.users.members,
                        dateModified: projDocs.dateModified
                    };

                    var currUser = userFactory.currUserUnsafe();
                    if (currUser) {
                        _.assign(newProj.owner, _.pick(currUser, ['first_name', 'last_name', 'name', 'email']));
                    } else {
                        console.warn('Current user not found');
                    }

                    //$scope.notify('success','New mapp ' + projDocs.projName + ' created!');
                    newProj.playerInfo = {
                        enabled: false
                    }; //Hack to hide the player icon in the dashboard on new map
                    $scope.org.selected.projects.push(newProj);
                    projDocs.edit = true;
                    return newProj;
                },

                isProjectInFocus: function(projectRef) {
                    if (typeof $scope.project.selected !== "undefined" && $scope.project.selected !== null) {
                        if (projectRef == $scope.project.selected._id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    } else {
                        return -1;
                    }
                },

                updateProject: function(orgProject, params) {
                    orgFactory.currOrg()
                        .then(function(currOrgDoc) {
                            return projFactory.updateProject(currOrgDoc._id, orgProject.ref, params);
                        })
                        .then(function(result) {
                            uiService.log('Mapp updated!');
                            var valsToUpdateObj = _.pick(result, ['projName', 'descr', 'picture']);
                            _.assign(orgProject, valsToUpdateObj);
                            if (_.isObject($scope.project.selected)) {
                                _.assign($scope.project.selected, valsToUpdateObj);
                            }
                            $scope.ui.cancelProjectEditMode(orgProject);
                        }, function(err) {
                            uiService.logError('Mapp could not be updated!');
                            console.log('[ctrlDashboard: ] mapp not updated - ', err);
                        });
                },

                cloneProject: function(projectRef) {
                    var _this = this;
                    projFactory.cloneProject($scope.org.selected._id, projectRef, function(res) {
                        //by design the response returns the id of the cloned project as confirmation
                        // HACK
                        // Not getting valid JSON from server
                        var parsedRef;
                        try {
                            parsedRef = JSON.parse(res);
                        } catch (e) {
                            parsedRef = res;
                        }
                        res._id && _this._addNewProjToCurrentOrg(parsedRef);
                    });
                },
                openUserOrgsModal: function(projectRef, isBatch) {
                    var modalInstance = $uibModal.open({
                        templateUrl: '#{server_prefix}#{view_path}/components/dashboard/mapps/project_ops/move/moveMappOrgModal.html',
                        controller: 'MoveMappOrgCtrl',
                        scope: $scope,
                        resolve: {
                            projectsToMove: function() {
                                if (isBatch) {
                                    return _.filter($scope.org.selected.projects, function(proj) {
                                        return $scope.project.batchAr.indexOf(proj.ref) !== -1;
                                    });
                                } else {
                                    return [_.find($scope.org.selected.projects, 'ref', projectRef)];
                                }
                            }
                        }
                    });

                    //Called when modal is closed
                    modalInstance.result
                        .then(
                            function(data) {
                                if (data.movedAr && data.movedAr.length > 0) {
                                    for (var i = 0; i < data.movedAr.length; i++) {
                                        var projIdx = _.findIndex($scope.org.selected.projects, 'ref', data.movedAr[i]);
                                        if (projIdx > -1) {
                                            $scope.org.selected.projects.splice(projIdx, 1);
                                        } else {
                                            throw new Error('Project moved not found in org');
                                        }
                                    }
                                }
                                $scope.project.clearBatch();
                            },
                            function() {
                                console.warn("Modal dismissed at: " + new Date());
                            }
                        ).finally(function() {

                        });
                },
                removeProject: function(projectRef, callback) {
                    uiService.showProgress('del_' + projectRef, 'Removing mapp', 'success', 30);
                    projFactory.removeProject($scope.org.selected._id, projectRef, function(res) {
                        //by design the response returns the id of the deleted project as confirmation
                        for (var i = 0, l = $scope.org.selected.projects.length; i < l; i++) {
                            // HACK
                            // Not getting valid JSON from server
                            var parsedRef;
                            try {
                                parsedRef = JSON.parse(res);
                            } catch (e) {
                                parsedRef = res;
                            }

                            if ($scope.org.selected.projects[i].ref == parsedRef) {
                                $scope.org.selected.projects.splice(i, 1);
                                $scope.project.clearLoadedProject();
                                uiService.showProgress('del_' + projectRef, 'Removing mapp', 'success', 100);
                                if (callback) {
                                    callback();
                                }
                                return;
                            }
                        }

                    });
                },

                openFileUploadModal: function(size, editMode, diMode) {
                    var modalInstance;
                    var removeHistoryListener = angular.noop();
                    var diDefer = $q.defer();

                    modalInstance = $uibModal.open({
                        templateUrl: '#{server_prefix}#{view_path}/components/project/dataIngestion/createMapModal.html',
                        controller: 'DataIngestionModalCtrl',
                        scope: $scope,
                        size: size,
                        backdrop: !editMode ? 'static' : true,
                        resolve: {
                            editMode: function() {
                                return editMode;
                            },
                            diMode: function() {
                                return diMode;
                            }
                        }
                    });

                    modalInstance.opened.then(function() {
                        removeHistoryListener = $scope.$on(BROADCAST_MESSAGES.route.historyBtnUsed, function() {
                            modalInstance.dismiss();
                        });
                    });

                    //Called when modal is closed
                    modalInstance.result
                        .then(
                            function(data) {
                                console.log(data);
                                diDefer.resolve(data);
                            },
                            function() {
                                diDefer.reject('modal dismissed');
                                $log.warn("Modal dismissed at: " + new Date());
                            }
                        ).finally(function() {
                            removeHistoryListener();
                        });

                    return diDefer.promise;
                },

                openNetgenModal: function(modalState, persist) {
                    var ngDefer = $q.defer();
                    var logPrefix = '[ctrlDashboard: openNetgenModal ] ';
                    var modalInstance = $uibModal.open({
                        templateUrl: '#{server_prefix}#{view_path}/components/project/netgen/netgenModal.html',
                        controller: 'NetgenModalCtrl',
                        size: 'lg',
                        backdrop: persist ? 'static' : true,
                        resolve: {
                            modalState: function() {
                                return modalState;
                            }
                        }
                    });

                    //Called when modal is closed
                    modalInstance.result.then(
                        function(data) {
                            if (data.operation == 'regenerate') {
                                var newNetworkId = data.newNetworkId;
                                var currentNetwork = networkService.getCurrentNetwork();

                                networkService.deleteNetwork(currentNetwork.id, newNetworkId)
                                    .then(function() {
                                        console.log(logPrefix + 'network deleted - ' + currentNetwork.name);
                                        uiService.log('Network deleted from mapp: ' + currentNetwork.name);
                                        // If network deleted due to regenration, set new network Id in depending snaps
                                        if (newNetworkId) {
                                            if (!currentNetwork) throw new Error('Current network not set');
                                            _.each(snapshotService.getNetworkSnapshots(currentNetwork.id), function(snap) {
                                                snap.networkId = newNetworkId;
                                                snap.layout.xaxis = 'OriginalX';
                                                snap.layout.yaxis = 'OriginalY';
                                            });
                                        }
                                        ngDefer.resolve(data);
                                    }, function(err) {
                                        console.error(err);
                                        ngDefer.reject(err);
                                    });
                            } else {
                                ngDefer.resolve(data);
                            }
                        },
                        function() {
                            ngDefer.reject('modal dismissed');
                            $log.warn("Modal dismissed at: " + new Date());
                        }
                    );
                    return ngDefer.promise;
                },

                downloadProjectXLSX: function(project) {
                    var modalInstance = $uibModal.open({
                        templateUrl: '#{server_prefix}#{view_path}/components/dashboard/mapps/project_ops/download_data/mapDownloadModal.html',
                        controller: 'MapDownloadModalCtrl',
                        resolve: {
                            projectRef: function() {
                                return project.ref;
                            }
                        }
                    });

                    //Called when modal is closed
                    modalInstance.result.then(
                        function() {
                            console.log('Map download started');
                        },
                        function() {
                            $log.warn("Modal dismissed at: " + new Date());
                        }
                    );
                },

                //
                // SVG output
                //
                renderSvg: function() {
                    var elem = $('#svg-renderarea');
                    elem.empty();
                    svgRenderService.renderSvg(document.getElementById('svg-renderarea'));
                    console.log('SVG rendered!');
                    console.log(document.getElementById('svg-renderarea'));
                    var svgElem = elem.children()[0];
                    $(svgElem).attr({
                        version: '1.1',
                        xmlns: "http://www.w3.org/2000/svg",
                        encoding: "UTF-8"
                    });
                    var xml = (new XMLSerializer()).serializeToString(svgElem);
                    svgRenderService.getSvgUrl(xml)
                        .then(function(url) {
                            console.log("[ctrlHackPanel] SVG URL: " + url);
                            open(url);
                        });
                },

                exportRecipe: function(projectRef) {
                    var orgId = $scope.org.selected._id;
                    if (!orgId) throw new Error('Org not loaded');
                    return recipeService.importRecipeFromProject(orgId, projectRef)
                        .then(function(projRecipe) {
                            console.log(logPrefix + 'recipe imported from project: ' + projectRef);
                            return recipeService.createNew(orgId, projRecipe);
                        })
                        .then(function(recipe) {
                            console.log(logPrefix + 'recipe created from project: ' + projectRef);
                            uiService.log('Recipe successfully exported from project!');
                            return recipe;
                        })
                        .catch(function(e) {
                            console.log(logPrefix + 'error in exporting recipe from project: ' + projectRef);
                            console.error(e);
                            uiService.logError('Sorry, recipe could not be exported from project!');
                        });
                }
            };

            $scope.surveyTemplate = {
                selected: null,
                oldItem: null,
                profileMediaTag: '',
                locales: [{
                    name: "English",
                    value: "english"
                }, {
                    name: "French",
                    value: "french"
                }],
                themes: [{
                    name: "Hacking Creativity",
                    value: "styleHC"
                }],
                profileQuestionTypes: [{
                    name: "Text",
                    value: "text"
                }, {
                    name: "Paragraph",
                    value: "para"
                }, {
                    name: "Video or Paragraph",
                    value: "vidpara"
                }],
                profileQuestionCats: [{
                    name: "Basic Info",
                    value: "PC1"
                }, {
                    name: "Selfie Q & A",
                    value: "PC2"
                }],
                newProfileQuestion: {
                    id: null,
                    titleText: '',
                    renderType: null,
                    categoryId: null
                },
                viewSurvey: function(stItem) {
                    window.open(surveyBaseUrl + stItem.ref, '_blank');
                },
                selectSurveyTemplate: function(surveyTemplate, $event) {

                    if ($event && $($event.target).hasClass('stop-prop')) {
                        surveyTemplate.disabled = true;
                        return;
                    } else if ($event && surveyTemplate.disabled) {
                        surveyTemplate.disabled = false;
                        return;
                    }

                    //if this is the current survey then do nothing
                    if ($scope.surveyTemplate.selected && surveyTemplate.ref == $scope.surveyTemplate.selected._id) {
                        return;
                    }

                    //close current if any
                    if ($scope.surveyTemplate.oldItem) {
                        $scope.ui.cancelSurveyTemplateEditMode($scope.surveyTemplate.oldItem);
                    }
                    $timeout(function() {
                        $scope.surveyTemplate.oldItem = surveyTemplate;
                        var surveyTemplateRef = surveyTemplate.ref;
                        //a way to allow bootstrap components (dropdown) to work within this div
                        //because the events need to bubble up

                        if ($scope.surveyTemplate.selected && surveyTemplateRef == $scope.surveyTemplate.selected._id) return;

                        switch (uiService.getPage()) {
                            case 'survey':
                                $scope.survey.open(surveyTemplateRef);
                                break;
                            case 'user-surveys':
                            default:

                                orgFactory.currOrg()
                                    .then(function(orgDocs) {
                                        return surveyTemplateFactory.getSurveyTemplateDoc(orgDocs._id, surveyTemplateRef);
                                    })
                                    .then(function(stDocs) {
                                        console.log('[ctrlDashboard.selectSurveyTemplate] %O', stDocs);
                                        $scope.surveyTemplate.selected = stDocs;
                                        $scope.tempData = null;
                                        surveyTemplate.edit = true;
                                        return $scope.surveyTemplate.selected;
                                    });
                                break;
                        }
                    });


                },


                //modal for rendereing a survey
                openRenderSurveyModal: function() {
                    var modalInstance = $uibModal.open({
                        templateUrl: "#{server_prefix}#{view_path}/partials/project/renderSurveyModal.html",
                        controller: 'renderSurveyModalCtrl',
                        size: 'lg'
                    });
                    modalInstance.result.then(function(renderParams) {
                        mappToSurveyService.renderSurvey(renderParams);
                    }, function() {
                        $log.warn("Modal dismissed at: " + new Date());
                    });
                },

                isSurveyTemplateInFocus: function(surveyTemplateRef) {
                    if (typeof $scope.surveyTemplate.selected !== "undefined" && $scope.surveyTemplate.selected !== null) {
                        if (surveyTemplateRef == $scope.surveyTemplate.selected._id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    } else {
                        return -1;
                    }
                },
                //get analytics and  whether to show download responses button and anything else that needs to be shown in list
                getAsyncData: function() {
                    return;
                    //get whether published
                    // orgFactory.currOrg()
                    //     .then(function(orgDocs) {
                    //         console.log('params: ', orgDocs._id, stItem.ref);
                    //         return surveyTemplateFactory.getSurveyTemplateDoc(orgDocs._id, stItem.ref);
                    //     })
                    // .then(function(stDocs) {
                    //     console.debug('stDocs: ', stDocs);
                    //     stItem.isPublished = stDocs.isPublished;
                    //     if(stItem.isPublished) {
                    //         //get analytics
                    //         // $scope.surveyTemplate.getSurveyDataAnalytics(stItem);
                    //     }
                    // })

                },

                addNewSurveyTemplate: function(surveyName) {
                    console.log("[ctrlDashboard.addNewSurvey]");
                    var newSt;
                    orgFactory.currOrg()
                        .then(function(currentOrg) {
                            var newSurveyTemplate = {
                                surveyName: surveyName || 'Survey Template ' + Math.round(Math.random() * 1000),
                                descr: '',
                                tags: ['wip']
                            };

                            surveyTemplateFactory.addSurveyTemplate(currentOrg._id, newSurveyTemplate)
                                .then(function(stDocs) {
                                    if (stDocs._id) {
                                        newSt = {
                                            ref: stDocs._id,
                                            surveyName: stDocs.surveyName,
                                            owner: {
                                                ref: stDocs.owner.ref,
                                                name: stDocs.owner.name,
                                                email: stDocs.owner.email,
                                                picture: stDocs.owner.picture
                                            },
                                            dateModified: stDocs.dateModified
                                        };
                                        $scope.notify('success', 'New Survey Template ' + stDocs.surveyName + ' created!');
                                        $scope.org.selected.surveyTemplates.push(newSt);
                                        // stDocs.edit = true;
                                        return stDocs;
                                    }
                                })
                                .then(function() {
                                    //clear selection
                                    uiService.log('Survey created!');
                                    newSt.edit = true;
                                    $scope.surveyTemplate.selectSurveyTemplate(newSt);
                                });
                        });
                },

                updateSurveyTemplate: function(updatedOrgSurveyTemplate) {
                    orgFactory.currOrg()
                        .then(function(currOrgDoc) {
                            console.log(currOrgDoc);
                            //_.assign(updatedOrgSurveyTemplate, params);
                            console.debug('survey template: ', updatedOrgSurveyTemplate);

                            return surveyTemplateFactory.updateSurveyTemplate(currOrgDoc._id, $scope.surveyTemplate.selected._id, updatedOrgSurveyTemplate);
                        })
                        .then(function(result) {

                            uiService.log('Survey updated!');
                            $scope.surveyTemplate.selected.surveyName = result.surveyName;
                            _.assign(updatedOrgSurveyTemplate, result);
                            console.log('about to close: ', _.find($scope.org.selected.surveyTemplates, {
                                ref: updatedOrgSurveyTemplate._id
                            }));
                            $scope.ui.cancelSurveyTemplateEditMode(_.find($scope.org.selected.surveyTemplates, {
                                ref: updatedOrgSurveyTemplate._id
                            }));
                        })
                        .then();
                },

                removeSurveyTemplate: function(surveyRef) {
                    surveyTemplateFactory.removeSurveyTemplate($scope.org.selected._id, surveyRef)
                        .then(function(res) {
                            uiService.log('Survey deleted!');

                            // console.log('delete response: ', res);
                            //by design the response returns the id of the deleted project as confirmation
                            for (var i = 0, l = $scope.org.selected.surveyTemplates.length; i < l; i++) {
                                if ($scope.org.selected.surveyTemplates[i].ref == String(res)) {
                                    $scope.org.selected.surveyTemplates.splice(i, 1);
                                    $scope.surveyTemplate.clearLoadedSurveyTemplate();
                                    return;
                                }
                            }
                        });
                },

                clearLoadedSurveyTemplate: function() {
                    console.log('clear survey template');
                    $scope.surveyTemplate.selected = null;
                    $scope.tempData = null;
                    $location.path('/user-surveys');
                },

                addIntroSlide: function(surveyTemplate) {
                    surveyTemplate.intro.sections.push({
                        slides: [{
                            title: "New Slide",
                            descr: "",
                            img: ""
                        }]
                    });
                },

                deleteIntroSlide: function(ind) {
                    $scope.surveyTemplate.selected.template.intro.sections.splice(ind, 1);
                },

                addMediaTag: function() {
                    var tag = $scope.surveyTemplate.profileMediaTag;
                    if (tag) {
                        $scope.surveyTemplate.selected.template.profile.mediaTags.push(tag);
                    }
                    $scope.surveyTemplate.profileMediaTag = "";
                },

                deleteMediaTag: function(ind) {
                    $scope.surveyTemplate.selected.template.profile.mediaTags.splice(ind, 1);
                },

                addProfileQuestion: function() {
                    //TODO
                    //create a unique id for the question
                    var ind = $scope.surveyTemplate.selected.template.profile.questions.length;
                    var newId = 'P' + ind;
                    while (_.find({
                            'id': newId
                        }, $scope.surveyTemplate.selected.template.profile.questions) != undefined) {
                        ind++;
                        newId = 'P' + ind;
                    }
                    $scope.surveyTemplate.newProfileQuestion.id = newId;
                    if ($scope.surveyTemplate.newProfileQuestion.titleText) {
                        $scope.surveyTemplate.selected.template.profile.questions.push(_.clone($scope.surveyTemplate.newProfileQuestion));
                    }
                    $scope.surveyTemplate.newProfileQuestion = {
                        id: null,
                        titleText: '',
                        renderType: null,
                        categoryId: null
                    };
                },

                deleteProfileQuestion: function(ind) {
                    console.log('deleting profile quesiton: ' + ind);
                    $scope.surveyTemplate.selected.template.profile.questions.splice(ind, 1);
                },

                open: function() {
                    //todo
                    //hold till we have a dedicated page
                    //for a single survey editor
                },

                publishSurvey: function(surveyTemplate) {
                    orgFactory.currOrg()
                        .then(function(orgDocs) {
                            //expect the dataSetRef for the survey back
                            return surveyTemplateFactory.publishSurveyTemplate(orgDocs._id, surveyTemplate.ref);
                        })
                        .then(function(rawDataSetRef) {
                            // $scope.surveyTemplate.selected.rawDataSetRef = rawDataSetRef;
                            // $scope.surveyTemplate.selected.isPublished = true;
                            // $scope.surveyTemplate.selected.isConcluded = false;
                            surveyTemplate.rawDataSetRef = rawDataSetRef;
                            surveyTemplate.isPublished = false;
                            surveyTemplate.isConcluded = true;
                        });
                },

                concludeSurvey: function(surveyTemplate) {
                    orgFactory.currOrg()
                        .then(function(orgDocs) {
                            //expect the dataSetRef for the survey back
                            return surveyTemplateFactory.concludeSurveyTemplate(orgDocs._id, surveyTemplate.ref);
                        })
                        .then(function() {
                            // $scope.surveyTemplate.selected.isPublished = false;
                            // $scope.surveyTemplate.selected.isConcluded = true;
                            surveyTemplate.isPublished = false;
                            surveyTemplate.isConcluded = true;
                        });
                },

                generateCoupons: function(surveyTemplate) {
                    orgFactory.currOrg()
                        .then(function(orgDocs) {
                            //expect the updated survey template to be returned
                            return surveyTemplateFactory.generateSurveyTemplateCoupons(orgDocs._id, surveyTemplate.ref);
                        })
                        .then(function(savedSurveyTemplate) {
                            console.log(savedSurveyTemplate);
                            $scope.surveyTemplate.selected.useCoupons = savedSurveyTemplate;
                            $scope.surveyTemplate.selected.coupons = savedSurveyTemplate.coupons;
                            $scope.surveyTemplate.selected.couponCriteria = savedSurveyTemplate.couponCriteria;
                            $scope.surveyTemplate.selected.noOfCouponsUsed = savedSurveyTemplate.noOfCouponsUsed;
                        });
                },

                //category
                addCategory: function(surveyTemplateRef) {
                    surveyTemplateFactory.addCategory($scope.org.selected._id, surveyTemplateRef, null)
                        .then(function(result) {
                            console.log('[ctrlDashboard.addCategory] %O', result);
                            $scope.surveyTemplate.selected.template.categories.push(result);
                            //$scope.ui.newCategory.name = ''; //clear ui form
                        });
                },

                updateCategory: function(surveyTemplateRef, category) {
                    surveyTemplateFactory.updateCategory($scope.org.selected._id, surveyTemplateRef, category.id, category)
                        .then(function(result) {
                            console.log('[ctrlDashboard.updateCategory] saved category: %O', result);
                            $scope.surveyTemplate.selected.template.categories[result] = category;
                            $scope.ui.cancelCategoryEditMode(category);
                        });
                },

                removeCategory: function(surveyTemplateRef, category) {
                    surveyTemplateFactory.removeCategory($scope.org.selected._id, surveyTemplateRef, category.id)
                        .then(function(result) {
                            //console.log(result);
                            //expect the deletion index of the category
                            $scope.surveyTemplate.selected.template.categories.splice(result.delIndex, 1);
                        });
                },

                //slide
                addSlide: function(surveyTemplateRef, category) {
                    surveyTemplateFactory.addSlide($scope.org.selected._id, surveyTemplateRef, {
                            categoryRef: category.id
                        })
                        .then(function(result) {
                            $scope.surveyTemplate.selected.template.slides.push(result);
                            category.slideList.push(result.id);
                            category.view = true;
                            //_.map($scope.surveyTemplate.selected.template.categories, function(ct){ console.log(ct.title + '-->');console.log(ct.slideList); return;});
                            //console.log('[ctrlDashboard.addSlide] slides->' + _.map($scope.surveyTemplate.selected.template.slides, function(sl){return sl.num}));
                            console.log('[ctrlDashboard.addSlide] success. no of current slides: ', $scope.surveyTemplate.selected.template.slides.length);
                        });
                },

                updateSlide: function(surveyTemplateRef, slideNum) {
                    var sl = $scope.surveyTemplate.getSlideFromNum(slideNum);
                    surveyTemplateFactory.updateSlide($scope.org.selected._id, surveyTemplateRef, slideNum, sl)
                        .then(function(result) {
                            console.log('[ctrlDashboard.updateSlide] slide updated %O', result);
                            sl = result;
                        });
                },

                removeSlide: function(surveyTemplateRef, slide) {
                    surveyTemplateFactory.removeSlide($scope.org.selected._id, surveyTemplateRef, slide.id)
                        .then(function(result) {
                            //expect the {delIndex, delNum} of the slide
                            console.log('removeSlide', result);
                            //removing slide from slides array
                            $scope.surveyTemplate.selected.template.slides = _.filter($scope.surveyTemplate.selected.template.slides, function(slide) {
                                console.log(slide.id, result.delNum, (slide.id != result.delNum));
                                return slide.id != result.delNum;
                            });

                            //updating all categories
                            for (var i = $scope.surveyTemplate.selected.template.categories.length - 1; i >= 0; i--) {
                                $scope.surveyTemplate.selected.template.categories[i].slideList = _.without($scope.surveyTemplate.selected.template.categories[i].slideList, slide.id);
                            }

                            //reporting
                            // _.map($scope.surveyTemplate.selected.template.categories, function(ct){ console.log(ct.title + '-->');console.log(ct.slideList); return;});
                            console.log('slides->' + _.map($scope.surveyTemplate.selected.template.slides, function(sl) {
                                return sl.num;
                            }));
                            console.log($scope.surveyTemplate.selected.template.slides);

                        });
                },

                getSlideFromNum: function(slideNum) {
                    //console.log('slideNum -: ' + slideNum);
                    // console.log('total number of slides: ' + $scope.surveyTemplate.selected.template.slides.length);
                    for (var i = $scope.surveyTemplate.selected.template.slides.length - 1; i >= 0; i--) {
                        //console.log('looking at slide : ' + i);
                        if (slideNum == $scope.surveyTemplate.selected.template.slides[i].id) {
                            //console.log('yes');
                            //console.log($scope.surveyTemplate.selected.template.slides[i]);
                            return $scope.surveyTemplate.selected.template.slides[i];
                        } else {
                            //console.log('no');
                            //console.log($scope.surveyTemplate.selected.template.slides[i]);
                        }
                    }

                    return;
                },

                opt: 0,
                choices: 0,

                addOptionsToSlideAnswer: function(surveyTemplateRef, slideNum) {
                    var options = $scope.surveyTemplate.getSlideFromNum(slideNum).answerOptions.rows;
                    options.push({
                        descr: 'option ' + options.length,
                        value: 0
                    });
                    $scope.surveyTemplate.updateSlide(surveyTemplateRef, slideNum);
                    //$scope.ui.slideOptionForm = {};
                },

                removeOptionsFromSlideAnswer: function(surveyTemplateRef, slideNum, optionNum) {
                    console.log('removing option ' + optionNum);
                    var options = $scope.surveyTemplate.getSlideFromNum(slideNum).answerOptions.rows;
                    options.splice(optionNum, 1);
                    $scope.surveyTemplate.updateSlide(surveyTemplateRef, slideNum);
                },

                addMatrixColumnToSlideAnswer: function(surveyTemplateRef, slideNum) {
                    var options = $scope.surveyTemplate.getSlideFromNum(slideNum).answerOptions.cols;
                    options.push({
                        descr: 'option ' + options.length,
                        value: 0
                    });
                    $scope.surveyTemplate.updateSlide(surveyTemplateRef, slideNum);
                    //$scope.ui.slideOptionForm = {};
                },

                removeMatrixColumnFromSlideAnswer: function(surveyTemplateRef, slideNum, optionNum) {
                    console.log('removing column ' + optionNum);
                    var options = $scope.surveyTemplate.getSlideFromNum(slideNum).answerOptions.cols;
                    options.splice(optionNum, 1);
                    $scope.surveyTemplate.updateSlide(surveyTemplateRef, slideNum);
                },

                addMatrixRowToSlideAnswer: function(surveyTemplateRef, slideNum) {
                    console.debug('slide: ', $scope.surveyTemplate.getSlideFromNum(slideNum));
                    var options = $scope.surveyTemplate.getSlideFromNum(slideNum).answerOptions.rows;
                    options.push({
                        descr: 'option ' + options.length,
                        value: 0
                    });
                    $scope.surveyTemplate.updateSlide(surveyTemplateRef, slideNum);
                    //$scope.ui.slideOptionForm = {};
                },

                removeMatrixRowFromSlideAnswer: function(surveyTemplateRef, slideNum, optionNum) {
                    console.log('removing option ' + optionNum);
                    var options = $scope.surveyTemplate.getSlideFromNum(slideNum).answerOptions.rows;
                    options.splice(optionNum, 1);
                    $scope.surveyTemplate.updateSlide(surveyTemplateRef, slideNum);
                },

                openDataUploadModal: function() {
                    //open modal
                    var modalInstance = $uibModal.open({
                        size: 'lg',
                        templateUrl: "#{server_prefix}#{view_path}/partials/templates/surveyDataUploadModal.html",
                        controller: 'surveyDataUploadModalCtrl',
                        resolve: {}
                    });
                    modalInstance.result.then(function(template) {
                        console.log('template received %O', template);
                        $scope.surveyTemplate.selected.template = template;
                    }, function() {
                        $log.warn("Modal dismissed at: " + new Date());
                    });
                },

                normalizeData: function(origData) {

                    var colData = [];
                    _.each(origData, function(rowObj) {
                        var normRowObj = {};
                        normRowObj.id = rowObj.rowId;
                        _.each(rowObj.row, function(ques) {
                            normRowObj[ques.colId] = ques.response;
                            if (_.indexOf(colData, ques.colId) > -1) colData.push(ques.colId);
                        });
                        $scope.tempData.push(_.clone(normRowObj));
                    });
                },

                getSurveyData: function(surveyTemplateRef) {
                    surveyTemplateFactory.fetchData($scope.org.selected._id, surveyTemplateRef)
                        .then(function(result) {
                            $scope.tempData = [];
                            $scope.questionCount = {};

                            var done = _.after(result.data.length, function() {
                                console.log('questionCount %0', $scope.questionCount);
                            });




                            _.each(result.data, function(rowObj) {
                                var normRowObj = {};
                                normRowObj.id = rowObj.rowId;
                                _.each(rowObj.row, function(ques) {
                                    normRowObj[ques.colId] = ques.response;
                                    // var arr = _.pluck(colData, 'field');
                                    // if (arr.indexOf(ques.colId) < 0) {
                                    //colData.push({field:ques.colId, displayName:ques.colId, width: 150});
                                    $scope.questionCount[ques.colId] = $scope.questionCount[ques.colId] ? $scope.questionCount[ques.colId] + 1 : 1;
                                    // }
                                });
                                $scope.tempData.push(_.clone(normRowObj));
                                done();
                            });
                        });
                },

                getSurveyDataAsXLSX: function(surveyTemplate) {
                    var surveyTemplateRef = surveyTemplate.ref;
                    surveyTemplateFactory.getSurveyDataAsXLSX($scope.org.selected._id, surveyTemplateRef)
                        .then(function(result) {
                            window.saveAs(new Blob([s2ab(result)], {
                                type: "application/octet-stream"
                            }), surveyTemplate.surveyName + ".xlsx");
                        });
                },

                getSurveyDataAnalytics: function(surveyItem) {
                    surveyTemplateFactory.getSurveyDataAnalytics($scope.org.selected._id, surveyItem.ref)
                        .then(function(result) {
                            console.debug("analytics results: ", result);

                            surveyItem.analytics = {};
                            surveyItem.analytics.viewCount = result.viewCount;
                            surveyItem.analytics.numLoggedIn = result.numLoggedIn;
                            surveyItem.analytics.numStarted = result.numStarted;
                            surveyItem.analytics.numFinished = result.numFinished;
                            surveyItem.analytics.meanFinishTime = isNaN(result.meanFinishTime) ? result.meanFinishTime : window.moment.duration(result.meanFinishTime).humanize();
                            console.log('surveyItem analytics: ', surveyItem.analytics);
                        });
                }
            };

            //recipes
            $scope.recipeDash = {
                searchKey: '',
                sortType: 'dateModified',
                sortReverse: true,
                create: function(recipe) {
                    if (!recipe) {
                        // $location.path('/recipes/new');

                        return recipeService.createNew($scope.org.selected._id, recipeService.getDefaultRecipe())
                            .then(function(recipe) {
                                console.log('new recipe: ', recipe);
                                uiService.log('Recipe Created');
                                $location.path('/recipes/' + recipe._id);
                            })
                            .catch(function(e) {
                                uiService.logError('Unable to create. Got error: ' + e.toString());
                            });
                    } else {
                        $location.path('/recipes/' + recipe._id);
                    }
                }
            };

            //ui
            $scope.ui = {
                //page
                setPage: function(page) {
                    console.log('setting page');
                    uiService.setPage(page);
                },
                getPage: function() {
                    return uiService.getPage();
                },

                //forms
                surveyTemplateForm: {},
                slideOptionForm: {},
                projForm: {},

                //survey
                enterSurveyTemplateEditMode: function(surveyTemplate) {
                    $scope.ui.surveyTemplateForm = {};
                    console.log("edit survey template");
                    if (typeof surveyTemplate === "undefined" || surveyTemplate === null) {
                        surveyTemplateFactory.currSurveyTemplate()
                            .then(function(stDocs) {
                                $location.path("/user-surveys");
                                $scope.surveyTemplate.selected = stDocs;
                                stDocs.edit = true;
                            });
                    } else {
                        $scope.surveyTemplate.selected = surveyTemplate;
                        surveyTemplate.edit = true;
                    }
                },
                cancelSurveyTemplateEditMode: function(surveyTemplate) {
                    surveyTemplate.edit = false;
                    $scope.surveyTemplate.selected = null;
                },

                generateSurveyPreview: function(stRef) {
                    $window.open(surveyBaseUrl + stRef);
                },

                getSurveyUrl: function(stRef) {
                    return surveyBaseUrl + stRef;
                },

                //slides
                toggleSlide: function(slide) {
                    if (slide.isOpen) {
                        slide.isOpen = false;
                    } else {
                        slide.isOpen = true;
                    }
                },
                openAllSlides: function(category) {
                    _.each(category.slideList, function(sNum) {
                        $scope.surveyTemplate.getSlideFromNum(sNum).isOpen = true;
                    });
                },
                closeAllSlides: function(category) {
                    _.each(category.slideList, function(sNum) {
                        $scope.surveyTemplate.getSlideFromNum(sNum).isOpen = false;
                    });
                },

                //categories
                enterCategoryEditMode: function(category) {
                    category.edit = true;
                    category.view = false;
                    //change rgb colors to hex color if needed
                    category.renderStyle.col = rgbString2hex(category.renderStyle.col);
                    category.renderStyle.bgCol = rgbString2hex(category.renderStyle.bgCol);
                },
                cancelCategoryEditMode: function(category) {
                    category.edit = false;
                },
                enterCategoryViewMode: function(category) {
                    category.view = !category.edit && true;
                },
                closeCategoryViewMode: function(category) {
                    category.view = false;
                },
                toggleCategoryViewMode: function(category) {
                    if (category.edit) return;

                    if (typeof category.view === "undefined") {
                        category.view = true;
                    } else {
                        category.view = !category.view;
                    }
                },

                //project
                hideDeletedProjects: true,
                enterProjectEditMode: function(project) {
                    console.log("edit project");
                    var defer = $q.defer(),
                        self = this;


                    // Close other edit inputs if open
                    _.each($scope.org.selected.projects, function(proj) {
                        if (proj.edit === true) {
                            proj.edit = false;
                        }
                    });

                    if (typeof project === "undefined" || project === null) {
                        projFactory.currProject()
                            .then(function(projDocs) {
                                $location.path("/user-projects");
                                $scope.project.selected = projDocs;
                                projDocs.edit = true;
                                defer.resolve();
                            });
                    } else {
                        self.projForm.projName = project.projName;
                        project.edit = true;
                        defer.resolve();
                    }

                    return defer.promise;
                },
                cancelProjectEditMode: function(project) {
                    project.edit = false;
                    project.showMenu = false;
                    this.projForm.projName = '';
                },
                openProjectMenu: function(project) {
                    // Close other edit inputs if open
                    _.each($scope.org.selected.projects, function(proj) {
                        proj.edit = false;
                        proj.showMenu = false;
                    });
                    project.showMenu = true;
                },

                openSurveyMenu: function(stItem) {
                    // Close other edit inputs if open
                    _.each($scope.org.selected.surveyTemplates, function(sur) {
                        sur.edit = false;
                        sur.showMenu = false;
                    });
                    stItem.showMenu = true;
                },

                newVersionForm: {},
                hideDeletedVersions: true,
                enterVersionEditMode: function(version) {
                    version.edit = true;
                },
                cancelVersionEditMode: function(version) {
                    version.edit = false;
                },
                goToOrgAssetList: function() {
                    switch (uiService.getPage()) {
                        case 'user-projects':
                            $location.path('/user-projects');
                            break;
                        case 'user-surveys':
                            $location.path('/user-surveys');
                            break;
                        case 'user-recipes':
                            $location.path('/user-recipes');
                            break;
                        default:
                            $location.path('/user-projects');
                            break;
                    }
                }
            };

            //alerts
            $scope.alerts = {
                arr: [],

                add: function(type, alertMsg) {
                    return $scope.alerts.arr.push({
                        type: type,
                        msg: alertMsg
                    });
                },

                closeAlert: function(index) {
                    return $scope.alerts.arr.splice(index, 1);
                }
            };






            /**
             * Scope methods
             */
            $scope.logout = logout;
            $scope.notify = notify;



            /*************************************
             ****** Event Listeners/Watches *******
             **************************************/
            $scope.$on(BROADCAST_MESSAGES.openDIModal, function(e, data) {
                $scope.project.openFileUploadModal('lg', data.editMode, data.diMode || false);
            });




            /*************************************
             ********* Initialise *****************
             **************************************/

            /*************************************
             ********* Core Functions *************
             **************************************/

            function logout() {
                console.group('[ctrlDashboard] logout start');
                AuthService.logout()
                    .then(function() {
                        orgFactory.clearCache();
                        userFactory.clearCache();
                        console.groupEnd();
                        $location.path('/');
                    });
            }

            function loadDefaultOrg(user) {
                console.log('[ctrlDashboard.loadDefaultOrg] loading default project');
                if (user.orgs.length > 0) {
                    //first org in user profile
                    orgFactory.listById(user.orgs[0].ref)
                        .then(function(res) {
                            if (res === '403') {
                                //this shouldnt happen - but just incase the auth is lost
                                createNewOrg(user);
                            } else {
                                $scope.notify('info', 'Your Organization: ' + res.orgName + ' loaded. Enjoy!');
                                $scope.org.selected = res;
                                //todo: update user last sign in
                                if (res.projects.length < 1) {
                                    $scope.notify('warning', 'Create a new project to get started!');
                                }
                            }
                        });
                } else {
                    createNewOrg(user);
                }
            }

            function createNewOrg(user) {
                console.log("[ctrlDashboard.createNewOrg] Creating new org for user");
                var newOrgName = user.name + "'s org";
                $scope.notify('info', 'Creating a new organization [' + newOrgName + '] for you. Welcome to Mappr!');
                orgFactory.addOrg(newOrgName, user.email)
                    .then(function(res) {
                        $scope.org.selected = res;
                    });
            }

            function s2ab(s) {
                var buf = new window.ArrayBuffer(s.length);
                var view = new window.Uint8Array(buf);
                for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
                return buf;
            }

            //for formatting category colors if in rgb instaead of hex (so color input works)
            function rgbString2hex(rgbString) {
                if (rgbString.indexOf('rgb') === 0) {
                    //get array of rgb values
                    var rgb = rgbString.split('(')[1].split(')')[0].split(',');

                    var hex = [
                        Number(rgb[0]).toString(16),
                        Number(rgb[1]).toString(16),
                        Number(rgb[2]).toString(16)
                    ];
                    $.each(hex, function(nr, val) {
                        if (val.length === 1) hex[nr] = '0' + val;
                    });
                    return '#' + hex.join('');
                } else {
                    //if not in right format, just return string
                    return rgbString;
                }
            }

            function notify(type, note) {
                switch (type) {
                    case 'info':
                        return uiService.log(note);
                    case 'success':
                        return uiService.logSuccess(note);
                    case 'warning':
                        return uiService.logWarning("Warning! " + note);
                    case 'error':
                        return uiService.logError("Oh snap! " + note);
                }
            }

        }
    ]);
