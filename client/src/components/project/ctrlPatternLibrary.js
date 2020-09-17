angular.module('common')
.controller('PatternLibraryCtrl',['$scope',
function ($scope) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    //THEMING
    $scope.otherTheme = 'light';

    //SLIDER INPUT
    $scope.sliderModel = 5;
    $scope.sliderOpts = {
        min: 0,
        max: 10,
        step: 1
    };

    $scope.dropdownFilterTitle = "Filter Dropdown";

    $scope.dropdownFilterValues = [
        {
            icon: 'fa fa-file',
            title: 'File'
        },
        {
            icon: 'fa fa-image',
            title: 'Image'
        },
        {
            icon: 'fa fa-gift',
            title: 'Gift'
        }
    ];

    //MODALS
    $scope.modalTab = 'one';
    $scope.modalSideTab = 'one';
    $scope.showMetaList = false;

    //RIGHT PANEL
    $scope.panelOpen = 1;
    $scope.rightPanelListItems = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];



    /**
    * Scope methods
    */
    $scope.toggleTheme = function() {
        if($scope.appUi.theme == 'dark') {
            $scope.appUi.theme = 'light';
            $scope.otherTheme = 'dark';
        }
        else {
            $scope.appUi.theme = 'dark';
            $scope.otherTheme = 'light';
        }
    };

    $scope.onDropdownFilterChange = function(val) {
        console.log('filter dropdown changed: ', val);
    };

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

}
]);
