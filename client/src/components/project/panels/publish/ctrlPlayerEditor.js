angular.module('mappr')
.controller('PlayerEditorCtrl', [ '$scope', '$rootScope', '$window', '$sce', '$q', '$uibModal', 'snapshotService', 'uiService', 'playerFactory', 'projFactory', 'orgFactory', 'uiHelper', 'BROADCAST_MESSAGES',
function($scope, $rootScope, $window, $sce, $q, $uibModal, snapshotService, uiService, playerFactory, projFactory, orgFactory, uiHelper, BROADCAST_MESSAGES) {

    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlPlayerEditor: ] ';
    var domain = uiHelper.getDomain();
    var updateOp = '';



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.domain = domain;
    $scope.protocol = uiHelper.getDocProtocol();
    $scope.mappSnapshots = [];
    $scope.tokenEditMode = false;
    $scope.playerTempObj = {};

    //options for themeing the player
    $scope.themes = [
        {
            value:'light',
            descr: 'Light'
        },
        {
            value:'dark',
            descr: 'Dark'
        }
    ];

    //font options for player
    $scope.fonts = [
        {
            name: 'Roboto',
            class: 'Roboto'
        }
    ];

    $scope.searchAlgs = [
        {
            value: 'naive',
            name: 'Substring search'
        },
        {
            value: 'elasticsearch',
            name: 'Elasticsearch'
        },
        {
            value: 'fuzzy',
            name: 'Approximate string matching (fuzzy)'
        }
    ];

    $scope.headerTypes = [
        {
            value:'simple',
            descr: 'Logo'
        },
        {
            value:'html',
            descr: 'HTML'
        }
    ];

    $scope.timelineTypes = [
        {
            value:'right',
            descr: 'Right'
        },
        {
            value:'bottom',
            descr: 'Bottom'
        }
    ];

    $scope.editorPanels = {
        closeOthers: true,
        privatePlayer: false,
        url: false,
        snapshots: true,
        styles: false,
        stats: false,
        editablePlayer: false
    };

    $scope.sortableSnapOptions = {
        stop: function() {
            // $scope.playerObj.snapshots = _.
            console.debug('snaps: ', $scope.mappSnapshots);
            $scope.markAsDirty();
        }
    };

    /**
    * Scope methods
    */
    $scope.togglePlayer = togglePlayer;
    $scope.togglePlayerAccess = togglePlayerAccess;
    $scope.toggleEditable = toggleEditable;
    $scope.setPrivateUrl = setPrivateUrl;
    $scope.setAccessToken = setAccessToken;
    $scope.editToken = editToken;
    $scope.removeSnapshot = removeSnapshot;
    $scope.saveSnapshot = saveSnapshot;
    $scope.openSnapEditModal = openSnapEditModal;
    $scope.updatePlayer = updatePlayer;
    $scope.finalisePlayer = finalisePlayer;
    $scope.isUrlAvailable = isUrlAvailable;

    $scope.markAsDirty = function(){
        $scope.playerTempObj.playerDirty = true;
    };

    $scope.markAsPristine = function() {
        $scope.playerTempObj.playerDirty = false;
    };

    $scope.openSnapshotBar = function() {
        $scope.rightPanels.togglePublish();
    };

    $scope.getEnabledSnapshots = function(){
        return _.filter($scope.mappSnapshots, 'isEnabled');
    };



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.player.added, initPlayer);



    /*************************************
    ********* Initialise *****************
    **************************************/
    //Get project player
    initPlayer();



    /*************************************
    ********* Core Functions *************
    **************************************/

    function togglePlayer() {
        if($scope.playerObj && $scope.playerObj.isDisabled) {
            updateOp = 'enableMapp';
            $scope.updatePlayer();
        }
        else {
            updateOp = 'disableMapp';
            $scope.updatePlayer();
        }
    }

    function togglePlayerAccess() {
        if($scope.playerObj.isPrivate) {
            updateOp = 'public';
        }
        $scope.markAsDirty();
    }

    function toggleEditable() {
        if($scope.playerObj.isEditable) {
            updateOp = 'unEditableMapp';
        }
        else {
            updateOp = 'editableMapp';
        }

        $scope.markAsDirty();
    }

    function setPrivateUrl() {
        updateOp = 'privateUrl';
        $scope.markAsDirty();
    }

    function setAccessToken() {
        updateOp = 'accessToken';
        $scope.markAsDirty();
    }

    function editToken() {
        $scope.tokenEditMode = true;
        updateOp = 'newAccessToken';
        $scope.markAsDirty();
    }

    function removeSnapshot(snapId) {
        snapshotService.removeSnapshot(snapId)
        .then(function() {
            uiService.log('Snapshot removed successfully!');
        });
    }

    function saveSnapshot(snap) {
        snapshotService.updateSnapshot(snap, false) //2nd param: updateGraph
        .then(function() {
            uiService.log('Snapshot Updated successfully!');
        });
    }

    function openSnapEditModal(snap) {
        var modalInstance = $uibModal.open({
            size: 'lg',
            templateUrl : '#{server_prefix}#{view_path}/components/project/panels/snapshot/snapEditModal.html',
            controller : 'SnapEditModalCtrl',
            resolve: {
                currSnap: function() {
                    return snap;
                }
            }
        });

        //Called when modal is closed
        modalInstance.result
        .then(
            function(data) {
                console.debug('snap edit modal data: ', data);
                if(data.isDeleting) {
                    $scope.removeSnapshot(data.id);
                } else {
                    //save edited snapshot data
                    $scope.saveSnapshot(data.snap);
                }
            },
            function() {
                console.warn("Modal dismissed at: " + new Date());
            }
        ).finally(function() {

        });
    }

    function updatePlayer(){
        console.log(logPrefix + 'Updating player');
        if($scope.playerTempObj.isUniquePlayerUrl
         && $scope.playerObj.playerUrl != $scope.playerTempObj.playerUrl) {
            $scope.playerObj.embedCode = $sce.trustAsResourceUrl(domain + '/play/' + $scope.playerTempObj.playerUrl);
        }

        projFactory.currProject()
        .then(function(proj) {
            return playerFactory.updatePlayer(proj.org.ref, proj._id, $scope.playerTempObj);
        }).then(function(updatedPlayer) {
            var uiMsg;

            switch(updateOp) {
            case 'enableMapp':
                uiMsg = 'Mapp published!';
                break;
            case 'disableMapp':
                uiMsg = 'Mapp unpublished!';
                break;
            case 'public':
                uiMsg = 'Mapp is public now!';
                break;
            case 'privateUrl':
                uiMsg = 'Mapp is private now and can be accessed with provided private Url!';
                break;
            case 'accessToken':
                uiMsg = 'Mapp is private now and can be accessed only with access token!';
                $scope.tokenEditMode = false;
                break;
            case 'newAccessToken':
                uiMsg = 'Mapp\'s access key has been updated!';
                $scope.tokenEditMode = false;
                break;
            case 'editableMapp':
                uiMsg = 'Mapp is now editable';
                break;
            case 'unEditableMapp':
                uiMsg = 'Mapp can no longer make edits';
                break;
            default:
                uiMsg = 'Mapp updated!';
            }

            console.log(logPrefix + 'Player updated');
            $scope.playerObj = updatedPlayer;
            $scope.playerTempObj = _.cloneDeep($scope.playerObj);
            $scope.playerTempObj.playerExists = true;
            $scope.playerTempObj.isUniquePlayerUrl = true;
            $scope.markAsPristine();
            uiService.log(uiMsg);
            $rootScope.$broadcast(BROADCAST_MESSAGES.player.updated, {updateOp: updateOp});
        }, function(err) {
            console.error(logPrefix + 'Error while updating player ', err);
            $scope.playerTempObj = _.cloneDeep($scope.playerObj);
            $scope.playerTempObj.playerExists = true;
            $scope.playerTempObj.isUniquePlayerUrl = true;
            $scope.markAsPristine();
            uiService.logError('Some error occured and Mapp could not be updated!');
        });

    }

    function finalisePlayer() {
        projFactory.currProject()
        .then(function(proj) {
            return playerFactory.finalisePlayer(proj.org.ref, proj._id, $scope.playerTempObj);
        })
        .then(function() {
            console.log(logPrefix + 'player finalised');
        })
        .catch(function(err) {
            console.error(logPrefix + 'player could not be finalised', err);
        });
    }

    function isUrlAvailable(){

        if($scope.playerTempObj.playerUrl == $scope.playerObj.playerUrl) {
            console.info('Player url hasn\'t changed');
            return;
        }

        playerFactory.checkUrlAvailable($scope.playerTempObj.playerUrl)
        .then(function(result){
            if(result.isAvailable) {
                $scope.playerTempObj.isUniquePlayerUrl = true;
                $scope.markAsDirty();
            } else {
                $scope.playerTempObj.isUniquePlayerUrl = false;
            }
        });
    }

    function initPlayer() {
        playerFactory.currPlayer()
        .then(function(doc) {
            if(!doc) {
                console.warn('No player yet');
                $scope.playerTempObj.playerExists = false;

            }
            else {
                $scope.playerObj = doc;
                $scope.playerObj.playerUrlShortened = ($scope.playerObj.playerUrl.length > 10) ? $scope.playerObj.playerUrl.substring(0, 9) + '..' : $scope.playerObj.playerUrl;
                $scope.playerObj.embedCode = $sce.trustAsResourceUrl(domain + '/play/' + $scope.playerObj.playerUrl);
                $scope.playerTempObj = _.cloneDeep($scope.playerObj);
                $scope.playerTempObj.playerExists = true;
                $scope.playerTempObj.isUniquePlayerUrl = true;
            }
        }, function(err) {
            console.warn('No player yet', err);
            $scope.playerTempObj.playerExists = false;
        });

        snapshotService.getSnapshots()
        .then(function(snaps) {
            $scope.mappSnapshots = snaps;
        });
    }

}
]);
