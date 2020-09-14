angular.module('dataIngestion')
.service('googleSheetsService', ['$http', '$q', 'dataIngestService',
function ($http, $q, dataIngestService) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.__authorize = __authorize;
    this.checkAuth = checkAuth;
    this.fetchFiles = fetchFiles;
    this.upload = upload;

    /*************************************
    ********* Local Data *****************
    **************************************/
    var driveApiUrl = 'https://apis.google.com/js/client.js',
        clientId = '',
        apiKey = '',
        scopes = 'https://www.googleapis.com/auth/drive.readonly';

    var googleFiles = [];

    /*************************************
    ********* Core Functions *************
    **************************************/
    function __authorize() {
        var defer = $q.defer(),
            _this = this;

        if(!window.gapi || !window.gapi.client) {
            dataIngestService.lazyLoadScript(driveApiUrl).then(
                function() {
                    setKey();

                    function setKey() {
                        if(!window.gapi || !window.gapi.client) {
                            window.setTimeout(setKey, 50);
                            return;
                        }
                        window.gapi.client.setApiKey(apiKey);

                        window.setTimeout(function() {
                            return _this.checkAuth(true).then(
                                function(data) {
                                    defer.resolve(data);
                                },
                                function(error) {
                                    defer.reject(error);
                                }
                            );
                        }, 1);
                    }

                },
                function() {}
            );
        }

        return defer.promise;
    }

    function checkAuth(immediate) {
        var defer = $q.defer();

        window.gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: immediate}, function(res) {
            handleAuthResult(res).then(
                function(data) {
                    defer.resolve(data);
                },
                function(error) {
                    defer.reject(error);
                }
            );
        });

        return defer.promise;
    }

    function fetchFiles() {
        var defer = $q.defer();

        if(googleFiles && angular.isArray(googleFiles) && googleFiles.length > 0) {
            defer.resolve(googleFiles);
        }
        else {
            this.__authorize().then(
                function(data) {
                    defer.resolve(data);
                },
                function(error) {
                    defer.reject(error);
                }
            );
        }

        return defer.promise;
    }

    function upload(obj) {
        var url = '/api/orgs/' + obj.urlParams[0] + '/projects/' + obj.urlParams[1] + '/dataset/savedata',
            defer = $q.defer();

        $http.post(url, obj.uData)
        .then(
            function(data) {
                defer.resolve(data.data);
                console.log('DATA', data);
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

    function handleAuthResult(authResult) {
        var defer = $q.defer(),
            requestParams = {
                'path': '/drive/v2/files',
                'method': 'GET',
                'params': {'q': '(mimeType = "application/vnd.google-apps.spreadsheet" or mimeType = "application/vnd.ms-excel" or mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") and trashed=false'}
            };

        if (authResult && !authResult.error) {

            if(!window.gapi.client || !window.gapi.client.drive) {
                window.gapi.client.load('drive', 'v2', retrieveAllFiles);
            }
            else {
                retrieveAllFiles();
            }

        }
        else {
            defer.reject('unAuthorized');
        }

        function retrieveAllFiles() {
            retrievePageOfFiles(window.gapi.client.request(requestParams), []);

            function retrievePageOfFiles(request, result) {
                request.execute(function(resp) {
                    var nextPageToken = resp.nextPageToken;
                    result = result.concat(resp.items);
                    console.log('response -->  ', resp);

                    if (nextPageToken) {
                        requestParams['pageToken'] = nextPageToken;
                        retrievePageOfFiles(window.gapi.client.request(requestParams), result);
                    }
                    else {
                        googleFiles = result;
                        defer.resolve(googleFiles);
                    }
                });
            }

        }

        return defer.promise;
    }

}
]);
