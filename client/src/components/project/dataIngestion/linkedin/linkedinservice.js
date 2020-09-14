angular.module('dataIngestion')
.service('linkedinService', ['projFactory', '$http', '$q', 'dataIngestService',
function (projFactory, $http, $q, dataIngestService) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getFields = getFields;
    this.importData = importData;
    this.checkAuthValidity = checkAuthValidity;



    /*************************************
    ********* Local Data *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/
    function getFields(){

        var fields = [ 'firstName',
            'formattedName',
            'headline',
            'industry',
            'lastName',
            'location',
            'country_code',
            'numConnections',
            'numConnectionsCapped',
            'company',
            'summary',
            'title',
            'startDate',
            'publicProfileUrl',
            'pictureUrl',
            'siteStandardProfileRequest' ];
        return fields;
    }

    function importData(fieldsNeeded) {
        var defer = $q.defer();

        projFactory.currProject().then(function (proj) {
            $http.post(buildOrgProjUrl(proj) + '/di/linkedin',{
                fields:fieldsNeeded
            })
            .then(function(data) {
                console.log('[importData] Got %O', data);
                if(data.data && data.data.id) {
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
                }
            );
        });

        return defer.promise;
    }

    function checkAuthValidity() {
        return $http.get('/auth/linkedin');
    }

    function buildOrgProjUrl (proj) {
        var orgId = proj.org.ref,
            projId = proj._id;
        return '/api/orgs/' + orgId + '/projects/' + projId;
    }

}
]);