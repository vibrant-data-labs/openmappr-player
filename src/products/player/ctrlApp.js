angular.module('player')
    .controller('AppCtrl', ['$q', '$sce', '$scope', '$rootScope', '$uibModal', '$routeParams', '$timeout', '$location', '$http', '$cookies', 'playerFactory', 'projFactory', 'dataService', 'networkService', 'clusterService', 'dataGraph', 'snapshotService', 'graphSelectionService', 'layoutService', 'searchService', 'browserDetectService', 'BROADCAST_MESSAGES', 'renderGraphfactory', 'ngIntroService', '$window', 'authService',
        function ($q, $sce, $scope, $rootScope, $uibModal, $routeParams, $timeout, $location, $http, $cookies, playerFactory, projFactory, dataService, networkService, clusterService, dataGraph, snapshotService, graphSelectionService, layoutService, searchService, browserDetectService, BROADCAST_MESSAGES, renderGraphfactory, ngIntroService, $window, authService) {
            'use strict';

            /*************************************
    ************ Local Data **************
    **************************************/
            var logPrefix = '[ctrlApp] ';
            var access_token = $routeParams.access_token || '';
            var loadPlayerData = $q.defer();
            var timeStart = Date.now();

            var tabs = {
                legend: 'summary',
                list: 'info'
            }

            const getDefaultNodeAttrs = (labelAttr) => {
                return [
                    {
                        "id": labelAttr,
                        "title": "OriginalLabel",
                        "visible": false,
                        "visibleInProfile": false,
                        "searchable": false,
                        "attrType": "liststring",
                        "renderType": "tag-cloud"
                    },
                    {
                        "id": "OriginalSize",
                        "title": "OriginalSize",
                        "visible": false,
                        "visibleInProfile": false,
                        "searchable": false,
                        "attrType": "integer",
                        "renderType": "histogram"
                    },
                    {
                        "id": "OriginalX",
                        "title": "OriginalX",
                        "visible": false,
                        "visibleInProfile": false,
                        "searchable": false,
                        "attrType": "float",
                        "renderType": "histogram"
                    },
                    {
                        "id": "OriginalY",
                        "title": "OriginalY",
                        "visible": false,
                        "visibleInProfile": false,
                        "searchable": false,
                        "attrType": "float",
                        "renderType": "histogram"
                    },
                    {
                        "id": "OriginalColor",
                        "title": "OriginalColor",
                        "visible": false,
                        "visibleInProfile": false,
                        "searchable": false,
                        "attrType": "color",
                        "renderType": "categorybar"
                    }
                ]
            }

            /*************************************
    ********* Scope Bindings *************
    **************************************/
            /**
    *  Scope data
    */
            $rootScope.MAPP_EDITOR_OPEN = false;
            $scope.playerUrlStr = $routeParams.urlStr;
            // UI
            $scope.appUi = {
                theme: null,
                hasExtUser: false,
                showGridResetBtn: false,
                setColor: function ($event, color) {
                    $($event.currentTarget).css({
                        color: color,
                        borderColor: color
                    });
                }

            };

            $scope.pinnedMedia = {
                isMediaPinned: false,
                nodeValue: null,
                nodeColorStr: null,
                pinMedia: function (value, color) {
                    $scope.pinnedMedia.nodeValue = value;
                    $scope.pinnedMedia.nodeColorStr = color;
                    $scope.pinnedMedia.isMediaPinned = true;
                },
                unpinMedia: function () {
                    $scope.pinnedMedia.isMediaPinned = false;
                    $scope.pinnedMedia.nodeValue = null;
                    $scope.pinnedMedia.nodeColorStr = null;
                }
            };

            $scope.extUserInfo = {};
            $scope.hasModal = false;

            $scope.snapInfo = {
                oldSnapId: -1, //if image or embed, helps determine which way to animate
                curSnapId: 0,
                curSnapInd: 0,
                activeSnap: {},
                snapsLoaded: false
            };

            //toggle panels
            $scope.panelUI = {
                summaryPanelOpen: false,
                filterPanelOpen: false,
                showRightPanel: false,
                showInfoAttrs: false,
                showAllAttrs: false,
                infoPanelOpen: false,
                slidesPanelOpen: false,
                modalPanelOpen: false,
                persistFilterPanel: false,
                currentPanelOpen: 'modal',

                //hovers
                infoPanelHover: false,
                summaryPanelHover: false,
                filterPanelHover: false,
                openPanel: function (panel) {
                    this.showRightPanel = true;
                    this.currentPanelOpen = tabs[panel] || panel;
                    //hide all panels
                    this.closePanels();
                    $scope.$broadcast(BROADCAST_MESSAGES.tabs.changed, panel);

                    switch (panel) {
                        case 'summary':
                        case 'legend':
                            this.summaryPanelOpen = true;
                            break;
                        case 'filter':
                            this.filterPanelOpen = true;
                            // to trigger virtual scroll so graphs load
                            $scope.$broadcast(BROADCAST_MESSAGES.fp.filter.visibilityToggled);
                            break;
                        case 'info':
                        case 'list':
                            this.infoPanelOpen = true;
                            break;
                        case 'slides':
                            this.slidesPanelOpen = true;
                            break;
                        case 'modal':
                            this.modalPanelOpen = true;
                            break;
                        default:
                    }
                },
                closePanels: function () {
                    this.filterPanelOpen = false;
                    this.summaryPanelOpen = false;
                    this.infoPanelOpen = false;
                    this.hideInfoPanel = false;
                    this.slidesPanelOpen = false;
                    this.modalPanelOpen = false;
                },
                togglePanel: function (pan) {
                    var tempBool;
                    this.currentPanelOpen = pan;
                    switch (pan) {
                        case 'info':
                            tempBool = this.infoPanelOpen;
                            this.closePanels();
                            this.infoPanelOpen = !tempBool;
                            if (tempBool) {
                                this.openPanel('summary');
                            }
                            break;
                        case 'summary':
                            tempBool = this.summaryPanelOpen;
                            this.closePanels();
                            this.summaryPanelOpen = !tempBool;
                            if (tempBool) {
                                this.openPanel('selection');
                            }
                            break;
                        case 'filter':
                            tempBool = this.filterPanelOpen;
                            this.closePanels();
                            this.filterPanelOpen = !tempBool;
                            if (tempBool) {
                                this.openPanel('selection');
                            }
                            break;
                        case 'slides':
                            tempBool = this.slidesPanelOpen;
                            this.closePanels();
                            this.slidesPanelOpen = !tempBool;
                            if (tempBool) {
                                this.openPanel('slides');
                            }
                            break;
                        case 'modal':
                            tempBool = this.modalPanelOpen;
                            this.closePanels();
                            this.modalPanelOpen = !tempBool;
                            if (tempBool) {
                                this.openPanel('modal');
                            }
                            break;
                        default:

                    }

                }
            };


            /**
    * Scope methods
    */
            $scope.isTallImg = isTallImg; //determine if image is wide or tall (for correct css (can't do purely with css))
            $scope.requestFullScreen = requestFullScreen;
            $scope.triggerInteraction = triggerInteraction; //kill playing if any mouse interactions in player

            $scope.isLaterSnap = function () {
                // console.log('cur snap: '+_.findIndex($scope.player.snapshots, {id: $scope.snapInfo.activeSnap.id})+" oldsnap: "+_.findIndex($scope.player.snapshots, {id: $scope.snapInfo.oldSnapId}));
                return (_.findIndex($scope.player.snapshots, { id: $scope.snapInfo.curSnapId }) > _.findIndex($scope.player.snapshots, { id: $scope.snapInfo.oldSnapId })) ? true : false;
            };

            $scope.resetGridSelections = function () {
                $scope.$broadcast(BROADCAST_MESSAGES.grid.reset);
            };






            /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
            $scope.$on(BROADCAST_MESSAGES.extUserOverlay.create, onExtOverlayCreate);
            $rootScope.$on(BROADCAST_MESSAGES.sigma.rendered, onSigmaRender);

            $scope.$on(BROADCAST_MESSAGES.snapshot.loaded, function (e, data) {
                $scope.snapInfo.activeSnap = data.snapshot;
            });

            $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function (e, data) {
                var currSnap = snapshotService.getCurrentSnapshot();
                if (currSnap.layout.plotType == 'grid') {
                    $scope.appUi.showResetBtn = true;
                }
                else {
                    $scope.appUi.showResetBtn = false;
                }

                if (currSnap.layout.plotType == 'list') {
                    $scope.appUi.showListSortBtn = true;
                } else {
                    $scope.appUi.showListSortBtn = false;
                }
                //for sorting in list and (eventually) grid
                $scope.appUi.nodeAttrs = dataGraph.getNodeAttrs();

                $scope.panelUI.showRightPanel = true;
            });





            /*************************************
    ********* Initialise *****************
    **************************************/
            //check for old browser and throw warning
            if (browserDetectService.isOldBrowser()) {
                //display modal
                $uibModal.open({
                    templateUrl: '#{player_prefix_index}/player/oldBrowserModal.html',
                    size: 'lg'
                });
            }

            (async function () {
                await getPlayerData();

                const dataset = await loadPlayerData.promise;

                $scope.player.snapshots = _.filter($scope.player.snapshots, function (snap) {
                    return snap.isEnabled === false ? false : true;
                });
                if (!$scope.player.snapshots || (angular.isArray($scope.player.snapshots) && $scope.player.snapshots.length < 1)) {
                    throw new Error('No enabled snapshots');
                }

                // Set project settings in projFactory
                projFactory.setProjSettingsForPlayer($scope.player.projSettings || {});

                //MODAL
                $scope.hasModal = true;
                $scope.panelUI.openPanel($scope.player.player.settings.startPage || 'modal');

                //COLORTHEME
                $scope.colorTheme = 'light';
                loadSuccess(dataset);

                $scope.$broadcast(BROADCAST_MESSAGES.player.load);

                if ($scope.player.isEditable === true) {
                    var x = $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function () {
                        openNodeOverlayForUser();
                        x();
                    });

                    listenForDsOrNwChange();
                }

                console.groupEnd();

                getMetaData();
            })();

            function getMetaData() {
                const { projectLogoTitle, projectLogoImageUrl } = $scope.player.player.settings;
                const title = document.querySelector('title');

                if (projectLogoTitle && title) {
                    title.innerHTML = projectLogoTitle;
                }
            }

            /*************************************
    ********* Core Functions *************
    **************************************/

            function onExtOverlayCreate(e, data) {
                if (!data) {
                    return;
                }
                console.debug('query data: ', data);
                $scope.extUserInfo = _.pick(data, ['userName', 'userPicUrl', 'nodeIdsToSelect', 'clusterVal', 'userDistrVals', 'showExtUserOverlay']);
                if (data.hasUserInfo) {
                    $scope.appUi.hasExtUser = true;
                }
            }

            function openNodeOverlayForUser() {
                var surveyPlayerEmailsMap = $cookies.getObject('surveyPlayerEmailsMap') || {};
                var surveyUser = surveyPlayerEmailsMap[$scope.player._id];
                var userEmailP = $q.when(null);

                if (surveyUser) {
                    userEmailP = $q.when(surveyUser);
                }
                else {
                    userEmailP = $q(function (resolve, reject) {
                        var modalInstance = $uibModal.open({
                            templateUrl: '#{player_prefix_index}/player/auth/userEmailAuthModal.html',
                            controller: 'UserEmailAuthCtrl',
                            scope: $scope
                        });

                        //Called when modal is closed
                        modalInstance.result
                            .then(function (data) {
                                console.log('User entered email: ', data);
                                surveyPlayerEmailsMap[$scope.player._id] = data;
                                $cookies.putObject('surveyPlayerEmailsMap', surveyPlayerEmailsMap);
                                resolve(data);
                            })
                            .catch(function (err) {
                                console.error('User did not enter email: ', err);
                                reject(err);
                            });
                    });
                }

                userEmailP
                    .then(function (emailId) {
                        var graphNodes = renderGraphfactory.sig().graph.nodes();
                        console.log(logPrefix, "user email: ", emailId);
                        var nodeWithEmail = _.find(graphNodes, 'attr.Username', emailId);
                        if (!nodeWithEmail) { throw new Error("Node not found for Survey User By Email: " + emailId); }
                        graphSelectionService.selectByIds([nodeWithEmail.id], 0);
                    });
            }

            function listenForDsOrNwChange() {
                if (!$scope.player) { throw new Error("Setting up listener before player load"); }
                var playerChannel = setupWebsocket(_.get($scope.player, 'project.ref'));
                playerChannel.on('updated', function (data) {
                    console.log(logPrefix, "dataset/networks updated for player");
                    updateOnDsOrNwChange();
                });
            }

            function updateOnDsOrNwChange() {
                var sendAccessToken = $scope.playerInfo && $scope.playerInfo.directAccess;
                var reqUrl = sendAccessToken ? $scope.playerUrlStr + '?access_token=' + access_token : $scope.playerUrlStr;

                playerFactory.getPlayerDocLocally(reqUrl)
                    .then(function (playerDoc) {
                        console.log('[' + (Date.now() - timeStart) + '] [ctrlPlayer] player load %O', playerDoc);
                        _.assign($scope.player, _.pick(playerDoc, ['snapshots', 'networks']));

                        return $q.all([
                            dataService.fetchProjectDatasetLocally(playerDoc.org.ref, playerDoc.project.ref),
                            networkService.fetchProjectNetworksLocally(playerDoc.org.ref, playerDoc.project.ref)
                        ]);
                    }).then(function (datasetAndNetworks) {
                        $scope.dataset = datasetAndNetworks[0];
                        $scope.$broadcast(BROADCAST_MESSAGES.player.load);
                    })
                    .catch(function (err) {
                        $rootScope.$broadcast(BROADCAST_MESSAGES.player.loadFailure);
                        console.error("Error in fetching Player: ", err);
                    });
            }

            function onSigmaRender() {
                console.log('sigma render called');
                var currSnap = snapshotService.getCurrentSnapshot();
                if (currSnap.layout.plotType == 'grid') {
                    $scope.appUi.showGridResetBtn = true;
                }
                else {
                    $scope.appUi.showGridResetBtn = false;
                }

                $scope.panelUI.showRightPanel = true;

                if ($scope.extUserInfo && $scope.extUserInfo.showExtUserOverlay === false) {
                    $scope.$broadcast(BROADCAST_MESSAGES.extUserOverlay.minimized);
                    console.log('broadcasting ext user overlay minimized');
                }
            }

            function getPlayerData() {
                return fetchPlayer(false);
            }

            function fetchPlayer(sendAccessToken) {
                $rootScope.$broadcast(BROADCAST_MESSAGES.player.loadStart);
                return playerFactory.getPlayerLocally()
                    .then(function (playerDoc) {
                        console.log('[' + (Date.now() - timeStart) + '] [ctrlPlayer] player load %O', playerDoc);
                        $scope.player = playerDoc;

                        const authFlag = authService.isAuthenticated();
                        if (playerDoc.player.settings.passwordHash && !authFlag) {
                            return $q.reject('Authentication required');
                        }

                        return $q.all([
                            dataService.fetchProjectDatasetLocally(),
                            networkService.fetchProjectNetworksLocally()
                        ]);
                    }).then(function ([dataset, network]) {
                        const nw = {
                            id: 'default',
                            nodes: [...dataset.datapoints],
                            links: [],
                            nodeAttrDescriptors: getDefaultNodeAttrs('Name'),
                            linkAttrDescriptors: [],
                            ...(network && network.length ? network[0] : {}),
                        }
                        networkService.updateNetworks([nw]);
                        networkService.setCurrentNetwork(nw.id)
                        loadPlayerData.resolve(dataset);
                    })
                    .catch(function (err) {
                        $rootScope.$broadcast(BROADCAST_MESSAGES.player.loadFailure);
                        console.error("Error in fetching Player: ", err);
                    });
            }
            function loadSuccess(dataSet) {
                $scope.dataSet = dataSet;
                console.log('[playerCtrl.loadSuccess]LoadingData: %O', dataSet);
                console.debug('snapshots: ', $scope.player.snapshots);

                //preloadImages if any
                var images = _.filter($scope.player.snapshots, { type: "image" }).map(function (s) {
                    return s.picture;
                });
                preloadImages(images);

                //use to trigger any initial animations
                $scope.snapInfo.snapsLoaded = true;

                //start tween
            }

            //maybe setup a service for this
            function preloadImages(array) {
                if (!preloadImages.list) {
                    preloadImages.list = [];
                }
                var list = preloadImages.list;
                for (var i = 0; i < array.length; i++) {
                    var img = new Image();
                    img.onload = function () {
                        var index = list.indexOf(this);
                        if (index !== -1) {
                            // remove image from the array once it's loaded
                            // for memory consumption reasons
                            list.splice(index, 1);
                        }
                    };
                    list.push(img);
                    img.src = array[i];
                }
            }

            // function loadFailure(reason) {
            //     console.warn('[playerCtrl.loadFailure] Loading failed! %O', reason);
            //     //show 404 modal here
            // }

            function isTallImg() {
                var img = $('#image-layout img')[0];
                if (img.naturalWidth / img.naturalHeight < $(window).width() / $(window).height()) {
                    return true;
                }
                return false;
            }

            function requestFullScreen() {
                var element = document.body; // Make the body go full screen.
                // Supports most browsers and their versions.
                var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullscreen;

                if (requestMethod) { // Native full screen.
                    requestMethod.call(element);
                } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
                    var wscript = new ActiveXObject("WScript.Shell");
                    if (wscript !== null) {
                        wscript.SendKeys("{F11}");
                    }
                }
            }

            function triggerInteraction() {
                $rootScope.$broadcast(BROADCAST_MESSAGES.player.interacted);
            }

            function setupWebsocket(projectId, onConnectFn) {
                // var playerChannel = window.io.connect(window.location.origin + "/player_tracker");
                // playerChannel.emit('subscibe_project_updates', {
                //     projectId : projectId
                // });
                // // wait for subscription before firing off engine
                // playerChannel.on('subscibed_project_updates', function(data) {
                //     console.log("[PlayerService.setupWebsocket] subscibed_project_updates data: ", data);
                //     if(onConnectFn) {
                //         onConnectFn(playerChannel);
                //     }
                // });
                // return playerChannel;
            }


        }
    ]);

window.__components = [];
window.__allComponentsLoaded = false;
const onComponentsLoaded = new Event('componentsLoaded');

const loadScript = function (scriptSrc, alias, options) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.crossOrigin = options ? options.crossOrigin : '';
        script.type = options ? options.type : 'module'
        script.src = scriptSrc;

        script.onload = () => {
            window.__components.push(alias);
            if (window.__components.length === 4) {
                window.__allComponentsLoaded = true;
                window.dispatchEvent(onComponentsLoaded);
            }
            resolve()
        };

        script.onerror = () => {
            console.error("Failed to load script:", script.src);
            reject()
        };

        document.body.appendChild(script);
    })

}

loadScript('https://unpkg.com/react@18/umd/react.production.min.js', 'react').then(() => {
    return loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', 'react-dom')
}).then(() => {
    return loadScript('https://cdn.jsdelivr.net/npm/csv-stringify@6.5.2/dist/iife/sync.js', 'csvStringify', {
        crossOrigin: undefined,
        type: 'text/javascript'
    })
}).then(() => {
    const src = '#{player_prefix_index_source}' || window.origin;
    return loadScript(`${src}/libs/mappr-components.js`, 'components')
}).then(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js', 'crypto-js', {
    type: 'text/javascript'
}));

window.waitUntilLoaded = () => {
    if (window.__allComponentsLoaded) return Promise.resolve();

    return new Promise((resolve) => {
        window.addEventListener('componentsLoaded', () => {
            return resolve()
        }, {
            once: true
        });
    })
}