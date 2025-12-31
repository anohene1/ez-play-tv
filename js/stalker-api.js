/**
 * EZ Play TV - Stalker Portal API Client
 * Handles communication with Stalker/Ministra middleware
 */

var StalkerAPI = {
    baseUrl: '',
    mac: '',
    token: '',

    /**
     * Initialize the API with account credentials
     */
    init: function (portalUrl, macAddress) {
        console.log('Original portal URL:', portalUrl);

        // Normalize portal URL - remove trailing slashes
        this.baseUrl = portalUrl.replace(/\/+$/, '');

        // Normalize MAC address to XX:XX:XX:XX:XX:XX format
        var cleanMac = macAddress.toUpperCase().replace(/[^A-F0-9]/g, '');
        if (cleanMac.length === 12) {
            this.mac = cleanMac.match(/.{2}/g).join(':');
        } else {
            this.mac = macAddress.toUpperCase();
        }

        this.token = '';
        console.log('StalkerAPI initialized - baseUrl:', this.baseUrl, 'MAC:', this.mac);
    },

    /**
     * Make API request
     */
    request: function (action, params) {
        var self = this;
        params = params || {};

        // Build the full URL
        var fullUrl = this.baseUrl + '/server/load.php';

        // Build query string - MAC is always required
        var queryParams = [];
        queryParams.push('type=' + encodeURIComponent(params.type || 'stb'));
        queryParams.push('action=' + encodeURIComponent(action));
        queryParams.push('mac=' + encodeURIComponent(this.mac));

        // Add token if we have one (required after handshake)
        if (this.token) {
            queryParams.push('token=' + encodeURIComponent(this.token));
        }

        // Add additional params
        for (var key in params) {
            if (params.hasOwnProperty(key) && key !== 'type') {
                queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
            }
        }

        fullUrl += '?' + queryParams.join('&');

        console.log('API Request:', fullUrl);

        return fetch(fullUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
                'X-User-Agent': 'Model: MAG250; Link: WiFi'
            }
        })
            .then(function (response) {
                return response.text();
            })
            .then(function (rawText) {
                console.log('API Response raw:', rawText.substring(0, 500));

                var data;
                try {
                    data = JSON.parse(rawText);
                } catch (parseError) {
                    console.error('JSON parse error. Raw response:', rawText);
                    throw new Error('Invalid JSON response from server');
                }

                return data;
            });
    },

    /**
     * Handshake with server to get token
     */
    handshake: function () {
        var self = this;
        console.log('Performing handshake with MAC:', this.mac);

        return this.request('handshake', {
            type: 'stb',
            prehash: '0'
        })
            .then(function (result) {
                if (result.js && result.js.token) {
                    self.token = result.js.token;
                    console.log('Handshake successful, token:', self.token);
                    return true;
                }
                throw new Error('Handshake failed: No token received');
            });
    },

    /**
     * Get server profile/settings
     */
    getProfile: function () {
        var self = this;
        return this.request('get_profile', {
            type: 'stb',
            sn: this.mac.replace(/:/g, ''),
            stb_type: 'MAG250',
            image_version: '218',
            hw_version: '1.7-BD-00'
        })
            .then(function (result) {
                return result.js || result;
            });
    },

    /**
     * Full connection sequence
     */
    connect: function () {
        var self = this;

        return this.handshake()
            .then(function () {
                return self.getProfile();
            })
            .then(function (profile) {
                console.log('Profile loaded:', profile);
                return { success: true, profile: profile };
            })
            .catch(function (error) {
                console.error('Connection failed:', error);
                return { success: false, error: error.message };
            });
    },

    /**
     * Get IPTV genres/categories
     */
    getGenres: function () {
        return this.request('get_genres', {
            type: 'itv'
        })
            .then(function (result) {
                return result.js || [];
            });
    },

    /**
     * Get all channels
     */
    getAllChannels: function (page, genre) {
        page = page || 1;
        genre = genre || '*';

        return this.request('get_all_channels', {
            type: 'itv',
            genre: genre,
            p: page
        })
            .then(function (result) {
                return {
                    channels: (result.js && result.js.data) || [],
                    total: parseInt((result.js && result.js.total_items) || 0),
                    pages: parseInt((result.js && result.js.max_page_items) || 14)
                };
            });
    },

    /**
     * Get ordered list of channels
     */
    getOrderedList: function (genre, page) {
        genre = genre || '*';
        page = page || 1;

        return this.request('get_ordered_list', {
            type: 'itv',
            genre: genre,
            fav: '0',
            sortby: 'number',
            p: page
        })
            .then(function (result) {
                return {
                    channels: (result.js && result.js.data) || [],
                    total: parseInt((result.js && result.js.total_items) || 0),
                    pages: parseInt((result.js && result.js.max_page_items) || 14)
                };
            });
    },

    /**
     * Create stream link for channel
     */
    createLink: function (cmd, channelId) {
        var params = {
            type: 'itv',
            cmd: cmd
        };

        if (channelId) {
            params.ch_id = channelId;
        }

        return this.request('create_link', params)
            .then(function (result) {
                if (result.js && result.js.cmd) {
                    var streamUrl = result.js.cmd;

                    // Clean up the URL
                    if (streamUrl.indexOf('ffmpeg ') === 0) {
                        streamUrl = streamUrl.replace(/^ffmpeg\s+/, '');
                    }
                    if (streamUrl.indexOf('ffrt ') === 0) {
                        streamUrl = streamUrl.replace(/^ffrt\s+/, '');
                    }

                    // Extract URL from quotes if present
                    var urlMatch = streamUrl.match(/"([^"]+)"|'([^']+)'|(\S+)/);
                    if (urlMatch) {
                        streamUrl = urlMatch[1] || urlMatch[2] || urlMatch[3];
                    }

                    // Fix empty stream parameter if present (some portals return stream=&)
                    if (channelId && (streamUrl.indexOf('stream=&') !== -1 || streamUrl.indexOf('stream=&') !== -1)) {
                        console.log('Fixing empty stream parameter with channel ID:', channelId);
                        streamUrl = streamUrl.replace('stream=&', 'stream=' + channelId + '&');
                    }

                    return streamUrl;
                }

                throw new Error('Failed to create stream link');
            });
    },

    /**
     * Get VOD categories
     */
    getVodCategories: function () {
        return this.request('get_categories', {
            type: 'vod'
        })
            .then(function (result) {
                return result.js || [];
            });
    },

    /**
     * Get VOD items (movies)
     */
    getVodItems: function (category, page, search) {
        category = category || '*';
        page = page || 1;
        search = search || '';

        var params = {
            type: 'vod',
            category: category,
            p: page,
            sortby: 'added'
        };

        if (search) {
            params.search = search;
        }

        return this.request('get_ordered_list', params)
            .then(function (result) {
                return {
                    items: (result.js && result.js.data) || [],
                    total: parseInt((result.js && result.js.total_items) || 0),
                    pages: parseInt((result.js && result.js.max_page_items) || 14)
                };
            });
    },

    /**
     * Create VOD stream link
     */
    createVodLink: function (cmd, videoId) {
        var params = {
            type: 'vod',
            cmd: cmd
        };

        if (videoId) {
            params.vod_id = videoId;
        }

        return this.request('create_link', params)
            .then(function (result) {
                if (result.js && result.js.cmd) {
                    var streamUrl = result.js.cmd;

                    if (streamUrl.indexOf('ffmpeg ') === 0) {
                        streamUrl = streamUrl.replace(/^ffmpeg\s+/, '');
                    }

                    var urlMatch = streamUrl.match(/"([^"]+)"|'([^']+)'|(\S+)/);
                    if (urlMatch) {
                        streamUrl = urlMatch[1] || urlMatch[2] || urlMatch[3];
                    }

                    return streamUrl;
                }

                throw new Error('Failed to create VOD link');
            });
    },

    /**
     * Get series categories
     */
    getSeriesCategories: function () {
        return this.request('get_categories', {
            type: 'series'
        })
            .then(function (result) {
                return result.js || [];
            });
    },

    /**
     * Get series list
     */
    getSeriesList: function (category, page, search) {
        category = category || '*';
        page = page || 1;
        search = search || '';

        var params = {
            type: 'series',
            category: category,
            p: page,
            sortby: 'added'
        };

        if (search) {
            params.search = search;
        }

        return this.request('get_ordered_list', params)
            .then(function (result) {
                return {
                    items: (result.js && result.js.data) || [],
                    total: parseInt((result.js && result.js.total_items) || 0),
                    pages: parseInt((result.js && result.js.max_page_items) || 14)
                };
            });
    },

    /**
     * Get episodes for a series
     * Note: Implementation varies by portal version. 
     * Often Series are navigated via categories/seasons in the list itself, 
     * or via create_link returning a playlist.
     * We'll try to fetch ordered list with season_id if applicable or just create_link.
     */
    createSeriesLink: function (seriesId) {
        return this.createLink('play', seriesId);
    },

    /**
     * Get EPG for channel
     */
    getEpg: function (channelId, period) {
        period = period || 5;

        return this.request('get_epg_info', {
            type: 'itv',
            ch_id: channelId,
            period: period
        })
            .then(function (result) {
                return (result.js && result.js.data) || [];
            });
    },

    /**
     * Get short EPG for channel
     */
    getShortEpg: function (channelId) {
        return this.request('get_short_epg', {
            type: 'itv',
            ch_id: channelId
        })
            .then(function (result) {
                return (result.js && result.js.data) || [];
            });
    },

    /**
     * Search channels
     */
    searchChannels: function (query, page) {
        page = page || 1;

        return this.request('get_ordered_list', {
            type: 'itv',
            genre: '*',
            fav: '0',
            sortby: 'number',
            search: query,
            p: page
        })
            .then(function (result) {
                return {
                    channels: (result.js && result.js.data) || [],
                    total: parseInt((result.js && result.js.total_items) || 0)
                };
            });
    },

    /**
     * Get favorites
     */
    getFavorites: function () {
        return this.request('get_ordered_list', {
            type: 'itv',
            genre: '*',
            fav: '1',
            sortby: 'number'
        })
            .then(function (result) {
                return (result.js && result.js.data) || [];
            });
    },

    /**
     * Set channel as favorite
     */
    setFavorite: function (channelId, isFavorite) {
        return this.request('set_fav', {
            type: 'itv',
            ch_id: channelId,
            fav: isFavorite ? '1' : '0'
        });
    }
};

window.StalkerAPI = StalkerAPI;
