angular.module('dataIngestion')
.controller('SpreadSheetCtrl', ['$scope', '$timeout', '$rootScope', '$q', 'dataIngestService', 'projFactory', 'snapshotService', 'dataGraph', 'AttrModifierService', 'uiService', 'networkService', 'BROADCAST_MESSAGES', 'AttrInfoService',
function($scope, $timeout, $rootScope, $q, dataIngestService, projFactory, snapshotService, dataGraph, AttrModifierService, uiService, networkService, BROADCAST_MESSAGES, AttrInfoService){
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.spreadSheetData = {
        fileId: '',
        file: '',
        available: false,
        nodesCount: 0,
        edgesCount: 0,
        createData: {
            localColumns: []
        },
        mergeData: {
            mergeConflicts: false,
            conflictedAttrs: {}
        },
        attrsData: {},
        attrTypes: dataGraph.getNodeAttrTypes(),
        mergeMachine: null
    };

    /**
    * Scope methods
    */
    $scope.validateNewAttrTitle = validateNewAttrTitle;
    $scope.changeLinkAttrType = changeLinkAttrType;
    $scope.toggleAllLocalAttrs = toggleAllLocalAttrs;
    $scope.setAllLocalAttrsSelection = setAllLocalAttrsSelection;
    $scope.changeNodeAttrType = changeNodeAttrType;



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$watchGroup(['spreadSheetData.createData.localColumns', 'spreadSheetData.mergeData'], genSheetViewData);



    /*************************************
    ********* Initialise *****************
    **************************************/
    $scope.mapProcessor.stopProcess = $scope.mapProcessor.emptyRejectFunc;

    //Overwriting DataIngestionModalCtrl's 'childProcess' method of 'mapProcessor'
    if($scope.diModalData.editMode) {
        //For merging maps
        $scope.mapProcessor.childProcess = function() {

            if($scope.spreadSheetData.mergeMachine.canMerge()) {
                $scope.progressHandler.showDummyProgress('savingData');

                return $scope.spreadSheetData.mergeMachine.merge()
                .then(function(data) {
                    // Check for network regen
                    var networkAttrs = networkService.getNetworkAttrs(networkService.getCurrentNetwork().id);
                    if(_.intersection(networkAttrs, $scope.spreadSheetData.mergeMachine.getUpdatedAttrIds()).length > 0) {
                        networkService.getCurrentNetwork().needsRegen = true;
                    }
                    return data;
                }, function(error) {
                    $scope.mapProcessor.showError('Error during merge', 'Merge with this new dataset is not possible');
                    return $q.reject(error);
                });
            }
            else {
                $scope.spreadSheetData.mergeMachine.setErrorMsg();
                return $q.reject('merge conflicted');
            }

        };
    }
    else {
        //For creating maps
        $scope.mapProcessor.childProcess = function() {
            $scope.progressHandler.showDummyProgress('savingData');
            var attrDescriptors = {
                dsAttrs: _.filter($scope.spreadSheetData.attrsData.dsAttrs, 'isLocalChecked'),
                nwNodeAttrs: _.filter($scope.spreadSheetData.attrsData.nwNodeAttrs, 'isLocalChecked'),
                nwLinkAttrs: $scope.spreadSheetData.attrsData.nwLinkAttrs
            };

            return dataIngestService.generateMap({
                urlParams : [$scope.currOrg._id, $scope.currProject._id],
                uData : {
                    fileId: $scope.spreadSheetData.fileId,
                    attrDescriptors: attrDescriptors
                }
            })
            .then(function(data) {
                if(data && data.updatedProjName) {
                    $scope.project.selected.projName = data.updatedProjName;
                    var currProject = projFactory.currProjectUnsafe();
                    if(currProject) {
                        currProject.projName = data.updatedProjName;
                    }
                    else {
                        console.warn('Could not get current project');
                    }
                }

                return data;
            });
        };
    }

    /*************************************
    ********* Core Functions *************
    **************************************/

    function validateNewAttrTitle(attrDescr, attrs) {
        var newAttrTitle = attrDescr.title;
        var titleAlreadyExists = _.any(attrs, function(attr) {
            return attr.id == newAttrTitle;
        });
        if(titleAlreadyExists) {
            uiService.logError('Can\'t change title to ' + newAttrTitle + ', it already exists!');
            attrDescr.title = attrDescr.id;
        }
    }

    function genSheetViewData(newVal, oldVal) {
        if(newVal == oldVal) { return; }
        var dsAttrs = [], nwNodeAttrs = [], nwLinkAttrs = [];
        var allLocalColsSelected = false;
        var allRemoteColsSelected = false;

        if(!$scope.diModalData.editMode) {
            // Create map mode
            // Find node count for each attribute
            var attributeNodeCountMap = {};

            $scope.diModalData.tabsInfo.hasNodes = true;
            $scope.diModalData.tabsStatus.nodes = true;

            _.each($scope.spreadSheetData.createData.nodesInfo, function(node) {
                _.each(node.attr, function(val, key) {
                    attributeNodeCountMap[key] = attributeNodeCountMap[key] ? attributeNodeCountMap[key] + 1 : 1;
                    //max node count
                    //so tab knows number of nodes
                    $scope.diModalData.tabsInfo.nodesLength = Math.max(attributeNodeCountMap[key], $scope.diModalData.tabsInfo.nodesLength);
                });
            });


            // Set up ds attributes
            _.each($scope.spreadSheetData.createData.localColumns, function(col) {
                _.assign(col, {
                    isLocalChecked: true,
                    local: true,
                    attrNodeCount: attributeNodeCountMap[col.id],
                    newAttrType: col.attrType
                });
                dsAttrs.push(col);
            });
            allLocalColsSelected = true;

            console.log('network: ', $scope.spreadSheetData.createData.networks[0]);

            // Setup network attrs
            if(!_.isEmpty( _.get($scope.spreadSheetData, 'createData.networks[0].links') )) {
                $scope.diModalData.tabsInfo.hasLinks = true;
                var network = $scope.spreadSheetData.createData.networks[0]; //Currently for first network only
                var nwAttrCountMap = {};

                _.each(network.nodes, function(node) {
                    _.each(node.attr, function(val, key) {
                        nwAttrCountMap[key] = nwAttrCountMap[key] ? nwAttrCountMap[key] + 1 : 1;
                    });
                });

                _.each(network.nodeAttrDescriptors, function(nodeAttr) {
                    _.assign(nodeAttr, {
                        newAttrType: nodeAttr.attrType,
                        isLocalChecked: true,
                        local: true,
                        attrNodeCount: nwAttrCountMap[nodeAttr.id]
                    });
                    nwNodeAttrs.push(nodeAttr);
                });

                //so tab knows total number of links
                $scope.diModalData.tabsInfo.linksLength = network.links.length;
                _.each(network.linkAttrDescriptors, function(linkAttr) {
                    _.assign(linkAttr, {
                        newAttrType: linkAttr.attrType
                    });
                    nwLinkAttrs.push(linkAttr);
                });
            }
        }
        else {
            // Edit map mode
            $scope.spreadSheetData.mergeMachine.processSaveDataReqResult($scope.spreadSheetData.mergeData)
            .then(function() {
                console.log($scope.spreadSheetData.mergeMachine);
                $scope.diModalData.dataAvailable = true;
            });
        }

        $scope.spreadSheetData.attrsData = {
            allLocalAttrsSelected: allLocalColsSelected,
            allRemoteAttrsSelected: allRemoteColsSelected,
            dsAttrs: dsAttrs,
            nwNodeAttrs: nwNodeAttrs,
            nwLinkAttrs: nwLinkAttrs,
            combinedAttrs: dsAttrs.concat(nwNodeAttrs)
        };

    }


    //Columns selection logic

    // For creating map only
    function toggleAllLocalAttrs() {
        var attrData = $scope.spreadSheetData.attrsData;
        if(attrData.allLocalAttrsSelected) {
            _toggleAllAttrs(false);
        }
        else {
            _toggleAllAttrs(true);
        }
        attrData.allLocalAttrsSelected = !attrData.allLocalAttrsSelected;
    }

    function setAllLocalAttrsSelection() {
        $timeout(function() {
            $scope.spreadSheetData.attrsData.allLocalAttrsSelected = $scope.spreadSheetData.attrsData.combinedAttrs.every(function(attr) {
                return attr.isLocalChecked;
            });
        });
    }

    function changeNodeAttrType(attr) {
        var converter = AttrModifierService.valueConverterForAttr(attr.newAttrType, attr.attrType, attr.id, $scope.spreadSheetData.createData.nodesInfo);
        if(converter) {
            attr.attrType = attr.newAttrType;
            attr.renderType = AttrInfoService.getRenderTypes(attr.attrType)[0];
        }
        else {
            uiService.logError('Can\'t convert from ' + attr.attrType + ' to ' + attr.newAttrType);
            attr.newAttrType = attr.attrType;
        }
    }

    function changeLinkAttrType(attr) {
        var converter = AttrModifierService.valueConverterForAttr(attr.newAttrType, attr.attrType, attr.id, $scope.spreadSheetData.createData.networks[0].links);
        if(converter) {
            attr.attrType = attr.newAttrType;
        }
        else {
            uiService.logError('Can\'t convert from ' + attr.attrType + ' to ' + attr.newAttrType);
            attr.newAttrType = attr.attrType;
        }
    }

    function _toggleAllAttrs(check) {
        _.each($scope.spreadSheetData.attrsData.combinedAttrs, function(attr) {
            attr.isLocalChecked = check;
        });
    }

}
]);