angular.module('mappr')
.service('ScriptingService', ['$q', '$http', 'projFactory', 'userFactory',
function($q, $http, projFactory, userFactory) {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.getScriptObj = getScriptObj;
    this.recent = function() { return recentScripts; };
    this.defScript = function() {return getScriptObj(defScriptSrc);};
    this.storeRecentlyUsedScripts = storeRecentlyUsedScripts;
    this.loadRecentlyUsedScripts = loadRecentlyUsedScripts;
    this.storeScript = storeScript;



    /*************************************
    ********* Local Data *****************
    **************************************/
    // organized from latest to least recently used
    var recentScripts = [];

    var defScriptSrc =  "// name: Default script\n" +
    "// x : is the value of the Source attribute\n" +
    "// node : is the node being processed. node.attr contains all the attr Values on the node\n" +
    "// nwAttrInfos  : is the attrInfo Object Index for network \n" +
    "// grpAttrInfos : is the attrInfo Object Index for selected group\n" +
    "// srcAttrInfo  : is the attrInfo Object for the source Attrib\n" +
    "return Math.pow(x,2);";



    /*************************************
    ********* Core Functions *************
    **************************************/

    function getScriptObj (scriptSrc, orgRef, projectRef, userRef, lastUsedAt) {
        var proj = projFactory.currProjectUnsafe(),
            user = userFactory.currUserUnsafe();

        var name = _extractName(scriptSrc);
        return {
            name : name,
            scriptSrc : scriptSrc,
            orgRef : orgRef || proj.org.ref,
            userRef : userRef || user._id,
            projectRef : projectRef || proj._id,
            lastUsedAt : lastUsedAt || Date.now()
        };
    }

    function storeScript (scriptSrc) {
        var name = _extractName(scriptSrc);
        var prevIdx = name ? _.findIndex(recentScripts, 'name', name) : _.findIndex(recentScripts, 'scriptSrc', scriptSrc);
        if(prevIdx < 0) {
            recentScripts.unshift(getScriptObj(scriptSrc));
        } else {
            // if a script with this name already exists, update the source
            var res = recentScripts.splice(prevIdx,1);
            recentScripts.unshift(getScriptObj(scriptSrc, null, res[0].projectRef, res[0].userRef));
        }
        storeRecentlyUsedScripts();
        return _.clone(recentScripts);
    }

    function storeRecentlyUsedScripts () {
        // default scripts are never stored
        var scriptsToStore = _.reject(recentScripts, 'name', 'Default script');
        var proj = projFactory.currProjectUnsafe();
        // call the api endpoint and store the babies.
        return $http.post('/api/orgs/' + proj.org.ref + '/scripts', {
            scripts : scriptsToStore
        })
        .then(function(respData) {
            console.log("Successfully stored scripts!" + respData);
            return respData;
        }).catch(function(err) {console.error("Unable to store scripts", err); return $q.reject(err); });
    }

    function loadRecentlyUsedScripts () {
        /// load from the api endpoint, append defScript to the top
        if(recentScripts.length === 0) {
            var proj = projFactory.currProjectUnsafe();
            return $http.get('/api/orgs/' + proj.org.ref + '/scripts')
            .then(function(respData) {
                recentScripts = respData.data;
                if(recentScripts.length === 0) {
                    recentScripts = [getScriptObj(defScriptSrc)];
                }
                return _.clone(recentScripts);
            }).catch(function(err) { console.error("Unable to load scripts", err); return $q.reject(err); });
        } else {
            return $q.when(_.clone(recentScripts));
        }
    }

    // if name can be found then use it, else use the 1st line
    function _extractName (scriptSrc) {
        var name = "";
        var matches = scriptSrc.match(/\/\/\s*name\s*:\s*(.+)\s*/);
        if(matches) {
            name = matches[1];
        } else {
            matches = scriptSrc.match(/(.*)/);
            name = matches[1];
        }
        return name;
    }

}]);