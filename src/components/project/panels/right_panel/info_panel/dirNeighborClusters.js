angular.module('common')
.directive('dirNeighborClusters', ['graphSelectionService', 'FilterPanelService', 'hoverService',
function(graphSelectionService, FilterPanelService, hoverService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        templateUrl: '#{player_prefix_index}/components/project/panels/right_panel/info_panel/neighborClusters.html',
        scope: {
            selGroup: '=',
            nodeGroups: '='
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
        scope.$watch('selGroup', function(group) {
            scope.neighborGroups = _.map(group.neighborGroups, function(nbrGrp) {
                return _.find(scope.nodeGroups, 'name', nbrGrp);
            });
        });

        scope.selectGroup = function(group) {
            graphSelectionService.selectByIds(group.nodeIds);
            FilterPanelService.rememberSelection(false);
        };

        scope.hoverGroup = function(group, $event) {
            hoverService.hoverNodes({ ids: group.nodeIds });
        };

        scope.unHoverGroup = function(group, $event) {
            hoverService.unhover()
        };
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);