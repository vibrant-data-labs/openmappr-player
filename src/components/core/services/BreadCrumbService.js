/*jshint unused:false, loopfunc:true */
/**
 * This service builds intelligence about an attribute in the dataset
 */
angular.module('common')
.service('BreadCrumbService', [function () {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    // constructors
    this.BreadCrumbItem = BreadCrumbItem;

    // BreadCrumb management
    this.getBreadCrumbs = getBreadCrumbs;
    this.newBreadCrumb = newBreadCrumb;
    this.clearBreadCrumbs = clearBreadCrumbs;
    this.newBreadCrumbFrom = newBreadCrumbFrom;
    this.appendBreadCrumbItem = appendBreadCrumbItem;
    this.focusOnBreadCrumbIdx = focusOnBreadCrumbIdx;

    this.getFocusedBC = function() { return breadCrumbs[focusOnIdx]; };


    /*************************************
    *************** CLASSES **************
    **************************************/

    //
    // An active Breadcrumb gets replaced with a new selection
    //

    function BreadCrumbItem (title, selector) {
        this.title = title;
        this.selector = selector;
        this.isActive = false;
        this.id = _.uniqueId('bcItem_');
        this.__nodes = null; // a cache of nodes
    }
    BreadCrumbItem.prototype.getNodes = function() {
        if(!this.__nodes) {
            this.__nodes = this.selector.getNodes();
        }

        return this.__nodes;
    };
    BreadCrumbItem.prototype.getNodeIds = function() {
        return this.selector.nodeIds;
    };



    /*************************************
    ********* Local Data *****************
    **************************************/
    var logPrefix = '[BreadCrumbService] ';
    // a list of breadcrumbItems
    // the last one is called active Item.
    var breadCrumbs = [];
    var focusOnIdx = -1;
    var activeIdx = 0;


    /*************************************
    ********* Core Functions *************
    **************************************/
    function newBreadCrumb () {
        console.log(logPrefix + "newBreadCrumb created.");
        breadCrumbs.length = 0;
        focusOnIdx = -1;
        activeIdx = 0;
    }
    function appendBreadCrumbItem (bcItem) {
        console.log(logPrefix + "appendBreadCrumbItem called with:", bcItem);
        if(focusOnIdx < 0) { // fresh BC
            breadCrumbs.push(bcItem);
            bcItem.isActive = false;
            focusOnIdx = 0;
            activeIdx = 1;
        } else {
            bcItem.isActive = true;
            if(activeIdx === breadCrumbs.length) { // new active
                breadCrumbs.push(bcItem);
            } else { // replace active
                breadCrumbs[activeIdx] = bcItem;
            }
        }
    }

    function trimBreadCrumbsToActiveBC() {
        // if(breadCrumbs.length !== activeIdx + 1) {
        //     breadCrumbs.length = activeIdx + 1; // trim out the rest of the BC array
        // }
        if(breadCrumbs.length !== activeIdx) {
            breadCrumbs.length = activeIdx ; // trim out the rest of the BC array
        }
    }
    function focusOnBreadCrumbIdx(idx) {
        console.log(logPrefix + "focusOnBreadCrumbIdx called with:", idx);
        console.assert(idx < breadCrumbs.length, "Index too large");
        focusOnIdx = idx;
        breadCrumbs[idx].isActive = false;
        activeIdx = idx + 1;
        trimBreadCrumbsToActiveBC();
    }
    function newBreadCrumbFrom (bcItem) {
        newBreadCrumb();
        appendBreadCrumbItem(bcItem);
    }

    function getBreadCrumbs () { return breadCrumbs; }
    function clearBreadCrumbs () { newBreadCrumb(); }
}
]);
