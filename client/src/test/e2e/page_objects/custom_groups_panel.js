'use strict';

var rightPanelElem = element(by.id('right-panel')),
    groupsPanelElem = rightPanelElem.element(by.css('[ng-controller="SelectionSetsCtrl"]')),
    togglePanelBtn = groupsPanelElem.element(by.css('[ng-click="panelUI.togglePanel(\'selection\');"]')),
    createNewGroupBtn = groupsPanelElem.element(by.css('[ng-click="addNewSelection(); panelUI.openPanel(\'selection\')"]')),
    saveNewGroupBtn = groupsPanelElem.element(by.css('[ng-click="selVM.create();"]')),
    groupsList = groupsPanelElem.all(by.repeater('selVM in selectionVMs'));

module.exports = {
    openPanel: function() {
        return togglePanelBtn.click();
    },
    getGroupsCount: function() {
        return groupsList.count();
    },
    createNewGroup: function() {
        return createNewGroupBtn.click()
		.then(() => saveNewGroupBtn.click());
    },
    addSelectedNodesToGroupByIdx: function(idx) {
        var addNodesBtn = groupsList.get(idx).element(by.css('[ng-click="selVM.addDatapoints();"]'));
        return addNodesBtn.click();
    },
    getGroupNodesCountByIdx: function(idx) {
        return groupsList.get(idx).evaluate('selVM.dpIDs.length');
    },
    renameGroupByIdx: function(newName, idx) {
        var group = groupsList.get(idx),
            moreOpsBtn = group.element(by.css('[ng-click="selVM.showButs = true;"]')),
            editNameBtn = group.element(by.css('[uib-tooltip="Edit Group Name"]')),
            saveNameBtn = group.element(by.css('[ng-click="$event.stopPropagation(); selVM.updateName();"]')),
            nameInput = group.element(by.model('selVM.selName'));
        return moreOpsBtn.click()
        .then(() => editNameBtn.click())
        .then(() => {
            nameInput.clear();
            return nameInput.sendKeys(newName);
        })
        .then(() => saveNameBtn.click());
    },
    getGroupNameByIdx: function(idx) {
        return groupsList.get(idx).evaluate('selVM.selName');
    },
    deleteGroupByIdx: function(idx) {
        var group = groupsList.get(idx),
            // moreOpsBtn = group.element(by.css('[ng-click="selVM.showButs = true;"]')),
            deleteGroupBtn = group.element(by.css('[uib-tooltip="Delete Group"]'));
        return deleteGroupBtn.click();
    }
};