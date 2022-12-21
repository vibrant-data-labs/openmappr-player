angular.module('common')
    .controller('LayoutDropdownCtrl', ['$scope', '$rootScope', 'BROADCAST_MESSAGES',
        function($scope, $rootScope, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
             ************ Local Data **************
             **************************************/
            // var logPrefix = '[ctrlLayoutDropdown: ] ';

            /*************************************
             ********* Scope Bindings *************
             **************************************/
            /**
             *  Scope data
             */

            $scope.setSnapActive = function(snap) {
                $rootScope.$broadcast(BROADCAST_MESSAGES.player.snapshotChanged, snap);
            };


            /**
             * Scope methods
             */

            /*************************************
             ****** Event Listeners/Watches *******
             **************************************/

            /*************************************
             ********* Initialise *****************
             **************************************/

            /*************************************
             ********* Core Functions *************
             **************************************/


        }
    ]);
