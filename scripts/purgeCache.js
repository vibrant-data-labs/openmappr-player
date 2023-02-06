const AWS = require('aws-sdk'),
    httpRequest = require('./httpRequest');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
});

const cloudfront = new AWS.CloudFront({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
});

const playerDistribution = 'mappr-player.openmappr.org';

const getDistributions = async (bucketName) => {
    const allDistributions = await cloudfront.listDistributions().promise();
    const allowedOrigins = `${bucketName}.s3-website-${s3.config.region || 'us-east-1'}.amazonaws.com`;
    const distributions = allDistributions.DistributionList.Items.filter(x =>
        x.Origins.Items.some(o => allowedOrigins.includes(o.DomainName)) || x.Aliases.Items.some(x => x === playerDistribution));

    return distributions;
}

const invalidateDistribution = async (distribution) => {
    await cloudfront.createInvalidation({
        DistributionId: distribution.Id,
        InvalidationBatch: {
            Paths: ['/*']
        }
    });
}

const purgeCloudFront = async (bucketName) => {
    const distributions = await getDistributions(bucketName);
    console.warn(`Found distributions: ${distributions.length}`);
    distributions.forEach((d) => console.warn(d.Aliases.Items.join(',')));

    await Promise.all(distributions.map(d => invalidateDistribution(d)));
    console.warn('Distribution invalidating is created');

    return distributions.map(d => ({
        url: `https://${d.Aliases.Items.join()}/`,
        domain: d.Aliases.Items.join()
    }));
}

const purgeCloudflareRequest = async (token, purgeData) => {
    const zoneList = await httpRequest({
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const domainName = purgeData.map(r => {
        const d = r.domain;
        return d.split('.').slice(-2).join('.');
    })[0];

    const domain = zoneList.result.find(x => x.name === domainName);

    await httpRequest({
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${domain.id}/purge_cache`,
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        }
    }, {
        files: purgeData.map(r => r.url)
    });
}

const purgeCloudflare = async (purgeData) => {
    const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
    if (!cloudflareApiKey) {
        console.warn('No Cloudflare config found');
        return;
    }

    console.warn(`Invalidating Cloudflare cache for: ${purgeData.map(r => r.url).join()}`);
    try {
        await purgeCloudflareRequest(cloudflareApiKey, purgeData);
    }
    catch (e) {
        console.error('Error while invalidating cache', e);
    }
}

const purgeCache = async (bucketName) => {
    try {
        const urls = await purgeCloudFront(bucketName);
        await purgeCloudflare(urls);

        console.log('All cache has been purged');
    }
    catch (e) {
        console.error('Error while purging the cache', e);
    }
}

module.exports = purgeCache;