#!/bin/bash
docker-compose stop web
docker-compose rm -f web
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache web
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
