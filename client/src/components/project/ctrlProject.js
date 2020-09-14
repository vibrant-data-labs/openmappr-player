angular.module('mappr')
.controller('projectCtrl', ['$q', '$rootScope', '$scope', '$uibModal', '$routeParams', '$timeout', 'projFactory', 'orgFactory', 'dataService','networkService', 'playerFactory', 'layoutService', 'snapshotService', 'renderGraphfactory', 'dataGraph', 'AttrInfoService', 'uiService', 'browserDetectService', 'BROADCAST_MESSAGES', 'athenaService', 'FilterPanelService', 'SelectionSetService',
function($q, $rootScope, $scope, $uibModal, $routeParams, $timeout, projFactory, orgFactory, dataService, networkService, playerFactory, layoutService, snapshotService, renderGraphfactory, dataGraph, AttrInfoService, uiService, browserDetectService, BROADCAST_MESSAGES, athenaService, FilterPanelService, SelectionSetService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var timeStart = Date.now();
    var logPrefix = '[ctrlProject: ] ';



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.currProjectRef = $routeParams.pid;
    $scope.isTakingSnap = false; //for firing snapshot flash effect
    $scope.org.userAuthorised = true;

    $scope.panelUI = {
        //panel booleans
        summaryPanelOpen: true,
        filterPanelOpen: false,
        stylePanelOpen: false,
        layoutPanelOpen: false,
        playerPanelOpen: false,
        algoPanelOpen: false,
        infoPanelOpen: false,
        selectionPanelOpen: false,
        //hovers
        infoPanelHover: false,
        summaryPanelHover: false,
        selectionPanelHover: false,
        filterPanelHover: false,
        //entire right panel boolean
        showRightPanel: false,
        //distance from bottom of window
        rightPanelBottom: 70,
        showInfoAttrs: false,
        showAllAttrs: false,
        currentPanelOpen: 'summary',
        closePanels: function() {
            this.infoPanelOpen = false;
            this.filterPanelOpen = false;
            this.summaryPanelOpen = false;
            this.selectionPanelOpen = false;
            this.stylePanelOpen = false;
            this.layoutPanelOpen = false;
            this.playerPanelOpen = false;
            this.algoPanelOpen = false;
        },
        openPanel: function(pan) {
            this.showRightPanel = true;
            this.closePanels();
            this.currentPanelOpen = pan;
            switch (pan) {
            case 'info':
                this.infoPanelOpen = true;
                break;
            case 'summary':
                this.summaryPanelOpen = true;
                break;
            case 'filter':
                this.filterPanelOpen = true;
                // to trigger virtual scroll so graphs load
                $scope.$broadcast(BROADCAST_MESSAGES.fp.filter.visibilityToggled);
                break;
            case 'selection':
                this.selectionPanelOpen = true;
                break;
            case 'style':
                this.stylePanelOpen = true;
                break;
            case 'algo':
                this.algoPanelOpen = true;
                break;
            case 'layout':
                this.layoutPanelOpen = true;
                break;
            case 'player':
                this.playerPanelOpen = true;
                break;
            default:
            }
        },
        togglePanel: function(pan) {
            var tempBool;
            this.currentPanelOpen = pan;
            switch (pan) {
            case 'info':
                tempBool = this.infoPanelOpen;
                this.closePanels();
                this.infoPanelOpen = !tempBool;
                if(tempBool) {
                    this.openPanel('summary');
                }
                break;
            case 'summary':
                tempBool = this.summaryPanelOpen;
                this.closePanels();
                this.summaryPanelOpen = !tempBool;
                if(tempBool) {
                    this.openPanel('selection');
                }
                break;
            case 'filter':
                tempBool = this.filterPanelOpen;
                this.closePanels();
                this.filterPanelOpen = !tempBool;
                if(tempBool) {
                    this.openPanel('selection');
                }
                break;
            case 'selection':
                tempBool = this.selectionPanelOpen;
                this.closePanels();
                this.selectionPanelOpen = !tempBool;
                console.log('tempBool: ', tempBool);
                if(tempBool) {
                    this.openPanel('filter');
                }
                break;
            default:

            }

        }
    };



    /**
    * Scope methods
    */
    $scope.editProjName = editProjName; //edit project name
    $scope.saveProjectName = saveProjectName;

    $scope.changeTheme = function(theme) {
        // Note:- triggering another $digest somehow
        // $($event.currentTarget).trigger('mouseleave');
        $rootScope.$broadcast(BROADCAST_MESSAGES.project.changeTheme, {theme: theme});
    };

    $scope.cancelProjEdit = function() {
        $scope.editingProjName = false;
    };

    $scope.closeOverlay = function() {
        $rootScope.$broadcast(BROADCAST_MESSAGES.nodeOverlay.remove);
    };




    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.dataMerged, function() {
        loadProject(true);
    });

    var x = $rootScope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
        x();
        $scope.panelUI.showRightPanel = true;
        createPlayer();
    });

    //show snapshot beside project name
    // $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
    //     setSnapName();
    // });
    // $scope.$on(BROADCAST_MESSAGES.snapshot.updated, function() {
    //     setSnapName();
    // });

    // Reset services data on exiting project
    $scope.$on('$destroy', function() {
        FilterPanelService.clear();
        snapshotService.clear();
        projFactory.clearCurrProject();
        dataService.clearDataSet();
        networkService.clear();
        AttrInfoService.clearCaches();
        dataGraph.clear();
        SelectionSetService.clear();
    });




    /*************************************
    ********* Initialise *****************
    **************************************/
    console.group('[ctrlProject load project]');
    //check for old browser and throw warning
    if(browserDetectService.isOldBrowser()) {
        //display modal
        $uibModal.open({
            templateUrl: '/partials/templates/oldBrowserModal',
            size: 'lg'
        });
    }

    $rootScope.$broadcast(BROADCAST_MESSAGES.project.loadStart);
    loadProject();




    /*************************************
    ********* Core Functions *************
    **************************************/

    function loadProject(dataMerged) {
        return orgFactory.currOrg()
        .then(function(orgDoc) {
            console.log('['+ (Date.now()-timeStart) +'] [ctrlProject] org loaded %O', orgDoc);
            return projFactory.getProjectDoc(orgDoc._id, $scope.currProjectRef);
        })
        .then(function(projDoc) {
            console.log(logPrefix + ' project loaded');
            var DiP, DsP, NgP, NwP, DsAndNwP;
            DiP = DsP = NgP = NwP = DsAndNwP = $q.when(null);
            // $scope.rightPanels.showNetwork();

            if(!_.get($scope.project, 'selected')) {
                $scope.project.selected = _.find($scope.org.selected.projects, 'ref', projDoc._id);
            }

            if(_.isEmpty(projDoc.dataset.ref)) {
                DiP = $scope.project.openFileUploadModal('lg', false);
            }

            DsP = DiP.then(function() {
                return dataService.fetchProjectDataSet(projDoc.org.ref, projDoc._id)
                    .then(function(ds) {
                        console.log('[ctrlProject.loadProject] dataset fetched ',ds);
                        if(_.isEmpty(projDoc.dataset.ref)) {
                            projDoc.dataset.ref = ds.id;
                        }
                        return ds;
                    });
            });

            if(projDoc.networks.length === 0) {
                NgP = DiP.then(function(diData) {
                    if(diData && diData.hasNetworks) {
                        return sanitizeNetworks();
                    }
                    else {
                        return $scope.project.openNetgenModal('diCreate');
                    }
                });
            }
            else {
                if(dataMerged && networkService.currNetNeedsReGen()) {
                    // Network Regeneration not necessary
                    NgP = $q(function(resolve) {
                        $scope.project.openNetgenModal('diMerge')
                        .finally(function() {
                            resolve();
                        });
                    });
                }
            }

            NwP = NgP.then(function() {
                return networkService.fetchProjectNetworks(projDoc.org.ref, projDoc._id);
            });
            DsAndNwP = $q.all([DsP, NwP]);

            DsAndNwP.catch(function(err) {
                console.error(logPrefix, err);
                return $q.reject(err);
            });
            return DsAndNwP;
        })
        .then(function(vals) {
            // Project has everything, start load
            var dataset = vals[0];
            var networks = vals[1];
            console.log(logPrefix + 'dataset and networks fetched');
            console.log(logPrefix, dataset);
            console.log(logPrefix, networks);
            if(dataMerged) {
                uiService.log('Data was successfully merged into the network!');
            }
            $rootScope.$broadcast(BROADCAST_MESSAGES.project.load);
            return true;
        })
        .catch(function(err) {
            if(err.status == 403) {
                console.log(logPrefix + 'user unauthorised for project');
            }
            else {
                $rootScope.$broadcast(BROADCAST_MESSAGES.project.loadFailed, {projId: $scope.currProjectRef});
            }
            console.error(logPrefix, err);
            return $q.reject(err);
        })
        .finally(function() {
            console.groupEnd();
        });
    }

    function sanitizeNetworks() {
        var proj = projFactory.currProjectUnsafe();
        return networkService.fetchProjectNetworks(proj.org.ref, proj._id)
            .then(function(networksReceived) {
                var networks = _.clone(networksReceived); // to get around de-cachement done in athenaService.run_algorithm
                var networksPropP = [];
                _.each(networks, function(network) {
                    if(!networkService.hasNetworkProps(network.id)) {
                        // Loade network doesnt have neytwork properties
                        var genPropsP = athenaService.generateNetworkProps(network.id);
                        networksPropP.push(genPropsP);
                    }
                });
                return $q.all(networksPropP)
                    .then(function() { // run cluster layout on networks without pos data
                        console.log('Network props generated');
                        console.log("Networks : ", _.pluck(networks, 'id'));
                        var networksClusterP = _(networks)
                        .filter('networkInfo.positionRandomized')
                        .pluck('id')
                        .tap(function(ids) { console.log("Generating clusts for networks :", ids);})
                        .map(athenaService.generateClusterLayout, athenaService)
                        .value();
                        // var networksClusterP = _.map(_.filter(networks, 'networkInfo.positionRandomized'), function(networkData) {
                        //  var clusterP = athenaService.generateClusterLayout(networkData.networkId);
                        //  return clusterP;
                        // });
                        return $q.all(networksClusterP);
                    });
            })
            .then(function() {
                var x = $rootScope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
                    var rd = dataGraph.getRawDataUnsafe();
                    var suggestedSnapObj = snapshotService.suggestSnapObj();
                    snapshotService.createSnapshot(suggestedSnapObj, function(snap) {
                        if(rd.isNodeAttr('Cluster')) {
                            snap.layout.settings.nodeColorAttr = 'Cluster';
                            snap.layout.settings.drawGroupLabels = true;
                            snap.layout.settings.nodeSizeAttr = 'ClusterArchetype';
                            snap.layout.settings.nodeSizeMultiplier = 0.4;
                        } else {
                            console.warn("'Cluster' does not exist in the network");
                        }
                    }).then(function(snap) {
                        snapshotService.setCurrentSnapshot(snap.id);
                        uiService.log('New snapshot created for this network');
                        $rootScope.$broadcast('updateMapprSettings', snap.layout.settings);
                    });
                    x();
                });
                return true;
            }).catch(function(err) {
                console.error("Error in sanitizeNetworks:", err);
                return $q.reject(err);
            });
    }

    function setSnapName() {
        var currSnap = snapshotService.getCurrentSnapshot();
        if(!currSnap) throw new Error('No snapshot loaded.');
        $scope.currSnapName = currSnap.snapName;
    }

    function editProjName() {
        $scope.tempProjName = $scope.project.selected.projName;
        var $target = $('#project-header-name');
        var headerWidth = $target.find('.proj-name').width();
        var $inp = $target.find('input');
        $inp.width(headerWidth);
        $scope.editingProjName = true;
        $timeout(function() {
            $inp.focus();
        });
    }

    function saveProjectName(name) {
        var params = {
            projName: name
        };
        console.log('tempprojname: ', $scope.tempProjName);
        var orgProject = $scope.project.selected;

        orgFactory.currOrg()
        .then(function(currOrgDoc) {
            return projFactory.updateProject(currOrgDoc._id, orgProject.ref, params);
        })
        .then(function(result) {
            uiService.log('Mapp updated!');
            var valsToUpdateObj = _.pick(result, ['projName', 'descr', 'picture']);
            _.assign(orgProject, valsToUpdateObj);
            if(_.isObject($scope.project.selected)) {
                _.assign($scope.project.selected, valsToUpdateObj);
            }
            $scope.editingProjName = false;
        }, function(err) {
            uiService.logError('Mapp could not be updated!');
            console.log('[ctrlDashboard: ] mapp not updated - ', err);
        });
    }

    function createPlayer() {
        playerFactory.currPlayer()
        .then(function(playerDoc) {
            console.log(logPrefix + ' player exists -> ', playerDoc);
        }, function() {
            // Player doesn't exist
            //No player in the project yet. Creating a default player
            projFactory.currProject()
            .then(function(currProject) {
                var playerObj = {
                    playerUrl: null, // let server assign name - till we have ui + validation
                    picture: currProject.picture || 'https://s3-us-west-1.amazonaws.com/mappr-misc/icons/player_icon_default.png',
                    dataSetRef: currProject.dataset.ref,
                    isDataChunked: true,
                    settings: {
                        allowJoin: false,
                        showModal: false,
                        fontClass: 'Roboto',
                        modalIntroHtml: '<h1>'+ currProject.projName +'</h1><div>Each of the 1000 nodes in this mapp represents ...</div><div>They are linked with each other if they are similar across the following attributes</div><div>a) Attribute 1</div><div>b) Attribute 2</div><h1></h1>',
                        modalTitle: currProject.projName,
                        modalSubtitle: '',
                        modalDescription: '',
                        modalLogo: '',
                        modalBackground: '',
                        highlightColor: '#e21186',
                        simpleSplash: true,
                        showHeader: true,
                        headerType: 'simple',
                        headerHtml: '<h1>' + currProject.projName + '</h1>',
                        headerImageUrl: '',
                        headerTitle: currProject.projName,
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

                playerFactory.createPlayer(currProject.org.ref, currProject._id, playerObj)
                .then(function(doc){
                    console.info('Player Added to project - ', doc);
                }, function(err) {
                    console.error('Player could not be created - ', err);
                });

            });
        });
    }

}
]);
