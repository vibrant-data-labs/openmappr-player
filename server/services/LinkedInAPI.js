'use strict';
var _ = require('lodash'),
    request = require('request'),
    Promise = require('bluebird');

var DSModel     = require("../datasys/datasys_model.js");

var fields = ["id", "first-name", "last-name", "maiden-name", "formatted-name", "headline",
        "location", "industry", "num-connections", "num-connections-capped",
        "summary", "specialties", "positions", "picture-url", "site-standard-profile-request",
        "api-standard-profile-request", "public-profile-url"];

// var returnedFields = [ 'firstName', 'formattedName', 'headline', 'industry', 'lastName', 'location',
// 'country_code', 'numConnections', 'numConnectionsCapped', 'company', 'summary', 'title', 'startDate',
// 'publicProfileUrl', 'pictureUrl', 'siteStandardProfileRequest' ];

var __getAttrType_switchObj = {
    "publicProfileUrl" : "url",
    "numConnections" : "integer",
    "pictureUrl" : "picture"
};
function getAttrType (name) {
    return __getAttrType_switchObj[name] || "string";
}
// Gets all connections for the user
function getConnections (authCode) {
    var max = 500, start = 0, total = 0;

    function _paginate(conns, start) {
        return getPage(authCode, start, max)
        .then(function(data) {
            start = start + data._count;
            total = total + data._total;
            console.log("[paginate] _count: ", data._count);
            console.log("[paginate] _total: ", data._total);
            console.log("[paginate] _start: ", data._start);
            if(data._count + data._start < data._total && data.values) {
                console.log("[paginate] _values: ", data.values.length);
                // possible more connections
                return _paginate(conns.concat(data.values), start);
            } else {
                console.log("Finished paging. Total conns: ", conns.length);
                return conns;
            }
        });
    }
    return _paginate([], start);
}
function getPage (authCode, start, count) {
    console.log("@@@ GET PAGE: start:,count:", start, count);
    var opts = {
        url : "https://api.linkedin.com/v1/people/~/connections:(" + fields.join(',') + ')' +"?start=" + start +"&count=" + count,
        headers : {
            'Authorization' : 'Bearer ' + authCode,
            'x-li-format' : 'json'
        }
    };
    return new Promise(function(resolve, reject) {
        request.get(opts, function(err, response, body) {
            if(err) {
                reject(err);
            } else if(body.status === "500" || (body.status && body.status.indexOf("40") >= 0)) {
                reject(body);
            } else {
                resolve(JSON.parse(body));
            }
        });
    });
}

// Returns the GraphData
function buildGraphDataFromConn (connData, fields) {
    var logPrefix = "[LinkedInAPI.buildGraphDataFromConn] ";
    var connections = _.reject(connData, {"id" : "private"}),
        datapoints = [],
        nodes = [],
        attrDescriptors = [],
        nodeAttrDescriptors = [],
        attrDescriptorsMap = {},
        aconn = connections[0],
        isfilterFieldsEnabled = false;

    console.log(logPrefix + "Found " + (connData.length - connections.length) + " private connections");

    if(fields && fields.length === 0) {
        console.log(logPrefix + "No fields provided, importing all fields");
    } else {
        console.log(logPrefix + "importing fields :", fields);
        isfilterFieldsEnabled = true;
    }
    function filterFields (attrname) {
        if(isfilterFieldsEnabled) {
            return fields.indexOf(attrname) > 0;
        } else {
            return true;
        }
    }

    // extract node attributes
    _.each(_.keys(aconn),function(connAttr) {
        if(connAttr === "apiStandardProfileRequest" ||
            connAttr === "id")
            return; // do nothing
        else if(connAttr === "location") {
            if(filterFields("location"))
                attrDescriptors.push({
                    id: "location",
                    title: "location",
                    attrType: getAttrType(connAttr),
                    generatorType: 'linkedin',
                    generatorOptions: null,
                    visible: true
                });

            if(filterFields("country_code"))
                attrDescriptors.push({
                    id: "country_code",
                    title: "country_code",
                    attrType: getAttrType(connAttr),
                    generatorType: 'linkedin',
                    generatorOptions: null,
                    visible: true
                });
        } else if(connAttr === "positions") {
            if(filterFields("company"))
                attrDescriptors.push({
                    id: "company",
                    title: "company",
                    attrType: getAttrType(connAttr),
                    generatorType: 'linkedin',
                    generatorOptions: null,
                    visible: true
                });

            if(filterFields("summary"))
                attrDescriptors.push({
                    id: "summary",
                    title: "summary",
                    attrType: getAttrType(connAttr),
                    generatorType: 'linkedin',
                    generatorOptions: null,
                    visible: true
                });

            if(filterFields("title"))
                attrDescriptors.push({
                    id: "title",
                    title: "title",
                    attrType: getAttrType(connAttr),
                    generatorType: 'linkedin',
                    generatorOptions: null,
                    visible: true
                });

            if(filterFields("startDate"))
                attrDescriptors.push({
                    id: "startDate",
                    title: "startDate",
                    attrType: getAttrType(connAttr),
                    generatorType: 'linkedin',
                    generatorOptions: null,
                    visible: true
                });
        }
        else {
            if(filterFields(connAttr))
                attrDescriptors.push({
                    id: connAttr,
                    title: connAttr,
                    attrType: getAttrType(connAttr),
                    generatorType: 'linkedin',
                    generatorOptions: null,
                    visible: true
                });
        }
    });
    console.log(logPrefix + "Node Attrs:", _.pluck(attrDescriptors, 'title'));
    // Build the title -> Id map for nodes
    _.each(attrDescriptors, function(attr) {
        attrDescriptorsMap[attr.title] = attr.id;
    });

    // extract nodes
    _.each(connections, function(conn) {
        var datapointId = datapoints.length + 1;
        var attr = {};
        var nodeAttrs = {
            OriginalLabel : conn.firstName
        };
        // build node attrs
        _.forIn(conn, function(attrValue, attrName) {
            if(attrName === "apiStandardProfileRequest" || attrName === "id")
                return; // do nothing
            else if(attrName === "location") {
                if(filterFields("location"))
                    attr[nodeAttrMap["location"]] = attrValue.name;

                if(filterFields("country_code"))
                    attr[nodeAttrMap["country_code"]] = attrValue.country.code;

            } else if(attrName === "siteStandardProfileRequest") {
                if(filterFields("siteStandardProfileRequest"))
                    attr[nodeAttrMap["siteStandardProfileRequest"]] = attrValue.url;

            } else if(attrName === "positions") {
                if(!attrValue.values)
                    return;
                var pos = attrValue.values[0];
                if(filterFields("company"))
                    attr[nodeAttrMap["company"]] = pos.company != null ? pos.company.name : "";

                if(filterFields("summary"))
                    attr[nodeAttrMap["summary"]] = pos.summary || "";

                if(filterFields("title"))
                    attr[nodeAttrMap["title"]] = pos.title || "";

                if(filterFields("startDate"))
                    attr[nodeAttrMap["startDate"]] = pos.startDate != null ? "" + pos.startDate.month + "/" + pos.startDate.year : "";

            } else {
                if(filterFields(attrName))
                    attr[nodeAttrMap["nodeAttrMap[attrName]"]] = attrValue;
            }
        });
        datapoints.push(new DSModel.DataPoint(datapointId, attr));
        nodes.push(new DSModel.Node(datapointId, datapointId, nodeAttrs));
    });
    console.log(logPrefix + "Got nodes of length: %s", nodes.length);

    return {
        datapoints : datapoints,
        nodes : nodes,
        attrDescriptors : attrDescriptors,
        nodeAttrDescriptors : nodeAttrDescriptors
    };
}
//
// API
//
module.exports = {
    getFields : _.constant(fields),
    getConnections : getConnections,
    buildGraphDataFromConn : buildGraphDataFromConn
};