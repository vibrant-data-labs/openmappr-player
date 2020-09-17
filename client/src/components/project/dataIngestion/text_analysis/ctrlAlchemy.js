angular.module('dataIngestion')
.controller('AlchemyCtrl', ['$scope', '$q', '$rootScope', 'alchemyService', 'dataGraph',  'dataService', 'projFactory', 'networkService', 'uiService', 'BROADCAST_MESSAGES',
function($scope, $q, $rootScope, alchemyService, dataGraph, dataService, projFactory, networkService, uiService, BROADCAST_MESSAGES) {
    'use strict';


    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlAlchemy: ] ';
    var algos = alchemyService.alchemyAlgos();


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.queryAttr = null;
    $scope.relevance = 0.4;
    $scope.alchemyAlgos = [];
    $scope.nodeAttrList = [];

    /**
    * Scope methods
    */
    $scope.validateNewTitle = validateNewTitle;
    $scope.updateAttrTitles = updateAttrTitles;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    $scope.mapProcessor.enableMainBtn();
    $scope.mapProcessor.stopProcess = $scope.mapProcessor.emptyRejectFunc;

    // build a node attrs lists for selections
    if($scope.diModalData.diMode) {
        $scope.nodeAttrList = _.reduce(dataService.currDataSetUnsafe().attrDescriptors, function(acc, attr) {
            if(!_.contains(['float', 'integer'], attr.attrType)) {
                acc.push({
                    id : attr.id,
                    title : attr.title
                });
            }
            return acc;
        }, []);

        $scope.mapProcessor.childProcess = runTextAnalysisForDI;
    }
    else {
        $scope.nodeAttrList = _.reduce(dataGraph.getNodeAttrs(), function(acc, attr) {
            if(!attr.isNumeric) {
                acc.push({
                    id : attr.id,
                    title : attr.title
                });
            }
            return acc;
        }, []);

        $scope.mapProcessor.childProcess = runTextAnalysis;
    }

    $scope.queryAttr = $scope.nodeAttrList[0];

    // Build algos model
    _.each(algos, function(algo) {
        var newTitle = $scope.queryAttr.title + '-' + algo;
        if(attrExists(newTitle)) {
            newTitle  = getUniqueTitle(newTitle);
        }

        $scope.alchemyAlgos.push({
            title: algo,
            newAttrTitle: newTitle,
            selected: false,
            titleInvalid: false
        });
    });

    // Select 1st algo as default
    $scope.alchemyAlgos[0].selected = true;

    //Inherited from DataIngestionDialogCtrl
    //Divide progress into parts and assign weightage
    $scope.progressHandler.addProcesses([
        {processType: 'nodeCrunching', message: 'Running Text Analysis<br>'}
    ]);

    /*************************************
    ********* Core Functions *************
    **************************************/

    function getUniqueTitle(title) {
        if(!attrExists(title)) {
            return title;
        }
        else {
            return getUniqueTitle(_.uniqueId(title));
        }
    }

    function attrExists(attrTitle) {
        return _.map($scope.nodeAttrList, 'id').indexOf(attrTitle) > -1;
    }

    function validateNewTitle(algo) {
        if(attrExists(algo.newAttrTitle)) {
            algo.titleInvalid = true;
        }
        else {
            algo.titleInvalid = false;
        }

        if(_.any($scope.alchemyAlgos, 'titleInvalid', true)) {
            $scope.mapProcessor.disableMainBtn();
        }
        else {
            $scope.mapProcessor.enableMainBtn();
        }
    }

    function updateAttrTitles() {
        // Update new attr titles
        _.each($scope.alchemyAlgos, function(algo) {
            var newTitle = $scope.queryAttr.title + '-' + algo.title;
            if(attrExists(newTitle)) {
                newTitle  = getUniqueTitle(newTitle);
            }
            algo.newAttrTitle = newTitle;
        });
    }


    //Overwriting DataIngestionModalCtrl 'childProcess' method of 'mapProcessor'

    function runTextAnalysis() {
        var selectedAlgos = _.pluckMultiple(_.filter($scope.alchemyAlgos, 'selected'), ['title', 'newAttrTitle']);
        console.log(logPrefix + 'selected algos: ', selectedAlgos);

        $scope.mapProcessor.stopProcess = function() {
            return alchemyService.stopTextAnalysis();
        };

        return alchemyService.enchanceData($scope.queryAttr.id, selectedAlgos, $scope.relevance)
        .then(
            function() {
                var proj = projFactory.currProjectUnsafe();
                $scope.progressHandler.finishProcess('nodeCrunching');
                console.log("Reloading dataset and network...");
                uiService.log("Reloading data...");
                return $q.all([
                    dataService.fetchProjectDataSet(proj.org.ref, proj._id),
                    networkService.fetchProjectNetwork(networkService.getCurrentNetwork().id)
                ]);
            },
            function(data) {
                throw new Error(data.status || 'failed');
            },
            function(result) {
                $scope.progressHandler.updateProgress('nodeCrunching', Math.floor(parseInt(result.completion, 10)), result.result.msg || '');
            }
        ).then(function(vals) {
            uiService.log("Re rendering graph...");
            var network = vals[1];
            $rootScope.$broadcast(BROADCAST_MESSAGES.network.changed,  { network : network });
            return dataGraph.mergeAndLoadNetwork(network);
        })
        .catch(function(err) {
            uiService.logError(err.toLocaleString());
            $scope.progressHandler.finishProcess('nodeCrunching');
        }).finally(function() {
            $scope.mapProcessor.stopProcess = $scope.mapProcessor.emptyRejectFunc;
        });
    }

    function runTextAnalysisForDI() {
        var selectedAlgos = _.pluckMultiple(_.filter($scope.alchemyAlgos, 'selected'), ['title', 'newAttrTitle']);
        console.log(logPrefix + 'selected algos: ', selectedAlgos);

        return alchemyService.enchanceData($scope.queryAttr.id, selectedAlgos, $scope.relevance)
        .then(
            function() {
                var proj = projFactory.currProjectUnsafe();
                $scope.progressHandler.finishProcess('nodeCrunching');
                uiService.log("Reloading data...");
                return dataService.fetchProjectDataSet(proj.org.ref, proj._id);
            },
            function(data) {
                throw new Error(data.status || 'failed');
            },
            function(result) {
                $scope.progressHandler.updateProgress('nodeCrunching', Math.floor(parseInt(result.completion, 10)), result.result.msg || '');
            }
        )
        .catch(function(err) {
            uiService.logError(err.toLocaleString());
            $scope.progressHandler.finishProcess('nodeCrunching');
        }).finally(function() {
            $scope.mapProcessor.stopProcess = $scope.mapProcessor.emptyRejectFunc;
        });
    }


}
]);