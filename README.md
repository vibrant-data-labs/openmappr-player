# OpenMappr Player 📊
## Prerequisites
- node > v14
- install npm dependencies `npm install`

## Run the project

To run the project locally, run the following command:

```npm run start```

It would use the sample TED data to be used as a source of the data for the project.
Password is `vibrantdatalabs`

If you want to replace the data with your own, place the data into the `data` folder. The easiest way to generate the data it is to use the [Py2Mappr](https://github.com/vibrant-data-labs/py2mappr) tool.

## Publish the project

In order to publish the project to the S3 bucket, the AWS credentials must be configured.

All the configuration is stored in the `.env` file. In order to run the project, you need to create the `.env` file and place the following variables inside it:

```
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
BUCKET=
CLOUDFLARE_API_KEY=
```

If it is required to purge the Cloudflare Cache after the deployment, the API key for Cloudflare must be provided, otherwise, this field can be left empty.

Once it is configured, the following command will generate all the assets and publish them to the S3 bucket:

```npm run publish``` 

To have only the static files generated, set `NODE_ENV` to be `production` and run the `build` command:

```NODE_ENV=production npm run build```

The GitHub Action for publishing the project is configured to run when a new commit is pushed to the `main` branch.

## Updating the published players

The player is integrated to other players as the following:

```
[Player S3 Bucket]
Stores the static files for the player: css, js, fonts, images, partials, etc.

[Project S3 Bucket]
Stores the data for the project: data, index.html, etc.

The `index.html` file in the project bucket contains the links to the static files from the Player S3 Bucket.
```

So if the logic should be updated in the player, the openmappr-player should be published to the Player S3 Bucket. All the changes would be propagated to all projects immediately.

If it is required to update the `index.html`, e.g. to change the title, add analytics, change logo, etc., it should be done manually for each project.
