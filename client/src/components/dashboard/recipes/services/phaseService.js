angular.module('mappr')
.service('phaseService', [function() {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.setPhaseWatches = setPhaseWatches;

    /*************************************
    ********* Local Data *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function setPhaseWatches(scope) {
        scope.$watch('recipevm.exec_started', function(val) {
            scope.inProgress = !!val;
        });
        scope.$watch('phasevm.run_begin', function(val) {
            console.log("Phase: " + scope.phasevm.phase_type + " started?: " + val);
            scope.run_begin = !!val;
        });
        scope.$watch('phasevm.run_finished', function(val) {
            console.log("Phase: " + scope.phasevm.phase_type + " ended?: " + val);
            scope.run_finished = !!val;
        });

        scope.$watch('phasevm.run_failed', function(val) {
            scope.run_failed = !!val;
            if(scope.run_failed) {
                console.log("Phase: " + scope.phasevm.phase_type + " failed");
            }
        });

        scope.$watch('phasevm.finalCompletion', function(val) {
            if(val > 0) { scope.finalCompletion = val; }
        });

    }
}
]);