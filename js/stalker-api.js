/**
 * EZ Play TV - Stalker Portal API Client
 * Handles communication with Stalker/Ministra middleware
 */

var StalkerAPI = {
    baseUrl: '',
    mac: '',
    token: '',
    authMode: 'url-params', // 'url-params' or 'headers'
    bearerToken: '',
    useLunaService: false,

    /**
     * Initialize the API with account credentials
     */
    init: function (portalUrl, macAddress, authMode) {
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
        this.authMode = authMode || 'url-params';
        this.bearerToken = '';
        this.authModeDetected = false;

        // Check if Luna Service is available
        if (typeof StalkerLunaService !== 'undefined' && StalkerLunaService.checkAvailability()) {
            console.log('Luna Service detected - will use proxy for all requests');
            this.useLunaService = true;
        } else {
            console.log('Luna Service not available - using direct HTTP');
            this.useLunaService = false;
        }

        console.log('StalkerAPI initialized - baseUrl:', this.baseUrl, 'MAC:', this.mac, 'Use Luna Service:', this.useLunaService);
    },

    /**
     * Auto-detect authentication mode by trying to fetch genres
     */
    detectAuthMode: async function() {
        console.log('Detecting authentication mode...');

        // ALWAYS do handshake in URL params mode first
        console.log('Performing handshake (always in URL params mode)...');
        this.authMode = 'url-params';
        this.bearerToken = '';

        try {
            await this.handshake();
            console.log('Handshake successful, got token:', this.token);
        } catch (error) {
            console.error('Handshake failed:', error.message);
            this.authModeDetected = true;
            return 'url-params';
        }

        const handshakeToken = this.token;

        // Try URL params mode (continue using token in URL)
        console.log('Trying URL params authentication mode...');
        this.authMode = 'url-params';

        try {
            const result = await this.request('get_genres', { type: 'itv' });
            console.log('URL params result:', result);

            if (result.js && Array.isArray(result.js) && result.js.length > 0) {
                console.log('✓ Auth mode detected: url-params (got ' + result.js.length + ' genres)');
                this.authModeDetected = true;
                return 'url-params';
            } else {
                console.log('✗ URL params returned empty or invalid data');
            }
        } catch (error) {
            console.log('✗ URL params method failed:', error.message);
        }

        // Try headers mode (use handshake token as Bearer token)
        console.log('Trying headers authentication mode...');
        this.authMode = 'headers';
        this.bearerToken = handshakeToken;
        console.log('Using handshake token as Bearer token for Authorization header');

        try {
            const result = await this.request('get_genres', { type: 'itv' });
            console.log('Headers result:', result);

            if (result.js && Array.isArray(result.js) && result.js.length > 0) {
                console.log('✓ Auth mode detected: headers (got ' + result.js.length + ' genres)');
                this.authModeDetected = true;
                return 'headers';
            } else {
                console.log('✗ Headers returned empty or invalid data');
            }
        } catch (error) {
            console.log('✗ Headers method failed:', error.message);
        }

        // Try headers mode with /c/ removed from URL (if present)
        if (this.baseUrl.includes('/c/') || this.baseUrl.endsWith('/c')) {
            const originalBaseUrl = this.baseUrl;
            this.baseUrl = this.baseUrl.replace(/\/c\/?$/, '').replace(/\/c\//, '/');
            console.log('Trying headers mode with /c/ removed from URL...');
            console.log('Original URL:', originalBaseUrl);
            console.log('Modified URL:', this.baseUrl);

            try {
                const result = await this.request('get_genres', { type: 'itv' });
                console.log('Headers result (without /c/):', result);

                if (result.js && Array.isArray(result.js) && result.js.length > 0) {
                    console.log('✓ Auth mode detected: headers without /c/ (got ' + result.js.length + ' genres)');
                    this.authModeDetected = true;
                    return 'headers';
                } else {
                    console.log('✗ Headers without /c/ returned empty or invalid data');
                    // Restore original URL if this didn't work
                    this.baseUrl = originalBaseUrl;
                }
            } catch (error) {
                console.log('✗ Headers method without /c/ failed:', error.message);
                // Restore original URL
                this.baseUrl = originalBaseUrl;
            }
        }

        // Default to url-params if both fail
        console.log('⚠ Could not detect auth mode, defaulting to url-params');
        this.authMode = 'url-params';
        this.token = handshakeToken;
        this.bearerToken = '';
        this.authModeDetected = true;
        return 'url-params';
    },

    /**
     * Make API request
     */
    request: function (action, params) {
        var self = this;
        params = params || {};

        // Use Luna Service if available
        if (this.useLunaService) {
            console.log('Using Luna Service for request:', action);
            return StalkerLunaService.request(action, params);
        }

        var fullUrl, headers, queryParams;

        if (this.authMode === 'headers') {
            // Header-based authentication mode (but using URL params since headers are blocked)
            fullUrl = this.baseUrl + '/portal.php';

            // Build query string
            queryParams = [];
            queryParams.push('type=' + encodeURIComponent(params.type || 'stb'));
            queryParams.push('action=' + encodeURIComponent(action));

            // Add MAC, timezone, and adid as URL params (since Cookie header is blocked)
            queryParams.push('mac=' + encodeURIComponent(this.mac));
            queryParams.push('timezone=' + encodeURIComponent('Africa/Accra'));
            queryParams.push('adid=' + encodeURIComponent('d958e2325c08699dd45a006a415f7a51'));

            // Add bearer token as URL param (since Authorization header is also blocked)
            if (this.bearerToken) {
                console.log('Adding token as URL parameter (Authorization header is blocked)');
                queryParams.push('token=' + encodeURIComponent(this.bearerToken));
            }

            // Add additional params
            for (var key in params) {
                if (params.hasOwnProperty(key) && key !== 'type') {
                    queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
            }

            fullUrl += '?' + queryParams.join('&');

            // Build headers
            headers = {
                'Accept': '*/*',
                'Accept-Language': 'en-GB',
                'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.211 Safari/537.36 WebAppManager'
            };
        } else {
            // URL parameter-based authentication mode (default)
            fullUrl = this.baseUrl + '/server/load.php';

            // Build query string - MAC is always required
            queryParams = [];
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

            headers = {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
                'X-User-Agent': 'Model: MAG250; Link: WiFi'
            };
        }

        console.log('API Request:', fullUrl);
        console.log('Auth Mode:', this.authMode);
        console.log('Request Headers:', JSON.stringify(headers, null, 2));

        return fetch(fullUrl, {
            method: 'GET',
            headers: headers
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

        // Use Luna Service if available
        if (this.useLunaService) {
            console.log('Initializing Luna Service...');
            return StalkerLunaService.init(this.baseUrl, this.mac)
                .then(function() {
                    console.log('Luna Service initialized successfully');
                    return { success: true };
                })
                .catch(function(error) {
                    console.error('Luna Service initialization failed:', error);
                    return { success: false, error: error.message || 'Luna Service init failed' };
                });
        }

        // Otherwise use direct HTTP
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
     * Create series stream link for a specific episode
     * Series uses type=vod with the cmd containing series info
     */
    createSeriesLink: function (cmd, episodeId) {
        console.log('Creating series link with cmd:', cmd);

        // Decode to verify format
        var episodeInfo;
        try {
            episodeInfo = JSON.parse(atob(cmd));
            console.log('Episode info:', episodeInfo);
        } catch (e) {
            console.error('Failed to decode episode cmd:', e);
            throw new Error('Invalid episode cmd format');
        }

        // Build params for create_link
        // For series, use type=vod with the cmd and series=1 flag
        var params = {
            type: 'vod',
            cmd: cmd,
            series: 1,
            force_ch_link_check: 0
        };

        console.log('Series create_link params:', params);

        return this.request('create_link', params)
            .then(function (result) {
                console.log('Series create_link result:', result);

                if (result.js && result.js.cmd) {
                    var streamUrl = result.js.cmd;

                    // Clean up the URL
                    if (streamUrl.indexOf('ffmpeg ') === 0) {
                        streamUrl = streamUrl.replace(/^ffmpeg\s+/, '');
                    }
                    if (streamUrl.indexOf('ffrt ') === 0) {
                        streamUrl = streamUrl.replace(/^ffrt\s+/, '');
                    }

                    var urlMatch = streamUrl.match(/"([^"]+)"|'([^']+)'|(\S+)/);
                    if (urlMatch) {
                        streamUrl = urlMatch[1] || urlMatch[2] || urlMatch[3];
                    }

                    return streamUrl;
                }

                throw new Error('Failed to create series link - no cmd in response');
            });
    },

    /**
     * Get seasons for a series
     * Uses get_ordered_list with series ID to fetch all seasons
     */
    getSeriesEpisodes: function (seriesId) {
        return this.request('get_ordered_list', {
            movie_id: seriesId,
            season_id: 0,
            episode_id: 0,
            action: 'get_ordered_list',
            type: 'series',
            p: 1,
            sortby: 'added'
        })
            .then(function (result) {
                console.log('Series seasons API response:', result);
                return {
                    items: (result.js && result.js.data) || [],
                    total: parseInt((result.js && result.js.total_items) || 0)
                };
            });
    },

    /**
     * Get episodes for a specific season
     */
    getSeasonEpisodes: function (seasonCmd) {
        // Decode the season cmd to get series_id and season_num
        var seasonInfo;
        try {
            seasonInfo = JSON.parse(atob(seasonCmd));
        } catch (e) {
            console.error('Failed to decode season cmd:', e);
            return Promise.resolve({ items: [], total: 0 });
        }

        console.log('Fetching episodes for season:', seasonInfo);

        return this.request('get_ordered_list', {
            movie_id: seasonInfo.series_id,
            season_id: seasonInfo.season_num,
            episode_id: 0,
            action: 'get_ordered_list',
            type: 'series',
            p: 1,
            sortby: 'added'
        })
            .then(function (result) {
                console.log('Season episodes API response:', result);
                return {
                    items: (result.js && result.js.data) || [],
                    total: parseInt((result.js && result.js.total_items) || 0)
                };
            });
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
