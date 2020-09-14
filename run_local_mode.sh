#!/bin/bash

NODE_ENV="local"
export NODE_ENV

exec ./node_modules/nodemon/bin/nodemon.js  --inspect --watch server server.js
