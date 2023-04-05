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

            /**
             *  Scope data
             */

            $scope.currentExport = 'all';
            $scope.showButtons = true;
            $scope.isShowTutorial = undefined;
            $scope.closeTutorial = function () {
                $scope.isShowTutorial = false;
            }

            $scope.startTutorial = function () {
                $scope.isShowTutorial = false;

                ngIntroService.setOptions(
                    {
                        tooltipClass: 'tutorial__tooltip',
                        steps: [
                            {
                                element: '.project-info',
                                intro: `
                                <p>Welcome! Map information is located in the right side panel, opened by clicking the info icon.</p>
                                <p>If a node is selected, the panel will display node-specific information.</p>
                                <p>Close the panel by clicking the drawer icon.</p>
                                `
                            },
                            {
                                element: '#right-panel',
                                intro: `
                                <p>The left side panel displays the Summary, Legend, and List tabs.</p>
                                <p>The Legend explains what the nodes are clustered by, colored by, and sized by.</p>
                                `,
                            },
                            {
                                element: '#right-panel',
                                intro: `
                                The Summary tab displays data elements grouped by category and enables data filtering and exploration. The elements within each category reflect the make-up of your current data selection that appears in the visualization, thereby providing a high-level 'summary' of the content.
                                `
                            },
                            {
                                element: 'body',
                                intro: `
                                <p>Selecting a data element will highlight your selection in the data visualization. A 'Filters Applied' (Data Selected) window appears to itemize the elements you've selected and the number of nodes in your current selection and to provide the option to 'Summarize Selection.'</p>
                                <p>Selecting multiple elements within the same category will act as an OR operator, while selecting elements across different categories will act as an AND operator.</p>
                                `
                            },
                            {
                                element: 'body',
                                intro: `
                                <p>Clicking 'Summarize Selection' filters the data down to the subset of nodes that match your selected attributes, and the data elements within each category in the Summary panel will update to reflect the content of your current data subset.</p>
                                <p>You can select additional data elements and click 'Summarize Selection' to filter your subset further and continue exploring.</p>
                                <p>Clicking Undo will remove your most recent selection and clicking 'Clear All' will reset the Summary panel and the visualization to display all data.</p>
                                `
                            }
                        ]
                    }
                );
                ngIntroService.intro.onchange(function () {
                    $timeout(function() {
                        const currentStep = ngIntroService.intro._currentStep;
                        if (currentStep === 0) {
                            $scope.$broadcast(BROADCAST_MESSAGES.ip.changed, true);
                        }
                        if (currentStep === 1) {
                            $scope.panelUI.openPanel('summary');
                        }
                        if (currentStep === 2) {
                            $scope.panelUI.openPanel('filter');
                        }
                        if (currentStep === 3) {
                            selectService.selectNodes({ attr: "Keywords", value: "energy" });
                        }

                        if (currentStep === 4) {
                            subsetService.subset();
                        }
                    }, 0);
                });
                ngIntroService.start();
            };

            $scope.$on(BROADCAST_MESSAGES.snapshot.loaded, function (ev, isInfoPanel) {
                if ($scope.isShowTutorial === undefined) {
                    $scope.isShowTutorial = true;
                }
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
