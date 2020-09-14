(function() {
    "use strict";

    angular.module("hcApp", ["ngRoute", 'ngFileUpload'])
    .config(function($sceDelegateProvider) {
        $sceDelegateProvider.resourceUrlWhitelist([
            // Allow same origin resource loads.
            'self',
            // Allow loading from our assets domain.
            'https://s3-us-west-2.amazonaws.com/new-mappr-builds/**',
            'http://d1vk2agkq7tezn.cloudfront.net/**'
        ]);
    })
    .controller('AppCtrl', ['$scope', '$q', 'Upload',
    function ($scope, $q, Upload) {

        $scope.cleanProcess = {
            errorMsg: '',
            progress: 0,
            showProgress: false
        };

        $scope.matchProcess = {
            errorMsg: '',
            progress: 0,
            showProgress: false
        };

        $scope.findMatches = function(files) {
            if(!files) {return;}
            if(!Array.isArray(files)) {
                files = [files];
            }

            var url = '/get_sources_sheet',
                file = files[0];

            $scope.matchProcess.showProgress = true;

            Upload.upload({
                url: url,
                method: 'POST',
                data: {}, // Any data needed to be submitted along with the files
                file: file
            })
            .success(function(data) {
                window.saveAs(new Blob([s2ab(data)],{type:"application/octet-stream"}), _.head(file.name.split('.')) + ".xlsx");
            })
            .progress(function(evt) {
                $scope.matchProcess.progress = ((evt.loaded/evt.total)*100).toFixed(2);
            })
            .error(function(error) {
                console.error('[Excel Upload error: ]', error);
                $scope.matchProcess.errorMsg = "Something went wrong!";
            });
        };

        $scope.cleanFile = function(files) {
            if(!files) {return;}
            if(!Array.isArray(files)) {
                files = [files];
            }

            var url = '/get_clean_sheet',
                file = files[0];

            $scope.cleanProcess.showProgress = true;

            Upload.upload({
                url: url,
                method: 'POST',
                data: {}, // Any data needed to be submitted along with the files
                file: file
            })
            .success(function(data) {
                window.saveAs(new Blob([s2ab(data)],{type:"application/octet-stream"}), _.head(file.name.split('.')) + ".xlsx");
            })
            .progress(function(evt) {
                $scope.cleanProcess.progress = ((evt.loaded/evt.total)*100).toFixed(2);
            })
            .error(function(error) {
                console.error('[Excel Upload error: ]', error);
                $scope.cleanProcess.errorMsg = "Something went wrong!";
            });
        };

        function s2ab(s) {
            var buf = new window.ArrayBuffer(s.length);
            var view = new window.Uint8Array(buf);
            for (var i = 0; i != s.length; ++i) { view[i] = s.charCodeAt(i) & 0xFF; }
            return buf;
        }

    }]);
}());
