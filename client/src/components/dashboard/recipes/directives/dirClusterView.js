angular.module('mappr')
.directive('dirClusterView', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        templateUrl: '#{server_prefix}#{view_path}/components/dashboard/recipes/clusterView.html',
        scope: {
            clusters: '=',
            totalNodesCount: '='
        },
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        scope.showCount = 5;
        scope.clustersViewData = _.cloneDeep(scope.clusters).sort(function(a, b) { return b.numNodes - a.numNodes; });
        scope.clustersViewData = _.map(scope.clustersViewData, function(cluster) {
            cluster.nodesPerc = (cluster.numNodes*100/scope.totalNodesCount).toFixed(2);
            return cluster;
        });

        scope.loadMore = function() {
            if(scope.clustersViewData.length > scope.showCount) {
                scope.showCount += 5;
            }
        };
    }

    return dirDefn;
}]);