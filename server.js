'use strict';
require('dotenv').config();
var express = require('express');
var serverInit = require('./server/main_server');
var assert = require('assert');

assert(+process.versions.node.slice(0,1) >= 5, "Node 5 or greater needed!");


var app  = express();

serverInit(app);
