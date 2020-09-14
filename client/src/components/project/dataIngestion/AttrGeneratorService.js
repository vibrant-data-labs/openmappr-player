angular.module('mappr')
.service('AttrGeneratorService', ['$q', '$http', 'projFactory',
function($q, $http, projFactory) {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.generateAttributeOnDataset = generateAttributeOnDataset;
    this.addAttributeOnNetwork = addAttributeOnNetwork;

    /*************************************
    ********* Local Data *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function getDatasetUrl() {
        var proj = projFactory.currProjectUnsafe();

        var url = '/api/orgs/' + proj.org.ref + '/projects/' + proj._id + '/dataset';
        return url;
    }

    function getNetworkUrl(networkId) {
        var proj = projFactory.currProjectUnsafe();

        var url = '/api/orgs/' + proj.org.ref + '/projects/' + proj._id + '/networks/' + networkId;
        return url;
    }

    function generateAttributeOnDataset (fnScript, srcAttrId, newAttrName, newAttrType) {
        return $http.post(getDatasetUrl() + '/gen_attr', {
            srcAttrId : srcAttrId,
            newAttrName : newAttrName,
            newAttrType : newAttrType,
            fnScript : fnScript
        }).then(function(respData) {
            console.log("Attribute generated successfully!", respData);
            return respData;
        });
    }

    function addAttributeOnNetwork (networkId, newAttrName, newAttrType, newValMapping) {
        return $http.post(getNetworkUrl(networkId) + '/gen_attr', {
            newAttrName : newAttrName,
            newAttrType : newAttrType,
            newValMapping : newValMapping
        }).then(function(respData) {
            console.log("Attribute generated successfully!", respData);
            return respData;
        });
    }
}]);