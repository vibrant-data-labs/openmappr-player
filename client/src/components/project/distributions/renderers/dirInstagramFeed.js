angular.module('common')
.directive('dirInstagramFeed', ['$sce', '$timeout', '$http',
function($sce, $timeout, $http) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        // template: '<div class="instagram-feed">'+
        //        '<div class="pic" ng-repeat="pic in instagramPics">'+
        //        '<div ng-bind-html="pic.embedSafe"></div>'+
        //        '</div>'+
        //        '</div>',
        templateUrl: '#{server_prefix}#{view_path}/components/project/distributions/renderers/instagramFeed.html',
        scope: {
            handle: '@',
            search: '@'
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "dirInstagramFeed: ";


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, elem, attrs) {
        scope.instagramPics = null;
        scope.instagramError = '';



        //seems like this has to be within compile or multiple instances
        //of this directive break things.

        //
        //INSTAGRAM
        //a bit more complicated than I would like
        //first get a user's images (20 at a time), then filter by the hashtag. Then if there are less than 5,
        //keep getting user images and filter by hashtag until you've gotten 100 (5 pages) or 5 tagged images
        //then take those filtered images and call instagram's oembed endpoint to get the embed code for each image


        var instagramClientId = '';
        //got it from using oauth on my own instagram account
        var instagramAccessToken = '';
        //to keep track of pagination

        //instagram only grabs 20 images at once, so go through 100 at most to find 5 with tag
        var totInstagramPages = 5;
        var curInstagramPage = 0;
        var instagramPics = [];

        function getInstagramFeed(user, hash, callback) {
            //get user's id
            $http.jsonp('https://api.instagram.com/v1/users/search?q=' + user + '&access_token=' + instagramAccessToken + '&callback=JSON_CALLBACK')
            .then(function(response) {
                var userId = _.get(response, 'data.data[0].id');
                if(!userId) {
                    $timeout(function() {
                        scope.instagramError = "&lsquo;" + user + "&rsquo; doesn&rsquo;t seem to be an Instagram user."
                    });
                    return console.warn(logPrefix + 'response doesn\'t have userId');
                }

                //get recent feed and continue looping until get 5 filtered images or go through 100 images,
                //whichever is first
                var callback2 = function(pics, next_max_id, next_url) {
                    //if have 5 or more, then return, else go get more
                    instagramPics = instagramPics.concat(pics);
                    if(instagramPics.length >= 5 || curInstagramPage >= totInstagramPages) {
                        //TODO: change for pagination
                        instagramPics.length = 5;
                        //go get oembed settings for instagram
                        getInstagramEmbeds(function() {
                            callback(instagramPics);
                        });
                    } else {
                        if(next_url) {
                            getInstagramPage(next_url, callback2, hash);
                        } else {
                            //go get oembed settings for instagram
                            getInstagramEmbeds(function() {
                                callback(instagramPics);
                            });
                        }
                    }
                };
                var url = 'https://api.instagram.com/v1/users/' + userId + '/media/recent?access_token=' + instagramAccessToken;
                getInstagramPage(url, callback2, hash);
            });
        }

        //get oembed code for embedding
        function getInstagramEmbeds(callback) {
            var ind = 0;
            var getEmbed = function(pic) {
                if(ind >= instagramPics.length) {
                    callback();
                } else {
                    if(pic.embed) {
                        ind++;
                        getEmbed(instagramPics[ind]);
                    } else {
                        var link = pic.link.replace('instagram.com', 'instagr.am');
                        //fuck me. instagram's oembed indopoint doesn't accept callbacks from jsonp with dot notation in them which is what angular does
                        //https://github.com/angular/angular.js/issues/1551
                        //so jquery it is
                        //- instagram's js doesn't seem to have a call to initialize so not using omitscript
                        $.getJSON('https://api.instagram.com/oembed?callback=?&beta=true&url='+encodeURIComponent(link))
                        .done(function(response) {
                            pic.embed = response.html;
                            ind++;
                            getEmbed(instagramPics[ind]);
                        });
                        // $http.jsonp('http://api.instagram.com/oembed?url='+link + '&callback=JSON_CALLBACK')
                        // .then(function(response) {
                        // })
                    }
                }

            };

            getEmbed(instagramPics[ind]);
        }

        //get a list of 20 of user's instagrams filtered by a possible hash tag
        function getInstagramPage(url, callback, hash) {
            $http.jsonp(url + '&callback=JSON_CALLBACK')
                .then(function(response) {
                    curInstagramPage++;
                    //filter response with hash if one
                    if(hash) {
                        var pics =  _.filter(response.data.data, function(pic) {
                            var upTags = pic.tags.map(function(value) {
                                return value.toUpperCase();
                            });
                            if(upTags.indexOf(hash.toUpperCase()) !== -1) {
                                return true;
                            }
                        });
                        if(response.data.pagination) {
                            callback(pics, response.data.pagination.next_max_id, response.data.pagination.next_url);
                        } else {
                            callback(pics);
                        }
                    } else {

                        callback(response.data.data, response.data.pagination.next_max_id, response.data.pagination.next_url);
                    }
                });
        }




        //initialize

        //remove any url added to instagram handle if one
        if(attrs.handle.indexOf('/') !== -1) {
            var ar = attrs.handle.split('/');
            attrs.handle = ar[ar.length - 1] && ar[ar.length - 1].indexOf('?') !== 0 ? ar[ar.length - 1] : ar[ar.length - 2];
        }


        //get instagram
        getInstagramFeed(attrs.handle, attrs.search, function(data) {
            scope.instagramPics = _.cloneDeep(data);
            $timeout(function() {
                for (var i = scope.instagramPics.length - 1; i >= 0; i--) {
                    scope.instagramPics[i].embedSafe = $sce.trustAsHtml(scope.instagramPics[i].embed);
                }
                //needed for rendering
                $timeout(function() {
                    if(window.instgrm) {
                        window.instgrm.Embeds.process();
                    }
                });
            });
        });
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
