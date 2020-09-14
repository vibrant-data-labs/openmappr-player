angular.module('common')
.directive('dirNetworkInfo', [
    '$rootScope',
    'graphSelectionService',
    'hoverService',
    'FilterPanelService',
    'infoPanelService',
    'projFactory',
    'layoutService',
    'dataGraph',
    function(
        $rootScope,
        graphSelectionService,
        hoverService,
        FilterPanelService,
        infoPanelService,
        projFactory,
        layoutService,
        dataGraph
    ) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        templateUrl: '#{server_prefix}#{view_path}/components/project/panels/right_panel/info_panel/networkInfo.html',
        scope: {
            labelAttr: '=',
            selInfo: '=',
            ui: '=',
            generalInfo: '=',
            mapprSettings: '='
        },
        link: postLinkFnWrapper
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = 'dirNetworkInfo: ';
    var defNodesTitle = 'Nodes';
    var minViewCount = 5;
    var nodesTitleCopy;
    var ITEMS_TO_SHOW = 100;
    var ITEMS_TO_SHOW_INITIALLY = 10;


    /*************************************
    ******** Controller Function *********
    **************************************/

    /*************************************
    ******** Post Link Wrapper Function **
    This is to ensure postLink is called
    after the getRawData has completed
    **************************************/
    function postLinkFnWrapper(scope) {
        dataGraph.getRawData().then(function (resolve) {
            postLinkFn(scope);
        });
    }


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        var projSettings = projFactory.getProjectSettings();

        // Scope Data
        scope.topArchetypes = [];
        scope.topBridgers = [];
        scope.numShowArchs = 0;
        scope.numShowBridgers = 0;
        scope.archsViewLimit = 0;
        scope.bridgersViewLimit = 0;
        scope.nodeSizeAttrs = layoutService.getNodeSizeAttrs();
        scope.MAPP_EDITOR_OPEN = $rootScope.MAPP_EDITOR_OPEN;

        scope.vm = {
            nodeSizeAttr: null,
            nodesTitle: projSettings.nodesTitle || defNodesTitle
        };

        nodesTitleCopy = scope.vm.nodesTitle;

        scope.vm.nodeSizeAttr = _.find(scope.nodeSizeAttrs, 'id', scope.mapprSettings.nodeSizeAttr);

        scope.$watch('generalInfo.hideArchsBridgers', function(val) {
            if(!val) {
                scope.topArchetypes = infoPanelService.getTopArchetypes();
                scope.topBridgers = infoPanelService.getTopBridgers();
                scope.archsViewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.topArchetypes.length);
                scope.bridgersViewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.topBridgers.length);
            }
        });

        // Scope methods
        scope.updateNodesTitle = updateNodesTitle;
        scope.cancelNodesTitleUpdate = cancelNodesTitleUpdate;
        scope.sizeByAttrUpdate = sizeByAttrUpdate;

        scope.hoverNodes = function(nodes) {
            hoverService.hoverNodes( { ids: _.map(nodes, 'id') });
        };

        scope.unHoverNodes = function(nodes) {
            hoverService.unhover()
        };

        scope.selectNodes = function(nodes, $event) {
            hoverService.unhover();
            graphSelectionService.selectByIds(_.map(nodes, 'id') , 0);
            FilterPanelService.rememberSelection(false);
        };

        scope.viewMoreArchs = function() {
            if(scope.archsViewLimit < scope.topArchetypes.length) {
                scope.numShowArchs++;
                scope.archsViewLimit = Math.min(scope.topArchetypes.length, scope.numShowArchs * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY);
            }
        };

        scope.viewMoreBridgers = function() {
            if(scope.bridgersViewLimit < scope.topBridgers.length) {
                scope.numShowBridgers++;
                scope.bridgersViewLimit = Math.min(scope.topBridgers.length, scope.numShowBridgers * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY);
            }
        };

        scope.viewLessArchs = function() {
            if(scope.archsViewLimit > ITEMS_TO_SHOW_INITIALLY) {
                scope.numShowArchs = 0;
                scope.archsViewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.topArchetypes.length);
            }
            else { throw new Error('Less button shouldn\'t be visible if current view limit is <= ' + ITEMS_TO_SHOW_INITIALLY); }
        };

        scope.viewLessBridgers = function() {
            if(scope.bridgersViewLimit > ITEMS_TO_SHOW_INITIALLY) {
                scope.numShowArchs = 0;
                scope.archsViewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.topBridgers.length);
            }
            else { throw new Error('Less button shouldn\'t be visible if current view limit is <= ' + ITEMS_TO_SHOW_INITIALLY); }
        };


        // Core functions
        function updateNodesTitle() {
            if(!scope.vm.nodesTitle) {
                console.error(logPrefix + 'empty nodes title');
                return;
            }
            projFactory.updateProjectSettings({nodesTitle: scope.vm.nodesTitle})
            .then(function() {
                console.log(logPrefix + 'nodes title changed successfully to ' + scope.vm.nodesTitle);
                nodesTitleCopy = scope.vm.nodesTitle;
                scope.ui.editNodesTitle = false;
            }, function(err) {
                console.error(logPrefix + 'could not update nodes title');
                console.log(logPrefix, err);
                scope.vm.nodesTitle = nodesTitleCopy;
            });
        }

        function cancelNodesTitleUpdate() {
            scope.vm.nodesTitle = nodesTitleCopy;
            scope.ui.editNodesTitle = false;
        }

        function sizeByAttrUpdate(){
            console.log(logPrefix + 'sizeBy: ', scope.vm.nodeSizeAttr.id);
            scope.mapprSettings.nodeSizeAttr =  scope.vm.nodeSizeAttr.id;
        }

    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
