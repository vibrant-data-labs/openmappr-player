angular.module('common')
.directive('dirTwitterFeed', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        template: '<div class="twitter-grid">'+
                  '<a class="twitter-timeline" data-theme="{{theme}}" data-link-color="#0099ff" data-chrome="noheader nofooter noborders noscrollbar transparent" data-tweet-limit="3" data-show-replies="false" data-screen-name="{{handle}}" href="https://twitter.com/{{handle}}" target="_blank">Tweets by @{{handle}}</a>'+
                  '<script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>'+
                  '</div>',
        scope: {
            handle: '@',
            theme: '='
        }
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


    /*************************************
    ************ Local Functions *********
    **************************************/




    return dirDefn;
}
]);
