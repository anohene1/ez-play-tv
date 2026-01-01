/**
 * EZ Play TV - Stalker Portal HTTP Proxy Service
 * Luna Service for webOS
 *
 * This service acts as an HTTP proxy to bypass browser CORS and header restrictions
 * when communicating with Stalker/Ministra IPTV portals.
 */

var pkgInfo = require('./package.json');
var Service = require('webos-service');
var axios = require('axios');

var service = new Service(pkgInfo.name);

// Service state
var portalUrl = '';
var macAddress = '';
var token = '';
var cookies = {};
var isHandshaking = false;

/**
 * Normalize MAC address to XX:XX:XX:XX:XX:XX format
 */
function normalizeMac(mac) {
    const cleanMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
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

    // Add any additional cookies from handshake
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
    if (isHandshaking) {
        // Wait for ongoing handshake
        return new Promise(function(resolve) {
            var checkInterval = setInterval(function() {
                if (!isHandshaking) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    isHandshaking = true;

    service.log('info', 'Performing handshake with portal');

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
        // Store cookies from response
        parseCookies(response.headers['set-cookie']);

        // Extract token
        if (response.data && response.data.js && response.data.js.token) {
            token = response.data.js.token;
            service.log('info', 'Handshake successful, token: ' + token);
        } else {
            throw new Error('No token received from handshake');
        }

        isHandshaking = false;
    })
    .catch(function(error) {
        isHandshaking = false;
        service.log('error', 'Handshake failed: ' + error.message);
        throw error;
    });
}

/**
 * Make request to Stalker portal with proper headers
 */
function makeRequest(type, action, extraParams, retryOnAuthError) {
    extraParams = extraParams || {};
    retryOnAuthError = retryOnAuthError !== false;

    // Ensure we have a token
    var promise = token ? Promise.resolve() : handshake();

    return promise.then(function() {
        var url = portalUrl + '/server/load.php';

        var params = {
            type: type || 'stb',
            action: action,
            mac: macAddress
        };

        // Add extra params
        Object.keys(extraParams).forEach(function(key) {
            params[key] = extraParams[key];
        });

        // Add token if we have one
        if (token) {
            params.token = token;
        }

        var headers = {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Cookie': buildCookieHeader()
        };

        // Add Authorization header if token exists
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        service.log('info', 'Request: ' + action + ' with params: ' + JSON.stringify(params));

        return axios.get(url, {
            params: params,
            headers: headers,
            timeout: 30000
        })
        .then(function(response) {
            // Update cookies from response
            parseCookies(response.headers['set-cookie']);
            return response.data;
        })
        .catch(function(error) {
            // Check if it's an auth error (401, 403, or empty response)
            var isAuthError =
                (error.response && error.response.status === 401) ||
                (error.response && error.response.status === 403) ||
                (error.response && error.response.data && Object.keys(error.response.data).length === 0);

            if (isAuthError && retryOnAuthError) {
                service.log('warn', 'Auth error detected, retrying handshake...');
                token = ''; // Clear token
                return handshake().then(function() {
                    // Retry once without retrying again
                    return makeRequest(type, action, extraParams, false);
                });
            }

            throw error;
        });
    });
}

/**
 * Luna Service Method: Initialize
 * Sets the portal URL and MAC address
 */
service.register('init', function(message) {
    try {
        var payload = message.payload;
        var url = payload.url;
        var mac = payload.mac;

        if (!url || !mac) {
            message.respond({
                returnValue: false,
                errorText: 'Missing required parameters: url and mac'
            });
            return;
        }

        // Normalize portal URL
        portalUrl = url.replace(/\/+$/, '');

        // Normalize MAC address
        macAddress = normalizeMac(mac);

        // Clear existing token and cookies
        token = '';
        cookies = {};

        service.log('info', 'Initialized with portal: ' + portalUrl + ', MAC: ' + macAddress);

        message.respond({
            returnValue: true,
            portalUrl: portalUrl,
            mac: macAddress
        });

    } catch (error) {
        service.log('error', 'Init error: ' + error.message);
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

/**
 * Luna Service Method: Request
 * Proxy HTTP request to Stalker portal
 */
service.register('request', function(message) {
    try {
        var payload = message.payload;
        var type = payload.type;
        var action = payload.action;
        var extraParams = payload.extraParams;

        if (!action) {
            message.respond({
                returnValue: false,
                errorText: 'Missing required parameter: action'
            });
            return;
        }

        if (!portalUrl || !macAddress) {
            message.respond({
                returnValue: false,
                errorText: 'Service not initialized. Call init first.'
            });
            return;
        }

        makeRequest(type, action, extraParams || {})
            .then(function(result) {
                message.respond({
                    returnValue: true,
                    data: result
                });
            })
            .catch(function(error) {
                service.log('error', 'Request error: ' + error.message);
                message.respond({
                    returnValue: false,
                    errorText: error.message,
                    errorCode: (error.response && error.response.status) || -1
                });
            });

    } catch (error) {
        service.log('error', 'Request error: ' + error.message);
        message.respond({
            returnValue: false,
            errorText: error.message,
            errorCode: -1
        });
    }
});

/**
 * Luna Service Method: Get Status
 * Returns current service state
 */
service.register('getStatus', function(message) {
    message.respond({
        returnValue: true,
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
 * Luna Service Method: Force Handshake
 * Manually trigger handshake
 */
service.register('forceHandshake', function(message) {
    try {
        if (!portalUrl || !macAddress) {
            message.respond({
                returnValue: false,
                errorText: 'Service not initialized. Call init first.'
            });
            return;
        }

        token = ''; // Clear existing token

        handshake()
            .then(function() {
                message.respond({
                    returnValue: true,
                    token: token,
                    cookies: cookies
                });
            })
            .catch(function(error) {
                service.log('error', 'Force handshake error: ' + error.message);
                message.respond({
                    returnValue: false,
                    errorText: error.message
                });
            });

    } catch (error) {
        service.log('error', 'Force handshake error: ' + error.message);
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.log('info', 'Stalker Portal Proxy Service started');
