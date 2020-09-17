angular.module('mappr')
.controller('MoveMappOrgCtrl', ['$scope', '$uibModalInstance', 'userFactory', 'projFactory', 'projectsToMove', 'uiService',
function($scope, $uibModalInstance, userFactory, projFactory, projectsToMove, uiService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlMoveMappOrg: ] ';
    var movingInd = 0;
    var movedAr = [];


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope variables
    */
    $scope.userSelection = {};
    $scope.showError = false;
    $scope.numberOfProjects = projectsToMove.length;

    /**
    * Scope methods
    */
    $scope.moveMappToSelectedOrg = moveMappToSelectedOrg;

    $scope.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
    };

    /*************************************
    ********* Event Listeners ************
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    // Initialize user orgs list
    userFactory.currUser()
    .then(function(user) {
        if(angular.isArray(user.orgs)) {
            $scope.currentOrg = _.find(user.orgs, 'ref', $scope.org.selected._id);
            $scope.userOrgsList = _.reject(user.orgs, function(org) {
                return (org.ref == $scope.org.selected._id) || org.role == 'member';
            });

            if($scope.userOrgsList.length === 0) {
                $scope.showError = true;
            }
            else {
                $scope.showError = false;
                $scope.userSelection.orgRef = $scope.userOrgsList[0].ref;
            }
        }
        else {
            console.error(logPrefix + 'Org list expected as array!');
        }

        console.log(user);
    });


    /*************************************
    ********* Core Functions *************
    **************************************/

    function moveMappToSelectedOrg() {
        if(!$scope.userSelection.orgRef) { throw new Error('No Org selected'); }
        console.log("moving project ref: ", projectsToMove[movingInd].ref);

        projFactory.changeProjectOrg($scope.org.selected._id, projectsToMove[movingInd].ref, $scope.userSelection.orgRef)
        .then(function(data) {
            var newOrgName = _.find($scope.userOrgsList, 'ref', $scope.userSelection.orgRef).orgName;
            console.log('Project moved to new org');
            console.log('Project: ' + projectsToMove[movingInd].projName + '  ,' + projectsToMove[movingInd].ref);
            console.log('New Org Id: ' + $scope.userSelection.orgRef);
            uiService.log('Project moved to ' + newOrgName + ' folder');
            movingInd++;
            movedAr.push(data);
            if(movingInd == projectsToMove.length){
                $uibModalInstance.close({
                    movedAr: movedAr
                });
            } else {
                $scope.moveMappToSelectedOrg();
            }
        });
    }

}
]);