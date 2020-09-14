'use strict';
var helpers = require('../../helpers'),
    params = browser.params,
    path = require('path'),
    projDash = require('../../page_objects/proj_dash'),
    diModal = require('../../page_objects/dataingest_modal'),
    netgenModal = require('../../page_objects/netgen_modal');

describe('project creation workflow', function() {

    // beforeAll(function() {
    //     browser.setLocation('/user-projects')
    //     .then(() => projDash.selectOrg(params.test_org));
    // });

    describe('create project and upload empty file', function() {

        it('should create empty project', function() {
            browser.setLocation('/user-projects');
            expect(browser.getLocationAbsUrl()).toMatch('/user-projects');
            helpers.createEmptyProj();
            browser.waitForAngular();
            var fileTab = diModal.fileTab;
            expect(fileTab.isPresent()).toBe(true);
        });

        it('should upload a file but not proceed to import phase', function() {
            var fileToUpload = '../../../datasets/Empty_file.xlsx',
                absolutePath = path.resolve(__dirname, fileToUpload);

            diModal.uploadFile(absolutePath)
            .then(() => {
                expect(diModal.importDataBtn.isPresent()).toBe(false);
                expect(diModal.fileTab.isPresent()).toBe(true);
            });
        });
    });

    describe('create project and ingest file with network', function() {

        it('should have upload modal opened', function() {
            expect(diModal.fileTab.isPresent()).toBe(true);
        });

        it('should upload a file', function() {
            var fileToUpload = '../../../datasets/HC_500(network).xlsx',
                absolutePath = path.resolve(__dirname, fileToUpload);

            diModal.uploadFile(absolutePath)
            .then(() => {
                expect(diModal.importDataBtn.isPresent()).toBe(true);
            });
        });

        it('should ingest data into project', function() {
            diModal.importData()
            .then(() => {
                expect(diModal.modalContainer.isPresent()).toBe(false);
            });
        });

        it('should render graph', function() {
            var sig = element(by.css('sig'));
            expect(sig.isPresent()).toBe(true);
        });

    });

    describe('ingest file without network', function() {

        it('should create empty project', function() {
            browser.setLocation('/user-projects');
            expect(browser.getLocationAbsUrl()).toMatch('/user-projects');
            helpers.createEmptyProj();
            browser.waitForAngular();
            var fileTab = diModal.fileTab;
            expect(fileTab.isPresent()).toBe(true);
        });

        it('should upload a file', function() {
            var fileToUpload = '../../../datasets/HC_500(nodes).xlsx',
                absolutePath = path.resolve(__dirname, fileToUpload);

            diModal.uploadFile(absolutePath)
            .then(function() {
                expect(diModal.importDataBtn.isPresent()).toBe(true);
            });
        });

        it('should ingest data into project and open netgen modal', function() {
            expect(diModal.importDataBtn.isPresent()).toBe(true);
            diModal.importData()
            .then(function() {
                var netgenAttrFormElem = netgenModal.nodeAttrForm;
                expect(netgenAttrFormElem.isPresent()).toBe(true);
            });
        });

        it('should generate network successfully', function() {

            netgenModal.attrList
            .then(result => {
                expect(result.length).toBeGreaterThan(1); //Check if netgen modal has more than 1 element present
                return netgenModal.selectAttrByIdx(5);
            })
            .then(() => netgenModal.startNetgen()); //Start netgen
        });

        it('should render graph successfully upon netgen', function() {
            browser.sleep(8000);
            var sig = element(by.css('sig'));
            expect(sig.isPresent()).toBe(true);
        });

    });

});