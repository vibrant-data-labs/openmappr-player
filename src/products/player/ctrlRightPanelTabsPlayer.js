angular.module('common')
    .controller('RightPanelTabsPlayerCtrl', ['$rootScope', '$scope', '$http', 'graphSelectionService', 'BROADCAST_MESSAGES', 'ngIntroService', 'FilterPanelService',
        '$timeout', '$window', 'selectService', 'subsetService', 'playerFactory',
        function ($rootScope, $scope, $http, graphSelectionService, BROADCAST_MESSAGES, ngIntroService, FilterPanelService, $timeout, $window, selectService, subsetService, playerFactory) {
            'use strict';

            /*************************************
             ************ Local Data **************
             **************************************/
            // var logPrefix = '[ctrlRightPanelTabs: ] ';

            /*************************************
             ********* Scope Bindings *************
             **************************************/
            /**
             *  LOAD CHANGE ngIntroService
             */

            ngIntroService.setOptions({ showProgress: true })

            ngIntroService.onBeforeChange(function (targetElement) {
                if (targetElement.id == '' && $scope.panelUI.currentPanelOpen == 'snapshots') {
                    var nodeID = graphSelectionService.dataGraph.getAllNodes()[0].id;
                    selectService.selectSingleNode(nodeID);
                    $scope.zoomInfo.zoomExtents();
                }
            });
            ngIntroService.onExit(function () {
                if ($scope.panelUI.currentPanelOpen == 'snapshots') {
                    selectService.unselect();
                    $scope.zoomInfo.zoomReset();
                }
                $window.localStorage[$scope.panelUI.currentPanelOpen] = true;
            });

            /**
             *  Scope data
             */

            $scope.currentExport = 'all';
            $scope.showButtons = true;
            
            $scope.exportCurrentImage = function() {
                var currentExport = $scope.currentExport;
                $rootScope.exportSelection(currentExport);
            }

            $scope.exportCurrentData = function() {
                $rootScope.exportData($scope.currentExport);
            }

            // send support email
            $scope.sendSupportEmail = function () {
                $http.post('/support', {
                    message: document.forms[0].elements[0].value
                })
                .then(function(response) {
                    document.forms[0].elements[0].value = "";
                    document.getElementById("floatingForm").style.display = "none";
                }).catch(function(err) {
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

            $scope.$on(BROADCAST_MESSAGES.hss.select, function(ev, data) {
                $scope.showButtons = data.nodes.length != 1;
            });

            $scope.tabs = {
                summary: {
                    title: 'Summary',
                    panel: 'filter',
                    cmd: function () {
                        $scope.panelUI.openPanel('filter');
                        if (!$window.localStorage.filter)
                            $timeout(function () {
                                ngIntroService.setOptions(FilterPanelService.getFilterIntroOptions());
                                //ngIntroService.start();
                            }, 100);
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
                list:{
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

            playerFactory.getPlayerLocally().then(function(resp) {
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

            // $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, function() {
            //     updateSelCount();
            // });

            // $scope.$on(BROADCAST_MESSAGES.selectNodes, function() {
            //     updateSelCount();
            // });

            // $scope.$on(BROADCAST_MESSAGES.selectStage, function() {
            //     updateSelCount();
            // });

            // $rootScope.$on(BROADCAST_MESSAGES.cleanStage, function() {                
            //     updateSelCount();
            // });

            // $scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function() {
            //     updateSelCount();
            // });

            // $rootScope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
            //     updateSelCount();
            // });

            $rootScope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                if (data.selectionCount == 0 && data.isSubsetted) {
                    $scope.currentExport = 'subset';
                    $scope.selNodesCount = subsetService.currentSubset().length;
                } else {
                    $scope.currentExport = data.filtersCount > 0 ? 'select': 'all';
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