angular.module('common')
.directive('dirClusterBrowser', ['graphSelectionService', 'FilterPanelService',
function(graphSelectionService, FilterPanelService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        templateUrl: '#{server_prefix}#{view_path}/components/project/panels/right_panel/info_panel/clusterBrowser.html',
        scope: {
            nodeGroups: '=',
            selGroup: '=',
            selNode: '='
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        scope.selGroupIdx = _.findIndex(scope.nodeGroups, {name: scope.selGroup.name, type: scope.selGroup.type});
        scope.ui = {
            showClusterProps : false
        };

        scope.$watch('selGroup.name', function() {
            scope.selGroupIdx = _.findIndex(scope.nodeGroups, {name: scope.selGroup.name, type: scope.selGroup.type});
        });

        scope.selectGroup = function(group) {
            scope.selGroupIdx = _.findIndex(scope.nodeGroups, {name: group.name});
            scope.selGroup = group;
            graphSelectionService.selectByIds(scope.selGroup.nodeIds, 0);
            FilterPanelService.rememberSelection(false);
        };

        scope.selectPrevGroup = function() {
            var idx = _.findIndex(scope.nodeGroups, {name: scope.selGroup.name});
            if(idx === 0) { idx = scope.nodeGroups.length - 1; }
            else { idx -= 1; }
            var group = scope.nodeGroups[idx];
            scope.selectGroup(group);
        };

        scope.selectNextGroup = function() {
            var idx = _.findIndex(scope.nodeGroups, {name: scope.selGroup.name});
            if(idx === scope.nodeGroups.length - 1) { idx = 0; }
            else { idx += 1; }
            var group = scope.nodeGroups[idx];
            scope.selectGroup(group);
        };
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);