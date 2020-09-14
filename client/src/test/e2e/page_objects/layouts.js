'use strict';
var _ = require('lodash');

var graphElem = element(by.tagName('sig')),
    graphContainerElem = graphElem.element(by.css('.graph-container')),
    clusterLabelsContainer = graphContainerElem.element(by.css('.sigma-d3-labels')),
    sigmaSelectionsContainer = graphContainerElem.element(by.css('.sigma-d3-selections'));

var scatterplotElem = element(by.tagName('drawaxis')),
    scatterXTitle = scatterplotElem.element(by.css('.xaxis-tit span')),
    scatterYTitle = scatterplotElem.element(by.css('.yaxis-tit span'));

var geoElem = element(by.tagName('geolayout'));

module.exports = {
    scatterplotElem: scatterplotElem,
    scatterXTitle: scatterXTitle,
    scatterYTitle: scatterYTitle,

    geoElem: geoElem,

    getSelElemCount: function getSelElemCount() {
        return sigmaSelectionsContainer.all(by.css('.sigma-d3-node'))
                .filter(elem => elem.getAttribute('class')
                        .then(classListStr => _.contains(classListStr.split(' '), 'sigma-d3-node-selected') ))
                .count();
    },
    selectClusterByLabel: function(clusterLabel) {
        return clusterLabelsContainer.element(by.css('[data-node-id="' + clusterLabel + '"]')).click();
    }
};