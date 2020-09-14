'use strict';

var closeModalBtn = element(by.css('[ng-click="closeModal()"]'));

module.exports = {
    modalId: 'dataModal',
    dsAttrsList: element.all(by.repeater('attr in dpAttrs')),
    toggleVisiblityBtn: element(by.css('[ng-click="attr_mod.toggleVisibility(); setAttrDirty(attr_mod);"]')),

    getAttrByIdx: function getAttrByIdx(idx) {
        return this.dsAttrsList.get(idx);
    },
    hoverOnAttr: function hoverOnAttr(elemFinder) {
        return browser.actions().mouseMove(elemFinder).perform();
    },
    toggleAttrVisibility: function toggleAttrVisibility(elemFinder) {
        var self = this;
        return this.hoverOnAttr(elemFinder)
        .then(() => self.toggleVisiblityBtn.click())
		.then(() => self.toggleVisiblityBtn.element(by.tagName('i')).getAttribute('class'));
    },
    closeModal: function() {
        return closeModalBtn.click();
    }

};