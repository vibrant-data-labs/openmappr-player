angular.module('common')
    .controller('RightPanelTabsPlayerCtrl', ['$rootScope', '$scope', 'renderGraphfactory', '$http', 'graphSelectionService', 'BROADCAST_MESSAGES', 'ngIntroService', 'FilterPanelService',
        '$timeout', '$window', 'selectService', 'subsetService', 'playerFactory', 'dataGraph', 'AttrInfoService',
        function ($rootScope, $scope, renderGraphfactory, $http, graphSelectionService, BROADCAST_MESSAGES, ngIntroService, FilterPanelService, $timeout, $window, selectService, subsetService, playerFactory, dataGraph, AttrInfoService) {
            'use strict';

            /*************************************
             ************ Local Data **************
             **************************************/
            const TransitionHandler = function () {

                // object:
                // 
                // {  
                //  [from: number]: {
                //      [to: number]: Function
                //  }
                // }
                const transitions = {};

                // object:
                // 
                // {
                //  [step: number]: Function
                // }
                const callbacks = {};
                let previousStep = -1;

                const getTransition = (idx) => {
                    if (!transitions[idx]) {
                        transitions[idx] = {};
                    }

                    return transitions[idx];
                }

                const runHandler = (handler) => {
                    if (typeof handler === 'function') {
                        handler();
                    }
                }

                const runDependencies = (stepNums) => {
                    stepNums.forEach((val, idx) => {
                        if (idx > 0) {
                            const prev = stepNums[idx - 1];
                            const transition = getTransition(prev);
                            runHandler(transition[val]);
                        }

                        runHandler(callbacks[val]);
                    });
                }

                const registerTransition = (from, to, handler, callbackDependencies) => {
                    const sourceTransition = getTransition(from);

                    if (callbackDependencies) {
                        sourceTransition[to] = () => {
                            runDependencies(callbackDependencies);
                            handler();
                        }
                    } else {
                        sourceTransition[to] = () => handler();
                    }
                }

                const registerCallback = (step, handler, callbackDependencies) => {
                    if (callbackDependencies) {
                        callbacks[step] = () => {
                            runDependencies(callbackDependencies);
                            handler();
                        }
                    } else {
                        callbacks[step] = () => handler();
                    }
                }

                const processTransition = (currentStep) => {
                    const transition = getTransition(previousStep);

                    runHandler(transition[currentStep]);
                    runHandler(callbacks[currentStep]);

                    previousStep = currentStep;
                }


                return {
                    registerTransition,
                    registerCallback,
                    processTransition,
                }
            }

            /*************************************
             ********* Scope Bindings *************
             **************************************/
            /**
             *  LOAD CHANGE ngIntroService
             */

            /**
             *  Scope data
             */

            $scope.currentExport = 'all';
            $scope.showButtons = true;
            $scope.isShowTutorial = undefined;
            $scope.isGeoLayout = false;
            $scope.isGeoSelectorOpen = false;
            $scope.geoLevels = [
                { id: 'countries', title: 'Countries', description: 'Countries or territories' },
                { id: 'fed_districts', title: 'States', description: 'States, federal districts' },
                { id: 'adm_districts', title: 'Counties', description: 'Counties, cities' },
                { id: 'node', title: 'Nodes', description: 'Nodes only, without regions' }
            ];
            $rootScope.geo = {
                level: 'countries'
            }
            $scope.geoLevel = $scope.geoLevels.find(x => x.id == $rootScope.geo.level);

            var tutorialCountdownPromise = undefined;

            $scope.toggleGeoSelector = function () {
                $scope.isGeoSelectorOpen = !$scope.isGeoSelectorOpen;
            }

            $scope.getGeoLevelTitle = function () {
                return $scope.geoLevel.title;
            }

            $scope.selectGeoLevel = function ($ev, lvl) {
                $ev.stopPropagation();
                $scope.geoLevel = lvl;
                $scope.isGeoSelectorOpen = false;
                $rootScope.geo.level = lvl.id;
                $rootScope.$broadcast(BROADCAST_MESSAGES.geoSelector.changed, { levelId: lvl.id });

            }

            $scope.tutorialCountdown = function () {
                tutorialCountdownPromise = $timeout(function () {
                    $scope.isShowTutorial = false;
                    $rootScope.$broadcast(BROADCAST_MESSAGES.tutorial.completed);
                }, 15000)
            }

            $scope.closeTutorial = function () {
                $scope.isShowTutorial = false;
                $rootScope.$broadcast(BROADCAST_MESSAGES.tutorial.completed);
                if (tutorialCountdownPromise) {
                    $timeout.cancel(tutorialCountdownPromise);
                }
            }

            $scope.startTutorial = function () {
                $scope.isShowTutorial = false;
                $rootScope.$broadcast(BROADCAST_MESSAGES.tutorial.started);
                if (tutorialCountdownPromise) {
                    $timeout.cancel(tutorialCountdownPromise);
                }

                ngIntroService.setOptions(
                    {
                        tooltipClass: 'tutorial__tooltip',
                        skipLabel: 'Close',
                        steps: [
                            {
                                element: '.focus-rigth-panel',
                                intro: `
                                <p>Welcome! Map information is located in the right side panel, opened by clicking the info icon. <span class="tutorial__button tutorial__button--info"></span></p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--0'
                            },
                            {
                                element: '.focus-rigth-panel',
                                intro: `
                                <p>If a node is selected, the panel will display node-specific information. Close the panel by clicking the drawer icon at the top. <span class="tutorial__button tutorial__button--drawer-close"></span></p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--1'
                            },
                            {
                                element: '#right-panel',
                                intro: `
                                <p>The left side panel displays the Summary, Legend, and List tabs.</p>
                                <p>The Legend explains what the nodes are clustered by, colored by, and sized by.</p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--2'
                            },
                            {
                                element: '#right-panel',
                                intro: `
                                The Summary tab displays data elements grouped by category and enables data filtering and exploration. The elements within each category reflect the make-up of your current data selection that appears in the visualization, thereby providing a high-level 'summary' of the content.
                                `,
                                tooltipClass: 'tutorial__tooltip step--3'
                            },
                            {
                                element: '.play-toolbar__buttons',
                                intro: `
                                <p>Selecting a data element will highlight your selection in the data visualization. A 'Filters Applied' window appears to itemize the elements you've selected and the number of nodes in your current selection and to provide the option to 'Summarize Selection.'</p>
                                <p>Selecting multiple elements within the same category will act as an OR operator, while selecting elements across different categories will act as an AND operator.</p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--4'
                            },
                            {
                                element: '.play-toolbar__buttons',
                                intro: `
                                <p>Clicking 'Summarize Selection' filters the data down to the subset of nodes that match your selected attributes, and the data elements within each category in the Summary panel will update to reflect the content of your current data subset.</p>
                                <p>You can select additional data elements and click 'Summarize Selection' to filter your subset further and continue exploring.</p>
                                <p>Clicking Undo will remove your most recent selection and clicking 'Clear All' will reset the Summary panel and the visualization to display all data.</p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--5'
                            },
                            {
                                element: '#right-panel',
                                intro: `
                                <p>The List tab displays the list of entities in your current selection. Clicking on one will open the information panel to display node-specific details.</p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--6'
                            },
                            {
                                element: '.details-panel__snapshots',
                                intro: `
                                <p>The Snapshot Selector provides a list of data visualizations with preset configurations. A description of each one is displayed below the Snapshot Title.</p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--7'
                            },
                            {
                                element: '.details-panel__controls',
                                intro: `
                                <p>You can Search the text fields of the dataset via the search bar at the top.</p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--8'
                            },
                            {
                                element: '.button-zoom',
                                intro: `
                                    <p>
                                        You can Zoom In/Out with your mouse or via the + and - toggles.
                                    </p>
                                    <p>
                                        Thanks for taking this Tutorial! If you have any questions, comments, or suggestions, 
                                        <a href="https://airtable.com/shruDh1SDKndgTl51" target="_blank">
                                        contact us
                                        </a>!
                                    </p>
                                `,
                                tooltipClass: 'tutorial__tooltip step--9'
                            }
                        ]
                    }
                );

                const transitionHandler = TransitionHandler();
                transitionHandler.registerCallback(0, () => {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.ip.changed, true);
                    $timeout(function () {
                        $('.focus-rigth-panel').addClass('active');
                        $('body').addClass('node-right-panel_opened');
                    }, 50);
                })

                transitionHandler.registerTransition(1, 0, () => {
                    if (selectService.singleNode) {
                        selectService.unselect();
                    }
                });

                transitionHandler.registerCallback(1, () => {
                    const nodes = dataGraph.getAllNodes();
                    if (nodes && nodes.length) {
                        selectService.selectSingleNode(nodes[0].id)
                    }
                });

                transitionHandler.registerTransition(1, 2, () => {
                    selectService.unselect();
                });

                transitionHandler.registerCallback(2, () => {
                    $timeout(() => {
                        $scope.panelUI.openPanel('summary');
                    }, 50);
                });

                transitionHandler.registerCallback(3, () => {
                    $timeout(() => {
                        $scope.panelUI.openPanel('filter');
                    }, 50);
                });

                transitionHandler.registerCallback(4, () => {
                    const rawData = dataGraph.getRawDataUnsafe();
                    const cloudAttrs = [
                        'tag-cloud',
                        'tag-cloud_2',
                        'tag_cloud_2',
                        'tag-cloud_3',
                        'tag_cloud_3',
                        'wide-tag-cloud',
                        'wide-tag_cloud'
                    ]

                    const attr = rawData.nodeAttrs.find(x => cloudAttrs.includes(x.renderType) && x.visible);
                    if (attr) {
                        const attrData = AttrInfoService.getNodeAttrInfoForRG().getForId(attr.id);
                        const val = _.sortByOrder(Object.keys(attrData.valuesCount), [(item) => attrData.valuesCount[item]], ['desc'])[0]
                        selectService.selectNodes({ attr: attr.id, value: val });
                    }
                });

                transitionHandler.registerTransition(4, 3, () => {
                    selectService.unselect();
                });

                transitionHandler.registerTransition(4, 5, () => {
                    subsetService.subset();
                });

                transitionHandler.registerTransition(5, 4, () => {
                    subsetService.unsubset();
                    $scope.resetOperation();
                });

                transitionHandler.registerCallback(6, () => {
                    $timeout(() => {
                        $scope.panelUI.openPanel('list');
                    }, 50);
                });

                transitionHandler.registerTransition(6, 7, () => {
                    subsetService.unsubset();
                    $scope.resetOperation();
                });

                transitionHandler.registerTransition(7, 6, () => {
                    if ($scope.isSnapshotSelectorOpen) {
                        $scope.toggleSnapshotSelector();
                    }
                }, [4, 5]);

                transitionHandler.registerCallback(7, () => {
                    if (!$scope.isSnapshotSelectorOpen) {
                        $scope.toggleSnapshotSelector();
                    };
                });

                transitionHandler.registerTransition(7, 8, () => {
                    if ($scope.isSnapshotSelectorOpen) {
                        $scope.toggleSnapshotSelector();
                    }
                });

                transitionHandler.registerCallback(8, () => {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.searchRequest.init, { text: 'oceans' });

                    $timeout(function () {
                        $('.introjs-helperLayer')
                            .css('left', $('.details-panel__controls').offset().left)
                            .css('width', $('.details-panel__controls').width());
                    }, 100);
                });

                transitionHandler.registerTransition(8, 7, () => {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.searchRequest.init, undefined);
                });

                transitionHandler.registerTransition(8, 9, () => {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.searchRequest.init, undefined);
                });

                ngIntroService.intro.onchange(function () {
                    const currentStep = ngIntroService.intro._currentStep;
                    transitionHandler.processTransition(currentStep);
                });

                ngIntroService.intro.oncomplete(function () {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.tutorial.completed);
                    $timeout(() => {
                        $scope.panelUI.openPanel('summary');
                        selectService.unselect();
                    }, 50);
                });

                ngIntroService.intro.onexit(function () {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.tutorial.completed);
                });

                ngIntroService.start();
            };

            $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, function (ev, d) {
                if (d.rawData.nodes.every(node => !('geodata' in node))) {
                    $rootScope.geo = {
                        level: 'node'
                    }
                    $scope.geoLevel = $scope.geoLevels.find(x => x.id == $rootScope.geo.level);
                }
            });

            $scope.$on(BROADCAST_MESSAGES.snapshot.loaded, function (ev, data) {
                $scope.isGeoLayout = data.snapshot.layout.plotType == 'geo';

                if ($scope.isShowTutorial === undefined) {
                    $scope.isShowTutorial = true;
                }
            });

            $scope.$on(BROADCAST_MESSAGES.snapshot.changed, function (ev, data) {
                $scope.isGeoLayout = data.snapshot.layout.plotType == 'geo';
            });

            $scope.exportCurrentImage = function () {
                var currentExport = $scope.currentExport;
                $rootScope.exportSelection(currentExport);
            }

            $scope.exportCurrentData = function () {
                $rootScope.exportData($scope.currentExport);
            }

            // send support email
            $scope.sendSupportEmail = function () {
                $http.post('/support', {
                    message: document.forms[0].elements[0].value
                })
                    .then(function (response) {
                        document.forms[0].elements[0].value = "";
                        document.getElementById("floatingForm").style.display = "none";
                    }).catch(function (err) {
                        console.log(err)
                    });
            }
            // toggle floating contact form
            $scope.toggleForm = function () {
                if (document.getElementById("floatingForm").style.display == "block") {
                    document.getElementById("floatingForm").style.display = "none";
                } else {
                    document.getElementById("floatingForm").style.display = "block";
                }
            }

            $scope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                $scope.showButtons = data.nodes.length != 1;
            });

            $scope.$on(BROADCAST_MESSAGES.tutorial.start, function () {
                $scope.startTutorial();
            });

            $scope.tabs = {
                summary: {
                    title: 'Summary',
                    panel: 'filter',
                    cmd: function () {
                        $scope.panelUI.openPanel('filter');
                    }
                },
                legend: {
                    title: 'Legend',
                    panel: 'summary',
                    tooltipTitle: 'See color and sizing information',
                    cmd: function () {
                        $scope.panelUI.openPanel('summary');
                    }
                },
                list: {
                    title: 'List',
                    showSelCount: true,
                    panel: 'info',
                    cmd: function () {
                        $scope.panelUI.openPanel('info');
                    }
                },
                // {
                //     iconClass: 'snapshots',
                //     title: 'Snapshots',
                //     panel: 'snapshots',
                //     tooltipTitle: 'See snapshot information and change views if there are more than one',
                //     cmd: function () {
                //         $scope.panelUI.openPanel('snapshots');
                //     }
                // },

            };

            playerFactory.getPlayerLocally().then(function (resp) {
                const { displayExportButton, feedback, beta } = resp.player.settings;
                $scope.displayExportButton = displayExportButton;
                $scope.feedbackLink = (feedback && feedback.link) || 'support@openmappr.org';
                $scope.feedbackText = (feedback && feedback.text) || 'Contact us';
                $scope.feedbackType = (feedback && feedback.type) || 'email';
                $scope.isShowBeta = beta;

                const tabs = resp.player.settings.tabs || Object.keys($scope.tabs);

                $scope.rightPanelTabs = tabs.map((el) => {
                    return $scope.tabs[el];
                })
            })

            /**
             * Scope methods
             */

            /*************************************
             ****** Event Listeners/Watches *******
             **************************************/

            $rootScope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                if (data.selectionCount == 0 && data.isSubsetted) {
                    $scope.currentExport = 'subset';
                    $scope.selNodesCount = subsetService.currentSubset().length;
                } else {
                    $scope.currentExport = data.filtersCount > 0 ? 'select' : 'all';
                    $scope.selNodesCount = data.selectionCount;
                }
            });

            /*************************************
             ********* Initialise *****************
             **************************************/

            /*************************************
             ********* Core Functions *************
             **************************************/

            // function updateSelCount() {                
            //     $scope.selNodesCount = selectService.selectedNodes.length;
            // }

        }
    ]);
