'use strict';

var projDB      = require('../schemas/proj_schema');

///
/// Count the networks generated till now. Setup the project.allGenNWIds field
///

function setupAllGenNWIds () {
    var opsCount = 0, modCount = 0;
    var ops = projDB.find({ networks: { $exists: true, $ne: [] }}).exec()
        .map(function(proj) {
            opsCount++;
            if(proj.allGenNWIds.length === 0) {
                proj.allGenNWIds = proj.networks.map(nw => nw.ref);
                modCount++;
                return proj.save();
            } else return proj;
        });
    ops.tap(function() {
        console.log("[setupAllGenNWIds] found Projects : " + opsCount);
        console.log("[setupAllGenNWIds] modified count : " + modCount);
    });

    return ops;
}

module.exports = {
    setupAllGenNWIds
};