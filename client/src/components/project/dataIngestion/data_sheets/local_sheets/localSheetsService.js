angular.module('dataIngestion')
.service('localSheetsService', ['Upload', '$q', '$http',
function (Upload, $q, $http) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.upload = upload;
    this.importFromUrl = importFromUrl;

    /*************************************
    ********* Local Data *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/
    function upload(obj) {
        var url = '/api/orgs/' + obj.urlParams[0] + '/projects/' + obj.urlParams[1] + '/dataset/savedata',
            defer = $q.defer();

        Upload.upload({
            url: url,
            method: 'POST',
            data: obj.uData, // Any data needed to be submitted along with the files
            file: obj.file
        })
        .success(function(data) {
            defer.resolve(data);
        })
        .progress(function(evt) {
            defer.notify(evt);
        })
        .error(function(error) {
            console.log('[Excel Upload error: ]', error);
            defer.reject(error);
        });

        return defer.promise;
    }

    function importFromUrl(obj) {
        var url = '/api/orgs/' + obj.urlParams[0] + '/projects/' + obj.urlParams[1] + '/dataset/savedata';

        return $http.post(url, obj.uData)
        .then(function(data) {
            return data.data;
        }).catch(function(error) {
            switch(error.status) {
            case 404:
                return $q.reject('Something terrible happened, please try later.');
            default:
                return $q.reject(error.data);
            }
        });


    }

}
]);