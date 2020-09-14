'use strict';
var helpers = require('../../helpers');
var loginPage = require('../../page_objects/login_page');
var params = browser.params;

describe('login module', function() {

    describe('login process', function() {

        it('should display error message for missing email', function() {
            loginPage.setEmail('');
            loginPage.setPassword(params.login.password);
            loginPage.login()
            .then(function() {
                expect(loginPage.errorMsg.getText()).toBe('Please enter your email & password!');
                expect(browser.getLocationAbsUrl()).toBe('/');
            });
        });

        it('should display error message for missing password', function() {
            expect(browser.getLocationAbsUrl()).toBe('/');
            browser.setLocation('/');
            loginPage.setEmail(params.login.user);
            loginPage.setPassword('');
            loginPage.login()
            .then(function() {
                expect(loginPage.errorMsg.getText()).toBe('Please enter your email & password!');
                expect(browser.getLocationAbsUrl()).toBe('/');
            });
        });

        it('should display error message for missing email & password', function() {
            expect(browser.getLocationAbsUrl()).toBe('/');
            browser.setLocation('/');
            loginPage.setEmail('');
            loginPage.setPassword('');
            loginPage.login()
            .then(function() {
                expect(loginPage.errorMsg.getText()).toBe('Please enter your email & password!');
                expect(browser.getLocationAbsUrl()).toBe('/');
            });
        });

        it('should display error message for incorrect credentials', function() {
            expect(browser.getLocationAbsUrl()).toBe('/');
            browser.setLocation('/');
            loginPage.setEmail(params.login.user);
            loginPage.setPassword('12345');
            loginPage.login()
            .then(function() {
                expect(loginPage.errorMsg.getText()).toBe('Error logging in. Please check your username and password.');
                expect(browser.getLocationAbsUrl()).toBe('/');
            });
        });

        it('should login successfully', function() {
            helpers.login();
            browser.getLocationAbsUrl()
            .then(function(url) {
                expect(['/admin', '/user-projects', '/org-admin']).toContain(url);
            });
        });

    });


});