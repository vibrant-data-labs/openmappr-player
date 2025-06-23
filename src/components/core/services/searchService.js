/**
* Used to search nodes on whole dataset or some selected attributes
*/
angular.module('common')
.service('searchService', ['$q', '$http', 'dataGraph',
function($q, $http, dataGraph) {
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

        // FUZZY SORT
        var allNodes = dataGraph.getAllNodes();

        if (typeof Worker === 'function') {
            if (this._activeSearch) {
                this._searchReject();
                this._activeSearch.terminate();
                this._activeSearch = undefined;
            }

            if (!this._activeSearch) {
                const host = '#{player_prefix_index_source}' || window.location.href.replace(/\/[^\/]*$/, '');
                const url = host + '/js/worker/searchWorker.js';
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
                searchResolve(e.data);
            };

            this._activeSearch.onerror = (e) => {
                console.error(logPrefix + 'searchWorker error: ', e);
                this._searchReject(e);
            };

            return result;
        }

        return new Promise(resolve => {
            var data = matchSorter(allNodes, text, {
                keys: filterAttrIds.map(r => 'attr.' + r),
                threshold: 3});

                
            resolve(data.map(r => ({
                _source: {
                    id: r.id,
                },
                highlight: _.reduce(filterAttrIds, (acc, cv) => { acc.cv = ''; return acc; } , {})
            })));
        });
    }

}
]);