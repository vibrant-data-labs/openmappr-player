angular.module('dataIngestion')
.service('alchemyService', ['projFactory', '$q', '$http', 'dataIngestService',
function (projFactory, $q, $http, dataIngestService) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.enchanceData = enchanceData;
    this.stopTextAnalysis = stopTextAnalysis;
    this.alchemyAlgos = _.constant(['keywords', 'concepts', 'entities', 'sentiment']);

    /*************************************
    ********* Local Data *****************
    **************************************/
    var activeTaskId = null;

    /*************************************
    ********* Core Functions *************
    **************************************/

    function enchanceData(queryAttrId, selectedAlgos, relevance) {
        var defer = $q.defer();

        projFactory.currProject().then(function (proj) {
            $http.post(buildOrgProjUrl(proj) + '/di/alchemyapi',{
                queryAttrId : queryAttrId,
                selectedAlgos : selectedAlgos,
                relevance : relevance
            })
            .then(function(data) {
                console.log('[alchemyapi.enchanceData] Got %O', data);
                if(data.data && data.data.id) {
                    activeTaskId = data.data.id;
                    return dataIngestService.heartBeating(data.data.id);
                }
                else {
                    defer.reject('no task id');
                }
            })
            .then(
                function(data) {
                    defer.resolve(data.data);
                },
                function(error) {
                    defer.reject(error);
                },
                function(progress) {
                    if(progress >= 100) progress = 100;
                    defer.notify(progress);
                }
            ).finally(function() {
                activeTaskId = null;
            });
        });

        return defer.promise;
    }

    function stopTextAnalysis() {
        if(activeTaskId == null) throw new Error('No active alchemy task found.');
        return $http.delete('/api/jobs/' + activeTaskId)
        .then(function() {
            activeTaskId = null;
            return true;
        });
    }

    function buildOrgProjUrl (proj) {
        var orgId = proj.org.ref,
            projId = proj._id;
        return '/api/orgs/' + orgId + '/projects/' + projId;
    }

}
]);