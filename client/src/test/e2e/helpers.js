'use strict';
var loginPage = require('./page_objects/login_page');
var projDash = require('./page_objects/proj_dash');
var params = browser.params;

module.exports = {
    login : function() {
        browser.setLocation('/');
        loginPage.setEmail(params.login.user);
        loginPage.setPassword(params.login.password);
        return loginPage.login();
    },

    logout : function() {
        browser.setLocation('/user-projects');
        return projDash.logout();
    },

    createEmptyProj: function() {
        browser.sleep(5000); //wait for UI notification to disappear, so that element is clickable
        return projDash.createEmptyProj();
    },

    pauseBrowser: function() {
        browser.pause(5859);
    },

    clickStage: function() {
        return browser.actions()
        .mouseMove(element(by.tagName('body')), {x: 100, y: 200})
        .click()
        .perform();
    }
};