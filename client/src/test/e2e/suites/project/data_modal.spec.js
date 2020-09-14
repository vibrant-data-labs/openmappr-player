'use strict';
var dataModal = require('../../page_objects/data_modal'),
    projPage = require('../../page_objects/proj_page');

describe('data modal ops', function() {

    it('should have project loaded', function() {
        expect(browser.getLocationAbsUrl()).toMatch(/projects\/\S+/);
    });

    it('should open data modal', function() {
        projPage.openDataModal()
        .then(() => {
            expect(element(by.id(dataModal.modalId)).isPresent()).toBe(true);
            dataModal.dsAttrsList
            .then(attrs => {
                expect(attrs.length).toBeGreaterThan(1); //If attrs list is displayed
            });
        });
    });

    describe('modify single attr', function() {

        it('should toggle visiblity', function() {
            var attrFinder = dataModal.getAttrByIdx(0);

            dataModal.toggleAttrVisibility(attrFinder)
            .then(function(attrClassStr) {
                console.log(attrClassStr.split(' '));
                expect(attrClassStr.split(' ')).toContain('text-muted-light');
            })
            .then(() => dataModal.toggleAttrVisibility(attrFinder))
            .then(attrClassStr => {
                expect(attrClassStr.split(' ')).not.toContain('text-muted-light');
            });
        });

    });

    afterAll(() => {
        dataModal.closeModal();
    });

	// Data Modal needs UI fixes in order to write more tests

});