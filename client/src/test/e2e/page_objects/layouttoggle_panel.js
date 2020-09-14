'use strict';

var panelElem = element(by.id('bottom-left-btns')).element(by.css('[ng-controller="LayoutToggleCtrl"]')),
    layoutList = panelElem.all(by.repeater('layout in layouts')),
    scatterplotBtn = layoutList.filter(elem => elem.evaluate('layout.plotType').then(layout => layout == 'scatterplot')).first(),
    clusterBtn = layoutList.filter(elem => elem.evaluate('layout.plotType').then(layout => layout == 'layout_generator_layout_clustered')).first(),
    geoBtn = layoutList.filter(elem => elem.evaluate('layout.plotType').then(layout => layout == 'geo')).first(),
    listBtn = layoutList.filter(elem => elem.evaluate('layout.plotType').then(layout => layout == 'list')).first(),
    layoutPanelBtn = element(by.css('[ng-click="openLayoutPanel()"]'));

module.exports = {
    panelElem: panelElem,
    scatterplotBtn : scatterplotBtn,
    geoBtn : geoBtn,
    listBtn : listBtn,

    openLayoutPanel: function openLayoutPanel() {
        return layoutPanelBtn.click();
    },
    createGeo: function createGeo() {
        return browser.actions().mouseMove(panelElem).perform()
        .then(() => geoBtn.click());
    },
    createScatterplot: function createScatterplot() {
        return browser.actions().mouseMove(panelElem).perform()
        .then(() => scatterplotBtn.click());
    },
    createCluster: function createCluster() {
        return browser.actions().mouseMove(panelElem).perform()
        .then(() => clusterBtn.click());
    }
};