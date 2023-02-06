/**
* Browser related APIs
*/
angular.module('common')
.service('browserDetectService', ['deviceDetector',
function(deviceDetector) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.isOldBrowser = isOldBrowser;


    /*************************************
    ********* Core Functions *************
    **************************************/
    function isOldBrowser() {
        var browser = deviceDetector.browser;
        var version = deviceDetector.browser_version.split('.')[0];
        if( (browser == 'chrome' && version < 30) ||
            (browser == 'safari' && version < 7) ||
            (browser == 'firefox' && version < 30) ||
            (browser == 'ie' && version < 10) ) {
            return true;
        }
        return false;
    }

}
]);