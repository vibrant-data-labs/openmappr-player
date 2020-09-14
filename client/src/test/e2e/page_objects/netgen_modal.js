'use strict';

module.exports = {
    genNetworkBtn : element(by.css('[ng-click="generateNetwork();"]')),
    closeModal : element(by.css('[ng-click="closeModal()"]')),
    enrichDataBtn : element(by.css('[ng-click="openMergeModal();"]')),
    attrList :  element.all(by.exactRepeater('attribute in nodeAttributes')),
    nodeAttrForm : element(by.className('modal-content')).element(by.css('[name="nodeAttrForm"]')),

    startNetgen : function() {
        return this.genNetworkBtn.click();
    },
    enrichData : function() {
        return this.enrichDataBtn.click();
    },
    selectAttrByIdx : function(idx) {
        return this.attrList.get(idx).element(by.tagName('label')).click();
    }
};