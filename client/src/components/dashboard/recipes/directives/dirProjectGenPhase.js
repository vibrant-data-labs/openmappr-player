angular.module('mappr')
.directive('dirProjectGenPhase', ['phaseService',
function(phaseService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        templateUrl: '#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/phase_project_gen.html',
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

        scope.$watch('phasevm', function(phasevm) {
            if(phasevm) { init(); }
        });

        init();

        function init () {
            scope.inProgress = !!scope.recipevm.exec_started;
            scope.run_begin = !!scope.phasevm.run_begin;
            scope.run_finished = !!scope.phasevm.run_finished;
            scope.run_failed = !!scope.phasevm.run_failed;
            scope.finalCompletion = scope.phasevm.finalCompletion || 0;
        }
    }

    return dirDefn;
}]);