#!/bin/bash

NAME="athena"
FLASKDIR=/home/ubuntu/sites/mappr-b/athena/
# VENVDIR=venv
# CONFIG="TestingConfig"
CONFIG="ProductionConfig"
export CONFIG
#SOCKFILE=/Code/flask_app/sock
USER=ubuntu
GROUP=ubuntu
NUM_WORKERS=4

echo "Starting $NAME"

# activate the virtualenv
# cd $VENVDIR
source venv/bin/activate

#export PYTHONPATH=$FLASKDIR:$PYTHONPATH
#echo "Pythonpath $PYTHONPATH"
# Create the run directory if it doesn't exist
#RUNDIR=$(dirname $SOCKFILE)
#test -d $RUNDIR || mkdir -p $RUNDIR

# cd ..
# Start your unicorn
exec python athena_beanstalkd.py