# OpenMappr Static 📊
## Prerequisites
- bower `npm install bower`
- grunt `npm install grunt-cli`

## Configuration
### MongoDB connection
Replace the `dbUrl` parameter in the `server/config/local.js` to match the required MongoDB instance.
### DigitalOcean connection
Replace all the credentials in the `server/config/digitalOcean.js`.

## Generating files
Command below will build all the assets, including project-specific files and place it inside `publish` directory.
```npm run build```
To generate only project files run the following command:
```npm run build:data```
CLI will navigate you to select the required project

To generate only static files run the following command:
```npm run build:static```

## Publish to Digital Ocean
If you have configured digital ocean properly, run the following command to deploy all the assets to DO:
```npm run deploy```