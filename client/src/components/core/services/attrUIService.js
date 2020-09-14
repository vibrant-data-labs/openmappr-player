/**
* Used to get precomputed attr container heights(based on renderType & filter) for Filter Panel
*/
angular.module('common')
.service('attrUIService', [function() {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getAttrFPHeight= getAttrFPHeight;


    /*************************************
    ********* Local Data *****************
    **************************************/
    // Fixed heights info for attrs in filter panel

    // var attrRenderTypesMap = AttrInfoService.getRenderTypesMap();

    //
    // Fixed attr heights acc. to render types
    // Only for attrs having distributions
    //
    var renderersHeightMap = {
        piechart: 300,
        histogram: 100,
        densitybar: 30,
        categorybar: 30,
        categorylist: 38, //Indiv. bar height
        tags: 39, //Indiv. bar height,
        'tag-cloud': 22/2  //Indiv. bar height(divided by no. of tags per row)
    };

    var rendererMarginMap = {
        piechart: 10,
        histogram: 10,
        densitybar: 20,
        categorybar: 20,
        categorylist: 55,
        tags: 55,
        'tag-cloud': 30
    };

    var renderTypeFilterMap = {
        piechart: 'checkboxFilter',
        histogram: 'rangeFilter',
        densitybar: 'rangeFilter',
        categorybar: 'checkboxFilter'
    };

    var filtersHeightMap = {
        checkboxFilter: 40, // Individual filter item height
        rangeFilter: 20
    };

    var filtersMarginMap = {
        checkboxFilter:10,
        rangeFilter: 20
    };

    // var containerMargin = 20; //Top margin only
    var attrTitleHeight = 36; //Height
    var attrTextHeight = 20; // For type strings only
    var moreBtnHeight = 36;
    var nonRendHeight = attrTitleHeight; //container margin not being used currently



    /*************************************
    ********* Core Functions *************
    **************************************/
    function getAttrFPHeight(attrInfo, showFilter) {
        var renderType = attrInfo.attr.renderType,
            attrType = attrInfo.attr.attrType,
            attrValsCount = attrInfo.values.length,
            rendererHeight = 0,
            filterHeight = 0,
            filterMarginHeight = 0,
            filter,
            itemHeight;

        // Detect correct rendertype for density bar renderer
        if(renderType == 'densitybar') {
            if(attrInfo.isTag) {
                renderType = 'tags';
            }
            else {
                renderType = attrInfo.isNumeric ? 'densitybar' : 'categorybar';
            }
        }
        if(renderType == 'categorylist' || renderType == 'tag-cloud') {
            rendererHeight = renderersHeightMap[renderType] * (attrValsCount >= 10 ? 10 : attrValsCount );
        }
        else if(renderType == 'tags') {
            rendererHeight = renderersHeightMap[renderType] * (attrValsCount >= 5 ? 5 : attrValsCount );
        }
        else if(renderType == 'histogram' && attrInfo.attr.attrType == 'timestamp') {
            rendererHeight = renderersHeightMap[renderType] + 40; //extra bottom margin for timestamp
        }
        else {
            rendererHeight = renderersHeightMap[renderType] || 0;
        }

        rendererHeight += rendererMarginMap[renderType];

        if(showFilter) {
            filter = renderTypeFilterMap[renderType];

            if(filter == 'checkboxFilter') {
                var filterValsCount = attrInfo.values.length;
                filterHeight = filterValsCount < 6 ? filtersHeightMap[filter]*filterValsCount : (5*filtersHeightMap[filter] + moreBtnHeight);
            }
            else {
                filterHeight = filtersHeightMap[filter];
            }
            filterHeight = filterHeight || 0;
            filterMarginHeight = filtersMarginMap[filter] || 0;
        }

        itemHeight = nonRendHeight + rendererHeight + filterHeight + filterMarginHeight;
        if(attrType == 'string' || renderType == 'tags') {
            itemHeight += attrTextHeight;
        }
        return itemHeight;
    }

}
]);
