const https = require('https');

const httpRequest = async (options, body) => {
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

module.exports = httpRequest;
