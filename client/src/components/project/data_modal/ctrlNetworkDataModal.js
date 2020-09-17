angular.module('mappr')
    .controller('NetworkDataModalCtrl', ['$scope', '$uibModalInstance', '$timeout', '$rootScope',  'dataService', 'networkService', 'dataGraph', 'projFactory', 'BROADCAST_MESSAGES', 'snapshotService', 'mapprSettings', 'uiService',
        function($scope, $uibModalInstance, $timeout, $rootScope, dataService, networkService, dataGraph, projFactory, BROADCAST_MESSAGES, snapshotService, mapprSettings, uiService){
            'use strict';

            /*************************************
    ************ Local Data **************
    **************************************/
            var dataset  = dataService.currDataSetUnsafe();


            /*************************************
    ********* Scope Bindings *************
    **************************************/
            /**
    *  Scope data
    */
            $scope.currentNetwork = networkService.getCurrentNetwork();
            $scope.dpAttrs = dataset.attrDescriptors;
            $scope.datapoints = dataset.datapoints;
            $scope.nodeAttrs = $scope.currentNetwork.nodeAttrDescriptors;
            $scope.nodeAttrTypes = dataGraph.getNodeAttrTypes();
            $scope.linkAttrs = $scope.currentNetwork.linkAttrDescriptors;
            $scope.linkAttrTypes = dataGraph.getEdgeAttrTypes();
            $scope.nodes = $scope.currentNetwork.nodes;
            $scope.links = $scope.currentNetwork.links;

            $scope.dsAttrSortOptions = {
                update: function() {
                    $scope.$evalAsync(function() {
                        $scope.updateAttrs('sort', 'dsattr');
                    });
                }
            };

            $scope.nwNodeAttrSortOptions = {
                update: function() {
                    $scope.$evalAsync(function() {
                        $scope.updateAttrs('sort', 'nwnode');
                    });
                }
            };

            $scope.nwLinkAttrSortOptions = {
                update: function() {
                    $scope.$evalAsync(function() {
                        $scope.updateAttrs('sort', 'nwlink');
                    });
                }
            };

            $scope.dmUi = {
                startRender: false,

                dsAttrMods: [],
                nwNodeAttrMods: [],
                nwLinkAttrsMods: [],
                showNoDeleteInfo: false,
                nonDelAttrsData: [],
                dsOrNwAttrDirty: false,

                tabs: {
                    nodes: true,
                    links: false,
                    clusters: false
                },
                openTab: function(tab) {
                    this.tabs.nodes = false;
                    this.tabs.links = false;
                    this.tabs.clusters = false;
                    this.tabs[tab] = true;
                },

                attrMetaPanelOpen: false,

                attrHelpersOpen: false,
                showAttrHelpers: function() {
                    this.attrHelpersOpen = true;
                },
                hideAttrHelpers: function() {
                    this.attrHelpersOpen = false;
                    this.attrMetaPanelOpen = false;
                }
            };

            /**
    * Scope methods
    */
            $scope.updateAttrs = updateAttrs;
            $scope.openMergeModal = openMergeModal;
            $scope.downloadNetworkXLSX = downloadNetworkXLSX;

            $scope.cancelAttrUpdate = function(op) {
                $scope.$broadcast('CANCELATTRUPDATE', {op: op, attrMod: $scope.activeAttrMod});
            };

            $scope.closeModal = function() {
                $uibModalInstance.dismiss('cancel');
            };

            /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
            $scope.$on('ATTRSSELECTED', function(e) {
                e.stopPropagation();
                $scope.dmUi.showAttrHelpers();
            });

            $scope.$on('ATTRSUNSELECTED', function(e) {
                e.stopPropagation();
                $scope.dmUi.hideAttrHelpers();
            });

            $scope.$on('ATTRSUPDATED', function(e) {
                e.stopPropagation();
                $scope.dmUi.hideAttrHelpers();
            });

            $scope.$on('OPENATTRMETATAB', function(e, data) {
                e.stopPropagation();
                $scope.dmUi.attrMetaPanelOpen = true;
                if(!_.isObject(data.attrMod)) {
                    throw new Error('Need Attr Modifier Object');
                }
                $scope.activeAttrMod = data.attrMod;
            });

            /*************************************
    ********* Initialise *****************
    **************************************/
            $timeout(function() {
                $scope.dmUi.startRender = true;
            }, 500);



            /*************************************
    ********* Core Functions *************
    **************************************/

            function updateAttrs(op, attrType) {
                if(op == 'remove') {
                    var nwaAttrIds = _.map(_.filter($scope.dmUi.nwNodeAttrMods, '_isChecked'), 'attr.id');
                    var nonNwAttrIds = _.map(_.filter($scope.dmUi.dsAttrMods, '_isChecked'), 'attr.id');
                    var attrSnapsMap = snapshotService.getDependentAttrs();
                    var nonDelDsAttrIds = _.filter(nonNwAttrIds, function(attrId) {
                        return _.keys(attrSnapsMap).indexOf(attrId) > -1;
                    });
                    var nonDelOtherDsAttrIds = _.filter(nonNwAttrIds, function(attrId) {
                        return attrId == mapprSettings.nodeColorAttr
                    || attrId == mapprSettings.nodeSizeAttr;
                    });
                    nonDelOtherDsAttrIds = _.difference(nonDelOtherDsAttrIds, nonDelDsAttrIds);
                    $scope.dmUi.nonDelAttrsData = [];

                    if(nwaAttrIds.length > 0 || nonDelDsAttrIds.length > 0 || nonDelOtherDsAttrIds.length > 0){
                        _.each(nonDelDsAttrIds, function(attrId) {
                            $scope.dmUi.nonDelAttrsData.push({
                                attrId: attrId,
                                reason: 'Used in snapshots - ' + attrSnapsMap[attrId].join(', ')
                            });
                        });

                        _.each(nonDelOtherDsAttrIds, function(attrId) {
                            $scope.dmUi.nonDelAttrsData.push({
                                attrId: attrId,
                                reason: 'Currently being used for coloring/sizing nodes'
                            });
                        });

                        _.each(nwaAttrIds, function(attrId) {
                            $scope.dmUi.nonDelAttrsData.push({
                                attrId: attrId,
                                reason: 'Can\'t delete network attrs'
                            });
                        });

                        $scope.dmUi.showNoDeleteInfo = true;
                        $scope.dmUi.hideAttrHelpers();
                        $scope.dmUi.dsOrNwAttrDirty = false;
                        _.each($scope.dmUi.nwNodeAttrMods, function(attr_mod) {
                            attr_mod._isChecked = false;
                        });
                        _.each($scope.dmUi.dsAttrMods, function(attr_mod) {
                            attr_mod._isChecked = false;
                        });
                        return;
                    }
                }

                $scope.$broadcast('UPDATEATTRS', {op: op, attrType: attrType, attrMod: $scope.activeAttrMod});
            }

            function openMergeModal() {
                $scope.closeModal();
                $timeout(function() {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.openDIModal, {editMode: true});
                }, 500);
            }

            function downloadNetworkXLSX() {
                var postObj = {
                    networkIds: [$scope.currentNetwork.id],
                    downloadFormat: 'xlsx'
                };
                var currProject = projFactory.currProjectUnsafe();
                if(currProject) {
                    var progressCbk = function(prog) {
                        console.log('Download progress: ' + prog + ' %');
                        uiService.showProgress('fileDownload', 'Downloading... ' + prog + '%', 'success', prog);
                    };
                    projFactory.downloadNetworksData(currProject.org.ref, currProject._id, postObj, progressCbk)
                        .then(function(result) {
                            uiService.showProgress('fileDownload', 'Downloading finished. ', 'success', 110);
                            window.saveAs(new Blob([s2ab(result)],{type:"application/octet-stream"}), currProject.projName + ".xlsx");
                        })
                        .catch(function(err) {
                            console.error(err);
                            uiService.logError('Some error occured while downloading, try again later!');
                        });
                }

                function s2ab(s) {
                    var buf = new window.ArrayBuffer(s.length);
                    var view = new window.Uint8Array(buf);
                    for (var i = 0; i != s.length; ++i) { view[i] = s.charCodeAt(i) & 0xFF; }
                    return buf;
                }
            }

        }
    ]);