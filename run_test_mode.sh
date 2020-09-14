#!/bin/bash

NODE_ENV="testing"
export NODE_ENV

exec ./node_modules/nodemon/bin/nodemon.js  --debug --watch server server.js