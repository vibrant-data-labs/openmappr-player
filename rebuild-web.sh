#!/bin/bash
docker-compose stop web
docker-compose rm -f web
docker-compose build --no-cache web
docker-compose up -d
