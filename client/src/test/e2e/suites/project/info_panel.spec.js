'use strict';
var infoPanel = require('../../page_objects/info_panel'),
    helpers = require('../../helpers');

describe('info_panel', function() {

    beforeAll(() => {
        infoPanel.openInfoPanel();
    });

    describe('network_info', () => {

        it('should have network info opened by default', () => {
            expect(infoPanel.networkInfoElem.isPresent()).toBe(true);
            expect(infoPanel.networkInfoElem.getInnerHtml()).not.toBe("");
        });

        it('should show top archetypes and bridgers', () => {
            expect(infoPanel.getTopArchsCount()).toBeGreaterThan(1);
            expect(infoPanel.getTopBridgersCount()).toBeGreaterThan(1);
        });

        it('should open selection info', () => {
            infoPanel.selectArchByIdx(0)
            .then(() => {
                expect(infoPanel.neighborNodesContainer.getInnerHtml()).not.toBe("");
                expect(infoPanel.getNeighborNodesCount()).toBeGreaterThan(1);
            });
        });

    });

    afterAll(() => {
        helpers.clickStage();
    });

});