"use strict";

var _ = require("lodash"),
    Promise = require("bluebird"),
    scriptModel = require("./scriptStore_model.js");

module.exports = {
    getScripts: function(req, res) {
        var org = req.org;
        console.log("Loading Scripts...");
        var foundScripts = scriptModel.listByOrgAsync(org._id);
        // foundScripts.tap(scripts => console.log("Found scripts: ", scripts));
        foundScripts = foundScripts.then(function(scripts) {
            // console.log("Found scripts: ", scripts);
            var grps = _.groupBy(scripts, "name");
            // console.log("Script Groups:", grps);
            // since the scripts are ordered in descending order, the 1st element of every group is the latest one.
            var topElms = _.mapValues(grps, _.head);
            // delete the rest from the db
            // console.log("Removing duplicates...");
            _.forOwn(grps, function(val, key) {
                var toRemove = _.rest(val);
                console.log("Removing old script:", toRemove);
                _.each(toRemove, oldScript => oldScript.remove());
            });
            var toReturn = _.sortBy(_.flatten(_.values(topElms)), "lastUsedAt").reverse();
            console.log("Final scripts to return:", toReturn);
            return toReturn;
        });
        res.status(200).send(foundScripts);
    },
    /**
     * A list of scripts is generally pushed to this url which has to be stored under their respective organizations
     */
    storeScripts: function(req, res) {
        var scripts = req.body.scripts;
        console.log("saving Scripts:", scripts);
        if (!scripts || scripts.length === 0) {
            return res.status(400).send("No scripts to store");
        }

        var onSave = Promise.map(scripts, function(scriptObj) {
            // we always save a new entry.
            return scriptModel.storeScript(_.omit(scriptObj, ["_id", "__v"]));
        });

        res.status(200).json(onSave);
    }
};