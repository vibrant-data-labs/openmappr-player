# How to run Athena

All commands run in mappr-b/athena

## Machine Setup
==================

### Install Pip
https://pip.pypa.io/en/latest/installing.html

### Install virtualenv
$ sudo pip install virtualenv

### Setup Venv and create 
$ virtualenv venv


## Running
==========
Make sure the venv directory exists in mappr-b/athena folder, if not create it as directed in Machine Setup

### Start virtualenv at mappr-b/athena/ (bash or its derivatives only. Use zsh :) )
$ . venv/bin/activate

Install libyaml

### Install project deps
$ pip install -r requirements.txt

### Running server
$ python athena.py

Server autoloads when any source code changes.


# Athena Server details
========================

There are 3 urls
 
localhost:5000/algos POST - run a new algorithm with given name and returns the Id of the algorithm.

try with:

```
{
  "algo_name":"reverse_coords",
  "datasetId": "539f2530ef19470000114236",
  "options": {
    "process":true
  }
}
```

localhost:5000/algos/id - GET -> get the status of the algorithm. For now, it always shows stopped

localhost:5000/algos/Id - DELETE -> stops/ removes algorithm from execution pipeline
