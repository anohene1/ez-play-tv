/**
 * EZ Play TV - Favorites Manager
 * Manages favorites and watchlist using localStorage
 */

const FavoritesManager = {
    STORAGE_KEY: 'ezplaytv_favorites',

    /**
     * Get all favorites from storage
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : { channels: [], movies: [], series: [] };
        } catch (e) {
            console.error('Failed to load favorites:', e);
            return { channels: [], movies: [], series: [] };
        }
    },

    /**
     * Save favorites to storage
     */
    save(favorites) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
        } catch (e) {
            console.error('Failed to save favorites:', e);
        }
    },

    /**
     * Check if item is a favorite
     */
    isFavorite(type, id) {
        const favorites = this.getAll();
        const list = favorites[type] || [];
        return list.some(item => item.id === id);
    },

    /**
     * Add item to favorites
     */
    add(type, item) {
        if (this.isFavorite(type, item.id)) return false;

        const favorites = this.getAll();
        if (!favorites[type]) favorites[type] = [];

        // Store comprehensive info for playback and display
        const minimalItem = {
            id: item.id,
            name: item.name,
            poster: item.poster || item.logo || '',
            cmd: item.cmd, // Critical for playback
            // Channel specific
            number: item.number,
            logo: item.logo,
            // VOD/Series specific
            year: item.year,
            rating: item.rating,
            genres: item.genres,
            season_count: item.season_count || (item.seasons ? item.seasons.length : 0),


            addedAt: Date.now()
        };

        favorites[type].push(minimalItem);
        this.save(favorites);
        return true;
    },

    /**
     * Remove item from favorites
     */
    remove(type, id) {
        const favorites = this.getAll();
        if (!favorites[type]) return false;

        const index = favorites[type].findIndex(item => item.id === id);
        if (index === -1) return false;

        favorites[type].splice(index, 1);
        this.save(favorites);
        return true;
    },

    /**
     * Toggle favorite status
     */
    toggle(type, item) {
        if (this.isFavorite(type, item.id)) {
            this.remove(type, item.id);
            return false; // No longer a favorite
        } else {
            this.add(type, item);
            return true; // Now a favorite
        }
    },

    /**
     * Get favorites by type
     */
    getByType(type) {
        const favorites = this.getAll();
        return favorites[type] || [];
    },

    /**
     * Get favorite channels
     */
    getChannels() {
        return this.getByType('channels');
    },

    /**
     * Get favorite movies
     */
    getMovies() {
        return this.getByType('movies');
    },

    /**
     * Get favorite series
     */
    getSeries() {
        return this.getByType('series');
    },

    /**
     * Clear all favorites
     */
    clearAll() {
        this.save({ channels: [], movies: [], series: [] });
    }
};

window.FavoritesManager = FavoritesManager;
