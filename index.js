const express = require('express');
const request = require('request');
const { JSDOM } = require('jsdom');
const app = express();

app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    next();
});

function rewriteUrls(body, baseUrl, proxyUrl) {
    const dom = new JSDOM(body);
    const document = dom.window.document;

    document.querySelectorAll('link[href]').forEach((link) => {
        link.href = `${proxyUrl}?url=${new URL(link.href, baseUrl).href}`;
    });

    document.querySelectorAll('script[src]').forEach((script) => {
        script.src = `${proxyUrl}?url=${new URL(script.src, baseUrl).href}`;
    });

    document.querySelectorAll('img[src]').forEach((img) => {
        img.src = `${proxyUrl}?url=${new URL(img.src, baseUrl).href}`;
    });

    document.querySelectorAll('a[href]').forEach((anchor) => {
        anchor.href = `${proxyUrl}?url=${new URL(anchor.href, baseUrl).href}`;
    });

    return dom.serialize();
}

app.get('/proxy', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing URL parameter');
    }

    // Prevent infinite loop
    if (targetUrl.startsWith(req.protocol + '://' + req.get('host'))) {
        return res.status(400).send('Cannot proxy this URL');
    }

    request({
        url: targetUrl,
        timeout: 10000, // 10-second timeout
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': '*/*',
        },
    }, (error, response, body) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error fetching the URL');
        }

        const contentType = response.headers['content-type'];
        res.setHeader('Content-Type', contentType);

        if (contentType && contentType.includes('text/html')) {
            const proxyUrl = `${req.protocol}://${req.get('host')}/proxy`;
            const rewrittenBody = rewriteUrls(body, targetUrl, proxyUrl);
            res.send(rewrittenBody);
        } else {
            res.send(body);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
