angular.module('dataIngestion')
.service('importioService', ['$http', 'projFactory',
function ($http, projFactory) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.importData = importData;

    /*************************************
    ********* Local Data *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/
    function importData(url) {
        return projFactory.currProject().then(function (proj) {
            return $http.post(buildOrgProjUrl(proj) + '/di/importio',{
                "importioUrl":url
            }).then(function(data) {
                console.log('[importIO.importData] Got %O', data);
                return data.data;
            });
        });
    }

    function buildOrgProjUrl (proj) {
        var orgId = proj.org.ref,
            projId = proj._id;
        return '/api/orgs/' + orgId + '/projects/' + projId;
    }

}
]);