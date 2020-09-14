'use strict';

module.exports = {
    'dbUrl': 'mongodb://127.0.0.1:27017/MAPPRDB',
    'oldDbUrl': 'mongodb://127.0.0.1:27017/MPTEST',
    'sessiondbUrl': 'mongodb://127.0.0.1:27017/sessionDB',
    'elasticSearchConfig': {
        host: '127.0.0.1:9200',
        log: 'error',
        apiVersion: '5.6'
    },
    'athena' : {
        url : '127.0.0.1:5000'
    },
    'beanstalk' : {
        host : '127.0.0.1',
        port : 11300
    },
    'redis' : {
        // url : 'redis://user:password@redis-service.com:6379/'
        url : 'redis://127.0.0.1:6380/0'
    }
};
