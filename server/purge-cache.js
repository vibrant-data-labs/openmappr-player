const AWS = require('aws-sdk'),
  s3Config = require('./config/s3Config'),
  https = require('https');

const s3 = new AWS.S3({
  accessKeyId: s3Config.accessKeyId,
  secretAccessKey: s3Config.secretAccessKey,
});

const cloudfront = new AWS.CloudFront({
  accessKeyId: s3Config.accessKeyId,
  secretAccessKey: s3Config.secretAccessKey,
});

const bucket = 'fow-landscape';
const playerDistribution = 'mappr-player.openmappr.org';

async function getDistributions(bucketName) {
  const allDistributions = await cloudfront.listDistributions().promise();
  const allowedOrigins = `${bucketName}.s3-website-${s3.config.region || 'us-east-1'}.amazonaws.com`;
  const distributions = allDistributions.DistributionList.Items.filter(x =>
    x.Origins.Items.some(o => allowedOrigins.includes(o.DomainName)) || x.Aliases.Items.some(x => x === playerDistribution));

  return distributions;
}

async function invalidateDistribution(distribution) {
  await cloudfront.createInvalidation({
    DistributionId: distribution.Id,
    InvalidationBatch: {
      Paths: ['/*']
    }
  });
}

async function purgeCloudFront(bucketName) {
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

function tryGetCloudflareConfig() {
  try {
    const cloudflareConfig = require('./config/cloudflare');
    return cloudflareConfig;
  }
  catch {
    return undefined;
  }
}

function http(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let rawData = '';

      res.on('data', d => {
        rawData += d;
      });

      res.on('end', () => {
        const data = JSON.parse(rawData);
        resolve(data);
      });
    })

    req.setHeader('User-Agent', 'javascript');

    req.on('error', error => {
      console.error(error);
      reject(error);
    })

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function purgeCloudflareRequest(zoneId, token, purgeData) {
  const zoneList = await http({
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

  await http({
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

async function purgeCloudflare(purgeData) {
  const cloudflareConfig = tryGetCloudflareConfig();
  if (!cloudflareConfig) {
    console.warn('No Cloudflare config found');
    return;
  }

  console.warn(`Invalidating Cloudflare cache for: ${purgeData.map(r => r.url).join()}`);
  try {
    await purgeCloudflareRequest(cloudflareConfig.id, cloudflareConfig.apiKey, purgeData);
  }
  catch (e) {
    console.error('Error while invalidating cache', e);
  }
}

async function purgeCache(bucketName) {
  try {
    const urls = await purgeCloudFront(bucketName);
    await purgeCloudflare(urls);

    console.log('All cache has been purged');
  }
  catch(e) {
    console.error('Error while purging the cache', e);
  }
}

module.exports = purgeCache;