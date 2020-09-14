angular.module('player')
.directive('dirSocialShare', ['$rootScope', 'BROADCAST_MESSAGES', '$location', '$window', 'urlShortenService', 'Analytics', function ($rootScope, BROADCAST_MESSAGES, $location, $window, urlShortenService, Analytics) {
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
    function postLinkFn(scope, elem, attrs) {
        elem.addClass('td-easy-social-share');

        // var sites = ['twitter', 'facebook', 'linkedin', 'google-plus'],
        var requestSite = attrs.dirSocialShare.toLowerCase(),
            shareLink,
            pageLink = $location.absUrl(),
            pageTitle = attrs.shareTitle, //comes from player.settings.shareTitle
            pageTitleUri = encodeURIComponent(pageTitle),
            square = '',
            isCompareOverlayOpen = false,
            poppedUpWindow;

        //Compare overlay requires special treatment
        $rootScope.$on(BROADCAST_MESSAGES.extUserOverlay.open, function() {
            isCompareOverlayOpen = true;
        });

        $rootScope.$on(BROADCAST_MESSAGES.extUserOverlay.close, function() {
            isCompareOverlayOpen = false;
        });

        function constructLink() {
            pageLink = isCompareOverlayOpen || attrs.isCompare ? pageLink : null;

            //URL Shortening : pass pageLink=null if you want urlShortenService to build url from playerState
            urlShortenService.getShortUrl(pageLink)
            .then(function(shortUrl){
                return {network: requestSite, pageLinkUpdated: shortUrl};
            }, function(err) {
                console.log(logPrefix + 'urlShortening failed - returning longUrl.', err);
                return {network: requestSite, pageLinkUpdated: pageLink};
            })
            .then(function(data){
                shareLink = getSiteShareUrl(requestSite.trim(), encodeURIComponent(data.pageLinkUpdated), pageTitleUri);
                console.log('constructing Link: ', shareLink);
                poppedUpWindow.location = shareLink;
                console.log(logPrefix, shareLink);
                //TODO: don't popup window if mobile
            });
        }

        var anchor = '';
        anchor += '<i'; //pagelink is raw location url at this point
        anchor += ' class="fa fa-fw fa-'+ requestSite + square + '"';
        anchor += '></i>';
        $(anchor).appendTo(elem).on('click', function(e) {
            e.preventDefault();
            poppedUpWindow = popupWindow('', pageTitle, 600, 400);
            constructLink();
            Analytics.trackEvent('share', attrs.dirSocialShare);
        });
    }



    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirSocialShare] ';


    /*************************************
    ************ Local Functions *********
    **************************************/
    function popupWindow(url, title, w, h) {
        var left = (screen.width/2)-(w/2);
        var top = (screen.height/2)-(h/2);
        return $window.open(url, title, 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width='+w+', height='+h+', top='+top+', left='+left);
    }

    function getSiteShareUrl(site, pageLink, pageTitleUri){
        switch (site) {
        case 'twitter':
            return 'http://twitter.com/intent/tweet?text=' + pageTitleUri + '%20' + pageLink;
        case 'facebook':
            return 'http://facebook.com/sharer.php?u=' + pageLink;
        case 'linkedin':
            return 'http://www.linkedin.com/shareArticle?mini=true&url=' + pageLink + '&title=' + pageTitleUri;
        case 'google-plus':
            return 'https://plus.google.com/share?url=' + pageLink;
        default: return false;
        }
    }


    return dirDefn;
}
]);