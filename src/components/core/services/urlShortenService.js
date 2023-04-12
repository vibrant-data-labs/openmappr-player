/**
* URL shortener for player Urls
*/
angular.module('common')
.service('urlShortenService', ['$q', '$http', '$location', 'snapshotService', 'graphSelectionService', 'AttrInfoService', 'playerFactory',
function($q, $http, $location, snapshotService, graphSelectionService, AttrInfoService, playerFactory) {
    "use strict";
    //share service
    //  - gets current player name
    //  - gets the current snapshot
    //  - gets the current the selection context (no selection, nodes selection, cluster selection)
    //  - assembles a longURL
    //  - shortens the URL
    //  - return a urls object {url: "goog.le/abcd", longUrl: "http://staging.mappr.io"}

    /*************************************
    *************** API ******************
    **************************************/
    this.getShortUrl = getShortUrl;



    /*************************************
    ********* Local Data *****************
    **************************************/
    // var logPrefix = '[urlShortenService]';


    /*************************************
    ********* Core Functions *************
    **************************************/

    function getPlayerState() {
        return playerFactory.currPlayer(true)
        .then(function(currPlayer){
            var currSnapshot = snapshotService.getCurrentSnapshot();
            var snapshotIdx = _.findIndex(snapshotService.getSnapshotsUnsafe(), 'id', currSnapshot.id);

            // check for cluster selection
            var selNodes = graphSelectionService.getSelectedNodes();
            var cid = getClusterIds(selNodes);
            var nid = [];

            if(cid.length === 0) {
                nid = graphSelectionService.selectedNodeIds();
            } else {
                // select all nodes which don't belong in the cluster
                nid = _.reduce(selNodes, function(acc, node) {
                    if(cid.indexOf(node.attr.Cluster) < 0) {
                        acc.push(node.id);
                    }
                    return acc;
                },[]);
            }

            var playerState = {
                serverPrefix: currPlayer.settings.shareServerPrefix || $location.protocol() + '://' + $location.host() + '/play/' + currPlayer.playerUrl,
                snapNum: snapshotIdx >= 0 ? snapshotIdx + 1 : 1,
                select: {
                    nid: nid,
                    cid: cid
                },
                zoom: true
            };

            return playerState;
        });
    }

    function getClusterIds (selNodes) {
        if(selNodes.length === 0) {return [];}

        var clusterGrps = _.groupBy(selNodes,'attr.Cluster');
        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId('Cluster');
        // check if num of nodes in each grp is == total num of nodes in cluster
        var cid = _.reduce(_.keys(clusterGrps), function(acc, clusterId) {
            if(attrInfo.valuesCount[clusterId] === clusterGrps[clusterId].length) {
                acc.push(clusterId);
            }
            return acc;
        }, []);
        return cid;
    }

    function buildPlayerUrl(ps) {
        //base
        var urlLong = ps.serverPrefix;

        //snapnum
        if (!_.isUndefined(ps.snapNum)) urlLong += 'snapnum=' + ps.snapNum;

        //zoom
        if (ps.zoom) urlLong += '&zoom=true';

        //nids
        if (ps.select.nid && ps.select.nid.length > 0) {
            var nidString = '&nids=' + encodeURIComponent(ps.select.nid.join('+'));
            urlLong += nidString;
        }

        //cids
        if (ps.select.cid && ps.select.cid.length > 0) {
            var cidString = '&cids=' + encodeURIComponent(ps.select.cid.join('+'));
            urlLong += cidString;
        }

        return urlLong;
    }

    function requestShortURL(url) {
        return $http.post('/api/shorten_url', {longUrl:url}).then(
            function(urlData) {
                //console.log(logPrefix, urlData);
                return urlData.data.url;
            },
            function() {
                //console.log(logPrefix + ' Got error : %O', error);
                return url; //hack for now. works in node_5 branch
                //return $q.reject('urlShortening Failed');
            }
        );
    }

    function getShortUrl(url) {
        if(url){
            return requestShortURL(url);
        } else {
            return getPlayerState().then(function(ps){
                return requestShortURL(buildPlayerUrl(ps));
            });
        }
    }
}
]);
