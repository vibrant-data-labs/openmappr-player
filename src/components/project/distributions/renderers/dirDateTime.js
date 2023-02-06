angular.module('common')
.directive('dirDateTime', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/dateTime.html',

        scope: {
            attrType: '@',
            dateString: '@',
            timeString: '@',
            dateTimeString: '@',
            nodeColorStr: '@'
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
        var date;
        scope.dateValid = true;
        if(scope.dateString) {
            date = scope.attrType === 'timestamp' ? window.moment.unix(scope.dateString) : window.moment(new Date(scope.dateString));
            date.utc();
            scope.dateValid = date.isValid();
            scope.day = date.format('D');
            scope.month = date.format('MMMM');
            scope.year = date.format('YYYY');
        }

        if(scope.timeString) {
            //have to add a date to time to convert or returns invalid
            date = scope.attrType === 'timestamp' ? window.moment.unix(scope.timeString) : window.moment(new Date(new Date().toDateString() + ' ' + scope.timeString));
            date.utc();
            scope.dateValid = date.isValid();
            scope.time = date.format('LTS');
        }

        if(scope.dateTimeString) {
            date = scope.attrType === 'timestamp' ? window.moment.unix(scope.dateTimeString) : window.moment(new Date(scope.dateTimeString));
            date.utc();
            scope.dateValid = date.isValid();
            scope.day = date.format('D');
            scope.month = date.format('MMMM');
            scope.year = date.format('YYYY');
            scope.time = date.format('LTS');
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);