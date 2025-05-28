/**
* Authentication modal directive
*/
angular.module('common')
    .directive('authModal', ['authService', '$rootScope', 'BROADCAST_MESSAGES',
        function (authService, $rootScope, BROADCAST_MESSAGES) {
            'use strict';

            return {
                restrict: 'E',
                template: `
                    <div id="auth-modal" style="display: none;">
                        <div class="auth-content">
                            <h2>{{ title }}</h2>
                            <h4>Authentication Required</h4>
                            <form id="auth-form">
                                <div class="auth-form-group">
                                    <div class="password-input-wrapper">
                                        <input id="password-input" type="password" placeholder="Enter password">
                                        <button type="button" class="toggle-password" ng-click="togglePassword()">
                                            <i class="fa" ng-class="{'fa-eye': !showPassword, 'fa-eye-slash': showPassword}"></i>
                                        </button>
                                    </div>
                                    <span ng-show="error" class="error-message">Incorrect password</span>
                                    <button class="auth-button" type="submit" ng-click="submitPassword()">Submit</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `,
                link: function (scope, element) {
                    const authModal = element.find('#auth-modal');
                    const passwordInput = element.find('#password-input');
                    const authForm = element.find('#auth-form');
                    const content = angular.element(document.querySelector('.view-container'));

                    // Initialize showPassword state
                    scope.showPassword = false;

                    // Toggle password visibility
                    scope.togglePassword = () => {
                        scope.showPassword = !scope.showPassword;
                        passwordInput.attr('type', scope.showPassword ? 'text' : 'password');
                    };

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
                        .then(({ title, passwordHash }) => {
                            scope.title = title;
                            if (!passwordHash) {
                                // No password required
                                localStorage.setItem('openmappr_authenticated', 'true');
                                window.location.reload();
                                return;
                            }

                            // Show the auth modal
                            authModal.css('display', 'block');

                            scope.submitPassword = () => {
                                scope.error = false;
                                const inputHash = CryptoJS.SHA256(passwordInput.val()).toString();

                                if (inputHash === passwordHash) {
                                    localStorage.setItem('openmappr_authenticated', 'true');
                                    window.location.reload();
                                } else {
                                    scope.error = true;
                                    passwordInput.val('');
                                    return false;
                                }
                            };
                        })
                        .catch(function (error) {
                            console.error('Error in auth modal:', error);
                            // If there's an error, allow access
                            localStorage.setItem('openmappr_authenticated', 'true');
                            window.location.reload();
                        });
                }
            };
        }
    ]); 