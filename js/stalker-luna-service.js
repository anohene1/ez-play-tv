/**
 * EZ Play TV - Stalker Proxy Service Wrapper
 *
 * This module provides a wrapper around the HTTP proxy server
 * to replace direct HTTP calls to the Stalker portal.
 *
 * Usage:
 * 1. Start proxy server: cd luna-service && npm install && npm start
 * 2. Call StalkerLunaService.init(url, mac) on app startup
 * 3. All requests will go through the proxy
 */

var StalkerLunaService = {
    initialized: false,
    available: false,
    isWebOS: false,
    proxyUrl: 'http://localhost:3000', // Only used for browser testing

    /**
     * Check if proxy service is available
     */
    checkAvailability: function() {
        // Check if running on webOS TV (has webOS object)
        this.isWebOS = typeof webOS !== 'undefined' && typeof webOS.service !== 'undefined';

        if (this.isWebOS) {
            console.log('Running on webOS TV - will use Luna Service');
            return true;
        }

        // Not on webOS - disable proxy (use direct HTTP instead)
        console.log('Not on webOS TV - Luna Service unavailable');
        return false;
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
                webOS.service.request('luna://com.ezplaytv.stalker.service', {
                    method: 'init',
                    parameters: {
                        url: portalUrl,
                        mac: macAddress
                    },
                    onSuccess: function(response) {
                        if (response.returnValue) {
                            console.log('Luna Service initialized:', response);
                            self.initialized = true;
                            self.available = true;
                            resolve(response);
                        } else {
                            throw new Error(response.error || 'Initialization failed');
                        }
                    },
                    onFailure: function(error) {
                        console.error('Luna Service init failed:', error);
                        self.initialized = false;
                        self.available = false;
                        reject(error);
                    }
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
                webOS.service.request('luna://com.ezplaytv.stalker.service', {
                    method: 'request',
                    parameters: requestBody,
                    onSuccess: function(response) {
                        if (response.returnValue && response.data) {
                            console.log('Luna Service response:', response.data);
                            resolve(response.data);
                        } else {
                            reject(new Error(response.error || 'Request failed'));
                        }
                    },
                    onFailure: function(error) {
                        console.error('Luna Service request failed:', error);
                        reject(error);
                    }
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
