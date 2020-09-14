'use strict';
var _ = require('lodash');

var headerElem = element(by.css('[ng-controller="HeaderCtrl"]')),
    dashElem = element(by.css('.page-projectlist')),
    newProjBtn = headerElem.element(by.css('[ng-click="project.createProjAndEnter();"]')),
    projList = dashElem.all(by.repeater('proj in org.selected.projects')),
    profileDropdown = headerElem.element(by.className('nav-profile')).element(by.tagName('a')),
    orgDropdown = headerElem.element(by.id('orgDropdown')).element(by.tagName('span')),
    orgList = element.all(by.css('[ng-click="org.selectByRef(orgItem.ref, ui.goToOrgAssetList)"]')),
    logoutBtn = headerElem.element(by.css('[ng-click="logout()"]')),
    delProjBtn = dashElem.element(by.css('[action="project.removeProject(proj.ref);"]')),
    renameProjBtn = dashElem.element(by.css('[ng-click="ui.enterProjectEditMode(proj); $event.stopPropagation();"]')),
    moreOpsBtn = dashElem.element(by.css('[ng-click="$event.stopPropagation(); proj.showExpandedMenu = true;"]')),
    cloneProjBtn = dashElem.element(by.css('[ng-click="project.cloneProject(proj.ref); $event.stopPropagation();"]'));

function hoverOnProjByIdx(idx) {
    return browser.actions().mouseMove(projList.get(idx)).perform();
}

module.exports = {
    newProjBtn : newProjBtn,
    projList : projList,
    profileDropdown : profileDropdown,
    orgDropdown: orgDropdown,
    orgList: orgList,
    logoutBtn : logoutBtn,

    createEmptyProj : function() {
        return newProjBtn.click();
    },
    logout : function() {
        return profileDropdown.click()
			.then(() => logoutBtn.click());
    },
    selectOrg: function(org) {
        return orgDropdown.click()
        .then(() => {
            return orgList.filter(orgElem => {
                return orgElem.element(by.tagName('a')).element(by.tagName('h6')).getText()
					.then(orgName => _.trim(orgName) == org);
            }).first().click();
        });
    },
    deleteProjByIdx: function(idx) {
        return hoverOnProjByIdx(idx)
        .then(() => delProjBtn.click())
        .then(() => element(by.css('[ng-click="deleteAction();"]')).click());
    },
    getProjCount: function() {
        return projList.count();
    },
    renameProjByIdx: function(newProjName, idx) {
        var projInput = dashElem.element(by.model('ui.projForm.projName')),
            updateProjBtn = dashElem.element(by.css('[ng-click="project.updateProject(proj, ui.projForm); $event.stopPropagation();"]'));

        return hoverOnProjByIdx(idx)
        .then(() => renameProjBtn.click())
        .then(() => {
            projInput.clear();
            return projInput.sendKeys(newProjName);
        })
        .then(() => updateProjBtn.click());
    },
    getProjNameByIdx: function(idx) {
        return projList.get(idx).evaluate('proj.projName');
    },
    cloneProject: function(idx) {
        return hoverOnProjByIdx(idx)
        .then(() => moreOpsBtn.click())
        .then(() => cloneProjBtn.click());
    }
};