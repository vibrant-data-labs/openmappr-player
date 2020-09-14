angular.module('mappr')
.controller('SelectionSetsCtrl', ['$scope', '$rootScope', 'uiService', 'graphSelectionService', 'SelectionSetService', 'BROADCAST_MESSAGES',
function($scope, $rootScope, uiService, graphSelectionService, SelectionSetService, BROADCAST_MESSAGES){
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlSelectionSets: ] ';


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.ui = {
        showSelections: false,
        graphInteracted: graphSelectionService.getSelectedNodes() !== 0
    };

    $scope.selectionVMs = [];

    /**
    * Scope methods
    */
    $scope.addNewSelection = addNewSelection;
    $scope.bakeIntoDataset = bakeIntoDataset;



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.selectStage, function() {
        _.each($scope.selectionVMs, function(selVM) {
            selVM.selected = false;
        });
        $scope.ui.graphInteracted = false;
    });


    // NOTE:- controller always alive, optimisation needed
    $scope.$on(BROADCAST_MESSAGES.selectNodes, function(e, data) {
        $scope.ui.graphInteracted = true;
        if(_.isArray(data.nodes) && data.nodes.length === 1) {
            highlighNodeGroups(data.nodes[0]);
        }
    });

    $scope.$on(BROADCAST_MESSAGES.overNodes, function(e, data) {
        if(_.isArray(data.nodes) && data.nodes.length === 1) {
            highlighNodeGroups(data.nodes[0]);
        }
    });

    $scope.$on(BROADCAST_MESSAGES.outNodes, function() {
        unHighlightAllGroups();
    });



    /*************************************
    ********* Initialise *****************
    **************************************/
    init();



    /*************************************
    ********* Core Functions *************
    **************************************/

    function init() {
        console.log(logPrefix + 'getting group sets');
        $scope.selectionVMs = SelectionSetService.getSelectionVMs();
    }

    function addNewSelection() {
        console.log(logPrefix + 'adding a new group');
        SelectionSetService.addNewSelection(true);
    }

    function bakeIntoDataset () {
        console.log("User wants to bake group into dataset");
        uiService.log('Baking groups into dataset');
        SelectionSetService.bakeSelections()
        .then(function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.project.selectionBakedIntoDS);
        });
    }

    function highlighNodeGroups(node) {
        _.each($scope.selectionVMs, function(selVM) {
            selVM.hovered = selVM.nodeExistsInGroup(node.id);
        });
    }

    function unHighlightAllGroups() {
        _.each($scope.selectionVMs, function(selVM) {
            selVM.hovered = false;
        });
    }


}
]);