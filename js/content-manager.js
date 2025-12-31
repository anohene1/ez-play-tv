/**
 * EZ Play TV - Content Manager Module
 * Manages IPTV content loading and caching
 */

const ContentManager = {
    // Cache for loaded content
    cache: {
        genres: null,
        channels: {},
        vodCategories: null,
        vodItems: {},
        seriesCategories: null,
        series: {},
    },

    // Current state
    currentGenre: '*',
    currentVodCategory: '*',
    currentSeriesCategory: '*',

    // Loading states
    loading: {
        genres: false,
        channels: false,
        vod: false,
        series: false,
    },

    /**
     * Initialize content manager and load initial data
     */
    async init() {
        const account = AccountManager.getActive();
        if (!account) {
            console.log('No active account');
            return false;
        }

        // Initialize Stalker API
        StalkerAPI.init(account.url, account.mac);

        // Connect to portal
        const result = await StalkerAPI.connect();
        if (!result.success) {
            console.error('Failed to connect:', result.error);
            return false;
        }

        console.log('Connected to portal');
        return true;
    },

    /**
     * Load channel genres/categories
     */
    async loadGenres() {
        if (this.cache.genres) return this.cache.genres;
        if (this.loading.genres) return null;

        this.loading.genres = true;

        try {
            const genres = await StalkerAPI.getGenres();

            // Add "All" category at the beginning
            this.cache.genres = [
                { id: '*', title: 'All Channels', number: '0' },
                ...genres,
            ];

            return this.cache.genres;
        } catch (error) {
            console.error('Failed to load genres:', error);
            return [];
        } finally {
            this.loading.genres = false;
        }
    },

    /**
     * Load channels for a genre
     */
    async loadChannels(genre = '*', page = 1, forceRefresh = false) {
        const cacheKey = `${genre}_${page}`;

        if (!forceRefresh && this.cache.channels[cacheKey]) {
            return this.cache.channels[cacheKey];
        }

        if (this.loading.channels) return null;

        this.loading.channels = true;

        try {
            const result = await StalkerAPI.getOrderedList(genre, page);

            // Process channels
            const channels = result.channels.map(ch => ({
                id: ch.id,
                name: ch.name,
                number: ch.number || ch.id,
                logo: ch.logo || '',
                cmd: ch.cmd,
                genres: ch.tv_genre_id || '',
                favorite: ch.fav === '1',
                epg: ch.epg || null,
                censored: ch.censored === '1',
            }));

            this.cache.channels[cacheKey] = {
                channels,
                total: result.total,
                pages: Math.ceil(result.total / result.pages),
                currentPage: page,
            };

            return this.cache.channels[cacheKey];
        } catch (error) {
            console.error('Failed to load channels:', error);
            return { channels: [], total: 0, pages: 0, currentPage: 1 };
        } finally {
            this.loading.channels = false;
        }
    },

    /**
     * Load all channels (paginated fetch)
     */
    async loadAllChannels(genre = '*', maxPages = 10) {
        const allChannels = [];
        let page = 1;

        while (page <= maxPages) {
            const result = await this.loadChannels(genre, page, true);
            if (!result || result.channels.length === 0) break;

            allChannels.push(...result.channels);

            if (page >= result.pages) break;
            page++;
        }

        return allChannels;
    },

    /**
     * Get stream URL for channel
     */
    async getChannelStream(channel) {
        try {
            const streamUrl = await StalkerAPI.createLink(channel.cmd, channel.id);
            return streamUrl;
        } catch (error) {
            console.error('Failed to get stream URL:', error);
            return null;
        }
    },

    /**
     * Load VOD categories
     */
    async loadVodCategories() {
        if (this.cache.vodCategories) return this.cache.vodCategories;
        if (this.loading.vod) return null;

        this.loading.vod = true;

        try {
            const categories = await StalkerAPI.getVodCategories();

            this.cache.vodCategories = [
                { id: '*', title: 'All Movies' },
                ...categories,
            ];

            return this.cache.vodCategories;
        } catch (error) {
            console.error('Failed to load VOD categories:', error);
            return [];
        } finally {
            this.loading.vod = false;
        }
    },

    /**
     * Load VOD items
     */
    async loadVodItems(category = '*', page = 1, search = '', forceRefresh = false) {
        const cacheKey = `${category}_${page}_${search}`;

        if (!forceRefresh && this.cache.vodItems[cacheKey]) {
            return this.cache.vodItems[cacheKey];
        }

        try {
            const result = await StalkerAPI.getVodItems(category, page, search);

            const items = result.items.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                poster: item.screenshot_uri || item.logo || '',
                year: item.year || '',
                director: item.director || '',
                actors: item.actors || '',
                genres: item.genres_str || '',
                rating: item.rating_imdb || item.rating_kinopoisk || '',
                duration: item.time || '',
                cmd: item.cmd,
                added: item.added,
            }));

            this.cache.vodItems[cacheKey] = {
                items,
                total: result.total,
                pages: Math.ceil(result.total / result.pages),
                currentPage: page,
            };

            return this.cache.vodItems[cacheKey];
        } catch (error) {
            console.error('Failed to load VOD items:', error);
            return { items: [], total: 0, pages: 0, currentPage: 1 };
        }
    },

    /**
     * Get stream URL for VOD
     */
    async getVodStream(vod) {
        try {
            const streamUrl = await StalkerAPI.createVodLink(vod.cmd, vod.id);
            return streamUrl;
        } catch (error) {
            console.error('Failed to get VOD stream URL:', error);
            return null;
        }
    },

    /**
     * Load series categories
     */
    async loadSeriesCategories() {
        if (this.cache.seriesCategories) return this.cache.seriesCategories;

        try {
            const categories = await StalkerAPI.getSeriesCategories();

            this.cache.seriesCategories = [
                { id: '*', title: 'All Series' },
                ...categories,
            ];

            return this.cache.seriesCategories;
        } catch (error) {
            console.error('Failed to load series categories:', error);
            return [];
        }
    },

    /**
     * Load series list
     */
    async loadSeriesList(category = '*', page = 1, search = '') {
        const cacheKey = `${category}_${page}_${search}`;

        if (this.cache.series[cacheKey]) {
            return this.cache.series[cacheKey];
        }

        try {
            const result = await StalkerAPI.getSeriesList(category, page, search);

            const items = result.items.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                poster: item.screenshot_uri || item.logo || '',
                year: item.year || '',
                genres: item.genres_str || '',
                rating: item.rating_imdb || '',
                seasons: item.series || [],
                cmd: item.cmd,
            }));

            this.cache.series[cacheKey] = {
                items,
                total: result.total,
                pages: Math.ceil(result.total / result.pages),
                currentPage: page,
            };

            return this.cache.series[cacheKey];
        } catch (error) {
            console.error('Failed to load series:', error);
            return { items: [], total: 0, pages: 0, currentPage: 1 };
        }
    },

    /**
     * Get stream URL for Series
     */
    async getSeriesStream(series) {
        try {
            const streamUrl = await StalkerAPI.createSeriesLink(series.cmd || series.id);
            return streamUrl;
        } catch (error) {
            console.error('Failed to get Series stream URL:', error);
            return null;
        }
    },

    /**
     * Get EPG for channel (Short/Current)
     */
    async getEpg(channelId) {
        try {
            const epg = await StalkerAPI.getShortEpg(channelId);
            return epg.map(item => ({
                id: item.id,
                title: item.name,
                description: item.descr || '',
                start: new Date(item.time * 1000),
                end: new Date(item.time_to * 1000),
                duration: item.duration,
            }));
        } catch (error) {
            console.error('Failed to load EPG:', error);
            return [];
        }
    },

    /**
     * Get Full EPG for channel (with period)
     */
    async getFullEpg(channelId, period = 24) {
        try {
            const epg = await StalkerAPI.getEpg(channelId, period);
            return epg.map(item => ({
                id: item.id,
                title: item.name,
                description: item.descr || '',
                start: new Date(item.time * 1000),
                end: new Date(item.time_to * 1000),
                duration: item.duration,
            }));
        } catch (error) {
            console.error('Failed to load Full EPG:', error);
            return [];
        }
    },

    /**
     * Search content
     */
    async search(query, type = 'channels') {
        try {
            switch (type) {
                case 'channels':
                    return await StalkerAPI.searchChannels(query);
                case 'vod':
                    return await this.loadVodItems('*', 1, query);
                case 'series':
                    return await this.loadSeriesList('*', 1, query);
                default:
                    return { items: [], total: 0 };
            }
        } catch (error) {
            console.error('Search failed:', error);
            return { items: [], total: 0 };
        }
    },

    /**
     * Toggle channel favorite
     */
    async toggleFavorite(channel) {
        try {
            await StalkerAPI.setFavorite(channel.id, !channel.favorite);
            channel.favorite = !channel.favorite;
            return true;
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            return false;
        }
    },

    /**
     * Clear cache
     */
    clearCache() {
        this.cache = {
            genres: null,
            channels: {},
            vodCategories: null,
            vodItems: {},
            seriesCategories: null,
            series: {},
        };
    },

    /**
     * Preload all content (Genres, Channels, VOD, Series)
     * Used during setup/startup to ensure data is ready
     */
    async preloadContent() {
        console.log('Preloading content...');
        try {
            // Load all categories first
            await Promise.all([
                this.loadGenres(),
                this.loadVodCategories(),
                this.loadSeriesCategories()
            ]);

            // Then load initial lists for each
            await Promise.all([
                this.loadChannels('*', 1),
                this.loadVodItems('*', 1),
                this.loadSeriesList('*', 1)
            ]);

            console.log('Content preload complete');
            return true;
        } catch (error) {
            console.error('Preload failed:', error);
            return false;
        }
    },

    /**
     * Refresh all data
     */
    async refresh() {
        this.clearCache();
        await this.preloadContent();
    },
};

window.ContentManager = ContentManager;
