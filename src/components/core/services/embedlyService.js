/**
 * Created by moran on 12/06/14.
 * Customized to deal with embedly's dislike of commas in urls (which google maps uses)
 */

angular.module('common')
.service('embedlyService', ['$http', '$q',
function ($http, $q) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.embed = embed;
    this.extract = extract;
    this.cancel = cancel;


    /*************************************
    ********* Local Data *****************
    **************************************/
    //move to config
    var key = 'e87bb926d6d844c4aa9e3687af17effa';
    var secure = true;
    var canceler = $q.defer();



    /*************************************
    ********* Core Functions *************
    **************************************/
    function getProtocol() {
        return secure ? 'https' : 'https' ;
    }

    function embed(inputUrl, maxwidth, autoplay, scheme) {
        var escapedUrl = encodeURI(inputUrl);
        //embedly dislikes commas in urls
        escapedUrl = escapedUrl.replace(/\,/g,'%2C');

        var embedlyRequest = getProtocol() + '://api.embed.ly/1/oembed?key=' + key + '&url=' +  escapedUrl;

        if(typeof maxwidth !== 'undefined'){
            embedlyRequest = embedlyRequest + '&maxwidth=' + maxwidth;
        }

        if(typeof autoplay !== 'undefined'){
            embedlyRequest = embedlyRequest + '&autoplay=' + autoplay;
        }

        if(typeof scheme !== 'undefined'){
            embedlyRequest = embedlyRequest + '&scheme=' + scheme;
        }

        //

        return $http({method: 'GET', url: embedlyRequest, timeout: canceler.promise});
    }

    function extract(inputUrl) {
        var escapedUrl = encodeURI(inputUrl);
        var embedlyRequest = getProtocol + '://api.embed.ly/1/extract?key=' + key + '&url=' +  escapedUrl;
        return $http({method: 'GET', url: embedlyRequest});
    }

    function cancel() {
        console.log('canceling embedly');
        canceler.resolve();
    }

}
]);
