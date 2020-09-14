angular.module('mappr')
.directive('dirDataSourcePhase', ['phaseService',
function(phaseService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        templateUrl: '#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/phase_data_source.html',
        scope: {
            phasevm: '=',
            recipevm: '='
        },
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        phaseService.setPhaseWatches(scope);

        scope.$watch('phasevm.uploads.length', function(numUploads) {
            if(numUploads > 0) { init(); }
        });

        init();

        function init () {
            var phasevm = scope.phasevm,
                cfg = phasevm.cfg;

            scope.inProgress = !!scope.recipevm.exec_started;
            scope.run_begin = !!scope.phasevm.run_begin;
            scope.run_finished = !!scope.phasevm.run_finished;
            scope.run_failed = !!scope.phasevm.run_failed;
            scope.finalCompletion = scope.phasevm.finalCompletion || 0;
            scope.sourceInfos = [];

            if(_.isArray(cfg.srcUrl)) {
                scope.srcUrls = cfg.srcUrl;
            } else {
                scope.srcUrls = [cfg.srcUrl];
            }

            if(cfg.srcType == 'uploadedData') {
                scope.sourceInfos = _.map(phasevm.uploads, function(uploadData) {
                    return _.extend({}, uploadData.sourceInfo, {
                        uploadId : uploadData.uploadId,
                        numColumns : uploadData.columns.length,
                        numNodes : uploadData.nodesInfo.length
                    });
                });
            }
        }
    }

    return dirDefn;
}]);