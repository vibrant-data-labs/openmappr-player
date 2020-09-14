'use strict';

module.exports = {
    'dbUrl': 'mongodb://localhost:27017/MAPPR_TEST',
    'oldDbUrl': 'mongodb://localhost:27017/MPTEST',
    'sessiondbUrl': 'mongodb://localhost:27017/sessionDB_TEST',
    'elasticSearchConfig': {
        host: 'localhost:9200',
        log: 'error',
        apiVersion: '5.6'
    },
    'athena' : {
        url : 'localhost:5000'
    },
    'beanstalk' : {
        host : '127.0.0.1',
        port : 11300
    }
};
