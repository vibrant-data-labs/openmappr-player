/**
* Authentication modal directive
*/
angular.module('common')
    .directive('authModal', ['authService', '$rootScope', 'BROADCAST_MESSAGES',
        function(authService, $rootScope, BROADCAST_MESSAGES) {
            'use strict';

            return {
                restrict: 'E',
                template: `
                    <div id="auth-modal" style="display: none;">
                        <div class="auth-content">
                            <h2>Enter Password</h2>
                            <form id="auth-form">
                                <input id="password-input" type="password" placeholder="Enter password">
                                <button id="submit-password" type="submit">Submit</button>
                            </form>
                        </div>
                    </div>
                `,
                link: function(scope, element) {
                    const authModal = element.find('#auth-modal');
                    const passwordInput = element.find('#password-input');
                    const authForm = element.find('#auth-form');
                    const content = angular.element(document.querySelector('.view-container'));

                    // Hide the main content initially
                    content.css('display', 'none');

                    // Check if already authenticated
                    if (authService.isAuthenticated()) {
                        authModal.css('display', 'none');
                        content.css('display', 'block');
                        return;
                    }

                    // Load password hash and show modal if needed
                    authService.getPasswordHash()
                        .then(function(hash) {
                            if (!hash) {
                                // No password required
                                localStorage.setItem('openmappr_authenticated', 'true');
                                window.location.reload();
                                return;
                            }

                            // Show the auth modal
                            authModal.css('display', 'block');

                            authForm.on('submit', function(e) {
                                e.preventDefault();
                                const inputHash = CryptoJS.SHA256(passwordInput.val()).toString();
                                
                                if (inputHash === hash) {
                                    localStorage.setItem('openmappr_authenticated', 'true');
                                    window.location.reload();
                                } else {
                                    alert('Incorrect password');
                                    passwordInput.val('');
                                }
                            });
                        })
                        .catch(function(error) {
                            console.error('Error in auth modal:', error);
                            // If there's an error, allow access
                            localStorage.setItem('openmappr_authenticated', 'true');
                            window.location.reload();
                        });
                }
            };
        }
    ]); 