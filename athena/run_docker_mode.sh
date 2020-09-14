#!/bin/bash

NAME="athena"

CONFIG="DockerConfig"
export CONFIG

USER=ubuntu
GROUP=ubuntu
NUM_WORKERS=4

echo "Starting my $NAME"

# activate the virtualenv
# cd $VENVDIR
# source venv/bin/activate

# cd ..
# Start your unicorn
# exec python athena_main.py

# Hack to start athena after certain time to allow mongorestore to finish
# TODO: control service startup order
sleep 10
exec python athena_beanstalkd.py
# exec circusd athena_docker.ini
