angular.module('mappr')
.controller('NetgenModalCtrl', ['$scope', '$rootScope', '$uibModalInstance', '$timeout', '$q', 'projFactory', 'dataGraph', 'dataService', 'networkService', 'AttrInfoService' ,'modalState', 'athenaService', 'snapshotService', 'uiService', 'BROADCAST_MESSAGES',
function($scope, $rootScope, $uibModalInstance, $timeout, $q, projFactory, dataGraph, dataService, networkService, AttrInfoService, modalState, athenaService, snapshotService, uiService, BROADCAST_MESSAGES) {

    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var runOptions = {};
    var status = 1;
    var algo;
    var currentNetwork;
    var start, end, lastSingleClick;


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.ngmodels = {
        newNetworkName : null
    };
    $scope.checkAll = false;

    $scope.ngUi = {
        switchToNewNetwork: true,
        hideModal: false,
        netGenRunning: false
    };
    $scope.modalState = modalState;


    /**
    * Scope methods
    */
    $scope.generateNetwork = generateNetwork;
    $scope.handleClickOnRow = handleClickOnRow;
    $scope.titleStringSuffix = titleStringSuffix;

    $scope.switchNetwork = function(networkId) {
        console.log("Switching network to :", networkId);
        return networkService.switchNetwork(networkId);
    };

    $scope.openMergeModal = function() {
        $scope.ngUi.hideModal = true;
        $timeout(function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.openDIModal, {editMode: true, diMode: true});
        }, 500);
    };

    $scope.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
    };

    $scope.toggleSelection = function() {
        $scope.checkAll = !$scope.checkAll;
        _.each($scope.nodeAttributes, function(na){
            na.isChecked = $scope.checkAll;
        });
    };

    $scope.uncheckSelectAll = function() {
        $scope.checkAll = false;
    };

    $scope.isAnySelected = function() {
        //console.log(_.some($scope.nodeAttributes, 'isChecked', true));
        return _.some($scope.nodeAttributes, 'isChecked', true);
    };

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.di.dataEnhanced, function() {
        initAttrsList();
    });

    /*************************************
    ********* Initialise *****************
    **************************************/
    init();

    /*************************************
    ********* Core Functions *************
    **************************************/

    function init() {
        $scope.networks = _.values(networkService.getNetworks());
        $scope.ngmodels.newNetworkName = 'Network ' + (projFactory.currProjectUnsafe().allGenNWIds.length + 1);

        $scope.paramsOpen = false;
        $scope.linkedToDI = $scope.networks.length < 1;
        //compilation of all the analysis type possible
        $scope.analysisType = [
            {type: 'Metadata', val:-1},
            {type: 'Subjective', val:0},
            {type: 'Numerical', val:1},
            {type: 'Ordinal', val:2},
            {type: 'MultiCategory', val:3},
            {type: 'BiCategory', val: 4},
            {type: 'Categorical', val:5},
            {type: 'Hierarchical', val:6},
            {type: 'MultiOrdinal', val:7},
            {type: 'WtdFeature', val:8}
        ];

        $scope.valType = ['Number', 'Category'];//, 'Text']; //wait for text -> tag (alchemy)
        $scope.isWtdFeature = ['Value', 'WtdFeature'];
        $scope.isOrdered = ['Ordered', 'Unordered'];
        $scope.isMulti = ['Multi', 'Singleton'];
        $scope.nodeAttrTypes = dataGraph.getNodeAttrTypes();
        $scope.edgeAttrTypes = dataGraph.getEdgeAttrTypes();

        initAttrsList();

        // Fetch algos
        athenaService.fetchAlgos().then(function(algos) {
            algo = _.find(algos || [], function(algo) {
                return algo.status >= status && algo.name == 'links_FromAttributes';
            });

            //If algo not found - athena is probably down - have to throw warnings to the user
            //further it should halt further actions. (run netgen button should be disabled for instance).
            if (!algo) return;

            $scope.attrNetwAlgo = algo;

            var areLinkingInfoPresent = !!(currentNetwork && currentNetwork.generatorInfo && currentNetwork.generatorInfo.links_FromAttributes);

            _.each(algo.options, function(alOption){
                runOptions[alOption.key] = (areLinkingInfoPresent && $scope.regenerateNetwork) ? currentNetwork.generatorInfo.links_FromAttributes[alOption.key] : alOption.default; //JSON.parse(alOption.default);
            });

            $scope.runOptions = runOptions;
            $scope.runOptions.analyseCurrentNetwork = false;
            // $scope.runOptions.analyseCurrentNetwork = modalState === 'regenerate';
        });
    }

    function initAttrsList() {
        dataService.currDataSet()
        .then(function(dataset) {
            $scope.nodeAttributes = dataset.attrDescriptors;

            //auto assign a best guess for analysis type by the analysing actual value
            //and NOT the user selected attr type
            _.each($scope.nodeAttributes, function(attr){
                attr.titleVeryShort = (attr.title.length > 14) ? attr.title.slice(0, 14) + '..' : attr.title;
                attr.titleShort = (attr.title.length > 27) ? attr.title.slice(0, 27) + '..' : attr.title;
                attr.isChecked = false;
                //is 'attr' numerical?
                if(attr.attrType == 'float' || attr.attrType == 'integer' || attr.attrType == "timestamp") {
                    attr.valType = $scope.valType[0];
                    attr.isOrdered = $scope.isOrdered[0];
                    attr.isMulti = $scope.isMulti[1];
                    attr.isWtdFeature = $scope.isWtdFeature[0];
                    attr.analysisType = $scope.analysisType[2];
                } else {
                    attr.valType = $scope.valType[1];
                    attr.isOrdered = $scope.isOrdered[1];
                    attr.isMulti = $scope.isMulti[1];
                    attr.isWtdFeature = $scope.isWtdFeature[0];
                    attr.analysisType = $scope.analysisType[6];
                }
                if(attr.attrType == 'liststring') {
                    attr.isMulti = $scope.isMulti[0];
                }
            });

            if(modalState != 'diCreate') {
                $scope.nodeAttributes = _.filter(dataset.attrDescriptors, function(attrDesc) {
                    var infoObj = AttrInfoService.getNodeAttrInfoForRG().getForId(attrDesc.id);
                    return filterAttributes(dataset.datapoints, infoObj, attrDesc);
                });
                console.log("%i attributes filtered out", dataset.attrDescriptors.length - $scope.nodeAttributes.length);
                console.log("Filtered attrs are:", _.difference(_.pluck(dataset.attrDescriptors, 'title'),_.pluck($scope.nodeAttributes,'title')));
            }

            if(modalState == 'regenerate' || modalState == 'diMerge') {
                // Select network attrs
                if(modalState == 'diMerge') $scope.regenAfterMerge = true;
                $scope.regenerateNetwork = true;
                currentNetwork = networkService.getCurrentNetwork();
                $scope.ngmodels.newNetworkName = currentNetwork.name;
                var networkAttrs = dataGraph.getNodeAttrTitlesForIds(networkService.getNetworkAttrs(currentNetwork.id));
                _.each(networkAttrs, function(attr) {
                    var nodeAttr = _.find($scope.nodeAttributes, "title", attr);
                    if(!nodeAttr) {
                        // the attribute could have been filtered out, add it back
                        nodeAttr = _.find(dataset.attrDescriptors, "title", attr);
                        if(!nodeAttr) {
                            console.log('Node attrs: ', $scope.nodeAttributes);
                            throw new Error('Attr not found');
                        }
                        $scope.nodeAttributes.unshift(nodeAttr);
                    }
                    nodeAttr.isChecked = true;
                });
            }
            else if(modalState == 'diCreate') {
                $scope.ngUi.switchToNewNetwork = true;
            }
        });
    }

    function generateNetwork() {
        $scope.ngUi.netGenRunning = true;

        _.assign($scope.runOptions, {
            questions: getNodeAttribTitles()
        });
        if($scope.runOptions.analyseCurrentNetwork) {
            var points = _.pluck(networkService.getCurrentNetwork().nodes, "dataPointId");
            $scope.runOptions.dataPointsToAnalyse = points;
        } else {
            $scope.runOptions.dataPointsToAnalyse = [];
        }

        /// If network is being regenerated,
        /// if the network is a subgraph, then use the initial datapoints
        /// if no parent network is set, then analyse the nodes of the dataset
        if(modalState === "regenerate" && !$scope.runOptions.analyseCurrentNetwork) {
            var nw = networkService.getCurrentNetwork();
            var parentNWId = _.get(nw.generatorInfo, "subGraph.parentNWId");
            points = [];

            if(parentNWId) {
                // if this network was generated via subgraph for selection, then only analyse those datapoints
                points = _.map(networkService.getCurrentNetwork().nodes, "dataPointId");
            } else {
                // check link_FromAttributes params if some subset of nodes
                // were analysed to build this graph.
                if(_.get(nw.generatorInfo, "links_FromAttributes.dataPointsToAnalyse")) {
                    points = _.get(nw.generatorInfo, "links_FromAttributes.dataPointsToAnalyse", []);
                } else {
                    // not a subgraph, nor a restricted generation. so analyse the whole dataset
                    points = [];
                }
            }
            $scope.runOptions.dataPointsToAnalyse = points;
        }
        uiService.log("Starting network generation...");
        $rootScope.$broadcast(BROADCAST_MESSAGES.netgen.started);

        athenaService.run_algorithm(algo, $scope.runOptions, $scope.ngmodels.newNetworkName)
        .then(function(data) {
            if(!data.networkId) throw new Error('Network Id expected to switch');
            if(!$scope.regenerateNetwork && projFactory.currProjectUnsafe().allGenNWIds.indexOf(data.networkId) === -1) {
                console.log("Adding new network to client copy of project");
                projFactory.currProjectUnsafe().allGenNWIds.push(data.networkId);
            }
            var postNetGenP = $q.when(null);
            $uibModalInstance.close({
                operation: $scope.regenerateNetwork ? 'regenerate' : 'generate',
                newNetworkId: data.networkId
            });
            if(modalState != 'diCreate') {
                if($scope.ngUi.switchToNewNetwork) {
                    postNetGenP = $scope.switchNetwork(data.networkId);
                }
                else {
                    postNetGenP = networkService.fetchProjectNetwork(data.networkId)
                    .then(function() {
                        $rootScope.$broadcast(BROADCAST_MESSAGES.network.initPanel);
                    }); // load network
                    console.info('New network created but not switching ' + data.networkId);
                }
            }
            $rootScope.$broadcast(BROADCAST_MESSAGES.netgen.finished, {networkId: data.networkId});

            // Create default snap for new network(if created from attrs)
            if(algo.title === "links_FromAttributes" && !$scope.regenerateNetwork) {
                var x = $rootScope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
                    console.log("Algo ran successfully. hacking mapprSettings");
                    var rd = dataGraph.getRawDataUnsafe();
                    var suggestedSnapObj = snapshotService.suggestSnapObj();
                    snapshotService.createSnapshot(suggestedSnapObj, function(snap) {
                        if(rd.isNodeAttr('Cluster')) {
                            snap.layout.settings.nodeColorAttr = 'Cluster';
                            snap.layout.settings.drawGroupLabels = true;
                            snap.layout.settings.nodeSizeAttr = 'ClusterArchetype';
                            snap.layout.settings.nodeSizeMultiplier = 0.4;
                            snap.layout.settings.drawEdges = rd.nodes && rd.nodes.length < 2000;
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
            }
            return postNetGenP;
        })
        .then(function() {
            console.log('Post net gen Ops finished');
        })
        .catch(function(err) {
            $scope.ngUi.netGenRunning = false;
            console.error('Error while generating network: ',  err);
            uiService.logError('Some error occured while generating network!');
            $rootScope.$broadcast(BROADCAST_MESSAGES.netgen.failed);
        });

    }

    function getNodeAttribTitles() {
        //Get selected attributes
        var nodeAttribObjects = _.filter($scope.nodeAttributes, 'isChecked');
        //console.log(nodeAttribObjects);

        //Construct the attribute titles with properties
        var nodeAttribTitles = _.map(nodeAttribObjects, function(attr){

            //assess analysis type
            if(attr.valType == 'Number'){
                if(attr.isWtdFeature == $scope.isWtdFeature[1]){
                    attr.analysisType = $scope.analysisType[9];
                } else {
                    attr.analysisType = $scope.analysisType[2];
                }
            } else if(attr.valType == 'Text'){
                attr.analysisType = $scope.analysisType[1];
            } else {
                //category
                if(attr.isOrdered == 'Ordered'){
                    if(attr.isMulti == 'Multi'){
                        //multi ordinal
                        attr.analysisType = $scope.analysisType[8];
                    } else {
                        //ordinal
                        attr.analysisType = $scope.analysisType[3];
                    }
                } else {
                    if(attr.isMulti == 'Multi'){
                        //multi categorical
                        attr.analysisType = $scope.analysisType[4];
                    } else {
                        //categorical
                        attr.analysisType = $scope.analysisType[6];
                    }
                }
            }

            return {
                Question : attr.id,
                qID: (_.pluck($scope.nodeAttributes, 'id')).indexOf(attr.id),
                qAnalysisType: attr.analysisType.val
            };
        });

        console.log('[ctrlNetgenModal: ]', nodeAttribTitles);
        return nodeAttribTitles;
    }

    function titleStringSuffix() {
        //console.log(_.some($scope.nodeAttributes, 'isChecked', true));
        var attribList = _.filter($scope.nodeAttributes, 'isChecked');
        if(attribList.length ==1){
            return _.pluck(attribList, 'titleShort')[0];
        } else if(attribList.length <= 2){
            return _.pluck(attribList, 'titleVeryShort').join(' & ');
        } else {
            //return _.slice(attribList, 0, 2).join(', ') + ' + ' + (attribList.length - 2) + ' others.'
            return '' + attribList.length + ' attributes';
        }
    }

    function handleClickOnRow(index, $event){

        $scope.nodeAttributes[index].isChecked = !$scope.nodeAttributes[index].isChecked;
        $scope.uncheckSelectAll();

        if($event.shiftKey){
            //unselect all
            //_.each($scope.nodeAttributes, function(nd){nd.isChecked = false;});

            //find start, end
            if(index>lastSingleClick) {
                start = lastSingleClick;
                end = index;
            } else {
                start = index;
                end = lastSingleClick;
            }

            //check all between start/end
            for(var i = start; i <= end; i++) $scope.nodeAttributes[i].isChecked = true;
        }

        lastSingleClick = index;
    }


    // return true if the attribute should be included in the netgen
    // if non-numeric reject if:
    //    "most" values are the same
    //    "most" values are different
    // if numeric reject if:
    //    all values are the same
    function filterAttributes (datapoints, attrInfo, attr) {
        if(!attrInfo) {
            console.warn("No info object found for attribute:", attr.id);
            return false;
        }
        if(attrInfo.isNumeric) {
            return attrInfo.bounds.min != attrInfo.bounds.max;
        } else {    // string or tag
            var keep = true;
            if( !attrInfo.isTag ) {
                var nVals = attrInfo.values.length;
                var nWithVal = attrInfo.nValues;
                var counts = _.values(attrInfo.valuesCount);
                if( nVals == 1 || nVals > 0.9*nWithVal) {   // all same or mostly different
                    keep = false;
                } else if( counts.length > 1 ) {
                    var nonUnique = 0;
                    _.forEach(counts, function(cnt) {if(cnt > 1) nonUnique++;});
                    keep = (nonUnique > Math.min(0.5*nVals, nWithVal*0.1)); // keep if enough values are non-unique
                } else {
                    keep = false;
                }
            } else {
                var nData = datapoints.length;
                nVals = attrInfo.nodeValsFreq.length;
                counts = _.values(attrInfo.nodeValsFreq);
                nonUnique = 0;
                _.forEach(counts, function(cnt) {if(cnt > 1) nonUnique++;});
                if( nonUnique > 0.8*nData || _.max(counts) > 0.8*nData ) {
                    keep = false;
                }
            }
            return keep;
        }
    }
}
]);
