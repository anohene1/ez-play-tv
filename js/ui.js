/**
 * EZ Play TV - UI Rendering Module
 */

const UI = {
    // Current state
    currentChannelIndex: 0,
    currentMovieIndex: 0,
    channels: [],
    movies: [],
    genres: [],
    vodCategories: [],
    seriesCategories: [],
    series: [],
    isLoading: false,

    /**
     * Initialize UI
     */
    init() {
        this.startClock();
        this.setupLoadingOverlay();
        this.setupPlayerOverlayAutoHide();
        this.setupSearchInputs();
    },

    /**
     * Setup loading overlay
     */
    setupLoadingOverlay() {
        if (!document.getElementById('loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading...</div>
            `;
            document.body.appendChild(overlay);
        }
    },

    /**
     * Show/hide loading
     */
    showLoading(show = true, text = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            const textEl = overlay.querySelector('.loading-text');
            if (textEl) textEl.textContent = text;
        }
        this.isLoading = show;
    },

    /**
     * Setup search inputs - simple client-side filtering
     */
    setupSearchInputs() {
        // Store original lists for restoring when search is cleared
        this._allChannels = null;
        this._allMovies = null;
        this._allSeries = null;

        // Channels search
        const channelsInput = document.getElementById('channels-search');
        if (channelsInput) {
            channelsInput.addEventListener('input', () => {
                const query = channelsInput.value.trim().toLowerCase();

                // Store original list on first search
                if (!this._allChannels && this.channels.length > 0) {
                    this._allChannels = [...this.channels];
                }

                if (!query) {
                    // Restore full list
                    if (this._allChannels) {
                        this.channels = [...this._allChannels];
                        this.renderChannels();
                    }
                } else if (this._allChannels) {
                    // Filter locally
                    this.channels = this._allChannels.filter(ch =>
                        ch.name.toLowerCase().includes(query)
                    );
                    this.renderChannels();
                }
            });
        }

        // Movies search
        const moviesInput = document.getElementById('movies-search');
        if (moviesInput) {
            moviesInput.addEventListener('input', () => {
                const query = moviesInput.value.trim().toLowerCase();

                if (!this._allMovies && this.movies.length > 0) {
                    this._allMovies = [...this.movies];
                }

                if (!query) {
                    if (this._allMovies) {
                        this.movies = [...this._allMovies];
                        this.renderMovies();
                    }
                } else if (this._allMovies) {
                    this.movies = this._allMovies.filter(m =>
                        m.name.toLowerCase().includes(query)
                    );
                    this.renderMovies();
                }
            });
        }

        // Series search
        const seriesInput = document.getElementById('series-search');
        if (seriesInput) {
            seriesInput.addEventListener('input', () => {
                const query = seriesInput.value.trim().toLowerCase();

                if (!this._allSeries && this.series.length > 0) {
                    this._allSeries = [...this.series];
                }

                if (!query) {
                    if (this._allSeries) {
                        this.series = [...this._allSeries];
                        this.renderSeries();
                    }
                } else if (this._allSeries) {
                    this.series = this._allSeries.filter(s =>
                        s.name.toLowerCase().includes(query)
                    );
                    this.renderSeries();
                }
            });
        }
    },

    /**
     * Load and display channels content
     */
    async loadChannelsContent() {
        this.showLoading(true, 'Loading channels...');

        try {
            // Initialize content manager if needed
            if (!ContentManager.cache.genres) {
                await ContentManager.init();
            }

            // Load genres
            const genres = await ContentManager.loadGenres();
            this.genres = genres;
            this.renderChannelGenres();

            // Load channels for first/selected genre
            const result = await ContentManager.loadChannels('*');
            this.channels = result.channels;
            this.renderChannels();

        } catch (error) {
            console.error('Failed to load channels:', error);
            this.showError('Failed to load channels. Please check your connection.');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Load and display movies content
     */
    async loadMoviesContent() {
        this.showLoading(true, 'Loading movies...');

        try {
            // Initialize content manager if needed
            if (!ContentManager.cache.vodCategories) {
                await ContentManager.init();
            }

            // Load VOD categories
            const categories = await ContentManager.loadVodCategories();
            this.vodCategories = categories;
            this.renderMovieGenres();

            // Load movies for first/selected category
            const result = await ContentManager.loadVodItems('*');
            this.movies = result.items;
            this.renderMovies();

        } catch (error) {
            console.error('Failed to load movies:', error);
            this.showError('Failed to load movies. Please check your connection.');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast-error';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Update profile name in header
     */
    updateProfileName() {
        const el = document.getElementById('home-profile-name');
        if (!el) return;

        const activeAccount = AccountManager.getActive();
        el.textContent = activeAccount ? activeAccount.name : 'No Account';

        this.updateHomeStats();
    },

    /**
     * Update home screen statistics (counts)
     */
    updateHomeStats() {
        // Update stats if data is available
        if (this.channels && this.channels.length > 0) {
            const el = document.getElementById('home-channels-count');
            if (el) el.textContent = `+${this.channels.length} Channels`;
        } else if (ContentManager.cache.channels && ContentManager.cache.channels['*_1']) {
            // Fallback to cache if UI.channels is empty but cache has it
            const total = ContentManager.cache.channels['*_1'].total;
            const el = document.getElementById('home-channels-count');
            if (el) el.textContent = `+${total} Channels`;
        }

        if (this.movies && this.movies.length > 0) {
            const el = document.getElementById('home-movies-count');
            if (el) el.textContent = `+${this.movies.length} Movies`;
        } else if (ContentManager.cache.vodItems && ContentManager.cache.vodItems['*_1_']) {
            const total = ContentManager.cache.vodItems['*_1_'].total;
            const el = document.getElementById('home-movies-count');
            if (el) el.textContent = `+${total} Movies`;
        }

        if (this.series && this.series.length > 0) {
            const el = document.getElementById('home-series-count');
            if (el) el.textContent = `+${this.series.length} Series`;
        } else if (ContentManager.cache.series && ContentManager.cache.series['*_1_']) {
            const total = ContentManager.cache.series['*_1_'].total;
            const el = document.getElementById('home-series-count');
            if (el) el.textContent = `+${total} Series`;
        }
    },

    /**
     * Render accounts list
     */
    renderAccounts() {
        const container = document.getElementById('accounts-list');
        if (!container) return;

        const accounts = AccountManager.getAll();
        const activeId = AccountManager.activeAccountId;

        let html = accounts.map(a => `
            <div class="account-card ${a.id === activeId ? 'active' : ''}" data-account-id="${a.id}">
                <div class="account-header">
                    <div class="account-avatar">${a.name.charAt(0).toUpperCase()}</div>
                    <div class="account-info">
                        <div class="account-name">${a.name}</div>
                        <div class="account-url">${a.url}</div>
                    </div>
                </div>
                <div class="account-actions">
                    <button class="account-btn account-select-btn focusable" tabindex="0" onclick="Actions.switchAccount('${a.id}')" title="Select">
                        <svg viewBox="0 0 24 24"><path d="${a.id === activeId
                ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
                : 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z'}"/></svg>
                        ${a.id === activeId ? 'Active' : 'Select'}
                    </button>
                    <button class="account-btn account-delete-btn focusable" tabindex="0" onclick="Actions.deleteAccount('${a.id}')" title="Delete">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        html += `
            <div class="add-account-card focusable" tabindex="0" onclick="ScreenManager.show('setup')">
                <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                <span>Add New Account</span>
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * Render channel genres (countries/categories)
     */
    renderChannelGenres() {
        const container = document.getElementById('country-list');
        if (!container) return;

        if (this.genres.length === 0) {
            container.innerHTML = '<div class="empty-list">No categories found</div>';
            return;
        }

        const selectedGenre = ContentManager.currentGenre || '*';

        container.innerHTML = this.genres.map((g, i) => `
            <div class="country-item focusable ${g.id === selectedGenre ? 'selected' : ''}" 
                 tabindex="0" 
                 onclick="Actions.selectChannelGenre('${g.id}', ${i})">
                <div class="country-flag">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                        <path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12zM9 10v8l7-4z"/>
                    </svg>
                </div>
                <div class="country-info">
                    <div class="country-name">${g.title || g.name}</div>
                    <div class="country-channels">${g.censored || ''}</div>
                </div>
            </div>
        `).join('');
    },

    /**
     * Render channels list
     */
    renderChannels() {
        const container = document.getElementById('channels-grid');
        if (!container) return;

        if (this.channels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No channels available</p>
                </div>
            `;
            return;
        }

        const currentChannelIds = Player.currentChannel ? Player.currentChannel.id : null;

        container.innerHTML = this.channels.map((ch, i) => {
            const isSelected = currentChannelIds === ch.id;
            // Get current program from EPG if available
            const currentProgram = ch.currentProgram || ch.epg_progname || '';
            // Check if channel is HD (based on name or a flag)
            const isHD = ch.hd || ch.name.toLowerCase().includes('hd');

            return `
            <div class="channel-card focusable ${isSelected ? 'selected' : ''}" tabindex="0" onclick="Actions.playChannel(${i})">
                <div class="channel-logo">
                    ${ch.logo
                    ? `<img src="${ch.logo}" alt="${ch.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="channel-logo-text" style="display:none">${ch.name.substring(0, 3).toUpperCase()}</span>`
                    : `<span class="channel-logo-text">${ch.name.substring(0, 3).toUpperCase()}</span>`
                }
                </div>
                <div class="channel-info">
                    <div class="channel-name">${ch.name}</div>
                    ${currentProgram ? `<div class="channel-program">${currentProgram}</div>` : `<div class="channel-views">#${ch.number}</div>`}
                    ${isHD ? '<div class="channel-badges"><span class="badge">HD</span></div>' : ''}
                </div>
            </div>
        `}).join('');
    },

    /**
     * Render movie genres/categories
     */
    renderMovieGenres() {
        const container = document.getElementById('genre-list');
        if (!container) return;

        if (this.vodCategories.length === 0) {
            container.innerHTML = '<div class="empty-list">No categories found</div>';
            return;
        }

        const selectedCategory = ContentManager.currentVodCategory || '*';

        container.innerHTML = this.vodCategories.map((g, i) => `
            <div class="genre-item focusable ${g.id === selectedCategory ? 'selected' : ''}" 
                 tabindex="0" 
                 onclick="Actions.selectVodCategory('${g.id}', ${i})">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                </svg>
                <span>${g.title || g.name}</span>
            </div>
        `).join('');
    },

    /**
     * Render movies grid
     */
    renderMovies() {
        const container = document.getElementById('movies-grid');
        if (!container) return;

        if (this.movies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No movies available</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.movies.map((m, i) => `
            <div class="movie-card focusable" tabindex="0" onclick="Actions.showMovieDetails(${i})">
                <div class="movie-poster">
                    ${m.poster
                ? `<img src="${m.poster}" alt="${m.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22170%22 height=%22255%22><rect fill=%22%232a2f45%22 width=%22170%22 height=%22255%22/><text x=%2285%22 y=%22127%22 fill=%22%23666%22 text-anchor=%22middle%22 font-size=%2214%22>No Image</text></svg>'">`
                : `<div class="movie-poster-placeholder">${m.name.charAt(0)}</div>`
            }
                    ${m.rating ? `
                        <span class="movie-rating">
                            <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                            ${m.rating}
                        </span>
                    ` : ''}
                    <span class="movie-quality">HD</span>
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${m.name}</h3>
                    <div class="movie-meta">
                        ${m.year ? `<span>${m.year}</span>` : ''}
                        ${m.duration ? `<span>${m.duration}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    },

    /**
     * Load and display series content
     */
    async loadSeriesContent() {
        this.showLoading(true, 'Loading series...');

        try {
            // Initialize content manager if needed
            if (!ContentManager.cache.seriesCategories) {
                await ContentManager.init();
            }

            // Load series categories
            const categories = await ContentManager.loadSeriesCategories();
            this.seriesCategories = categories;
            this.renderSeriesGenres();

            // Load series for first/selected category
            const result = await ContentManager.loadSeriesList('*');
            this.series = result.items;
            this.renderSeries();

        } catch (error) {
            console.error('Failed to load series:', error);
            this.showError('Failed to load series. Please check your connection.');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Render series genres/categories
     */
    renderSeriesGenres() {
        const container = document.getElementById('series-genre-list');
        if (!container) return;

        if (!this.seriesCategories || this.seriesCategories.length === 0) {
            container.innerHTML = '<div class="empty-list">No categories found</div>';
            return;
        }

        const selectedCategory = ContentManager.currentSeriesCategory || '*';

        container.innerHTML = this.seriesCategories.map((g, i) => `
            <div class="genre-item focusable ${g.id === selectedCategory ? 'selected' : ''}" 
                 tabindex="0" 
                 onclick="Actions.selectSeriesCategory('${g.id}', ${i})">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                </svg>
                <span>${g.title || g.name}</span>
            </div>
        `).join('');
    },

    /**
     * Render series grid
     */
    renderSeries() {
        const container = document.getElementById('series-grid');
        if (!container) return;

        if (!this.series || this.series.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No series available</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.series.map((s, i) => `
            <div class="movie-card focusable" tabindex="0" onclick="Actions.showSeriesDetails(${i})">
                <div class="movie-poster">
                    ${s.poster
                ? `<img src="${s.poster}" alt="${s.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22170%22 height=%22255%22><rect fill=%22%232a2f45%22 width=%22170%22 height=%22255%22/><text x=%2285%22 y=%22127%22 fill=%22%23666%22 text-anchor=%22middle%22 font-size=%2214%22>No Image</text></svg>'">`
                : `<div class="movie-poster-placeholder">${s.name.charAt(0)}</div>`
            }
                    ${s.rating ? `
                        <span class="movie-rating">
                            <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                            ${s.rating}
                        </span>
                    ` : ''}
                    <span class="movie-quality">HD</span>
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${s.name}</h3>
                    <div class="movie-meta">
                        ${s.year ? `<span>${s.year}</span>` : ''}
                        ${s.seasons ? `<span>${s.seasons.length} Seasons</span>` : ''}
                    </div>
                </div>
            </div >
    `).join('');
    },

    /**
     * Show series details
     */
    showSeriesDetails(series) {
        const backdropEl = document.getElementById('series-detail-backdrop');
        const posterEl = document.getElementById('series-detail-poster');

        if (backdropEl) backdropEl.src = series.poster || '';
        if (posterEl) posterEl.src = series.poster || '';

        document.getElementById('series-detail-title').textContent = series.name;
        document.getElementById('series-detail-tagline').textContent = series.genres || '';
        document.getElementById('series-detail-year').textContent = series.year || '';

        // Count seasons if available, or just generic
        const seasonsCount = series.seasons ? series.seasons.length : (series.season_count || 1);
        document.getElementById('series-detail-seasons').textContent = `${seasonsCount} Season${seasonsCount !== 1 ? 's' : ''} `;

        const ratingEl = document.getElementById('series-detail-rating');
        if (ratingEl) {
            ratingEl.innerHTML = series.rating ? `
    < svg viewBox = "0 0 24 24" > <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg >
        ${series.rating}
` : '';
        }

        document.getElementById('series-detail-description').textContent = series.description || 'No description available.';
        document.getElementById('series-detail-cast').textContent = series.actors || 'Unknown';

        const genresEl = document.getElementById('series-detail-genres');
        if (genresEl && series.genres) {
            genresEl.innerHTML = series.genres.split(',').map(g =>
                `< span class="genre-tag" > ${g.trim()}</span > `
            ).join('');
        }

        // Store current series for playback
        this.currentSeries = series;

        ScreenManager.show('series-details');
    },

    /**
     * Show movie details
     */
    showMovieDetails(movie) {
        const backdropEl = document.getElementById('detail-backdrop');
        const posterEl = document.getElementById('detail-poster');

        if (backdropEl) backdropEl.src = movie.poster || '';
        if (posterEl) posterEl.src = movie.poster || '';

        document.getElementById('detail-title').textContent = movie.name;
        document.getElementById('detail-tagline').textContent = movie.genres || '';
        document.getElementById('detail-year').textContent = movie.year || '';
        document.getElementById('detail-duration').textContent = movie.duration || '';

        const ratingEl = document.getElementById('detail-rating');
        if (ratingEl) {
            ratingEl.innerHTML = movie.rating ? `
    < svg viewBox = "0 0 24 24" > <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg >
        ${movie.rating}
` : '';
        }

        document.getElementById('detail-description').textContent = movie.description || 'No description available.';
        document.getElementById('detail-cast').textContent = movie.actors || 'Unknown';

        const genresEl = document.getElementById('detail-genres');
        if (genresEl && movie.genres) {
            genresEl.innerHTML = movie.genres.split(',').map(g =>
                `< span class="genre-tag" > ${g.trim()}</span > `
            ).join('');
        }

        // Store current movie for playback
        this.currentMovie = movie;

        ScreenManager.show('movie-details');
    },

    /**
     * Fallback: Render countries list (when no API data)
     */
    renderCountries() {
        const container = document.getElementById('country-list');
        if (!container) return;

        container.innerHTML = Data.countries.map((c, i) => `
    < div class="country-item focusable ${c.selected ? 'selected' : ''}" tabindex = "0" onclick = "Actions.selectCountry(${i})" >
                <div class="country-flag">${c.flag}</div>
                <div class="country-info">
                    <div class="country-name">${c.name}</div>
                    <div class="country-channels">${c.channels} Channels</div>
                </div>
            </div >
    `).join('');
    },

    /**
     * Fallback: Render genres list (when no API data)
     */
    renderGenres() {
        const container = document.getElementById('genre-list');
        if (!container) return;

        const icons = {
            grid: '<path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z"/>',
            action: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
            comedy: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>',
            drama: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>',
            scifi: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z"/>',
            horror: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
            romance: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
            thriller: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'
        };

        container.innerHTML = Data.genres.map((g, i) => `
    < div class="genre-item focusable ${g.selected ? 'selected' : ''}" tabindex = "0" onclick = "Actions.selectGenre(${i})" >
                <svg viewBox="0 0 24 24">${icons[g.icon] || icons.grid}</svg>
                <span>${g.name}</span>
            </div >
    `).join('');
    },

    /**
     * Update player UI
     */
    updatePlayerUI(channel) {
        const nameEl = document.querySelector('.channel-name-large');
        const numberEl = document.querySelector('.channel-number');
        const logoEl = document.querySelector('.channel-logo-large');

        if (nameEl) nameEl.textContent = channel.name;
        if (numberEl) numberEl.textContent = String(channel.number).padStart(3, '0');

        if (logoEl && channel.logo) {
            logoEl.innerHTML = `<img src="${channel.logo}" alt="${channel.name}" style="max-width:100%;max-height:100%;" onerror="this.parentElement.innerHTML='${channel.name.substring(0, 3).toUpperCase()}'">`;
        }

        // Show overlay and start timer
        this.showPlayerOverlay();
    },

    /**
     * Update mini player info
     */
    updateMiniPlayerInfo(channel) {
        const titleEl = document.querySelector('.mini-player-title');
        const descEl = document.querySelector('.mini-player-description');
        const labelEl = document.querySelector('.mini-player-label');
        const posterEl = document.getElementById('mini-player-poster');
        const iconEl = document.getElementById('mini-player-play-icon');
        const videoEl = document.getElementById('mini-video-player');

        if (titleEl) titleEl.textContent = channel.name;
        if (labelEl) labelEl.textContent = 'Previewing...';

        // Show loading state or poster
        if (videoEl) videoEl.style.display = 'none';
        if (posterEl) {
            posterEl.style.display = 'block';
            if (channel.logo) posterEl.src = channel.logo;
        }
        if (iconEl) iconEl.style.display = 'block';

        // Fetch current program for description
        ContentManager.getEpg(channel.id).then(epg => {
            if (epg && epg.length > 0) {
                const now = new Date();
                const currentProg = epg.find(p => p.start <= now && p.end > now);
                if (currentProg && descEl) {
                    descEl.textContent = currentProg.title + (currentProg.description ? ' - ' + currentProg.description : '');
                } else if (descEl) {
                    descEl.textContent = 'No program information available';
                }
            } else if (descEl) {
                descEl.textContent = 'No program information available';
            }
        });
    },

    /**
     * Setup player overlay auto-hide
     */
    overlayTimer: null,
    setupPlayerOverlayAutoHide() {
        // Find overlay - it might be rendered later, so we just attach listeners to document
        // Reset timer on user activity
        document.addEventListener('mousemove', () => this.showPlayerOverlay());
        document.addEventListener('keydown', () => this.showPlayerOverlay());
        document.addEventListener('click', () => this.showPlayerOverlay());
    },

    /**
     * Show player overlay and start auto-hide timer
     */
    showPlayerOverlay() {
        // Only run if on player screen
        if (typeof ScreenManager !== 'undefined' && ScreenManager.currentScreen !== 'player') return;

        const overlay = document.querySelector('.player-overlay');
        if (overlay) {
            overlay.style.opacity = '1';
            overlay.style.visibility = 'visible';
            overlay.style.transition = 'opacity 0.3s ease';
        }

        if (this.overlayTimer) clearTimeout(this.overlayTimer);
        this.overlayTimer = setTimeout(() => {
            if (overlay && typeof ScreenManager !== 'undefined' && ScreenManager.currentScreen === 'player') {
                overlay.style.opacity = '0';
                overlay.style.visibility = 'hidden';
                overlay.style.transition = 'opacity 0.5s ease';
            }
        }, 5000); // Hide after 5 seconds
    },

    /**
     * Load and display EPG
     */
    async loadEpg(channelId) {
        try {
            const epg = await ContentManager.getEpg(channelId);
            this.renderEpg(epg);
        } catch (error) {
            console.error('Failed to load EPG:', error);
        }
    },

    /**
     * Render EPG
     */
    renderEpg(epgData) {
        const container = document.querySelector('.epg-panel');
        if (!container) return;

        const itemsContainer = container.querySelector('.epg-items');
        const progressEl = container.querySelector('.epg-progress');

        if (!epgData || epgData.length === 0) {
            if (itemsContainer) itemsContainer.innerHTML = '<div class="epg-item"><span class="epg-title">No Program Information</span></div>';
            if (progressEl) progressEl.style.display = 'none';
            return;
        }

        const now = new Date();

        // Find current and next programs
        const programs = epgData.slice(0, 3).map((prog, i) => {
            const isNow = prog.start <= now && prog.end > now;
            const progress = isNow
                ? ((now - prog.start) / (prog.end - prog.start)) * 100
                : 0;

            return {
                ...prog,
                isNow,
                progress,
            };
        });

        const epgHtml = programs.map(prog => `
            <div class="epg-item ${prog.isNow ? 'now' : ''}">
                <span class="epg-time">${this.formatEpgTime(prog.start)} - ${this.formatEpgTime(prog.end)}</span>
                <span class="epg-title">${prog.title}</span>
            </div>
        `).join('');

        if (itemsContainer) {
            itemsContainer.innerHTML = epgHtml;
        }

        if (progressEl) {
            // Only show progress bar if we have a current program
            const currentProg = programs.find(p => p.isNow);
            if (currentProg) {
                progressEl.style.display = 'block';
                const fillEl = progressEl.querySelector('.progress-fill');
                if (fillEl) {
                    fillEl.style.width = `${currentProg.progress}%`;
                }
            } else {
                progressEl.style.display = 'none';
            }
        }
    },

    /**
     * Format EPG time
     */
    formatEpgTime(date) {
        if (!(date instanceof Date)) return '--:--';
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} `;
    },

    /**
     * Start clock updates
     */
    startClock() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
    },

    /**
     * Update clock display
     */
    updateClock() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes} `;

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const dayName = days[now.getDay()];
        const monthName = months[now.getMonth()];
        const date = now.getDate();

        // Home screen
        const clockTime = document.getElementById('clock-time');
        const clockDate = document.getElementById('clock-date');
        if (clockTime) clockTime.textContent = timeStr;
        if (clockDate) clockDate.textContent = `${dayName}, ${monthName} ${date} `;

        // Channels screen
        const channelsTime = document.getElementById('channels-time');
        if (channelsTime) channelsTime.textContent = timeStr;

        // Movies screen
        const moviesTime = document.getElementById('movies-time');
        if (moviesTime) moviesTime.textContent = timeStr;

        // Player screen
        const playerDay = document.getElementById('player-day');
        const playerDatetime = document.getElementById('player-datetime');
        if (playerDay) playerDay.textContent = dayName;
        if (playerDatetime) {
            const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')} /${date.toString().padStart(2, '0')}/${now.getFullYear()} `;
            playerDatetime.textContent = `${dateStr}  ${hours}:${minutes}:${seconds} `;
        }
    }
};

window.UI = UI;
