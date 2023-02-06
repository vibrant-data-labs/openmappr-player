angular.module('common')
.service('uiHelper', [function() {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.getDomain = getDomain;
    this.getDocProtocol = getDocProtocol;


    /*************************************
    ********* Local Data *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/
    function getDomain() {
        return window.location.host;
    }

    function getDocProtocol() {
        return window.location.protocol;
    }

}
]);