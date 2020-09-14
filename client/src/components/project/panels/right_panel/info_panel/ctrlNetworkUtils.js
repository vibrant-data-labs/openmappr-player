angular.module('mappr')
.controller('NetworkUtilsCtrl', ['$scope', '$rootScope', '$uibModal', 'networkService', 'snapshotService', 'dataGraph', 'graphSelectionService', 'athenaService', 'layoutService', 'uiService', 'projFactory', 'renderGraphfactory', 'BROADCAST_MESSAGES',
function($scope, $rootScope, $uibModal, networkService, snapshotService, dataGraph, graphSelectionService, athenaService, layoutService, uiService, projFactory, renderGraphfactory, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[ctrlNetworkPanel: ] ";

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.allNodesSelected = true;
    $scope.deleteNetworkInfo = null;

    $scope.algorithms = [
        {
            name: 'Calculate Network Properties',
            action: 'calcNetProp'
        }
    ];

    $scope.utilsUi = {
        editMode: false
    };

    /**
    * Scope methods
    */
    $scope.saveNetworkEdits = saveNetworkEdits;
    $scope.cancelNetworkEdits = cancelNetworkEdits;
    $scope.switchNetwork = switchNetwork;
    $scope.deleteNetwork = deleteNetwork;
    $scope.runAlgo = runAlgo;
    $scope.getDeleteNetworkInfo = getDeleteNetworkInfo;
    $scope.startNetGen = startNetGen;
    $scope.openNetworkDataModal = openNetworkDataModal;
    $scope.selectionAsNW = selectionAsNW;
    $scope.toggleArchsBridgersInfo = toggleArchsBridgersInfo;



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.dataGraph.loaded, initialise);

    $scope.$on(BROADCAST_MESSAGES.selectNodes, function() {
        console.log('hearing select nodes');
        $scope.allNodesSelected = false;
    });

    $scope.$on(BROADCAST_MESSAGES.selectStage, function() {
        console.log('hearing select stage');
        $scope.allNodesSelected = true;
    });




    /*************************************
    ********* Initialise *****************
    **************************************/
    if(dataGraph.getRawDataUnsafe()) {
        initialise();
    }

    /*************************************
    ********* Core Functions *************
    **************************************/

    function saveNetworkEdits() {
        networkService.updateNetwork($scope.networkTempObj.id, $scope.networkTempObj)
        .then(function() {
            $scope.utilsUi.editMode = false;
            uiService.log('Network updated!');
        }, function(err) {
            console.error('Could not update network info.', err);
            uiService.logError('Could not update network!');
            $scope.utilsUi.editMode = false;
            buildNwTempObj($scope.currentNetwork);
        });
    }

    function toggleArchsBridgersInfo() {
        $scope.networkTempObj.networkInfo.hideArchsBridgers = !$scope.networkTempObj.networkInfo.hideArchsBridgers;
    }

    function cancelNetworkEdits() {
        buildNwTempObj($scope.currentNetwork);
        $scope.utilsUi.editMode = false;
    }

    function switchNetwork(networkId) {
        networkService.switchNetwork(networkId)
        .then(function(network) {
            console.log(logPrefix + 'switched to network ' + network.name);
            console.log(logPrefix + 'current network - ', network);
            uiService.log('Switched to network: ' + network.name);
            refreshNwInfo();
        });
    }

    function deleteNetwork() {
        // Delete network
        var delNwId = $scope.currentNetwork.id;
        networkService.deleteNetwork($scope.currentNetwork.id)
        .then(function(resp) {
            console.log(logPrefix + 'network deleted - ' + $scope.currentNetwork.name);
            uiService.log('Network deleted from mapp: ' + $scope.currentNetwork.name);
//          $scope.npUi.openMainPanel();
            // Unload network specific snapshots
            snapshotService.unloadSnapshots(_.pluck($scope.currentNetworkSnapshots, 'id'));

            // delete network from network list
            var delNetwIdx = _.findIndex($scope.networkList, 'id', resp.delNetworkId);
            if(delNetwIdx > -1) $scope.networkList.splice(delNetwIdx, 1);

            if($scope.networkList.length === 0) {
                $scope.startNetGen(false, true);
            }
            else {
                $scope.switchNetwork(networkService.getLastModifiedNetwork().id);
            }
            $rootScope.$broadcast(BROADCAST_MESSAGES.network.deleted, {delNetworkId: delNwId});
        });
    }

    function runAlgo() {
        throw new Error('Algo functions not defined');
        // switch (action) {
        // case 'calcNetProp':
        //     calcNetProp();
        //     break;
        // case 'calcNodeSim':
        //     calcNodeSim();
        //     break;
        // }
    }


    function getDeleteNetworkInfo() {
        $scope.deleteNetworkInfo = [];

        _.forEach($scope.currentNetworkSnapshots, function(snap) {
            $scope.deleteNetworkInfo.push({
                name: 'Snapshot:',
                val: snap.snapName
            });
        });

    }

    function startNetGen(regenerateNetwork, persistModal) {
        var modalState = regenerateNetwork ? 'regenerate' : 'simpleGenerate';
        $scope.project.openNetgenModal(modalState, persistModal)
        .then(function() {
            console.log('Network generated');
        })
        .catch(function(err) {
            console.error(err);
        });
    }

    function openNetworkDataModal() {

        var modalInstance = $uibModal.open({
            templateUrl: '#{server_prefix}#{view_path}/components/project/data_modal/networkDataModal.html',
            controller: 'NetworkDataModalCtrl',
            size: 'lg'
        });

        //Called when modal is closed
        modalInstance.result.then(
            function() {
                console.log('Closing network data modal');
            },
            function() {
                console.warn("Modal dismissed at: " + new Date());
            }
        );
    }

    function selectionAsNW() {
        // use selection to create network
        var subNw = graphSelectionService.getSubNetwork(),
            currNw = networkService.getCurrentNetwork();
        var nAttr;
        try {
            nAttr = currNw.generatorInfo.links_FromAttributes.questions.length;
        } catch(e) {
            nAttr = undefined;
        }
        uiService.log("Creating new network containing " + subNw.nodeIds.length + " nodes and " + subNw.linkIds.length + " links");
        $rootScope.$broadcast(BROADCAST_MESSAGES.subnet.started);

        networkService.createSubNetwork(currNw.id, subNw.nodeIds, subNw.linkIds, subNw.colorMap)
        .then(function(networkId) {
            uiService.log("generating Network Properties for sub network...");
            if(projFactory.currProjectUnsafe().allGenNWIds.indexOf(networkId) === -1) {
                console.log("Adding new network to client copy of project");
                projFactory.currProjectUnsafe().allGenNWIds.push(networkId);
            }
            return athenaService.generateNetworkProps(networkId, nAttr, _.get(currNw, "generatorInfo.links_FromAttributes.fineClusters", false))
                .then(function() { return networkId; });
        })
        .then(function cloneLayouts (networkId) {
            var settings = projFactory.getProjectSettings();
            var hasChanged = false;
            _.each(settings.layouts, function (val) {
                var relatedLayouts = _.cloneDeep(_.filter(val, 'networkId', currNw.id));
                _.each(relatedLayouts, function (layout) {
                    layout.networkId = networkId;
                });
                if(relatedLayouts.length > 0) {
                    val.push.apply(val, relatedLayouts);
                    hasChanged = true;
                }
            });
            if(hasChanged) {
                return projFactory.updateProjectSettings(settings).then(function () { return networkId; });
            } else {
                return networkId;
            }
        })
        .then(function(networkId) {
            $rootScope.$broadcast(BROADCAST_MESSAGES.subnet.finished, {networkId: networkId});
            return networkService.fetchProjectNetwork(networkId);
        })
        .then(function generateSnapshot(network) {
            uiService.logSuccess("Sub network created successfully!");
            var camRatio = renderGraphfactory.sig().cameras.cam1.ratio;
            var serializedLayout = layoutService.serializeCurrent();
            var suggestedSnapObj = snapshotService.suggestSnapObjFromLayoutNetwork(serializedLayout, network);

            return snapshotService.createSnapshot(suggestedSnapObj, function(snap) {
                snap.layout.settings.nodeSizeMultiplier /= camRatio; // try to have the same size
                snap.layout.settings.drawEdges = network.nodes && network.nodes.length < 2000;
                snap.camera.x = 0;
                snap.camera.y = 0;
                snap.camera.ratio = snap.camera.r = 1;
                snap.ndSelState = []; //Discard selections for default subnet snap
                snap.processSelection = true;
                snap.networkId = network.id;
            })
            .then(function(snap) {
                snapshotService.setCurrentSnapshot(snap.id);
                uiService.log('New snapshot created for this network');
                graphSelectionService.clearSelections();
                return networkService.switchNetwork(network.id, snap);
            });
        })
        .catch(function(err) {
            uiService.logError("Error in creating sub network:" + err);
            $rootScope.$broadcast(BROADCAST_MESSAGES.subnet.failed);
        });

    }

    function initialise() {
        $scope.networkList = _.values(networkService.getNetworks());
        refreshNwInfo();
    }

    function refreshNwInfo() {
        $scope.currentNetwork = networkService.getCurrentNetwork();
        if(!$scope.currentNetwork) throw new Error('Current network not set');
        buildNwTempObj($scope.currentNetwork);
        $scope.currentNetworkSnapshots = snapshotService.getNetworkSnapshots($scope.currentNetwork.id);
    }

    function buildNwTempObj(network) {
        $scope.networkTempObj = {
            id : network.id,
            name : network.name,
            description : network.description,
            generatorInfo : network.generatorInfo || {},
            networkInfo: network.networkInfo
        };
    }



}
]);