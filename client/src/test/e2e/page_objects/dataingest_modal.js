'use strict';

module.exports = {
    modalContainer: element(by.id('diModal')),
    fileTab : element(by.css('[ng-controller="LocalSheetsCtrl"]')),
    fileInput : element.all(by.css('input[type="file"]')),
    importDataBtn : element(by.css('[ng-click="mapProcessor.createMap()"]')),

    uploadFile: function uploadFile(absolutePath) {
        return this.fileInput
        .then(items => items[0].sendKeys(absolutePath));
    },
    importData: function importData() {
        return this.importDataBtn.click();
    }
};