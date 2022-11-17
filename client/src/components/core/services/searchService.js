/**
* Used to search nodes on whole dataset or some selected attributes
*/
angular.module('common')
.service('searchService', ['$q', '$http', 'dataGraph', 'cfpLoadingBar',
function($q, $http, dataGraph, cfpLoadingBar) {
    "use strict";


    /*************************************
    *************** API ******************
    **************************************/
    this.searchNodes = searchNodes;
    this._workerUrl = '';
    this._activeSearch = undefined;
    this._searchReject = undefined;


    /*************************************
    ********* Local Data *****************
    **************************************/
    var logPrefix = '[searchService: ] ';


    /*************************************
    ********* Core Functions *************
    **************************************/

    function searchNodes(text, dataSetRef, filterAttrIds, searchAlg){
        
        if(!filterAttrIds) {
            console.warn(logPrefix + 'filter attr Ids not passed, using empty arr');
            filterAttrIds = [];
        }
        if(!_.isArray(filterAttrIds)) {
            throw new Error('Array expected for attr Ids');
        }
        
        if (!searchAlg) {
            searchAlg = 'naive';
        }

        var start = performance.now();
        cfpLoadingBar.start();

        // FUZZY SORT
        var allNodes = dataGraph.getAllNodes();

        // NAIVE SEARCH
        if (searchAlg === 'matchSorter') {
            if (typeof Worker === 'function') {
                if (this._activeSearch) {
                    this._searchReject();
                    this._activeSearch.terminate();
                    this._activeSearch = undefined;
                }

                if (!this._activeSearch) {
                    const url ='#{player_prefix_index_source}/js/worker/searchWorker.js';
                    const content = `importScripts( "${ url }" );`;
                    this._workerUrl = URL.createObjectURL( new Blob( [ content ], { type: "text/javascript" } ) );
                    this._activeSearch = new Worker(this._workerUrl);
                }

                this._activeSearch.postMessage([allNodes, filterAttrIds, text]);

                var searchResolve = null;
                var result = new Promise((resolve, reject) => {
                    searchResolve = resolve;
                    this._searchReject = reject;
                });

                this._activeSearch.onmessage = (e) => {
                    var end = performance.now();
                    console.log('Search took ' + (end - start) + ' ms');
                    cfpLoadingBar.complete();
                    searchResolve(e.data);
                };

                return result;
            }

            return new Promise(resolve => {
                var data = matchSorter(allNodes, text, {
                    keys: filterAttrIds.map(r => 'attr.' + r),
                    threshold: 3});

                    
                cfpLoadingBar.complete();
                resolve(data.map(r => ({
                    _source: {
                        id: r.id,
                    },
                    highlight: _.reduce(filterAttrIds, (acc, cv) => { acc.cv = ''; return acc; } , {})
                })));
            });
        }

        if (searchAlg === 'substring') {
            var idx = 0;
            return new Promise(resolve => {
                var data = _.reduce(allNodes, function (acc, cv) {
                    cfpLoadingBar.set(idx / allNodes.length);
                    var hitsData = _.reduce(filterAttrIds, function (attrAcc, attrCv) {
                        if (cv.attr[attrCv]) {
                            var sourceTxt = cv.attr[attrCv].toString().toLowerCase();
                            var searchTxt = text.toLowerCase();
                            if (cv.attr[attrCv] && _.contains(sourceTxt, searchTxt)) {
                                var sourceArr = sourceTxt.split(' ');
                                var index = _.findIndex(sourceArr, x => _.contains(x, searchTxt));
                                var highlightPart = sourceArr.slice(index > 5 ? index - 5 : 0, index + 6);
                                attrAcc[attrCv] = highlightPart.map(x => 
                                        _.contains(x, searchTxt) ? '<i>' + x + '</i>' : x
                                    ).join(attrCv === 'Keywords' ? ', ' : ' ');
                            }
                        }

                        return attrAcc;
                    }, {});

                    idx++;
                    if (!Object.keys(hitsData).length) return acc;

                    acc.push({
                        _source: {
                            id: cv.id,
                        },
                        highlight: {
                            ...hitsData,
                        }
                    });

                    return acc;
                }, []);

                cfpLoadingBar.complete();
                resolve(data);
            });
        }

        if (searchAlg == 'fuzzy') {
            return new Promise(resolve => {
                var hits = fuzzysort.go(text, allNodes, {
                    keys: filterAttrIds,
                    threshold: -100,
                    nodes: true,
                    allowTypo: true
                });

                var data = _.map(hits, function (n) {
                    var highlights = _.reduce(n, function (acc, cv, i) {
                        if (!cv) return acc;
                        if (cv.score < -100) return acc;

                        acc[filterAttrIds[i]] = fuzzysort.highlight(cv, '<i>', '</i>');

                        return acc;
                    }, {});

                    return {
                        _source: {
                            id: n.obj.id
                        },
                        highlight: highlights
                    };
                })

                cfpLoadingBar.complete();
                resolve(data);
            });
        }

        return $http.post('/api/elasticsearch/search_nodes', {
            dataSetId : dataSetRef,
            query : text,
            filterAttrIds: filterAttrIds
        }).then(
            function(data) {
                console.log("[searchService] Got data : %O",data);
                var hits = data.data.hits || [];
                var ids = _.map(hits, function(sn) {return sn._source.id;});
                if(ids && ids.length > 0) {
                    // graphSelectionService.selectByDataPointIds(ids,0);
                    return hits;
                }
                else {
                    console.log("[searchService] Found nothing");
                    // graphSelectionService.clearSelections(true);
                    return $q.reject('noMatch');
                }
            },
            function(error) {
                console.log("[searchService] Got error: %O",error);
                return $q.reject('searchFailed');
            }
        );

    }

}
]);