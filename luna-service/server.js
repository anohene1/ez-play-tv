/**
 * EZ Play TV - Stalker Portal HTTP Proxy Server
 * Simple HTTP proxy to bypass browser CORS and header restrictions
 */

var express = require('express');
var cors = require('cors');
var axios = require('axios');

var app = express();
var PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Service state
var portalUrl = '';
var macAddress = '';
var token = '';
var cookies = {};

/**
 * Normalize MAC address to XX:XX:XX:XX:XX:XX format
 */
function normalizeMac(mac) {
    var cleanMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
    if (cleanMac.length === 12) {
        return cleanMac.match(/.{2}/g).join(':');
    }
    return mac.toUpperCase();
}

/**
 * Build Cookie header from stored cookies
 */
function buildCookieHeader() {
    var cookieParts = ['mac=' + macAddress];

    if (cookies.stb_lang) {
        cookieParts.push('stb_lang=' + cookies.stb_lang);
    } else {
        cookieParts.push('stb_lang=en');
    }

    if (cookies.timezone) {
        cookieParts.push('timezone=' + cookies.timezone);
    } else {
        cookieParts.push('timezone=GMT');
    }

    // Add any additional cookies
    Object.keys(cookies).forEach(function(key) {
        if (key !== 'stb_lang' && key !== 'timezone') {
            cookieParts.push(key + '=' + cookies[key]);
        }
    });

    return cookieParts.join('; ');
}

/**
 * Parse Set-Cookie headers and store cookies
 */
function parseCookies(setCookieHeaders) {
    if (!setCookieHeaders) return;

    var headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

    headers.forEach(function(cookieStr) {
        var parts = cookieStr.split(';')[0].split('=');
        if (parts.length === 2) {
            var key = parts[0].trim();
            var value = parts[1].trim();
            cookies[key] = value;
        }
    });
}

/**
 * Perform handshake with Stalker portal
 */
function handshake() {
    console.log('[Handshake] Starting with MAC:', macAddress);

    var url = portalUrl + '/server/load.php';
    var params = {
        type: 'stb',
        action: 'handshake',
        prehash: '0',
        mac: macAddress
    };

    return axios.get(url, {
        params: params,
        headers: {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-User-Agent': 'Model: MAG250; Link: WiFi'
        }
    })
    .then(function(response) {
        parseCookies(response.headers['set-cookie']);

        if (response.data && response.data.js && response.data.js.token) {
            token = response.data.js.token;
            console.log('[Handshake] Success! Token:', token);
        } else {
            throw new Error('No token received from handshake');
        }
    });
}

/**
 * Make request to Stalker portal
 */
function makeRequest(type, action, extraParams, retryOnAuthError) {
    extraParams = extraParams || {};
    retryOnAuthError = retryOnAuthError !== false;

    var promise = token ? Promise.resolve() : handshake();

    return promise.then(function() {
        var url = portalUrl + '/server/load.php';

        var params = {
            type: type || 'stb',
            action: action,
            mac: macAddress
        };

        Object.keys(extraParams).forEach(function(key) {
            params[key] = extraParams[key];
        });

        if (token) {
            params.token = token;
        }

        var headers = {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Cookie': buildCookieHeader()
        };

        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        console.log('[Request]', action, 'with params:', JSON.stringify(params));

        return axios.get(url, {
            params: params,
            headers: headers,
            timeout: 30000
        })
        .then(function(response) {
            parseCookies(response.headers['set-cookie']);
            return response.data;
        })
        .catch(function(error) {
            var isAuthError =
                (error.response && error.response.status === 401) ||
                (error.response && error.response.status === 403) ||
                (error.response && error.response.data && Object.keys(error.response.data).length === 0);

            if (isAuthError && retryOnAuthError) {
                console.log('[Request] Auth error, retrying handshake...');
                token = '';
                return handshake().then(function() {
                    return makeRequest(type, action, extraParams, false);
                });
            }

            throw error;
        });
    });
}

// ============ API ROUTES ============

/**
 * POST /init - Initialize proxy with portal URL and MAC
 */
app.post('/init', function(req, res) {
    try {
        var url = req.body.url;
        var mac = req.body.mac;

        if (!url || !mac) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: url and mac'
            });
        }

        portalUrl = url.replace(/\/+$/, '');
        macAddress = normalizeMac(mac);
        token = '';
        cookies = {};

        console.log('[Init] Portal:', portalUrl, 'MAC:', macAddress);

        res.json({
            success: true,
            portalUrl: portalUrl,
            mac: macAddress
        });

    } catch (error) {
        console.error('[Init] Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /request - Proxy request to Stalker portal
 */
app.post('/request', function(req, res) {
    try {
        var type = req.body.type;
        var action = req.body.action;
        var extraParams = req.body.extraParams || {};

        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: action'
            });
        }

        if (!portalUrl || !macAddress) {
            return res.status(400).json({
                success: false,
                error: 'Proxy not initialized. Call /init first.'
            });
        }

        makeRequest(type, action, extraParams)
            .then(function(data) {
                res.json({
                    success: true,
                    data: data
                });
            })
            .catch(function(error) {
                console.error('[Request] Error:', error.message);
                res.status(error.response ? error.response.status : 500).json({
                    success: false,
                    error: error.message
                });
            });

    } catch (error) {
        console.error('[Request] Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /status - Get proxy status
 */
app.get('/status', function(req, res) {
    res.json({
        success: true,
        status: {
            initialized: !!(portalUrl && macAddress),
            portalUrl: portalUrl,
            mac: macAddress,
            hasToken: !!token,
            token: token,
            cookies: cookies
        }
    });
});

/**
 * POST /handshake - Force handshake
 */
app.post('/handshake', function(req, res) {
    if (!portalUrl || !macAddress) {
        return res.status(400).json({
            success: false,
            error: 'Proxy not initialized. Call /init first.'
        });
    }

    token = '';

    handshake()
        .then(function() {
            res.json({
                success: true,
                token: token,
                cookies: cookies
            });
        })
        .catch(function(error) {
            console.error('[Handshake] Error:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        });
});

// Get local IP address
function getLocalIP() {
    var os = require('os');
    var interfaces = os.networkInterfaces();
    for (var name in interfaces) {
        for (var i = 0; i < interfaces[name].length; i++) {
            var iface = interfaces[name][i];
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Start server on all interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', function() {
    var localIP = getLocalIP();
    console.log('');
    console.log('========================================');
    console.log('  Stalker Portal HTTP Proxy Server');
    console.log('========================================');
    console.log('');
    console.log('  Server running on port:', PORT);
    console.log('  Local access:   http://localhost:' + PORT);
    console.log('  Network access: http://' + localIP + ':' + PORT);
    console.log('');
    console.log('  For webOS TV app, use: http://' + localIP + ':' + PORT);
    console.log('');
    console.log('  Endpoints:');
    console.log('    POST /init       - Initialize with portal URL and MAC');
    console.log('    POST /request    - Proxy request to portal');
    console.log('    GET  /status     - Get proxy status');
    console.log('    POST /handshake  - Force handshake');
    console.log('');
    console.log('========================================');
    console.log('');
});
