#!/bin/bash

NAME="athena"

CONFIG="DevelopmentConfig"
export CONFIG

USER=ubuntu
GROUP=ubuntu
NUM_WORKERS=4

echo "Starting $NAME"

# activate the virtualenv
# cd $VENVDIR
source venv/bin/activate

# cd ..
# Start your unicorn
# exec python athena_main.py
# exec python athena_beanstalkd.py
exec circusd athena_test.ini