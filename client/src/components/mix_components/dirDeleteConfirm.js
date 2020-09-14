angular.module('mappr')
.directive('dirDeleteConfirm', ['$uibModal',
function($uibModal) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        scope: {
            //title of modal
            title: '@',
            //delete function
            action: '&',
            //name of object (if leave off title, then 'Delete [objName]'' is used')
            objName: '@',
            //method called when opening the modal to get info about the object needing to be deleted
            //if want to get info when modal launched
            getObjInfo: '&',
            //info about the object about to be deleted in array of {name: ,val: }
            objInfo: '=',
            //size of modal 'lg' or 'sm', defaults to small
            size: '@'
        },
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {
        var modalInstance;
        var modalConfig = {};

        function safeApply(func) {
            if(scope.$$phase != '$apply' || scope.$$phase != '$digest') {
                scope.$apply(function() {
                    func();
                });
            }
            else {
                func();
            }
        }

        scope.closeModal = function() {
            console.log('closing modal');
            modalInstance.dismiss('cancel');
        };

        scope.deleteAction = function() {
            scope.action();
            scope.closeModal();
        };

        $(element).on('click', function() {
            //call method to get info about object deleting
            if(_.isFunction(scope.getObjInfo)) {
                safeApply(scope.getObjInfo);
            }
            else throw new Error('Function not passed');

            modalConfig = {
                templateUrl : '#{server_prefix}#{view_path}/components/mix_components/deleteConfirmModal.html',
                scope: scope
            };

            if(_.isString(scope.size)) modalConfig['size'] = scope.size;
            modalInstance = $uibModal.open(modalConfig);
        });
    }

    return dirDefn;
}
]);