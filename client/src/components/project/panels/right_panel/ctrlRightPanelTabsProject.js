angular.module('common')
    .controller('RightPanelTabsProjectCtrl', [
        '$scope',
        '$http',
        '$rootScope',
        'graphSelectionService',
        'BROADCAST_MESSAGES',
        'dataGraph',
        '$uibModal',
        'ngIntroService',
        '$timeout',
        'FilterPanelService',
        'selectService',
        'subsetService',
        function($scope, $http, $rootScope, graphSelectionService, BROADCAST_MESSAGES, dataGraph, $uibModal, ngIntroService, $timeout, FilterPanelService, selectService, subsetService) {
            'use strict';

            /*************************************
             ************ Local Data **************
             **************************************/
            // var logPrefix = '[ctrlRightPanelTabs: ] ';

            /*************************************
             ********* Scope Bindings *************
             **************************************/
            /**
             *  Scope data
             */

            $scope.expandedState = {
                isSet: false,
                isExpanded: false
            };
            $scope.togglePanel = function () {
                if ($scope.expandedState.isSet) {
                    if ($scope.expandedState.isExpanded) {
                        document.body.classList.remove('side-menu-compressed');
                    } else {
                        document.body.classList.add('side-menu-compressed');
                    }
                }
                $scope.expandedState.isSet = true;
                $scope.expandedState.isExpanded = document.body.classList.contains('side-menu-compressed');
            }

            $scope.expandPanel = function () {
                if (!$scope.expandedState.isSet) {
                    document.body.classList.remove('side-menu-compressed');
                }
            }

            $scope.collapsePanel = function () {
                if (!$scope.expandedState.isSet) {
                    document.body.classList.add('side-menu-compressed');
                }
            }

            $scope.collapsePanel = function () {
                if (!$scope.expandedState.isSet) {
                    document.body.classList.add('side-menu-compressed');
                }
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

            $scope.rightPanelTabs = [
            //   {
            //     iconClass: 'fa-info-circle',
            //     title: 'Info',
            //     panel: 'summary',
            //     cmd: function() {
            //
            //     }
            // },
                {
                    iconClass: 'filter',
                    title: 'Filters',
                    tooltipTitle: 'Filter data by one or more attributes',
                    panel: 'filter',
                    cmd: function() {
                        $scope.panelUI.openPanel('filter');



                        let nodeID = graphSelectionService.selectedNodeIds()[0];
                        console.log({NodeRightPanelCtrl: dataGraph.getNodeById(nodeID)});
                        console.log({NodeRightPanelCtrl : 
                            $scope.nodeInfoAttrs
                           });
                        

                        
                        $timeout(function () {
                            ngIntroService.setOptions(FilterPanelService.getFilterIntroOptions());
                            //ngIntroService.start();
                        }, 100);
                    }
                },
                {
                    iconClass: 'legend',
                    title: 'Legend',
                    tooltipTitle: 'See color and sizing information',
                    panel: 'summary',
                    cmd: function() {
                        $scope.panelUI.openPanel('summary');
                    }
                },
                {
                    iconClass: 'list',
                    title: 'List',
                    showSelCount: true,
                    tooltipTitle: 'See the list view of selected nodes - or all nodes if none are selected',
                    panel: 'info',
                    cmd: function() {
                        $scope.panelUI.openPanel('info');
                    }
                },
                {
                    iconClass: 'player',
                    title: 'Player',
                    panel: 'player',
                    tooltipTitle: 'Publish shareable map and add project information',
                    cmd: function() {
                        $scope.panelUI.openPanel('player');
                    }
                },
                {
                    iconClass: 'groups',
                    title: 'Groups',
                    tooltipTitle: 'Save customer selections',
                    panel: 'selection',
                    cmd: function() {
                        $scope.panelUI.openPanel('selection');
                    }
                },
                {
                    iconClass: 'style',
                    title: 'Style',
                    panel: 'style',
                    tooltipTitle: 'Edit styling for nodes, links, and labels',
                    cmd: function() {
                        $scope.panelUI.openPanel('style');
                    }
                },

            ];

            /**
             * Scope methods
             */

            /*************************************
             ****** Event Listeners/Watches *******
             **************************************/

            $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, function() {
                updateSelCount();
            });

            $scope.$on(BROADCAST_MESSAGES.selectNodes, function() {
                updateSelCount();
            });

            $scope.$on(BROADCAST_MESSAGES.selectStage, function() {
                updateSelCount();
            });
            
            $rootScope.$on(BROADCAST_MESSAGES.cleanStage, function() {                
                updateSelCount();
            });

            $scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function() {
                updateSelCount();
            });

            $rootScope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
                updateSelCount();
            });

            $rootScope.$on(BROADCAST_MESSAGES.hss.select, function(ev, data) {
                if (data.selectionCount == 0 && data.isSubsetted) {
                    $scope.selNodesCount = subsetService.currentSubset().length;
                } else {
                    $scope.selNodesCount = data.selectionCount;
                }
            });

            /*************************************
             ********* Initialise *****************
             **************************************/

            /*************************************
             ********* Core Functions *************
             **************************************/

            function updateSelCount() {
                $scope.selNodesCount = selectService.selectedNodes.length || subsetService.currentSubset().length;
            }


        }
    ]);
