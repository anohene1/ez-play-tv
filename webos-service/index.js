/**
 * EZ Play TV - webOS Stalker Portal Service
 * Uses Node.js built-ins plus the webOS-provided webos-service module.
 */

var Service = require('webos-service');
var http = require('http');
var https = require('https');
var url = require('url');
var pkgInfo = require('./package.json');

var service = new Service(pkgInfo.name);
var portalUrl = '';
var macAddress = '';
var token = '';
var cookies = {};
var handshakePromise = null;
var streamProxyPort = 3002;
var streamProxyKey = String(Date.now()) + String(Math.random()).slice(2);

function getStreamProxyBase() {
    return 'http://127.0.0.1:' + streamProxyPort + '/stream?key=' +
        encodeURIComponent(streamProxyKey) + '&url=';
}

function respondProxyError(response, statusCode, message) {
    if (response.headersSent) return response.end();
    response.writeHead(statusCode, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
    });
    response.end(message);
}

function proxyStream(targetUrl, clientRequest, clientResponse, redirectsLeft) {
    redirectsLeft = typeof redirectsLeft === 'number' ? redirectsLeft : 5;
    var parsed = url.parse(targetUrl);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return respondProxyError(clientResponse, 400, 'Unsupported stream protocol');
    }

    var headers = {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'X-User-Agent': 'Model: MAG250; Link: WiFi',
        'Cookie': buildCookieHeader()
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (clientRequest.headers.range) headers.Range = clientRequest.headers.range;

    var transport = parsed.protocol === 'https:' ? https : http;
    var upstreamRequest = transport.get(targetUrl, { headers: headers }, function(upstreamResponse) {
        if (upstreamResponse.statusCode >= 300 && upstreamResponse.statusCode < 400 && upstreamResponse.headers.location) {
            upstreamResponse.resume();
            if (redirectsLeft <= 0) {
                return respondProxyError(clientResponse, 502, 'Too many stream redirects');
            }
            return proxyStream(url.resolve(targetUrl, upstreamResponse.headers.location), clientRequest, clientResponse, redirectsLeft - 1);
        }

        var contentType = String(upstreamResponse.headers['content-type'] || '');
        if (!contentType || /application\/octet-stream/i.test(contentType)) {
            contentType = 'video/mp2t';
        }

        var responseHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
        };
        ['content-length', 'content-range', 'accept-ranges'].forEach(function(header) {
            if (upstreamResponse.headers[header]) responseHeaders[header] = upstreamResponse.headers[header];
        });

        clientResponse.writeHead(upstreamResponse.statusCode, responseHeaders);
        upstreamResponse.pipe(clientResponse);

        clientResponse.on('close', function() {
            if (upstreamResponse && !upstreamResponse.destroyed) upstreamResponse.destroy();
        });
    });

    upstreamRequest.setTimeout(30000, function() {
        upstreamRequest.destroy(new Error('Stream request timed out'));
    });
    upstreamRequest.on('error', function(error) {
        console.error('Stream proxy error:', error.message);
        respondProxyError(clientResponse, 502, 'Stream upstream request failed');
    });
}

var streamProxyServer = http.createServer(function(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Headers', 'Range');
        response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.writeHead(204);
        return response.end();
    }

    var requestUrl = url.parse(request.url, true);
    if (request.method !== 'GET' || requestUrl.pathname !== '/stream') {
        return respondProxyError(response, 404, 'Not found');
    }
    if (requestUrl.query.key !== streamProxyKey) {
        return respondProxyError(response, 403, 'Forbidden');
    }
    if (!requestUrl.query.url) {
        return respondProxyError(response, 400, 'Missing stream URL');
    }

    proxyStream(requestUrl.query.url, request, response, 5);
});

streamProxyServer.on('error', function(error) {
    console.error('Stream proxy server failed:', error.message);
});
streamProxyServer.listen(streamProxyPort, '127.0.0.1');

function normalizePortalUrl(portal) {
    return portal.trim().replace(/\/+$/, '').replace(/\/c$/i, '');
}

function normalizeMac(mac) {
    var cleanMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
    if (cleanMac.length === 12) return cleanMac.match(/.{2}/g).join(':');
    return mac.toUpperCase();
}

function buildCookieHeader() {
    var parts = [
        'mac=' + macAddress,
        'stb_lang=' + (cookies.stb_lang || 'en'),
        'timezone=' + (cookies.timezone || 'GMT')
    ];

    Object.keys(cookies).forEach(function(key) {
        if (key !== 'mac' && key !== 'stb_lang' && key !== 'timezone') {
            parts.push(key + '=' + cookies[key]);
        }
    });

    return parts.join('; ');
}

function parseCookies(setCookieHeaders) {
    if (!setCookieHeaders) return;
    var headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

    headers.forEach(function(cookieString) {
        var separator = cookieString.indexOf('=');
        if (separator === -1) return;
        var key = cookieString.slice(0, separator).trim();
        var value = cookieString.slice(separator + 1).split(';')[0].trim();
        cookies[key] = value;
    });
}

function makeApiUrl(params) {
    var parsed = url.parse(portalUrl);
    var basePath = (parsed.pathname || '').replace(/\/+$/, '');
    parsed.pathname = basePath + '/server/load.php';
    parsed.search = null;
    parsed.query = params;
    return url.format(parsed);
}

function requestJson(params, redirectsLeft) {
    redirectsLeft = typeof redirectsLeft === 'number' ? redirectsLeft : 5;
    var requestUrl = makeApiUrl(params);

    return new Promise(function(resolve, reject) {
        var parsed = url.parse(requestUrl);
        var transport = parsed.protocol === 'https:' ? https : http;
        var headers = {
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Cookie': buildCookieHeader()
        };

        if (token) headers.Authorization = 'Bearer ' + token;

        var request = transport.get(requestUrl, { headers: headers }, function(response) {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                if (redirectsLeft <= 0) return reject(new Error('Too many portal redirects'));
                // Portals commonly redirect HTTP to HTTPS. Keep the configured portal
                // base path while adopting the redirected origin; otherwise a redirect
                // to load.php would make the next request append load.php a second time.
                var redirected = url.parse(url.resolve(requestUrl, response.headers.location));
                var portal = url.parse(portalUrl);
                portal.protocol = redirected.protocol;
                portal.host = redirected.host;
                portalUrl = normalizePortalUrl(url.format(portal));
                return requestJson(params, redirectsLeft - 1).then(resolve, reject);
            }

            var chunks = [];
            response.on('data', function(chunk) { chunks.push(chunk); });
            response.on('end', function() {
                var body = Buffer.concat(chunks).toString('utf8');
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    var statusError = new Error('Portal returned HTTP ' + response.statusCode);
                    statusError.statusCode = response.statusCode;
                    return reject(statusError);
                }

                parseCookies(response.headers['set-cookie']);
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Portal returned invalid JSON'));
                }
            });
        });

        request.setTimeout(30000, function() {
            request.destroy(new Error('Portal request timed out'));
        });
        request.on('error', reject);
    });
}

function handshake() {
    if (handshakePromise) return handshakePromise;

    handshakePromise = requestJson({
        type: 'stb',
        action: 'handshake',
        prehash: '0',
        mac: macAddress
    }).then(function(response) {
        if (!response || !response.js || !response.js.token) {
            throw new Error('No token received from handshake');
        }
        token = response.js.token;
        return token;
    });

    handshakePromise.then(function() {
        handshakePromise = null;
    }, function() {
        handshakePromise = null;
    });

    return handshakePromise;
}

function makeRequest(type, action, extraParams, retryOnAuthError) {
    extraParams = extraParams || {};
    retryOnAuthError = retryOnAuthError !== false;

    return (token ? Promise.resolve() : handshake()).then(function() {
        var params = {
            type: type || 'stb',
            action: action,
            mac: macAddress
        };

        Object.keys(extraParams).forEach(function(key) { params[key] = extraParams[key]; });
        if (token) params.token = token;

        return requestJson(params).catch(function(error) {
            if (retryOnAuthError && (error.statusCode === 401 || error.statusCode === 403)) {
                token = '';
                return handshake().then(function() {
                    return makeRequest(type, action, extraParams, false);
                });
            }
            throw error;
        });
    });
}

function respondError(message, error) {
    message.respond({
        returnValue: false,
        error: error.message,
        errorText: error.message,
        errorCode: error.statusCode || -1
    });
}

service.register('init', function(message) {
    try {
        var payload = message.payload || {};
        if (!payload.url || !payload.mac) throw new Error('Missing required parameters: url and mac');

        portalUrl = normalizePortalUrl(payload.url);
        macAddress = normalizeMac(payload.mac);
        token = '';
        cookies = {};
        handshakePromise = null;

        message.respond({
            returnValue: true,
            portalUrl: portalUrl,
            mac: macAddress,
            streamProxyBase: getStreamProxyBase()
        });
    } catch (error) {
        respondError(message, error);
    }
});

service.register('keepAlive', function(message) {
    message.respond({
        returnValue: true,
        subscribed: !!message.isSubscription,
        streamProxyBase: getStreamProxyBase()
    });
}, function() {
    // The webos-service library removes the canceled subscription and allows
    // the service to return to its normal idle lifecycle.
});

service.register('request', function(message) {
    var payload = message.payload || {};
    if (!payload.action) return respondError(message, new Error('Missing required parameter: action'));
    if (!portalUrl || !macAddress) return respondError(message, new Error('Service not initialized'));

    makeRequest(payload.type, payload.action, payload.extraParams || {}).then(function(data) {
        message.respond({ returnValue: true, data: data });
    }).catch(function(error) {
        respondError(message, error);
    });
});

service.register('getStatus', function(message) {
    message.respond({
        returnValue: true,
        status: {
            initialized: !!(portalUrl && macAddress),
            portalUrl: portalUrl,
            mac: macAddress,
            hasToken: !!token
        }
    });
});

service.register('forceHandshake', function(message) {
    if (!portalUrl || !macAddress) return respondError(message, new Error('Service not initialized'));
    token = '';
    handshake().then(function() {
        message.respond({ returnValue: true });
    }).catch(function(error) {
        respondError(message, error);
    });
});

console.log('EZ Play TV Stalker service started');
