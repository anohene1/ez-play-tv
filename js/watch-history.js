/**
 * EZ Play TV - Watch History Manager
 * Stores recently played content per portal account.
 */

const WatchHistoryManager = {
    STORAGE_KEY: 'ezplaytv_watch_history',
    MAX_ITEMS: 50,

    getAccountId() {
        const account = typeof AccountManager !== 'undefined' && AccountManager.getActive
            ? AccountManager.getActive()
            : null;
        return account && account.id ? String(account.id) : 'default';
    },

    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to load watch history:', error);
            return {};
        }
    },

    save(history) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
            return true;
        } catch (error) {
            console.error('Failed to save watch history:', error);
            return false;
        }
    },

    getAccountHistory(history) {
        const accountId = this.getAccountId();
        if (!history[accountId]) {
            history[accountId] = { channels: [], movies: [], series: [] };
        }
        return history[accountId];
    },

    toStoredItem(item) {
        return {
            id: item.id,
            name: item.name || item.title || 'Untitled',
            cmd: item.cmd || '',
            poster: item.poster || item.screenshot_uri || item.cover || item.logo || '',
            logo: item.logo || '',
            number: item.number,
            description: item.description || item.plot || '',
            year: item.year || item.releaseDate || '',
            duration: item.duration || item.time || '',
            director: item.director || '',
            actors: item.actors || '',
            genres: item.genres || item.genres_str || '',
            rating: item.rating || item.rating_imdb || item.rating_kinopoisk || '',
            season_count: item.season_count || (item.seasons ? item.seasons.length : 0),
            playedAt: Date.now()
        };
    },

    record(type, item) {
        if (!item || item.id === undefined || item.id === null) return false;

        const history = this.getAll();
        const accountHistory = this.getAccountHistory(history);
        if (!accountHistory[type]) accountHistory[type] = [];

        const itemId = String(item.id);
        const list = accountHistory[type].filter(entry => String(entry.id) !== itemId);
        list.unshift(this.toStoredItem(item));
        accountHistory[type] = list.slice(0, this.MAX_ITEMS);
        return this.save(history);
    },

    getByType(type) {
        const history = this.getAll();
        const accountHistory = history[this.getAccountId()];
        return accountHistory && Array.isArray(accountHistory[type])
            ? accountHistory[type]
            : [];
    },

    getChannels() {
        return this.getByType('channels');
    },

    getMovies() {
        return this.getByType('movies');
    },

    getSeries() {
        return this.getByType('series');
    },

    clearCurrentAccount() {
        const history = this.getAll();
        delete history[this.getAccountId()];
        return this.save(history);
    }
};

window.WatchHistoryManager = WatchHistoryManager;
