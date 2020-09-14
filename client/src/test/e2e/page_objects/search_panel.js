'use strict';

var panelElem = element(by.css('[ng-controller="SearchPanelCtrl"]')),
    searchInput = panelElem.element(by.model('globalSearch.text')),
    resultsContainer = panelElem.element(by.css('.panel-scroll .panel-list')),
    resultsList = resultsContainer.all(by.repeater('node in searchResults')),
    selectAllBtn = panelElem.element(by.css('[ng-click="selectAllNodes(); $event.stopPropagation();"]'));


module.exports = {
    panelElem: panelElem,

    searchText: function searchText(query) {
        searchInput.clear();
        return searchInput.sendKeys(query);
    },
    getResultsCount: function getResultsCount() {
        return resultsList.count();
    },
    selectAllResults: function selectAllResults() {
        return selectAllBtn.click();
    }
};