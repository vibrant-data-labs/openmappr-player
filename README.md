# OpenMappr Static 📊
## Prerequisites
- grunt `npm install -g grunt-cli`
- install npm dependencies `npm install`

## Configuration
### MongoDB connection
Replace the `dbUrl` parameter in the `server/config/local.js` to match the required MongoDB instance.
### AWS S3 connection
Place the valid API keys into the `server/config/s3.js`.

## Generating files
Command below will build all the assets, including project-specific files and place it inside `publish` directory.

```npm run build```

To generate only project files run the following command:

```npm run build:data```

CLI will navigate you to select the required project

To generate only static files run the following command:

```npm run build:static```

## Publish to S3
If you have configured s3 properly, run the following command to deploy all the assets from `publish` folder to S3 bucket:

```npm run publish```

If you want to publish only static files, run the following command:

```npm run publish:player```

If you want to update the data only, run the following command:

```npm run publish:map```