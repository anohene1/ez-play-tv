#!/usr/bin/env node

/**
 * EZ Play TV - Stalker Portal Proxy Luna Service
 * This service runs ON the webOS TV and proxies Stalker API requests
 * with proper MAG headers that browsers cannot set.
 */

var http = require('http');
var https = require('https');
var url = require('url');

// Service state
var config = {
    portalUrl: '',
    mac: '',
    token: '',
    cookies: {}
};

/**
 * Normalize MAC address
 */
function normalizeMac(mac) {
    var cleanMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
    if (cleanMac.length === 12) {
        return cleanMac.match(/.{2}/g).join(':');
    }
    return mac.toUpperCase();
}

/**
 * Build Cookie header
 */
function buildCookieHeader() {
    var parts = ['mac=' + config.mac];
    parts.push('stb_lang=en');
    parts.push('timezone=GMT');

    for (var key in config.cookies) {
        if (key !== 'mac' && key !== 'stb_lang' && key !== 'timezone') {
            parts.push(key + '=' + config.cookies[key]);
        }
    }

    return parts.join('; ');
}

/**
 * Make HTTP request to Stalker portal
 */
function makePortalRequest(action, params, callback) {
    var parsedUrl = url.parse(config.portalUrl);
    var protocol = parsedUrl.protocol === 'https:' ? https : http;

    var queryParams = {
        type: params.type || 'stb',
        action: action,
        mac: config.mac
    };

    if (config.token) {
        queryParams.token = config.token;
    }

    // Merge extra params
    for (var key in params) {
        if (key !== 'type') {
            queryParams[key] = params[key];
        }
    }

    var query = Object.keys(queryParams).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(queryParams[k]);
    }).join('&');

    var requestUrl = parsedUrl.protocol + '//' + parsedUrl.host + '/server/load.php?' + query;

    var options = {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Cookie': buildCookieHeader(),
            'Authorization': config.token ? 'Bearer ' + config.token : ''
        }
    };

    console.log('[Request]', action, requestUrl);

    var req = protocol.get(requestUrl, options, function(res) {
        var data = '';

        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {
            try {
                var json = JSON.parse(data);

                // Extract token from handshake
                if (action === 'handshake' && json.js && json.js.token) {
                    config.token = json.js.token;
                    console.log('[Token]', config.token);
                }

                callback(null, json);
            } catch (e) {
                callback(e, null);
            }
        });
    });

    req.on('error', function(e) {
        callback(e, null);
    });
}

/**
 * Handshake
 */
function handshake(callback) {
    console.log('[Handshake] Starting...');
    makePortalRequest('handshake', { prehash: '0' }, callback);
}

/**
 * Handle Luna Service call (stdin/stdout communication)
 */
process.stdin.setEncoding('utf8');
var inputBuffer = '';

process.stdin.on('data', function(chunk) {
    inputBuffer += chunk;

    var lines = inputBuffer.split('\n');
    inputBuffer = lines.pop();

    lines.forEach(function(line) {
        if (!line.trim()) return;

        try {
            var message = JSON.parse(line);
            handleMessage(message);
        } catch (e) {
            console.error('[Error] Invalid JSON:', e.message);
        }
    });
});

function handleMessage(message) {
    var method = message.method;
    var params = message.payload || {};

    if (method === 'init') {
        config.portalUrl = params.url.replace(/\/+$/, '');
        config.mac = normalizeMac(params.mac);
        config.token = '';
        config.cookies = {};

        console.log('[Init]', config.portalUrl, config.mac);

        sendResponse({
            returnValue: true,
            portalUrl: config.portalUrl,
            mac: config.mac
        });

    } else if (method === 'request') {
        var action = params.action;
        var extraParams = params.extraParams || {};
        extraParams.type = params.type;

        // Auto handshake if no token
        if (!config.token && action !== 'handshake') {
            handshake(function(err, result) {
                if (err) {
                    sendResponse({ returnValue: false, error: err.message });
                } else {
                    makePortalRequest(action, extraParams, function(err, data) {
                        if (err) {
                            sendResponse({ returnValue: false, error: err.message });
                        } else {
                            sendResponse({ returnValue: true, data: data });
                        }
                    });
                }
            });
        } else {
            makePortalRequest(action, extraParams, function(err, data) {
                if (err) {
                    sendResponse({ returnValue: false, error: err.message });
                } else {
                    sendResponse({ returnValue: true, data: data });
                }
            });
        }

    } else if (method === 'getStatus') {
        sendResponse({
            returnValue: true,
            status: {
                initialized: !!(config.portalUrl && config.mac),
                portalUrl: config.portalUrl,
                mac: config.mac,
                hasToken: !!config.token,
                token: config.token
            }
        });

    } else {
        sendResponse({
            returnValue: false,
            error: 'Unknown method: ' + method
        });
    }
}

function sendResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
}

console.log('[Service] Stalker Proxy Luna Service started');
