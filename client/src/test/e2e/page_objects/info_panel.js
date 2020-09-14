'use strict';

var rightPanelElem = element(by.id('right-panel')),
    infoPanelElem = rightPanelElem.element(by.css('[ng-controller="InfoPanelCtrl"]')),
    toggleInfoPanelBtn = infoPanelElem.element(by.css('[ng-click="panelUI.togglePanel(\'info\');"]')),
    networkInfoElem = infoPanelElem.element(by.tagName('dir-network-info')).all(by.tagName('div')).get(0),
    archsList = networkInfoElem.all(by.repeater('node in topArchetypes')),
    neighborNodesContainer = infoPanelElem.element(by.tagName('dir-neighbor-nodes')),
    neighborsList = neighborNodesContainer.all(by.repeater('neighbor in nodeNeighbors'));

module.exports = {
    networkInfoElem: networkInfoElem,
    neighborNodesContainer: neighborNodesContainer,

    openInfoPanel: function() {
        return toggleInfoPanelBtn.click();
    },
    getTopArchsCount: function() {
        return networkInfoElem.evaluate('topArchetypes.length');
    },
    getTopBridgersCount: function() {
        return networkInfoElem.evaluate('topBridgers.length');
    },
    selectArchByIdx: function(idx) {
        return archsList.get(idx).click();
    },
    getNeighborNodesCount: function() {
        return neighborsList.count();
    }
};