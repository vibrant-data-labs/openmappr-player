/**
* Provides APIs to handle XHR operations
*/
angular.module('common')
.service('extAPIService',['$http', '$q',
function ($http, $q) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getData = getData;
    this.postData = postData;
    this.processInQueue = processInQueue;


    /*************************************
    ********* Core Functions *************
    **************************************/
    function getData(host, resource) {
        var url = host + resource;
        console.log('GET', url);
        return $http.get(url);
    }

    function postData(host, resource){
        var url = host + resource;
        // var postData = data || {};
        console.log('[extAPIService.POST]', url);
        return $http.post(url)
            .then(function(result){
                // console.log('[extAPIService.result]');
                // console.log(result);
                return result.data;
            });
    }

    function processInQueue(func) {
        if(typeof func !== 'function') { throw new TypeError('argument not function'); }
        // var active = false;
        var requestQueue = [];

        function runNext() {
            var task = requestQueue[0];
            console.log('Firing request: ', Date.now());
            func.apply(task.context, task.args)
            .then(function(data) {
                task.p.resolve(data);
            }, function(err) {
                task.p.reject(err);
            }).finally(function() {
                requestQueue.shift();
                if(requestQueue.length > 0) {
                    runNext();
                }
            });
        }

        return function() {
            var defer = $q.defer();

            requestQueue.push({args: arguments, p: defer, context: this});
            if(requestQueue.length === 1) {
                runNext();
            }
            return defer.promise;
        };
    }
}
]);
