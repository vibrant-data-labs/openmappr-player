angular.module('mappr')
.controller('ScriptAttribCtrl', ['$scope', '$rootScope', '$timeout', '$q', 'ScriptingService',  'SelectionSetService', 'AttrModifierService', 'AttrInfoService', 'AttrGeneratorService', 'dataGraph', 'dataService', 'networkService', 'projFactory', 'BROADCAST_MESSAGES', 'uiService',
function($scope, $rootScope, $timeout, $q, ScriptingService, SelectionSetService, AttrModifierService, AttrInfoService, AttrGeneratorService, dataGraph, dataService, networkService, projFactory, BROADCAST_MESSAGES, uiService){
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ScriptAttribCtrl: ] ';
    var genAutoName = true;
    var followSrcType = true;
    var evalResults = null;
    var selectionSets = SelectionSetService.getSelectionSets();
    // var converter = null; // corece values to their correct type



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.selectedScript = ScriptingService.defScript();
    $scope.networkName = '';
    $scope.groupInfoTypes = ['Parent Cluster'].concat(_.map(selectionSets, 'selName'));
    $scope.groupInfoType = _.head($scope.groupInfoTypes);

    $scope.scripts = [];
    $scope.fnScript = "";



    /**
    * Scope methods
    */
    $scope.changeSrcAttrib = changeSrcAttrib;
    $scope.evaluateFn = evaluateFn;
    $scope.changeScript = changeScript;
    $scope.disableAutoNaming = disableAutoNaming;
    $scope.disableFollowingType = disableFollowingType;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    // Enable modal's main button
    $scope.mapProcessor.enableMainBtn();
    $scope.mapProcessor.childProcess = saveOnServer;
    setup();



    /*************************************
    ********* Core Functions *************
    **************************************/

    function setup() {
        var network = networkService.getCurrentNetwork(),
            mergedGraph = dataGraph.getRawDataUnsafe();

        $scope.srcAttribOptions = mergedGraph.nodeAttrs;
        $scope.networkName = network.name;
        changeSrcAttrib(mergedGraph.nodeAttrs[0]);

        $scope.attribTypes = dataGraph.getNodeAttrTypes();

        var defScript = ScriptingService.defScript();
        $scope.fnScript = defScript.scriptSrc;
        $scope.selectedScript = defScript;
        $scope.scripts = [defScript];

        ScriptingService.loadRecentlyUsedScripts()
        .then(function(scripts) {
            $scope.scripts = scripts;
            $scope.selectedScript = _.head(scripts);
        });

        $scope.evaluate_results = "Run the script to see the results..";
        $scope.isScriptValid = "INIT";
    }

    function changeSrcAttrib(newSrcAttrib) {
        $scope.srcAttrib  = newSrcAttrib;
        $scope.newAttribName = genAutoName ? $scope.srcAttrib.title + "_1" : $scope.newAttribName;
        $scope.newAttribType = followSrcType ? $scope.srcAttrib.attrType : $scope.newAttribType;
        console.log(logPrefix, "Changed src Attrib to " + newSrcAttrib.title);
    }

    function changeScript (newScript) {
        $scope.fnScript = newScript.scriptSrc;
    }

    function disableAutoNaming () {
        genAutoName = false;
    }
    function disableFollowingType () {
        followSrcType = false;
    }

    function evaluateFn() {
        var srcAttrId = $scope.srcAttrib.id,
            network = networkService.getCurrentNetwork(),
            mergedGraph = dataGraph.getRawDataUnsafe(),
            groupInfoType = $scope.groupInfoType;

        // get the values to inject into the script
        var nwAttrInfos = AttrInfoService.getNodeAttrInfoForNetwork(network.id);
        var srcAttrInfo = nwAttrInfos.forId(srcAttrId);
        // a function which gets ClusterInfo for the given node. Lazily built for performance
        var grpAttrInfoFn = null;
        if(groupInfoType === 'Parent Cluster') {
            grpAttrInfoFn = AttrInfoService.getClusterInfoFn(mergedGraph);
        } else {
            var sel = _.find(selectionSets, 'selName', groupInfoType);
            if(!sel) { throw new Error("Unable to find the correct selectionSet. Given: " + groupInfoType); }

            var nodes = _.map(_.compact(_.map(sel.dpIDs, function(dpId) {
                return mergedGraph.dataPointIdNodeIdMap[dpId];
            })), function(nodeId) { return mergedGraph.nodeIndex[nodeId];});

            grpAttrInfoFn = _.constant(AttrInfoService.genInfoForGrouping(nodes, mergedGraph.nodeAttrs));
        }

        // run the script on each node
        try {
            var newFn = new Function("_", "moment", "srcAttrInfo", "nwAttrInfos", "grpAttrInfos", "node", "x", $scope.fnScript);
            evalResults = _.reduce(mergedGraph.nodes, function(acc, node) {
                var grpAttrInfos = grpAttrInfoFn(node);
                if(node.attr[srcAttrId] != null) {
                    acc.push([node.id, newFn(_, window.moment, srcAttrInfo, nwAttrInfos, grpAttrInfos, node, node.attr[srcAttrId])]);
                }
                return acc;
            },[]);

            // check if it worked
            var resultValues = _.map(evalResults, _.last),
                compactedValues = _.compact(resultValues);

            if(compactedValues.length === 0) {
                throw new Error("Result Error: Function compiles but generates no results");
            }
            console.log(logPrefix,"Function successfully evaluted!", resultValues);
            console.log(logPrefix, "Number of invalid values: ", resultValues.length - compactedValues.length);

            // coerce to correct type
            var currType = srcAttrInfo.isNumeric ? "float" : (_.isArray(resultValues[0]) ? "liststring" : "string");
            var converter = AttrModifierService.valueConverterForValues($scope.newAttribType, currType, resultValues);
            if(!converter) {
                throw new Error("Function generated values. But can't coerce the type to the selected type. Check the final type");
            }
            _.each(evalResults, function(res) {
                res[1] = converter(res[1]);
            });
            console.log(logPrefix,"Coreced values", _.map(resultValues, converter));
            // works!
            $scope.evaluate_results = JSON.stringify(_.map(resultValues, converter));
            $scope.isScriptValid = "YES";
            $scope.scripts = ScriptingService.storeScript($scope.fnScript);
            $scope.selectedScript = _.head($scope.scripts);

        } catch (err) {
            console.log(logPrefix,"Function couldn't runn correctly!", err);
            $scope.evaluate_results = err.toLocaleString();
            $scope.isScriptValid = "NO";
        }
    }

    //generate and reload dataset
    function saveOnServer() {
        console.log(logPrefix, "Changed src Attrib to " + $scope.srcAttrib.title);
        var network = networkService.getCurrentNetwork();

        uiService.log("Generating data on server...");
        if($scope.isScriptValid == "NO") {
            return $q.reject('Script failed');
        } else {
            return AttrGeneratorService.addAttributeOnNetwork(network.id, $scope.newAttribName, $scope.newAttribType, evalResults)
            .then(function() {
                var proj = projFactory.currProjectUnsafe();
                console.log("Reloading dataset and network...");
                uiService.log("Reloading data...");
                return $q.all([
                    dataService.fetchProjectDataSet(proj.org.ref, proj._id),
                    networkService.fetchProjectNetwork(network.id)
                ]);
            })
            .then(function(vals) {
                uiService.log("Re rendering graph...");
                var network = vals[1];
                $rootScope.$broadcast(BROADCAST_MESSAGES.network.changed, { network : network });
                return dataGraph.mergeAndLoadNetwork(network);
            })
            .catch(function(err) {
                uiService.logError(err.toLocaleString());
            });
        }
    }
}
]);
