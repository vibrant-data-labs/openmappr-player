angular.module('mappr')
.controller('OldProjectListingCtrl', ['$scope','$timeout' ,'$http' ,'userFactory', 'BROADCAST_MESSAGES', 'uiService',
function($scope, $timeout, $http, userFactory, BROADCAST_MESSAGES, uiService) {
    'use strict';

    var old_projects = $scope.old_projects = [];
    $scope.org.projectSearchKey = '';

    function ProjectVM(id, projName, ownerName, ownerRef, dateModified) {
        this.id = id;
        this.projName = projName;
        this.owner = {
            ref : ownerRef,
            name : ownerName
        };
        this.dateModified = dateModified;
    }
    ProjectVM.prototype.migrate = function() {
        uiService.log("Beginning migration of project " + this.projName);
        $http.post('/api/maintain/migrate_project', {
            email : userFactory._currentUser().email,
            orgName : $scope.org.selected.orgName,
            projectId : this.id
        }).then(function(resp) {
            console.log(resp);
            uiService.logSuccess("Migrated project successfully. Check the new project tab");
        }, function(err) {
            console.log(err);
            uiService.logError("Error in migration, check console.");
        });
    };
    userFactory.currUser()
    .then(function(user) {
        $http.post('/api/maintain/list_old_projects', {
            "email" : user.email
        }).then(function(respData) {
            if(respData.data.length > 0)
                old_projects.length = 0;
            _.each(respData.data, function(user_proj) {
                var splitted = user_proj.owner.split(',',4);
                if(splitted.length != 4) return;
                var name = splitted[1].match(/:.'([\w]+)'/)[1];
                var ref = splitted[3].match(/:.'([\w]+)'/)[1];
                var projObj = new ProjectVM(user_proj.ref, user_proj.projName,
                                            name, ref, user_proj.dateJoined);
                old_projects.push(projObj);
            });
        });
    });
}
]);