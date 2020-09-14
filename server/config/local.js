'use strict';

module.exports = {
    'dbUrl': 'mongodb://192.168.99.100:27017/MAPPRDB',
    'oldDbUrl': 'mongodb://192.168.99.100:27017/MPTEST',
    'sessiondbUrl': 'mongodb://192.168.99.100:27017/sessionDB',
    'elasticSearchConfig': {
        host: '192.168.99.100:9200',
        log: 'error',
        apiVersion: '5.6'
    },
    'athena' : {
        url : '192.168.99.100:5000'
    },
    'beanstalk' : {
        host : '192.168.99.100',
        port : 11300
    },
    'redis' : {
        // url : 'redis://user:password@redis-service.com:6379/'
        url : 'redis://192.168.99.100:6380/0'
    }
};
