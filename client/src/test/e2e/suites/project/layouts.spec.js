'use strict';

var layoutTogglePanel = require('../../page_objects/layouttoggle_panel'),
    layoutPanel = require('../../page_objects/layout_panel'),
    layouts = require('../../page_objects/layouts');

describe('Layout creator', () => {

    it('should have project loaded', () => {
        expect(browser.getLocationAbsUrl()).toMatch(/projects\/\S+/);
    });

    // it('should open layout panel', () => {

    //     layoutTogglePanel.openLayoutPanel()
    //     .then(() => {
    //         expect(layoutPanel.isPanelVisible()).toBe(true);
    //     });

    // });

    describe('scatterplot layout', () => {

        it('should create scatterplot layout', () => {
            layoutTogglePanel.createScatterplot()
            .then(() => {
                expect(layoutPanel.isPanelVisible()).toBe(true);
                expect(layouts.scatterplotElem.isDisplayed()).toBe(true);
                expect(layouts.scatterXTitle.getText()).toBe('OriginalX');
                expect(layouts.scatterYTitle.getText()).toBe('OriginalY');
            });
        });

        it('should update scatterplot X axis', () => {
            layoutPanel.setXAttrByIdx(12)
            .then(() => layoutPanel.getSelXAttr())
            .then(attrId => {
                console.log('Selected X attr: ', attrId);
                expect(layouts.scatterXTitle.getText()).toBe(attrId);
            });
        });

        it('should update scatterplot Y axis', () => {
            layoutPanel.setYAttrByIdx(13)
            .then(() => layoutPanel.getSelYAttr())
            .then(attrId => {
                console.log('Selected X attr: ', attrId);
                expect(layouts.scatterYTitle.getText()).toBe(attrId);
            });
        });

    });

    describe('geo layout', () => {

        it('should create geo layout', () => {
            layoutTogglePanel.createGeo()
            .then(() => {
                expect(layoutPanel.isPanelVisible()).toBe(true);
                expect(layouts.geoElem.isDisplayed()).toBe(true);
            });
        });

    });

    describe('cluster layout', () => {
        it('should open cluster layout', () => {
            layoutTogglePanel.createCluster()
            .then(() => {
                expect(layoutPanel.getCurrentLayoutName()).toBe('Original');
                expect(layoutPanel.getClusterLayoutNameOpt()).toBe('Clustered_1');
            });
        });

        it('should generate and save a new cluster layout', () => {
            layoutPanel.setClusterClumpiness('0.7');

            layoutPanel.createClusterLayout()
            .then(() => {
                browser.sleep(5000);
                expect(layoutPanel.getCurrentLayoutName()).toBe('Clustered_1');
                return layoutPanel.switchClusterLayout('Original');
            })
            .then(() => {
                expect(layoutPanel.getCurrentLayoutName()).toBe('Original');
            });
        });
    });

    it('should close layout panel', () => {
        layoutPanel.closePanel()
        .then(() => {
            expect(layoutPanel.isPanelVisible()).toBe(false);
        });
    });

});