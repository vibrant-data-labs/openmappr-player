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
    this.createSnapshot = createSnapshot;
    this.cloneSnapshot = cloneSnapshot;
    this.removeSnapshot = removeSnapshot;
    this.updateSnapshot = updateSnapshot;
    this.updateSequence = updateSequence;
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
    // customizer is a f: snap -> null to customize the snapshot object
    function createSnapshot(snapObj, customizer) {
        console.group('Creating Snapshot');
        var snap;
        return _createNewSnapFromExisting(snapObj)
            .then(function(createdSnap){
                console.log('[ctrlSnapshot] saving snapshot %O', createdSnap);
                snap = createdSnap;
                if(_.isFunction(customizer)) customizer(snap);
                return projFactory.currProject();
            }).then(function(projDoc) {
                return projFactory.addSnapshot(projDoc.org.ref, projDoc._id, snap);
            }).then(function(createdSnap) {
                if(!createdSnap) {
                    return $q.reject('Snap not added to mapp');
                }
                mappSnapshots.push(createdSnap);
                var broadcastData = {
                    createdSnap: createdSnap
                };
                if(_.isFunction(customizer)) broadcastData.makeCurrent = true;
                $rootScope.$broadcast(BROADCAST_MESSAGES.snapshot.added, broadcastData);
                console.log('Snapshot add %O', createdSnap);

                // Update snap gen count in proj settings
                _updateSnapGenCount(createdSnap);
                console.groupEnd();
                return createdSnap;
            }, function(err) {
                return $q.reject(err);
            });
    }

    function cloneSnapshot(snapId) {
        var snapIdx;

        return projFactory.currProject()
        .then(function(projDoc){
            snapIdx = _.findIndex(mappSnapshots, {'id': snapId});
            if(snapIdx > -1) {
                var snapClone = _.cloneDeep(mappSnapshots[snapIdx]);
                return projFactory.addSnapshot(projDoc.org.ref, projDoc._id, snapClone);
            }
            else {
                return $q.reject('Snap not found');
            }
        })
        .then(
            function(snap){
                if(!snap) {
                    return $q.reject('Snap not added to map');
                }
                mappSnapshots.splice(snapIdx + 1, 0, snap);
                $rootScope.$broadcast(BROADCAST_MESSAGES.snapshot.added, {createdSnap: _.clone(snap)});
                console.log('Snapshot cloned %O', snap);
                return snap;
            },
            function(err) {
                return $q.reject(err);
            }
        );
    }

    function updateSnapshot(snap, updateGraph) {
        console.group('[ctrlSnapshot] Updating Snapshot');
        var plotType = layoutService.getCurrentIfExists().plotType;
        var canvasToSave, canvasElem;
        if (plotType === 'grid') {
            canvasElem = '.grid-layout';
        } else if (plotType === 'list') {
            canvasElem = '.list-layout-content';
        }

        if (canvasElem) {
            return new Promise(function(resolve, reject) {
                html2canvas(document.querySelector(canvasElem), {
                    useCORS: true,
                    onrendered: function(canvas) {
                        canvasToSave = canvas.toDataURL();
                        snap.summaryImg = canvasToSave;
                        _updateSnapshot(snap, updateGraph).then(function(res) {
                            resolve(res);
                        });
                    }
                });
            });
        } else if (plotType === 'geo') {
            return new Promise(function(resolve, reject) {
                html2canvas(document.querySelector('.angular-leaflet-map'), {
                    useCORS: true,
                    onrendered: function(canvas) {
                        var sig = renderGraphfactory.sig();

                        var nodeData = sig.renderers.graph.snapshot({background: 'transparent'});

                        var resultCanvas = document.createElement('canvas');
                        resultCanvas.style.display = 'none';
                        resultCanvas.width = canvas.width;
                        resultCanvas.height = canvas.height;
                        document.body.appendChild(resultCanvas);
                        
                        var img = new Image();
                        img.onload = function() {
                            var ctx = resultCanvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            var mergedData = mergeData(
                                ctx.getImageData(0, 0, canvas.width, canvas.height), 
                                canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));

                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.putImageData(mergedData, 0, 0);
                            
                            snap.summaryImg = resultCanvas.toDataURL();
                            _updateSnapshot(snap, updateGraph).then(function (res) {
                                resolve(res);
                            });
                        }
                        img.src = nodeData;
                    }
                });
            });
        } else {
            var sig = renderGraphfactory.sig();

            snap.summaryImg = sig.renderers.graph.snapshot({background: 'white'});
            return _updateSnapshot(snap, updateGraph);
        }
    }

    function mergeData(top, bottom){
        var tD = top.data,
            bD = bottom.data,
            l = tD.length;
        for(var i = 0; i < l; i += 4){
            //source alpha
            var alphaSrc = tD[i+3] / 255, //source alpha
                alphaDst = bD[i+3] / 255, //destination alpha
                alphaSrcO = 1 - alphaSrc, //(1 - x)
                alpha = alphaSrc + alphaDst * alphaSrcO; //if destination alpha is opaque
            //merge colors
            bD[i] = ((tD[i]*alphaSrc) + (bD[i]*alphaDst*alphaSrcO)) / alpha,
            bD[i+1] = ((tD[i+1]*alphaSrc) + (bD[i+1]*alphaDst*alphaSrcO)) / alpha,
            bD[i+2] = ((tD[i+2]*alphaSrc) + (bD[i+2]*alphaDst*alphaSrcO)) / alpha,
            bD[i+3] = 255*alpha;
        }
        //return bottom
        return bottom;
    }

    function removeSnapshot(snapId) {
        return projFactory.currProject()
        .then(function(projDoc) {
            if(!snapId) {
                return $q.reject('Snapshot ID expected');
            }
            return projFactory.removeSnapshot(projDoc.org.ref, projDoc._id, snapId);
        }).then(function(delId) {
            var snapIdx = _.findIndex(mappSnapshots, {'id': delId});
            var deletedSnapClone = _.clone(mappSnapshots[snapIdx]);
            mappSnapshots.splice(snapIdx, 1);
            $rootScope.$broadcast(BROADCAST_MESSAGES.snapshot.removed, {deletedSnap: deletedSnapClone});
            console.groupEnd();
            return snapId;
        }, function(err) {
            return $q.reject(err);
        });
    }

    function updateSequence() {
        var snapIdArr = _.map(mappSnapshots, 'id');
        return projFactory.currProject()
        .then(function(projDoc) {
            return projFactory.updateSnapshotSequence(projDoc.org.ref, projDoc._id, snapIdArr);
        }).then(function(snapshots) {
            mappSnapshots.length = 0;
            _.each(snapshots, function(snap) {
                mappSnapshots.push(snap);
            });
            return mappSnapshots;
        });
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

    // NOTE:- CHECK IF THIS IS BEING USED. NO SCOPE IN SERVICE
    // function uploadImage($files, progressCallback, finishedCallback, errorCallback) {
    //     if($files.length == 0) {
    //         return;
    //     }
    //     //$files: an array of files selected, each file has name, size, and type.
    //     var file = $files[0];
    //     $scope.upload = Upload.upload({
    //         url: '/api/users/'+owner.ref+'/orgs/'+org._id+'/upload',
    //         method: 'POST',
    //         file: file, // or list of files: $files for html5 only
    //         /* set the file formData name ('Content-Desposition'). Default is 'file' */
    //         //fileFormDataName: myFile, //or a list of names for multiple files (html5).
    //         /* customize how data is added to formData. See #40#issuecomment-28612000 for sample code */
    //         //formDataAppender: function(formData, key, val){}
    //     }).progress(function(evt) {
    //         // $scope.progressMaxVal = evt.total;
    //         // $scope.progressVal = evt.loaded;

    //         var per = parseInt(100.0 * evt.loaded / evt.total);
    //         progressCallback(per);
    //     }).success(function(data, status, headers, config) {
    //         // file is uploaded successfully
    //         console.log("file data: ", data);

    //         finishedCallback(data);

    //     }).error(function(err){
    //         console.log('error uploading file: ', err);

    //         errorCallback(err);
    //     })
    //     //.then(success, error, progress);
    //     //.xhr(function(xhr){xhr.upload.addEventListener(...)})// access and attach any event listener to XMLHttpRequest.
    // }





    /*************************************
    ********* Local Functions ************
    **************************************/

   function _updateSnapshot(snap, updateGraph) {
        var currProject, newSnap;
       return projFactory.currProject()
        .then(function(proj) {
            currProject = proj;
            if(updateGraph) {
                return _createNewSnapFromExisting(snap)
                .then(function(createdSnap){
                    newSnap = createdSnap;
                    newSnap.id = createdSnap.id;
                    console.log('[ctrlSnapshot] updating snapshot %O', newSnap);
                    return projFactory.updateSnapshot(currProject.org.ref, currProject._id, newSnap);
                });
            }
            else {
                return projFactory.updateSnapshot(currProject.org.ref, currProject._id, snap);
            }
        }).then(function(updatedSnap) {
            var mappSnap = _.find(mappSnapshots, {'id': updatedSnap.id});
            _.assign(mappSnap, updatedSnap);
            $rootScope.$broadcast(BROADCAST_MESSAGES.snapshot.updated, {updatedSnap: _.clone(updatedSnap)});
            console.log('Snapshot updated %O', updatedSnap);
            console.groupEnd();
            return mappSnap;
        });
   }

    /**
     * Serializes snapshot information so that it can be saved for later use.
     * @param  {layout} layout Current layout in LayoutService
     * @param  {Sigma Instance} sig    Current sigma instance in renderGraphfactory
     * @return {object}        The serialized object
     */
     // id: rsd.id,
     // name          : rsd.snapName,
     // description   : rsd.descr,
     // picture       : rsd.picture,
     // author        : rsd.author,
     // layout        : rsd.layout,
     // networkId     : rsd.networkId,
     // ndSelState    : rsd.ndSelState || [],
     // edSelState    : rsd.edSelState || [],
     // camera        : rsd.camera,
     // pinState      : rsd.pinState,
     // dateModified  : rsd.dateModified,
     // isDeleted     : rsd.isDeleted,
     // isEnabled     : rsd.isEnabled,
     // type          : rsd.type
    function _createNewSnapFromExisting(snapObj) {

        //update camera
        //plotType should belong to layout

        return renderGraphfactory.getSig()
        .then(function(sig) {
            var c;
            var newSnap = _createDefault();
            var rg = dataGraph.getRenderableGraph();

            if(_.isPlainObject(snapObj) && _.keys(snapObj).length > 0) {
                // Assign values from passed snap object only if they exist, else use current values
                _.assign(newSnap, snapObj, function(destVal, srcVal, key) {
                    if(key == 'layout') { //Hacking for now
                        return destVal;
                    }
                    return srcVal != null ? srcVal : destVal;
                });
            }

            graphSelectionService.persistIntoSnapshot(newSnap);

            var layout = layoutService.getCurrentIfExists();
            // camera is always in pixels, no lat lng stuff.
            if(layout.plotType == 'geo') {
                c = layout.map.getCenter();
                newSnap.camera.x = c.lat;
                newSnap.camera.y = c.lng;
                newSnap.camera.r = 1;
            } else {
                c = sig.cameras.cam1;
                newSnap.camera.x = c.x * rg.baseRatio;
                newSnap.camera.y = c.y * rg.baseRatio;
                newSnap.camera.r = c.ratio;
                newSnap.camera.normalizeCoords = true; // for backwards compatibility
            }

            //update axes
            //if(layout.isScatterPlot) {
            newSnap.layout.xaxis = layout.attr.x;
            newSnap.layout.yaxis = layout.attr.y;
            //}

            newSnap.networkId = networkService.getCurrentNetwork().id;
            return newSnap;
        });

    }

    function _createDefault () {
        var snap = {
            snapName      : 'Snapshot',
            description   : 'Add a description',
            type          : 'network',
            isEnabled     : true,
            picture       : renderGraphfactory.getDataURL(100,100) || '',
            audio         : '',
            embed         : '',
            text          : '',
            author        : null,
            layout        : layoutService.serializeCurrent(),
            networkId     : networkService.getCurrentNetwork().id,
            ndSelState  : [],
            edSelState  : [],
            camera        : {
                x:0,
                y:0,
                r:1
            },
            pinState      : null,   //rsd.pinState,
            dateModified  : _.now(),//rsd.dateModified,
            isDeleted     : false,   //rsd.isDeleted,
            processSelection: _.size(graphSelectionService.getSelectedNodes()) > 0 ? true : false
        };
        return snap;
    }

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

    function _updateSnapGenCount(snap) {
        var projSettings = projFactory.getProjectSettings();
        if(projSettings.snapGenMap == null) {
            projSettings.snapGenMap = {};
        }
        if(_.isEmpty(projSettings.snapGenMap[snap.networkId])) {
            if(mappSnapshots.length === 0) {
                // new project
                projSettings.snapGenMap[snap.networkId] = {
                    geo: 0,
                    scatterplot: 0,
                    cluster: 0
                };
            }
            else {
                // for backwards compatiblity
                var networkSnaps = getNetworkSnapshots(snap.networkId);
                projSettings.snapGenMap[snap.networkId] = {
                    geo: _.filter(networkSnaps, 'layout.plotType', 'geo').length,
                    scatterplot: _.filter(networkSnaps, 'layout.plotType', 'scatterplot').length,
                    cluster: _.reject(networkSnaps, function(nwSnap) {
                        return _.contains(['geo', 'scatterplot'], nwSnap.layout.plotType);
                    }).length
                };

                // Reduce by 1 for current created snap
                if(_.contains(['geo', 'scatterplot'], snap.layout.plotType)) {
                    projSettings.snapGenMap[snap.networkId][snap.layout.plotType]--;
                }
                else {
                    projSettings.snapGenMap[snap.networkId]['cluster']--;
                }
            }
        }

        var layoutType = _.contains(['scatterplot', 'geo'], snap.layout.plotType.toLowerCase())
            ? snap.layout.plotType.toLowerCase()
            : 'cluster';
        projSettings.snapGenMap[snap.networkId][layoutType]++;

        projFactory.updateProjectSettings(projSettings)
        .then(function() {
            console.log('[snapshotService: _updateSnapGenCount] snap gen counts updated');
        })
        .catch(function(err) {
            console.error('[snapshotService: _updateSnapGenCount] error in updating snap gen counts.', err);
        });
    }

    

}
]);
