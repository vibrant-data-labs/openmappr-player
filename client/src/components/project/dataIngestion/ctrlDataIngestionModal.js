angular.module('dataIngestion')
.controller('DataIngestionModalCtrl', ['$scope', '$rootScope', '$q', '$uibModalInstance', '$interval', '$timeout', '$uibModal', '$location', 'orgFactory', 'projFactory', 'uiService', 'editMode', 'diMode', 'BROADCAST_MESSAGES',
function($scope, $rootScope, $q, $uibModalInstance, $interval, $timeout, $uibModal, $location, orgFactory, projFactory, uiService, editMode, diMode, BROADCAST_MESSAGES){
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlDataIngestionModal: ] ';


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.diProgress = {
        progressVal: 0,
        message: ''
    };

    $scope.diModalData = {
        subviewTitle: null,
        subview: null, //By default, open excel view
        editMode: editMode || false,
        diMode: diMode || false,
        summaryOpen: false,
        dataAvailable: false,
        currSrcType: null,
        tabsInfo: {
            hasNodes: false,
            hasLinks: false,
            hasClusters: false,
            nodesLength: null,
            linksLength: null,
            clustersLength: null
        },
        tabsStatus: {
            nodes: true,
            links: false,
            clusters: false
        },
        openTab: function(tab) {
            this.tabsStatus.nodes = false;
            this.tabsStatus.links = false;
            this.tabsStatus.clusters = false;
            this.tabsStatus[tab] = true;
        },

        //Called when a tab is clicked
        activateTab : function(src, srcType) {
            if($scope.currDataSrc && $scope.currDataSrc.title && ($scope.currDataSrc.title == src.title)) {
                console.warn(logPrefix + src.title + ' tab is already active.');
                return;
            }
            this.subviewTitle = src.title;
            this.subview = src.title.replace(/[^A-Z0-9]/ig, "").toLowerCase();
            $scope.diModalData.currSrcType = srcType;
            console.debug('src: '+src.title+" : "+this.subview);
            $scope.currDataSrc = src;
            $scope.mapProcessor.clearError();
            $scope.progressHandler.__clear();
        },

        reset: function() {
            this.dataAvailable = false;
            this.openTab('fileupload');
        }
    };

    $scope.dataSources = [
        {
            text : 'import from external source',
            type : 'import',
            sources : [
                {
                    title: 'File',
                    tooltip: 'Click to start',
                    icon: 'fa fa-fw fa-file',
                    btnCreateText: 'Import',
                    btnEditText: 'Merge'
                },
                {
                    title: 'URL',
                    tooltip: 'Click to start',
                    icon: 'fa fa-fw fa-upload',
                    btnCreateText: 'Import',
                    btnEditText: 'Merge'
                }
                // {
                //  title: 'Google SpreadSheet',
                //  tooltip: 'Click to start',
                //  icon: 'fa fa-fw fa-google',
                //  btnCreateText: 'Import',
                //  btnEditText: 'Merge'
                // },
                // {
                //  title: 'LinkedIn',
                //  tooltip: 'Click to start',
                //  icon: 'fa fa-fw fa-linkedin',
                //  btnCreateText: 'Import',
                //  btnEditText: 'Merge'
                // },
                //  {
                //  title: 'Import.io',
                //  tooltip: 'Click to start',
                //  icon: 'fa fa-fw fa-ellipsis-h',
                //  btnCreateText: 'Import',
                //  btnEditText: 'Merge'
                // },
            ]
        }
    ];

    /**
    * Scope methods
    */
    $scope.backToProjects = backToProjects;
    $scope.closeModal = closeModal;

    //Provides methods to display progress
    $scope.progressHandler = (function() {
        var processes = {};
        var intervalPromise;

        return {

            addProcesses: function(pieces) {
                this.__clear();

                angular.forEach(pieces, function(process) {
                    processes[process.processType] = process;
                    processes[process.processType]['processProgress'] = 0;
                    processes[process.processType]['complete'] = false;
                });
            },

            __clear: function() {
                processes = {};
                intervalPromise = '';
                console.log(logPrefix + 'clearing processes from progress handler');
            },

            finishProcess: function(processType) {
                this.updateProgress(processType, 100);
            },

            finishAllProcesses: function() {
                var self = this;
                var unfinishedProcesses = _.filter(processes, function(process) {
                    return process.processProgress < 100;
                });
                _.each(unfinishedProcesses, function(process) {
                    self.updateProgress(process.processType, 100);
                });
            },

            resetAllProcesses: function() {
                _.each(processes, function(process) {
                    process.processProgress = 0;
                    process.complete = false;
                });
            },

            updateProgress: function(processType, progress, subMsg) {
                var currProcess = processes[processType];
                subMsg = subMsg || '';
                if(currProcess.complete) {
                    console.warn(processType + ' process is already complete.');
                    return;
                }

                currProcess.processProgress = progress;

                if(progress >= 100) {
                    currProcess.complete = true;
                    currProcess.processProgress = 100;
                    intervalPromise && $interval.cancel(intervalPromise);
                    intervalPromise = '';
                }

                uiService.showProgress(processType, currProcess.message + subMsg, 'success', currProcess.processProgress);
            },

            /**
             * Shows dummy progress
             * @param {string} processType - Refers to individual progress process
             * @param {Object} progConfig - Dummy progress configuration object
                 * @param {number} progConfig.threshold - Don't increment progress after this val has reached
                 * @param {number} progConfig.progIncrVal - Progress increment value
             * @param {number} progConfig.interval - Time interval for updating progress
             */
            showDummyProgress: function(processType, threshold) {
                var _this = this;
                threshold = threshold || 95;

                intervalPromise = $interval(function() {
                    var currProgress = processes[processType].processProgress;
                    var incr = 0;

                    if(currProgress >=0 && currProgress < 25) {
                        incr = Math.random() * 3 + 3;
                    }
                    else if(currProgress >= 25 && currProgress < 65) {
                        incr = Math.random() * 3;
                    }
                    else if(currProgress >=65 && currProgress < threshold) {
                        incr = 0.5;
                    }
                    else if(currProgress >= threshold) {
                        $interval.cancel(intervalPromise);
                    }
                    _this.updateProgress(processType, currProgress + incr);
                }, 500);
            }
        };
    }());

    //Provides methods related to modal's main button a.k.a Create Map
    $scope.mapProcessor = {
        mainBtnText: 'next',
        disableBtn: true,
        status: {
            failure: false,
            dataSourceSelected: false,
            errorType: '',
            errorMsg: ''
        },
        persistingMessages: [],

        //Empty promiseable function. If overwritten by child controllers, must return a promise
        childProcess: function() {
            var defer = $q.defer();

            $timeout(function() { defer.resolve(); }, 0);
            return defer.promise;
        },

        emptyRejectFunc: function() { return $q.reject(); },

        stopProcess: function() { return $q.reject(); },

        enableMainBtn: function() {
            this.disableBtn = false;
        },

        disableMainBtn: function() {
            this.disableBtn = true;
        },

        showError: function(errorType ,errorMsg, persist) {
            // this.status.failure = true;
            // this.status.errorType = errorType;
            // this.status.errorMsg = errorMsg;
            this.persistingMessages.push(uiService.log(errorType, persist));
        },

        clearPersistingMessages: function() {
            _.each(this.persistingMessages, function(msgHandler) {
                if(_.isFunction(msgHandler.close)) {
                    msgHandler.close();
                }
                else {
                    console.warn('Ui message has no method close');
                }
            });
        },

        clearError: function() {
            this.status.failure = false;
            this.status.errorType = '';
            this.status.errorMsg = '';
        },

        createMap: function() {
            this.childProcess()
            .then(
                function(data) {
                    console.log('[DIModal.createMap]',data);
                    if($scope.diModalData.diMode) {
                        $scope.progressHandler.finishAllProcesses();
                        $scope.diProgress.message = 'Successful';
                        $rootScope.$broadcast(BROADCAST_MESSAGES.di.dataEnhanced);
                        $uibModalInstance.close({});
                    }
                    else {
                        $scope.progressHandler.finishAllProcesses();
                        $scope.diProgress.message = 'Successful';
                        if($scope.diModalData.editMode && $scope.diModalData.currSrcType == 'import') {
                            $rootScope.$broadcast(BROADCAST_MESSAGES.dataMerged);
                        }
                        var modalState = $scope.diModalData.editMode ? 'diMerge' : 'diCreate';
                        $uibModalInstance.close({
                            refID : data,
                            netgenModalState: modalState,
                            hasNetworks: $scope.diModalData.tabsInfo.hasLinks
                        });
                    }
                },
                function(error) {
                    switch(error) {
                    case 'mergeConflicts':
                        // Nada!
                        break;
                    default:
                        // _this.showError('Please try again!');
                    }
                }
            );

        }
    };

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    if(!$scope.diModalData.editMode) {
        $scope.dataSources[0].sources.push(
            {
                title: 'News API',
                tooltip: 'Run Query',
                icon: 'fa fa-fw fa-newspaper-o',
                btnCreateText: 'Run Query',
                btnEditText: 'Merge'
            }
            // ,
            // {
            //     title: 'Company API',
            //     tooltip: 'Run Company API Query',
            //     icon: 'fa fa-fw fa-building',
            //     btnCreateText: 'Run Query',
            //     btnEditText: 'Run Query'
            // }
        );
    }

    if($scope.diModalData.editMode) {
        // Has data
        $scope.dataSources.push({
            text : 'derive from existing data',
            type : 'derive',
            sources : [
                {
                    title: 'Text Analysis', //Alchemy
                    tooltip: 'Enrich data',
                    icon: 'fa fa-fw fa-fire',
                    // btnCreateText: 'Import',
                    btnEditText: 'Run Analysis'
                },
                // {
                //  title: 'Script',
                //  tooltip: 'Generate attribute',
                //  icon: 'fa fa-fw fa-fire',
                //  // btnCreateText: 'Import',
                //  btnEditText: 'Run Script'
                // },
                {
                    title: 'Common Ops',
                    tooltip: 'Common Ops on data',
                    icon: 'fa fa-code',
                    // btnCreateText: 'Import',
                    btnEditText: 'Run Op'
                }
            ]
        });
    }

    //Get Project Info
    orgFactory.currOrg()
    .then(function(orgDoc){
        $scope.currOrg = orgDoc;
        return projFactory.currProject();
    })
    .then(function(projDoc){
        $scope.currProject = projDoc;
    });

    if($scope.diModalData.diMode && $scope.diModalData.editMode) {
        $scope.diModalData.activateTab(_.find($scope.dataSources[1].sources, 'title', 'Text Analysis'), 'derive');
    }
    else {
        $scope.diModalData.activateTab($scope.dataSources[0].sources[0], 'import');
    }

    /*************************************
    ********* Core Functions *************
    **************************************/

    function backToProjects() {
        $scope.closeModal(true);
        $timeout(function() {
            $location.path('/user-projects');
        });
    }

    function closeModal(forceClose) {
        $scope.mapProcessor.stopProcess()
        .then(function() {
        }, function() {
            // No process stopped, close or reset modal
            if(!editMode && !forceClose) {
                $scope.diModalData.reset();
            }
            else {
                if($scope.diModalData.dataAvailable) $scope.diModalData.reset();
                else $uibModalInstance.dismiss('cancel');
            }
        });
    }

}
]);