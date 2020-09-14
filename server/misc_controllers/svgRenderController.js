'use strict';
var _ = require('lodash');

var jsCache = {

};
//
// Returns the url where SVG is going to be located
function rendersvg (req, res) {
    var data = req.body.svg_data;
    var id = _.uniqueId('svg');
    jsCache[id] = data;
    res.json(200, {
        url : "/api/svg_get/" + id
    });
}

function getSvg (req, res) {
    var id = req.params.svg_id;
    console.log("[SVG ID] id" + id);
    res.send(200, jsCache[id]);
}
//API
module.exports = {
    rendersvg : rendersvg,
    getSvg : getSvg
};

