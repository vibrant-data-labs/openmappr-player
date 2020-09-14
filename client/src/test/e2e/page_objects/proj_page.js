'use strict';

module.exports = {
    dataModalBtn : element(by.css('[ng-click="openNetworkDataModal(); $event.stopPropagation();"]')),

    openDataModal: function openDataModal() {
        return this.dataModalBtn.click();
    }
};