angular.module('dataIngestion')
.service('dataIngestService', ['$q', '$http', 'projFactory',
function($q, $http, projFactory) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.genLatLong = genLatLong;
    this.genLinkedinUrl = genLinkedinUrl;
    this.heartBeating = heartBeating;
    this.generateMap = generateMap;
    this.lazyLoadScript = lazyLoadScript;

    /*************************************
    ********* Local Data *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/


    function buildOrgProjVerUrl (proj) {
        var orgId = proj.org.ref,
            projId = proj._id,
            versionId = projFactory.getCurrVersion() || 0;
        return '/api/orgs/' + orgId + '/projects/' + projId + '/versions/' + versionId;
    }

    function genLatLong (nodeAttrId) {
        if(!nodeAttrId) {
            console.warn("[dataIngestService.genLatLong] No nodeAttrId given");
            return;
        }
        projFactory.currProject().then(function (proj) {

            $http.post(buildOrgProjVerUrl(proj) + '/di/location', {
                nodeAttrId : nodeAttrId
            }).success(function postGenLatLong(data) {
                console.log('[dataIngestService.genLatLong] Success! data : %O', data);
            }).error(function(data, status) {
                console.log('[dataIngestService.genLatLong]Error in executing. data : %O, status : %s', data, status);
            });
        });
    }

    function genLinkedinUrl () {
        var defer = $q.defer;
        projFactory.currProject().then(function (proj) {
            var url = buildOrgProjVerUrl(proj) + '/di/linkedin';
            defer.resolve(url);
        });
        return defer.promise;
    }

    function heartBeating(id) {
        var defer = $q.defer();

        //var beatingInterval = window.setInterval(checkBeat, 5000);

        var taskChannel = window.io.connect(window.location.origin + "/" + id);
        // var taskChannel = io.connect();
        console.log("[diService.ChannelCreated]", taskChannel);
        taskChannel.on('connect', function() {
            console.log('[diService.Channel]' + 'Connected IO successfully');
        });
        taskChannel.on('connect_error', function(err) {
            console.error('[diService.Channel]' + 'Failed to connect', err);
        });
        taskChannel.on(id, function(data) {
            var result = data;
            console.log("[diService.Channel.GotData]", data);
            if(result) {
                if(result.status === 'completed') {
                    defer.resolve(result.result);
                }
                else if(result.status === 'failed' || result.status === 'cancelled'){
                    defer.reject(data);
                }
                else if((result.status === 'running' || result.status === 'notification') && result.completion) {

                    // defer.notify(result.completion);
                    defer.notify(result);
                }
            }
        });
        taskChannel.on("update", function(data) {
            console.warn("[diService.Channel.GotJUNKData]", data);
        });

        return defer.promise;
    }

    function generateMap(obj) {
        var url = '/api/orgs/' + obj.urlParams[0] + '/projects/' + obj.urlParams[1] + '/dataset/data',
            defer = $q.defer();

        $http.post(url, obj.uData)
        .then(
            function(data) {
                console.log(data);
                defer.resolve(data.data);
            },
            function(error) {
                switch(error.status) {
                case 404:
                    defer.reject('Something terrible happened, please try later.');
                    break;
                default:
                    defer.reject(error.data);
                }
            }
        );

        return defer.promise;
    }

    function lazyLoadScript(url) {
        var defer = $q.defer(),
            scr = document.createElement('script'),
            loaded = false;

        scr.onload = handleLoad;
        scr.onreadystatechange = handleReadyState;
        scr.onerror = handleError;
        document.body.appendChild(scr);
        scr.src = url;

        function handleLoad() {
            if(!loaded) {
                loaded = true;
                defer.resolve();
            }
        }

        function handleReadyState() {
            !loaded && scr.readyState === 'complete' && handleLoad();
        }

        function handleError() {
            if(!loaded) {
                loaded = true;
                defer.reject();
            }
        }

        return defer.promise;
    }

}
]);