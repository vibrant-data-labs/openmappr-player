/**
* Handles all operations related to project's snapshots
*/
angular.module('common')
.service('snapshotService',[ '$q', '$http', '$rootScope', '$routeParams', 'layoutService', 'graphSelectionService', 'dataGraph','networkService', 'projFactory', 'renderGraphfactory', 'playerFactory', 'BROADCAST_MESSAGES',
function ($q, $http, $rootScope, $routeParams, layoutService, graphSelectionService, dataGraph, networkService, projFactory, renderGraphfactory, playerFactory, BROADCAST_MESSAGES) {
    'use strict';


    /*************************************
    *************** API ******************
    **************************************/
    this.getSnapshots = getSnapshots;
    this.getSnapshotsUnsafe = function() {
        return mappSnapshots;
    };
    this.loadSnapshots = loadSnapshots;
    this.unloadSnapshots = unloadSnapshots;
    this.getCurrentSnapshot = getCurrentSnapshot;
    this.setCurrentSnapshot = setCurrentSnapshot;
    this.getById = getSnapshotById;
    this.clear = clear;
    // this.uploadSnapshotImage     = uploadImage;
    this.getDependentAttrs = getDependentAttrs;
    this.getNetworkSnapshots = getNetworkSnapshots;
    this.suggestSnapObj = suggestSnapObj;
    this.suggestSnapObjFromLayoutNetwork = suggestSnapObjFromLayoutNetwork;
    this.getLastViewedSnapId = getLastViewedSnapId;

    this.getCurrentPinnedAttrs = getCurrentPinnedAttrs;
    this.movePinnedToTop = movePinnedToTop;
    this.toggleAttrPin = toggleAttrPin;
    this.getPinnedAttrIds = getPinnedAttrIds;
    this.getAnchoredAttrIds = getAnchoredAttrIds;



    /*************************************
    ********* Local Data *****************
    **************************************/
    var currentSnapshot = null;
    var mappSnapshots = [];
    var fetchNewSnaps = true;
    var isPlayer = false;



    /*************************************
    ********* Core Functions *************
    **************************************/

    function getSnapshots() {
        if(fetchNewSnaps) {
            fetchNewSnaps = false;

            return projFactory.currProject()
            .then(function(proj) {
                mappSnapshots = _.clone(proj.snapshots) || [];
                return mappSnapshots;
            });
        }
        else {
            return $q.when(mappSnapshots);
        }
    }

    function loadSnapshots(fetchFromPlayer) {
        if(fetchFromPlayer) {
            isPlayer = true;
            return playerFactory.currPlayer()
            .then(function(player) {
                if(player && player.snapshots) {
                    mappSnapshots = player.snapshots;
                    return mappSnapshots;
                }
                else {
                    return $q.reject('No player snapshots');
                }
            });
        }
        else {
            return getSnapshots();
        }
    }

    function getCurrentPinnedAttrs() {
        if(!currentSnapshot) {
            console.warn('Current snapshot not set');
            return [];
        }
        return currentSnapshot.pinnedAttrs || [];
    }

    function getAnchoredAttrIds() {

        if(!currentSnapshot) {
            console.warn('Current snapshot not set');
            return [];
        }
        console.log('attrs for possible anchor: ', dataGraph.getNodeAttrs());
        return _.map(_.filter(dataGraph.getNodeAttrs(), function(n) {
            return n.metadata.overlayAnchor;
        }), 'id');
    }

    function getPinnedAttrIds() {
        if(!currentSnapshot) {
            console.warn('Current snapshot not set');
            return [];
        }
        return _.map(_.filter(dataGraph.getNodeAttrs(), 'isStarred'), 'id');
    }

    function movePinnedToTop(attrsList) {
        var pinnedAttrIds = getCurrentPinnedAttrs();
        if(pinnedAttrIds.length === 0) return attrsList;

        var splitAttrs = _.partition(attrsList, function(attr) {
            return pinnedAttrIds.indexOf(attr.id) > -1;
        });
        return splitAttrs[0].concat(splitAttrs[1]);
    }

    function toggleAttrPin(attrId) {
        if(!_.isString(attrId)) throw new Error('String expected for AttrId');
        var pinnedAttrIds = getCurrentPinnedAttrs();
        var attrIdx = pinnedAttrIds.indexOf(attrId);
        if(attrIdx > -1) {
            pinnedAttrIds.splice(attrIdx, 1);
        }
        else {
            pinnedAttrIds.push(attrId);
        }
    }

    function getCurrentSnapshot() {
        return currentSnapshot || null;
    }

    function setCurrentSnapshot(snapId) {
        var refSnap = _.find(mappSnapshots, {'id': snapId});
        if(!refSnap) {
            throw new Error('Snapshot doesn\'t exist');
        }
        currentSnapshot = refSnap;

        // Update last viewed snap for app
        if(!isPlayer) {
            var projSettings = projFactory.getProjectSettings();
            if(projSettings && projSettings.lastViewedSnap != currentSnapshot.id) {
                projFactory.updateProjectSettings({
                    lastViewedSnap: snapId
                });
            }
        }

        return currentSnapshot;
    }

    function getLastViewedSnapId() {
        if(mappSnapshots.length === 0) throw new Error('No snapshots loaded');
        var projSettings = projFactory.getProjectSettings();
        if(projSettings)
            return projSettings.lastViewedSnap;
        else return mappSnapshots[0].id;
    }

    function getSnapshotById(snapId) {
        if( mappSnapshots.length < 1) {
            return null;
        }
        else {
            return _.find(mappSnapshots, {'id': snapId}) || null;
        }
    }

    function clear() {
        mappSnapshots = [];
        currentSnapshot = null;
        fetchNewSnaps = true;
    }

    function getNetworkSnapshots(networkId) {
        if(!networkId) throw new Error('network Id expexted');
        return _.filter(mappSnapshots, function(snap) {
            return snap.networkId == networkId;
        });
    }

    function unloadSnapshots(snapIds) {
        if(mappSnapshots.length < 1) {
            console.warn('No snapshots, can\'t unload.');
            return;
        }
        if(!_.isArray(snapIds)) throw new Error('Array expected for snap Ids');

        _.each(snapIds, function(snapId) {
            var loadedSnapIdx = _.findIndex(mappSnapshots, 'id', snapId);
            if(loadedSnapIdx > -1) mappSnapshots.splice(loadedSnapIdx, 1);
        });
    }

    function getDependentAttrs() {
        var result = {};
        if(mappSnapshots.length === 0) {
            return result;
        }
        var layoutProps = ['xaxis', 'yaxis'];
        var layoutSettingsProps = ['nodeColorAttr', 'nodeSizeAttr', 'edgeColorAttr'];

        _.each(mappSnapshots, function(snap) {
            var layout = snap.layout;
            var attrId;
            _.each(layoutProps, function(prop) {
                attrId = layout[prop];
                addToResult(attrId, snap);
            });
            _.each(layoutSettingsProps, function(prop) {
                attrId = layout.settings[prop];
                addToResult(attrId, snap);
            });
        });

        function addToResult(attrId, snap) {
            if(_.isString(attrId)) {
                if(!result[attrId]) {
                    result[attrId] = [];
                }
                _.pushUnique(result[attrId], snap.snapName);
            }
        }
        return result;
    }

    function suggestSnapObjFromLayoutNetwork(layout, network) {
        var suggestedSnap = {
            snapName: '',
            descr: ''
        };
        if(!layout) throw new Error('Layout not found');
        if(!network) throw new Error('Current network not set');
        var networkAttrsList = dataGraph.getNodeAttrTitlesForIds(networkService.getNetworkAttrs(network.id)),
            layoutName = _.contains(['scatterplot', 'geo'], layout.plotType.toLowerCase()) ? layout.plotType.toLowerCase() : 'cluster';

        suggestedSnap.snapName = network.name + ' - ' + layoutName + (_getSnapTypeGenCount(layoutName, network.id) + 1);
        suggestedSnap.descr = formatContent('Network', network.name);
        suggestedSnap.descr += formatContent('Attributes used to create network', networkAttrsList.join(', '));
        if(layout.plotType.toLowerCase() == 'scatterplot') {
            suggestedSnap.descr += formatContent('X/Y Attributes', layout.xaxis + ', ' + layout.yaxis);
        }
        suggestedSnap.descr += formatContent('Node color attribute', layout.settings.nodeColorAttr);
        suggestedSnap.descr += formatContent('Node size attribute', layout.settings.nodeSizeAttr);

        function formatContent(title, content) {
            var formattedContent = '<p><b>' + title + '</b> - ';
            formattedContent += content + '\n\n';
            return formattedContent;
        }

        return suggestedSnap;
    }


    function suggestSnapObj() {
        var currLayout = layoutService.serializeCurrent();
        var currNetwork = networkService.getCurrentNetwork();

        return suggestSnapObjFromLayoutNetwork(currLayout, currNetwork);
    }

    /*************************************
    ********* Local Functions ************
    **************************************/

    function _getSnapTypeGenCount(layoutType, networkId) {
        var snapGenMap = _.get(projFactory.getProjectSettings(), 'snapGenMap.' + networkService.getCurrentNetwork().id);
        if(_.isObject(snapGenMap) && snapGenMap[layoutType] != null) {
            return snapGenMap[layoutType];
        }
        else {
            return _.contains(['geo', 'scatterplot'], layoutType)
                ? _.filter(getNetworkSnapshots(networkId), 'layout.plotType', layoutType).length
                : _.reject(getNetworkSnapshots(networkId), function(layout) {
                    return _.contains(['geo', 'scatterplot'], layout.plotType);
                }).length;
        }
    }
}
]);
