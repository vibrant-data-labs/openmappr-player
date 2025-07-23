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
            this.clearAuthCache = clearAuthCache;

            /*************************************
            ********* Local Data *****************
            **************************************/
            var passwordHash = null;

            /*************************************
            ********* Core Functions *************
            **************************************/
            function isAuthenticated() {
                const cachedHash = localStorage.getItem('openmappr_password_hash');

                // If no cached hash, user is not authenticated
                if (cachedHash === null) {
                    return false;
                }

                // If we haven't loaded the current password hash yet, 
                // we can't validate, so return false to trigger authentication
                if (passwordHash === null) {
                    return false;
                }

                // If no password is required, authentication is valid
                if (!passwordHash) {
                    return true;
                }

                // If password hash doesn't match, clear cache and return false
                if (cachedHash !== passwordHash) {
                    clearAuthCache();
                    return false;
                }

                return true;
            }

            function authenticate() {
                console.log('Authenticating...')
                // Store the current password hash (or empty string if no password required)
                localStorage.setItem('openmappr_password_hash', passwordHash || '');
                $rootScope.$broadcast(BROADCAST_MESSAGES.auth.authenticated);
                window.location.reload();
            }

            function clearAuthCache() {
                localStorage.removeItem('openmappr_password_hash');
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