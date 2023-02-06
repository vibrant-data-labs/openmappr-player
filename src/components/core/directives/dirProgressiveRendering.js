/**
* Starts Rendering of UI components in a sequential manner with a timegap for each render
* Useful when a component has several subcomponents all of which take a substantial amount of time to load.
* Eg. If a component has 3 subcomponents(C1, C2, C3), this utility will help in rendering C1 1st,
* then will start rendering C2 in the next digest after a specified time delay and so on
*/
// USAGE:
// - <elem progressive-render="", processesCount="x", renderGap="y"></elem>
// - <elem ng-if="renderProcesses.processZ.shouldLoad"></elem>
//- 'Z' should be set prioroty wise
angular.module('common')
.directive('progressiveRender', ['$timeout',
function($timeout) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, elem, attrs) {
        var processes = {};
        var processesCount = parseInt(attrs.renderProcesses, 10); //Total processes which need to be rendered
        var renderGap = parseInt(attrs.renderGap, 10); //Time gap between each render

        //Insert processes and initialize each process with shouldLoad 'false'
        for(var i = 1; i <= processesCount; i++) {
            processes['process' + i] = {shouldLoad: false};
        }

        //Assign processes to scope
        scope.renderProcesses = processes;

        //Start rendering all processes
        startRendering(1);

        function startRendering(processId) {
            if(processId === 1) {
                render();
            }
            else {
                $timeout(render, renderGap);
            }

            function render() {
                if(scope.renderProcesses['process' + processId]) {
                    scope.renderProcesses['process' + processId].shouldLoad = true;
                }

                if(processId++ !== processesCount) {
                    startRendering(processId);
                }
            }
        }
    }


    return dirDefn;
}
]);