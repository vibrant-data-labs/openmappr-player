angular.module('dataIngestion')
.service('alchemyNewsService', ['projFactory', '$http', 'dataIngestService',
function (projFactory, $http, dataIngestService) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.runQuery = runQuery;

    /*************************************
    ********* Local Data *****************
    **************************************/
    var activeTaskId = null;

    /*************************************
    ********* Core Functions *************
    **************************************/
    function runQuery(postObj) {
        var proj = projFactory.currProjectUnsafe();
        return $http.post(buildOrgProjUrl(proj) + '/di/alchemynews', {options: postObj})
        .then(function(data) {
            console.log('[alchemynewsapi.runQuery] Got %O', data);
            if(data.data && data.data.id) {
                activeTaskId = data.data.id;
                return dataIngestService.heartBeating(activeTaskId);
            }
            else {
                throw new Error('Task Id not received.');
            }
        }).finally(function() {
            activeTaskId = null;
        });
    }

    function buildOrgProjUrl (proj) {
        var orgId = proj.org.ref,
            projId = proj._id;
        return '/api/orgs/' + orgId + '/projects/' + projId;
    }

}
]);