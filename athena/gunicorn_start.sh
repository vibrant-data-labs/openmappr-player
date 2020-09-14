#!/bin/bash

NAME="athena"
FLASKDIR=/home/ubuntu/sites/mappr-b/athena/
VENVDIR=/home/ubuntu/sites/mappr-b/athena/venv/
#SOCKFILE=/Code/flask_app/sock
USER=ubuntu
GROUP=ubuntu
NUM_WORKERS=4

CONFIG="ProductionConfig"
export CONFIG

echo "Starting $NAME"

# activate the virtualenv
cd $VENVDIR
source bin/activate

#export PYTHONPATH=$FLASKDIR:$PYTHONPATH
#echo "Pythonpath $PYTHONPATH"
# Create the run directory if it doesn't exist
#RUNDIR=$(dirname $SOCKFILE)
#test -d $RUNDIR || mkdir -p $RUNDIR

cd ..
# Start your unicorn
exec gunicorn athena_main:app -b 0.0.0.0:5000 \
  --daemon \
  --name $NAME \
  --workers $NUM_WORKERS \
  --user=$USER --group=$GROUP \
  --log-level=debug \
  --log-file=athenalog.log
