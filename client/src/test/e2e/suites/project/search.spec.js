'use strict';
var searchPanel = require('../../page_objects/search_panel'),
    layouts = require('../../page_objects/layouts'),
    helpers = require('../../helpers');

describe('search panel', () => {

    it('should have project loaded', () => {
        expect(browser.getLocationAbsUrl()).toMatch(/projects\/\S+/);
    });

    it('should have search panel visible', () => {
        expect(searchPanel.panelElem.isDisplayed()).toBe(true);
    });

    describe('typing in search bar', () => {
        var selNodesCount = 0;

        it('should list search results', () => {
            searchPanel.searchText('Amber')
            .then(() => {
                browser.sleep(2000);
                return searchPanel.getResultsCount();
            })
            .then(count => {
                selNodesCount = count;
                expect(count).not.toBe(0);
            });
        });

        it('should select nodes on graph on clicking selectAll', () => {
            searchPanel.selectAllResults()
            .then(() => {
                browser.sleep(3000);
                console.log('Selected nodes count: ', selNodesCount);
                expect(layouts.getSelElemCount()).toBe(selNodesCount);
            });
        });

    });

    afterAll(() => {
        helpers.clickStage();
    });

});