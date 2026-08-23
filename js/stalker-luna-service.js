/**
 * EZ Play TV - Stalker Proxy Service Wrapper
 *
 * This module provides a wrapper around the HTTP proxy server
 * to replace direct HTTP calls to the Stalker portal.
 *
 * Usage:
 * 1. Start proxy server: cd luna-service && npm install && npm start (port 3001)
 * 2. Call StalkerLunaService.init(url, mac) on app startup
 * 3. All requests will go through the proxy
 */

var StalkerLunaService = {
    initialized: false,
    available: false,
    isWebOS: false,
    proxyUrl: 'http://localhost:3001', // Only used for browser testing
    serviceUri: 'luna://com.ezplaytv.app.stalker',
    pendingRequests: [],
    keepAliveRequest: null,
    streamProxyBase: '',

    startKeepAlive: function() {
        var self = this;
        if (!this.isWebOS || this.keepAliveRequest) return;

        this.keepAliveRequest = webOS.service.request(this.serviceUri, {
            method: 'keepAlive',
            parameters: { subscribe: true },
            subscribe: true,
            resubscribe: true,
            onSuccess: function(response) {
                if (response.streamProxyBase) self.streamProxyBase = response.streamProxyBase;
            },
            onFailure: function(error) {
                console.error('Stream proxy keep-alive failed:', error);
                self.keepAliveRequest = null;
            }
        });
    },

    getStreamProxyUrl: function(targetUrl) {
        if (!this.isWebOS || !this.streamProxyBase) return targetUrl;
        return this.streamProxyBase + encodeURIComponent(targetUrl);
    },

    requestWebOS: function(method, parameters) {
        var self = this;

        return new Promise(function(resolve, reject) {
            var requestHandle = null;
            var timeoutHandle = null;
            var settled = false;
            var release = function() {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                var index = self.pendingRequests.indexOf(requestHandle);
                if (index !== -1) self.pendingRequests.splice(index, 1);
            };
            var complete = function(callback, value) {
                if (settled) return;
                settled = true;
                release();
                callback(value);
            };

            requestHandle = webOS.service.request(self.serviceUri, {
                method: method,
                parameters: parameters || {},
                onSuccess: function(response) {
                    complete(resolve, response);
                },
                onFailure: function(error) {
                    complete(reject, error);
                }
            });

            if (!settled) {
                self.pendingRequests.push(requestHandle);
                timeoutHandle = setTimeout(function() {
                    if (requestHandle && typeof requestHandle.cancel === 'function') {
                        requestHandle.cancel();
                    }
                    complete(reject, new Error('webOS service request timed out: ' + method));
                }, 35000);
            }
        });
    },

    /**
     * Check if proxy service is available
     */
    checkAvailability: function() {
        // Check if running on webOS TV (has webOS object)
        this.isWebOS = typeof webOS !== 'undefined'
            && typeof webOS.service !== 'undefined'
            && (typeof webOSSystem !== 'undefined'
                || typeof PalmSystem !== 'undefined'
                || (webOS.platform && webOS.platform.tv === true));

        if (this.isWebOS) {
            console.log('Running on webOS TV - will use Luna Service');
            return true;
        }

        // Browser development uses the companion HTTP proxy. Calling Stalker
        // portals directly from a browser is unreliable because most portals do
        // not expose CORS headers and browsers block MAG-specific headers.
        console.log('Running in browser - will use HTTP proxy at ' + this.proxyUrl);
        return true;
    },

    /**
     * Initialize the Service (Luna on TV, HTTP in browser)
     */
    init: function(portalUrl, macAddress) {
        var self = this;

        return new Promise(function(resolve, reject) {
            console.log('Initializing Service with portal:', portalUrl, 'MAC:', macAddress);

            if (self.isWebOS) {
                // Use Luna Service on webOS TV
                self.requestWebOS('init', {
                        url: portalUrl,
                        mac: macAddress
                    })
                    .then(function(response) {
                        if (response.returnValue) {
                            console.log('Luna Service initialized:', response);
                            self.initialized = true;
                            self.available = true;
                            if (response.streamProxyBase) self.streamProxyBase = response.streamProxyBase;
                            self.startKeepAlive();
                            resolve(response);
                        } else {
                            throw new Error(response.error || response.errorText || 'Initialization failed');
                        }
                    })
                    .catch(function(error) {
                        console.error('Luna Service init failed:', error);
                        self.initialized = false;
                        self.available = false;
                        reject(error);
                    });
            } else {
                // Use HTTP proxy in browser
                fetch(self.proxyUrl + '/init', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: portalUrl,
                        mac: macAddress
                    })
                })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    if (data.success) {
                        console.log('HTTP Proxy initialized:', data);
                        self.initialized = true;
                        self.available = true;
                        resolve(data);
                    } else {
                        throw new Error(data.error || 'Initialization failed');
                    }
                })
                .catch(function(error) {
                    console.error('HTTP Proxy init failed:', error);
                    self.initialized = false;
                    self.available = false;
                    reject(error);
                });
            }
        });
    },

    /**
     * Make a request through the Service (Luna on TV, HTTP in browser)
     */
    request: function(action, params) {
        var self = this;

        return new Promise(function(resolve, reject) {
            if (!self.initialized) {
                reject(new Error('Service not initialized. Call init() first.'));
                return;
            }

            params = params || {};

            var requestBody = {
                action: action,
                type: params.type || 'stb',
                extraParams: {}
            };

            // Move all params except 'type' to extraParams
            for (var key in params) {
                if (params.hasOwnProperty(key) && key !== 'type') {
                    requestBody.extraParams[key] = params[key];
                }
            }

            console.log('Service request:', action, requestBody);

            if (self.isWebOS) {
                // Use Luna Service on webOS TV
                self.requestWebOS('request', requestBody)
                    .then(function(response) {
                        if (response.returnValue && response.data) {
                            console.log('Luna Service response:', response.data);
                            resolve(response.data);
                        } else {
                            reject(new Error(response.error || response.errorText || 'Request failed'));
                        }
                    })
                    .catch(function(error) {
                        console.error('Luna Service request failed:', error);
                        reject(error);
                    });
            } else {
                // Use HTTP proxy in browser
                fetch(self.proxyUrl + '/request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    if (data.success && data.data) {
                        console.log('HTTP Proxy response:', data.data);
                        resolve(data.data);
                    } else {
                        throw new Error(data.error || 'Request failed');
                    }
                })
                .catch(function(error) {
                    console.error('HTTP Proxy request failed:', error);
                    reject(error);
                });
            }
        });
    },

    /**
     * Get service status
     */
    getStatus: function() {
        var self = this;

        if (self.isWebOS) {
            return self.requestWebOS('getStatus', {}).then(function(response) {
                if (response.returnValue) return response.status;
                throw new Error(response.error || response.errorText || 'Status check failed');
            });
        }

        return new Promise(function(resolve, reject) {
            fetch(self.proxyUrl + '/status')
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                if (data.success) {
                    console.log('Proxy Service status:', data.status);
                    resolve(data.status);
                } else {
                    throw new Error(data.error || 'Status check failed');
                }
            })
            .catch(function(error) {
                console.error('Proxy Service getStatus failed:', error);
                reject(error);
            });
        });
    },

    /**
     * Force handshake
     */
    forceHandshake: function() {
        var self = this;

        if (self.isWebOS) {
            if (!self.initialized) {
                return Promise.reject(new Error('Proxy Service not initialized. Call init() first.'));
            }

            return self.requestWebOS('forceHandshake', {}).then(function(response) {
                if (response.returnValue) return response;
                throw new Error(response.error || response.errorText || 'Handshake failed');
            });
        }

        return new Promise(function(resolve, reject) {
            if (!self.initialized) {
                reject(new Error('Proxy Service not initialized. Call init() first.'));
                return;
            }

            fetch(self.proxyUrl + '/handshake', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                if (data.success) {
                    console.log('Proxy Service handshake successful:', data);
                    resolve(data);
                } else {
                    throw new Error(data.error || 'Handshake failed');
                }
            })
            .catch(function(error) {
                console.error('Proxy Service forceHandshake failed:', error);
                reject(error);
            });
        });
    }
};

// Export for use in other modules
window.StalkerLunaService = StalkerLunaService;
