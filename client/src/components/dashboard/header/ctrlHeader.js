angular.module('mappr')
.controller('HeaderCtrl', ['$scope', '$rootScope', '$document', '$uibModal', '$log', 'mappToSurveyService',
function($scope, $rootScope, $document, $uibModal, $log, mappToSurveyService) {

    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var projectListDropdownOpen = false;
    var detachSigmaClickNodeProjFn;
    var detachSigmaClickStageProjFn;


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope variables
    */

    /**
    * Scope methods
    */
    $scope.handleProjectDropdownToggle = handleProjectDropdownToggle;
    $scope.openRenderSurveyModal = openRenderSurveyModal;

    // Mapp To Survey
    $scope.renderSurvey = function() {
        mappToSurveyService.renderSurvey();
    };

    /*************************************
    ********* Event Listeners ************
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    /* Project List Dropdown
     * Handle toggle for sigma events
    */
    function handleProjectDropdownToggle($event) {
        $event.stopPropagation();
        if(!projectListDropdownOpen) {
            console.log('[CtrlApp]: Attaching listeners for projectlist dropdown');
            $('#projectListDropdown').toggle();
            $document.on('click', digestClickProjectDropdown);
            detachSigmaClickStageProjFn = $scope.$on('sigma.clickStage', documentClickProjectDropdown);
            detachSigmaClickNodeProjFn = $scope.$on('sigma.clickNode', documentClickProjectDropdown);
            projectListDropdownOpen = true;
        }
        else {
            documentClickProjectDropdown();
        }

    }

    function digestClickProjectDropdown(event) {
        $scope.$apply(function() {
            event.stopPropagation();
            documentClickProjectDropdown();
        });
    }

    function documentClickProjectDropdown() {
        $('#projectListDropdown').toggle();
        projectListDropdownOpen = false;
        console.log('[CtrlApp]: Removing listeners for projectlist dropdown');
        $document.off('click', digestClickProjectDropdown);
        angular.isFunction(detachSigmaClickNodeProjFn) && detachSigmaClickNodeProjFn();
        angular.isFunction(detachSigmaClickStageProjFn) && detachSigmaClickStageProjFn();
    }

    /*
    / Survey Generator
    /
    */

    //modal for rendering a survey
    function openRenderSurveyModal() {
        var modalInstance = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/partials/project/renderSurveyModal.html",
            controller: 'renderSurveyModalCtrl',
            size: 'lg'
        });
        modalInstance.result.then(function(renderParams) {
            mappToSurveyService.renderSurvey(renderParams);
        }, function() {
            $log.warn("Modal dismissed at: " + new Date());
        });
    }

}
]);
