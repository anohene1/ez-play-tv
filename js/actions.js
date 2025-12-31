/**
 * EZ Play TV - Actions Module
 * User interaction handlers
 */

const Actions = {
    /**
     * Save new account from setup form
     */
    async saveAccount() {
        const url = document.getElementById('portal-url').value.trim();
        const mac = document.getElementById('mac-address').value.trim();
        const name = document.getElementById('account-name').value.trim() || 'My IPTV';

        if (!url || !mac) {
            UI.showError('Please enter Portal URL and MAC Address');
            return;
        }

        UI.showLoading(true, 'Connecting to portal...');

        try {
            // Test connection before saving
            StalkerAPI.init(url, mac);
            const result = await StalkerAPI.connect();

            if (!result.success) {
                throw new Error(result.error || 'Connection failed');
            }

            // Connection successful, save account
            AccountManager.add(url, mac, name);

            // Clear form
            document.getElementById('portal-url').value = '';
            document.getElementById('mac-address').value = '';
            document.getElementById('account-name').value = '';

            // Clear content cache for new account
            ContentManager.clearCache();

            // Preload content
            UI.showLoading(true, 'Loading content...');
            await ContentManager.preloadContent();

            UI.showLoading(false);
            ScreenManager.show('home');

        } catch (error) {
            UI.showLoading(false);
            console.error('Connection error:', error);

            // Save anyway but warn user
            const saveAnyway = confirm('Connection test failed: ' + error.message + '\n\nSave account anyway?');
            if (saveAnyway) {
                AccountManager.add(url, mac, name);
                document.getElementById('portal-url').value = '';
                document.getElementById('mac-address').value = '';
                document.getElementById('account-name').value = '';
                ScreenManager.show('home');
            }
        }
    },

    /**
     * Switch to different account
     */
    async switchAccount(id) {
        AccountManager.setActive(id);
        ContentManager.clearCache();
        UI.renderAccounts();

        UI.showLoading(true, 'Switching account...');
        await ContentManager.init(); // Re-init with new account credentials
        await ContentManager.preloadContent();
        UI.showLoading(false);

        ScreenManager.show('home');
    },

    /**
     * Delete an account
     */
    deleteAccount(id, e) {
        if (e) e.stopPropagation();
        if (!confirm('Delete this account?')) return;

        AccountManager.remove(id);
        ContentManager.clearCache();
        UI.renderAccounts();

        if (!AccountManager.hasAccounts()) {
            ScreenManager.show('setup');
        }
    },

    /**
     * Select a channel genre/category
     */
    async selectChannelGenre(genreId, index) {
        ContentManager.currentGenre = genreId;

        const items = document.querySelectorAll('#country-list .country-item');
        items.forEach((item, i) => item.classList.toggle('selected', i === index));

        UI.showLoading(true, 'Loading channels...');

        try {
            const result = await ContentManager.loadChannels(genreId, 1, true);
            UI.channels = result.channels;
            UI.renderChannels();
        } catch (error) {
            UI.showError('Failed to load channels');
        } finally {
            UI.showLoading(false);
        }

        if (items[index]) items[index].focus();
    },

    /**
     * Select a VOD category
     */
    async selectVodCategory(categoryId, index) {
        ContentManager.currentVodCategory = categoryId;

        const items = document.querySelectorAll('#genre-list .genre-item');
        items.forEach((item, i) => item.classList.toggle('selected', i === index));

        UI.showLoading(true, 'Loading movies...');

        try {
            const result = await ContentManager.loadVodItems(categoryId, 1, '', true);
            UI.movies = result.items;
            UI.renderMovies();
        } catch (error) {
            UI.showError('Failed to load movies');
        } finally {
            UI.showLoading(false);
        }

        if (items[index]) items[index].focus();
    },

    /**
     * Select a country (fallback)
     */
    selectCountry(index) {
        Data.countries.forEach((c, i) => c.selected = i === index);
        UI.renderCountries();
        const items = document.querySelectorAll('#country-list .country-item');
        if (items[index]) items[index].focus();
    },

    /**
     * Select a genre (fallback)
     */
    selectGenre(index) {
        Data.genres.forEach((g, i) => g.selected = i === index);
        UI.renderGenres();
        const items = document.querySelectorAll('#genre-list .genre-item');
        if (items[index]) items[index].focus();
    },

    /**
     * Toggle channel favorite
     */
    async toggleChannelFavorite(index) {
        const channel = UI.channels[index];
        if (!channel) return;

        try {
            await ContentManager.toggleFavorite(channel);
            UI.renderChannels();
            const cards = document.querySelectorAll('#channels-grid .channel-card');
            if (cards[index]) cards[index].focus();
        } catch (error) {
            UI.showError('Failed to update favorite');
        }
    },

    /**
     * Toggle favorite (fallback)
     */
    toggleFavorite(index) {
        Data.channels[index].favorite = !Data.channels[index].favorite;
        UI.renderChannels();
        const cards = document.querySelectorAll('#channels-grid .channel-card');
        if (cards[index]) cards[index].focus();
    },

    /**
     * Play a channel
     */
    /**
     * Play a channel
     */
    currentMiniPlayerChannelId: null,

    async playChannel(index) {
        const channel = UI.channels && UI.channels[index];

        if (!channel) {
            console.log('Playing mock channel:', index);
            ScreenManager.show('player');
            return;
        }

        // Check if already previewing this channel
        if (this.currentMiniPlayerChannelId === channel.id) {
            // ALREADY PREVIEWING: Go to full screen seamless
            console.log('Switching to full screen for:', channel.name);

            // Move video element to player screen full container
            const videoEl = document.getElementById('video-player');
            const playerContainer = document.querySelector('.player-video');

            if (videoEl && playerContainer) {
                videoEl.style.objectFit = 'contain';
                playerContainer.appendChild(videoEl);
            }

            // Switch screen
            ScreenManager.show('player');

            // Reset mini player state
            this.currentMiniPlayerChannelId = null;

            // Ensure UI is updated
            UI.updatePlayerUI(channel);

            // Ensure EPG is loaded for full screen
            UI.loadEpg(channel.id);

            // We do NOT call Player.stop() or Player.play() -> Seamless!

        } else {
            // NOT PREVIEWING: Start Mini Player Preview
            console.log('Starting mini player preview for:', channel.name);

            this.currentMiniPlayerChannelId = channel.id;
            UI.updateMiniPlayerInfo(channel);

            // Stop any current playback (from previous channel)
            Player.stop();

            // Initialize/Find main video element
            let videoEl = document.getElementById('video-player');
            const miniContainer = document.querySelector('.mini-player-video');

            if (videoEl && miniContainer) {
                // Move video element to mini player container
                videoEl.style.display = 'block';
                videoEl.style.objectFit = 'cover';
                miniContainer.appendChild(videoEl);

                // Hide poster and play icon in mini player
                const poster = document.getElementById('mini-player-poster');
                const icon = document.getElementById('mini-player-play-icon');
                if (poster) poster.style.display = 'none';
                if (icon) icon.style.display = 'none';
            }

            // Initialize Player if not already bound
            if (!Player.videoElement) {
                Player.init('video-player');
            }

            try {
                const streamUrl = await ContentManager.getChannelStream(channel);
                if (!streamUrl) throw new Error('Failed to get stream URL');

                console.log('Mini Player Stream:', streamUrl);

                Player.onPlaying = () => {
                    // Can hide loading indicators here
                };
                Player.currentChannel = channel;

                await Player.play(streamUrl);

            } catch (error) {
                console.error('Mini player error:', error);
                UI.showError('Preview failed');
            }
        }
    },

    /**
     * Show movie details
     */
    showMovieDetails(index) {
        if (UI.movies && UI.movies.length > 0 && UI.movies[index]) {
            UI.showMovieDetails(UI.movies[index]);
            return;
        }

        const movie = Data.movies[index];
        if (movie) {
            UI.showMovieDetails({
                name: movie.title,
                poster: movie.poster,
                year: movie.year,
                duration: movie.duration,
                rating: movie.rating,
                description: movie.description,
                genres: movie.genres ? movie.genres.join(', ') : '',
                actors: movie.cast ? movie.cast.join(', ') : '',
            });
        }
    },

    /**
     * Play movie/VOD
     */
    async playMovie() {
        const movie = UI.currentMovie;

        if (!movie || !movie.cmd) {
            ScreenManager.show('player');
            return;
        }

        // Restore video element to player screen if it was in mini player
        const videoEl = document.getElementById('video-player');
        const playerContainer = document.querySelector('.player-video');
        if (videoEl && playerContainer && videoEl.parentElement !== playerContainer) {
            videoEl.style.objectFit = 'contain';
            playerContainer.appendChild(videoEl);
        }

        UI.showLoading(true, 'Getting stream...');

        try {
            const streamUrl = await ContentManager.getVodStream(movie);

            if (!streamUrl) {
                throw new Error('Failed to get stream URL');
            }

            console.log('VOD Stream URL:', streamUrl);

            ScreenManager.show('player');
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!Player.videoElement) {
                Player.init('video-player');
            }

            Player.onPlaying = () => UI.showLoading(false);
            Player.onBuffering = (isBuffering) => {
                UI.showLoading(isBuffering, 'Buffering...');
            };

            Player.currentVod = movie;
            await Player.play(streamUrl);

        } catch (error) {
            UI.showLoading(false);
            console.error('Play VOD error:', error);
            UI.showError('Failed to play: ' + error.message);
        }
    },

    /**
     * Search channels
     */
    async searchChannels(query) {
        if (!query || query.length < 2) return;

        UI.showLoading(true, 'Searching...');

        try {
            const result = await ContentManager.search(query, 'channels');
            UI.channels = result.channels || [];
            UI.renderChannels();
        } catch (error) {
            UI.showError('Search failed');
        } finally {
            UI.showLoading(false);
        }
    },

    /**
     * Search movies
     */
    async searchMovies(query) {
        if (!query || query.length < 2) return;

        UI.showLoading(true, 'Searching...');

        try {
            const result = await ContentManager.search(query, 'vod');
            UI.movies = result.items || [];
            UI.renderMovies();
        } catch (error) {
            UI.showError('Search failed');
        } finally {
            UI.showLoading(false);
        }
    },

    /**
     * Select a Series category
     */
    async selectSeriesCategory(categoryId, index) {
        ContentManager.currentSeriesCategory = categoryId;

        const items = document.querySelectorAll('#series-genre-list .genre-item');
        items.forEach((item, i) => item.classList.toggle('selected', i === index));

        UI.showLoading(true, 'Loading series...');

        try {
            const result = await ContentManager.loadSeriesList(categoryId, 1, '');
            UI.series = result.items;
            UI.renderSeries();
        } catch (error) {
            UI.showError('Failed to load series');
        } finally {
            UI.showLoading(false);
        }

        if (items[index]) items[index].focus();
    },

    /**
     * Show series details
     */
    showSeriesDetails(index) {
        if (UI.series && UI.series.length > 0 && UI.series[index]) {
            UI.showSeriesDetails(UI.series[index]);
            return;
        }
    },

    /**
     * Play series
     */
    async playSeries() {
        const series = UI.currentSeries;

        if (!series || !series.cmd) {
            ScreenManager.show('player');
            return;
        }

        // Restore video element to player screen if it was in mini player
        const videoEl = document.getElementById('video-player');
        const playerContainer = document.querySelector('.player-video');
        if (videoEl && playerContainer && videoEl.parentElement !== playerContainer) {
            videoEl.style.objectFit = 'contain';
            playerContainer.appendChild(videoEl);
        }

        UI.showLoading(true, 'Getting stream...');

        try {
            const streamUrl = await ContentManager.getSeriesStream(series);

            if (!streamUrl) {
                throw new Error('Failed to get stream URL');
            }

            console.log('Series Stream URL:', streamUrl);

            ScreenManager.show('player');
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!Player.videoElement) {
                Player.init('video-player');
            }

            Player.onPlaying = () => UI.showLoading(false);
            Player.onBuffering = (isBuffering) => {
                UI.showLoading(isBuffering, 'Buffering...');
            };

            Player.currentVod = series; // Treat series as VOD for player control context
            await Player.play(streamUrl);

        } catch (error) {
            UI.showLoading(false);
            console.error('Play Series error:', error);
            UI.showError('Failed to play: ' + error.message);
        }
    },

    /**
     * Exit player screen
     */
    exitPlayer() {
        // If playing a channel, collapse to mini-player
        if (Player.currentChannel) {
            console.log('Collapsing to mini-player');

            const channel = Player.currentChannel;
            const videoEl = document.getElementById('video-player');
            const miniContainer = document.querySelector('.mini-player-video');

            if (videoEl && miniContainer) {
                // Determine if we should collapse or stop
                // For seamless experience, we collapse back to mini player

                videoEl.style.objectFit = 'cover';
                miniContainer.appendChild(videoEl);

                // Restore state so clicking it again goes back to full screen
                this.currentMiniPlayerChannelId = channel.id;
            }

            ScreenManager.show('channels');
        } else {
            // If VOD or unknown, stop and go back
            // For now default to home or whatever was previous? 
            // Navigation logic usually handles "where to go", but since we intercept here:

            Player.stop();

            if (Player.currentVod) {
                // Ideally return to details or grid
                // For simplified flow, let's guess based on VOD type or just go Movies
                ScreenManager.show('movies');
            } else {
                ScreenManager.show('home');
            }
        }
    },

    /**
     * Search series
     */
    async searchSeries(query) {
        if (!query || query.length < 2) return;

        UI.showLoading(true, 'Searching...');

        try {
            const result = await ContentManager.search(query, 'series');
            UI.series = result.items || [];
            UI.renderSeries();
        } catch (error) {
            UI.showError('Search failed');
        } finally {
            UI.showLoading(false);
        }
    },

    // Player controls
    playerTogglePlayPause() { Player.togglePlayPause(); },
    playerSeekForward() { Player.seekRelative(30); },
    playerSeekBackward() { Player.seekRelative(-10); },
    playerVolumeUp() { Player.setVolume(Player.getVolume() + 0.1); },
    playerVolumeDown() { Player.setVolume(Player.getVolume() - 0.1); },
    playerToggleMute() { Player.toggleMute(); },
    playerStop() { Player.stop(); ScreenManager.show('channels'); },

    /**
     * Channel up/down in player
     */
    async channelUp() {
        if (!UI.channels || UI.channels.length === 0) return;
        var currentChannelId = Player.currentChannel ? Player.currentChannel.id : null;
        var currentIndex = UI.channels.findIndex(function (ch) { return ch.id === currentChannelId; });
        var nextIndex = (currentIndex + 1) % UI.channels.length;
        await this.playChannel(nextIndex);
    },

    async channelDown() {
        if (!UI.channels || UI.channels.length === 0) return;
        var currentChannelId = Player.currentChannel ? Player.currentChannel.id : null;
        var currentIndex = UI.channels.findIndex(function (ch) { return ch.id === currentChannelId; });
        var prevIndex = currentIndex <= 0 ? UI.channels.length - 1 : currentIndex - 1;
        await this.playChannel(prevIndex);
    },
};

window.Actions = Actions;
