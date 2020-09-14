"use strict";

module.exports = {
    file_system : {
        temp_dir: './uploads_tmp/'
    },
    email: {
        service: "Gmail",
        auth: {
            user: "admin@vibrantdata.io", //"support@vibrantdata.is",
            pass: "d1rtydata" //"vdat*su*1"
        }
    },
    athena: {
        ATHENA_PIPE: "survey_worker",
        CLIENT_PREFIX: "client_"
    },
    uploadS3: {
        client_config: {
            maxAsyncS3: 20, // this is the default
            s3RetryCount: 3, // this is the default
            s3RetryDelay: 1000, // this is the default
            multipartUploadThreshold: 20971520, // this is the default (20 MB)
            multipartUploadSize: 15728640, // this is the default (15 MB)
            s3Options: {
                // s3admin user keys
                accessKeyId: "<jhkhk>",
                secretAccessKey: "<kjhkjhkj>",
                region: "us-west-1"
                // any other options are passed to new AWS.S3()
                // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
            }
        },
        player_bucket : "mappr-final-players"
    },
    etl: {
        AUTH_HEADER : "<>",
        DATABRICKS_URL : "/",
        CLUSTER_ID : "<>",
        TEMP_BUCKET : "<>", // a temp bucket used to store maps
        ETL_BUCKET : "<>" // the bucket where a lot of user data is stored
    },
    alchemy: {
        ACCESS_KEY : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' // 40 chars
    },
    defaultUser: {
        name : "Monster User",
        email: "monster@mappr.io",
        password: "woot",
        orgName : "Monster Org",
        ownerEmail : "monster@mappr.io"
    },
    urlShortener: {
        ACCESS_KEY: "<>"
    },
    mailChimp: {
        ACCESS_KEY: "<>"
    },
    linkedIn: {
        apiKey : "<>",
        secretKey : "<>",
        callbackUrl : "http://localhost:8080/auth/linkedin/callback"
    },
    mongo: {
        connectionUrl: "mongodb://<MONGODB_HOST>/MAPPRDB"
        // var url = 'mongodb://mapprdb-0.vdat.0075.mongodbdns.com:27000/MAPPRDB';
    }
};
