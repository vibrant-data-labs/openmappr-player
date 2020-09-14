angular.module('common')
.directive('dirNodeBrowser', ['BROADCAST_MESSAGES', 'graphSelectionService', 'FilterPanelService',
function(BROADCAST_MESSAGES, graphSelectionService, FilterPanelService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirDataBrowser',
        scope: {
            selNode: '=',
            selNodes: '=',
            selGroup: '=',
            labelAttr: '=',
            selBrowsing: '='
        },
        templateUrl: '#{server_prefix}#{view_path}/components/project/panels/right_panel/info_panel/nodeBrowser.html',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirNodeBrowser: ] ';


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, elem, attrs, parCtrl) {
        var selNodeIds = [];
        if(scope.selBrowsing) {
            selNodeIds = _.map(scope.selNodes, 'id');
        }
        else {
            selNodeIds = scope.selGroup.nodeIds;
        }

        scope.selNodeIdx = selNodeIds.indexOf(scope.selNode.id);

        scope.selectPrevNode = function() {
            if(scope.selNodeIdx === 0) {
                console.log(logPrefix + 'reached beginning of group');
                scope.selNodeIdx = selNodeIds.length;
            }
            graphSelectionService.selectByIds([selNodeIds[--scope.selNodeIdx]]);
            FilterPanelService.rememberSelection(false);
        };

        scope.selectNextNode = function() {
            if(scope.selNodeIdx === selNodeIds.length - 1) {
                console.log(logPrefix + 'reached end of group');
                scope.selNodeIdx = -1;
            }
            graphSelectionService.selectByIds([selNodeIds[++scope.selNodeIdx]]);
            FilterPanelService.rememberSelection(false);
        };
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);