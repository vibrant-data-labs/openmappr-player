angular.module('mappr')
.directive('dirSliderInput', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        template: '<input class="slider-text form-control" type="text" ng-model="ngModel" dir-select-all/><div class="slider-holder"><div class="slider" ui-slider min="{{opt.min}}" max="{{opt.max}}" step="0.1" use-decimals="" ng-model="ngModel"></div></div>',
        scope: {
            ngModel: '=',
            opt: '='
        },
        require:'ngModel',
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {
        var $handle = element.find('.ui-slider-handle');
        $handle.on('');
    }

    return dirDefn;
}
]);