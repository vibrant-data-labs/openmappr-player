/**
* Handles authentication operations
*/
angular.module('common')
    .service('authService', ['$http', '$q', '$rootScope', 'BROADCAST_MESSAGES',
        function ($http, $q, $rootScope, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
            *************** API ******************
            **************************************/
            this.isAuthenticated = isAuthenticated;
            this.authenticate = authenticate;
            this.checkPassword = checkPassword;
            this.getPasswordHash = getPasswordHash;

            /*************************************
            ********* Local Data *****************
            **************************************/
            var passwordHash = null;

            /*************************************
            ********* Core Functions *************
            **************************************/
            function isAuthenticated() {
                return localStorage.getItem('openmappr_authenticated') === 'true';
            }

            function authenticate() {
                console.log('Authenticating...')
                localStorage.setItem('openmappr_authenticated', 'true');
                $rootScope.$broadcast(BROADCAST_MESSAGES.auth.authenticated);
                window.location.reload();
            }

            function checkPassword(inputPassword) {
                if (!passwordHash) {
                    return $q.resolve(true);
                }

                const inputHash = CryptoJS.SHA256(inputPassword).toString();
                const isValid = inputHash === passwordHash;

                if (isValid) {
                    authenticate();
                }

                return $q.resolve(isValid);
            }

            function getPasswordHash() {
                return $http.get(DATA_PATH + 'settings.json')
                    .then(function(response) {
                        passwordHash = response.data.player?.settings?.passwordHash;
                        if (!passwordHash) {
                            return null;
                        }
                        return {
                            passwordHash: passwordHash,
                            title: response.data.player?.settings?.headerTitle
                        };
                    })
                    .catch(function(error) {
                        console.error('Error loading settings:', error);
                        authenticate();
                        return null;
                    });
            }
        }
    ]); 