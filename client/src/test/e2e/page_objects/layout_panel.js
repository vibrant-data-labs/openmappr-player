'use strict';

var panelElem = element(by.css('[ng-controller="LayoutPanelCtrl"]')),
    primaryOptions = element.all(by.exactRepeater('opt in layout.options.primary')),
    scatterXAttr = findLayoutOptionByTitle('xAttr'),
    scatterYAttr = findLayoutOptionByTitle('yAttr'),
    xAttrDropdown = scatterXAttr.all(by.css('[ng-click="checkUp()"]')).first(),
    yAttrDropdown = scatterYAttr.all(by.css('[ng-click="checkUp()"]')).first(),

    clusterClumpiness = findLayoutOptionByTitle('Clumpiness'),
    clusterLayoutName = findLayoutOptionByTitle('Layout Name'),
    clusterPanel = panelElem.all(by.css('.panel-list .panel-item'))
                                .filter(elem => elem.evaluate('layout.name')
                                                .then(layoutName => layoutName == 'Cluster'))
                                .first(),
    createClusterLayoutBtn = clusterPanel.element(by.css('[ng-click="layout.refresh()"]')),
    closePanelBtn = panelElem.element(by.css('[ng-click="panelUI.openPanel(\'summary\');"]'));

function findLayoutOptionByTitle(title) {
    return primaryOptions.filter(elem => elem.evaluate('opt.title').then(actualTitle => actualTitle == title))
            .first();
}

module.exports = {
    panelElem: panelElem,
    primaryOptions: primaryOptions,
    scatterXAttr: scatterXAttr,
    scatterYAttr: scatterYAttr,

    clusterLayoutName: clusterLayoutName,

    isPanelVisible: function() {
        return panelElem.evaluate('panelUI.layoutPanelOpen');
    },
    setXAttrByIdx: function(idx) {
        return xAttrDropdown.click()
        .then(() => element.all(by.css('.uib-dropdown-menu'))
                    .filter(elem => elem.isDisplayed().then(isDisplayed => isDisplayed)).first())
        .then(attrDropdown => attrDropdown.all(by.repeater('val in valsList')).get(idx).click());
    },
    setYAttrByIdx: function(idx) {
        return yAttrDropdown.click()
        .then(() => element.all(by.css('.uib-dropdown-menu'))
                    .filter(elem => elem.isDisplayed().then(isDisplayed => isDisplayed)).first())
        .then(attrDropdown => attrDropdown.all(by.repeater('val in valsList')).get(idx).click());
    },
    getSelXAttr: function() {
        return scatterXAttr.evaluate('opt.input_value');
    },
    getSelYAttr: function() {
        return scatterYAttr.evaluate('opt.input_value');
    },

    setClusterClumpiness: function setClusterClumpiness(clumpiness) {
        return clusterClumpiness.evaluate('opt.input_value = ' + clumpiness);
    },
    getClusterLayoutNameOpt: function getClusterLayoutNameOpt() {
        return clusterLayoutName.evaluate('opt.input_value');
    },
    createClusterLayout: function createClusterLayout() {
        return createClusterLayoutBtn.click();
    },
    getCurrentLayoutName: function getCurrentLayoutName() {
        return panelElem.evaluate('layoutPanel.focusLayout.name');
    },
    switchClusterLayout: function switchClusterLayout(layoutName) {
        return clusterPanel
                .element(by.css('[uib-dropdown-toggle="uib-dropdown-toggle"]')).click()
                .then(() => element.all(by.css('.uib-dropdown-menu'))
                            .filter(elem => elem.isDisplayed().then(isDisplayed => isDisplayed)).first()
                            .all(by.repeater('layout in layouts'))
                            .filter(elem => elem.evaluate('layout.name')
                                            .then(name => layoutName == name))
                            .first().click());
    },
    closePanel: function closePanel() {
        return closePanelBtn.click();
    }
};