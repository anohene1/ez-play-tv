/**
 * EZ Play TV - Screen Manager Module
 */

const ScreenManager = {
    currentScreen: null,
    previousScreen: null,

    /**
     * Show a screen by ID
     */
    show(id) {
        // Leaving full playback or navigating away from the Channels mini-player
        // must tear down the media request and its buffering UI. The one exception
        // is Channels -> Player, where the same live stream moves to full screen.
        const leavingFullPlayer = this.currentScreen === 'player' && id !== 'player';
        const leavingLivePreview = this.currentScreen === 'channels'
            && id !== 'channels'
            && id !== 'player'
            && typeof Player !== 'undefined'
            && !!Player.currentUrl;

        if (leavingFullPlayer || leavingLivePreview) {
            if (typeof Player !== 'undefined') {
                Player.stop();
                Player.currentChannel = null;
                Player.currentVod = null;
            }

            if (typeof UI !== 'undefined') {
                UI.showLoading(false);
                if (UI.vodProgressInterval) {
                    clearInterval(UI.vodProgressInterval);
                    UI.vodProgressInterval = null;
                }
            }

            if (typeof Actions !== 'undefined') {
                Actions.currentMiniPlayerChannelId = null;
            }
        }

        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Track previous screen
        if (this.currentScreen) {
            this.previousScreen = this.currentScreen;
        }

        // Show target screen
        const screen = document.getElementById(id + '-screen');
        if (screen) {
            screen.classList.add('active');
            this.currentScreen = id;

            // Screen-specific actions
            this.onScreenShow(id);

            // Focus first element after transition
            setTimeout(() => {
                this.focusFirstElement(id);
                // Extra explicit focus for home screen Live TV card
                if (id === 'home') {
                    const livetvCard = document.getElementById('livetv-card');
                    if (livetvCard) livetvCard.focus();
                }
            }, 200);
        }
    },

    /**
     * Actions to perform when showing a screen
     */
    onScreenShow(id) {
        switch (id) {
            case 'profile':
                UI.renderAccounts();
                break;
            case 'home':
                UI.updateProfileName();
                break;
            case 'channels':
                // Retry the screen load when either its items or categories are missing.
                if (!UI.channels || UI.channels.length === 0 || !ContentManager.cache.genres) {
                    UI.loadChannelsContent();
                } else {
                    // Update list to reflect selection state
                    UI.renderChannels();
                }
                break;
            case 'movies':
                if (!UI.movies || UI.movies.length === 0 || !ContentManager.cache.vodCategories) {
                    UI.loadMoviesContent();
                }
                break;
            case 'series':
                if (!UI.series || UI.series.length === 0 || !ContentManager.cache.seriesCategories) {
                    UI.loadSeriesContent();
                }
                break;
            case 'favorites':
                // Default to channels view when opening
                UI.renderFavoritesScreen('channels');
                break;
            case 'player':
                // Ensure video element is available
                break;
        }
    },

    /**
     * Focus the appropriate first element for a screen
     */
    focusFirstElement(id) {
        let firstEl = null;

        switch (id) {
            case 'home':
                firstEl = document.getElementById('livetv-card') || document.querySelector('#home-screen .category-card.focusable');
                break;
            case 'channels':
                // Try to focus the currently playing channel if available
                if (Player.currentChannel) {
                    const selected = document.querySelector('.channel-card.selected');
                    if (selected) {
                        firstEl = selected;
                    } else {
                        firstEl = document.querySelector('#channels-screen .country-item.focusable');
                    }
                } else {
                    firstEl = document.querySelector('#channels-screen .country-item.focusable');
                }
                break;
            case 'movies':
                firstEl = document.querySelector('#movies-screen .genre-item.focusable');
                break;
            case 'series':
                firstEl = document.querySelector('#series-screen .genre-item.focusable');
                break;
            case 'favorites':
                firstEl = document.querySelector('#favorites-screen .tab-btn.active') || document.querySelector('#favorites-screen .tab-btn');
                break;
            case 'movie-details':
                firstEl = document.querySelector('#movie-details-screen .btn-play');
                break;
            case 'series-details':
                firstEl = document.querySelector('#series-details-screen .btn-play');
                break;
            case 'setup':
                firstEl = document.querySelector('#setup-screen .input-field.focusable');
                break;
            case 'profile':
                firstEl = document.querySelector('#profile-screen .account-card.focusable, #profile-screen .add-account-card.focusable');
                break;
            default:
                firstEl = document.querySelector('#' + id + '-screen .focusable');
        }

        if (firstEl) {
            firstEl.focus();
        }
    },

    /**
     * Get current screen ID
     */
    getCurrent() {
        return this.currentScreen;
    },

    /**
     * Check initial screen based on accounts
     */
    async checkInitialScreen() {
        if (AccountManager.hasAccounts()) {
            // Show splash or loading first
            UI.showLoading(true, 'Starting up...');

            // Try to connect and preload
            const connected = await ContentManager.init();
            if (connected) {
                await ContentManager.preloadContent();
            }

            UI.showLoading(false);
            this.show('home');
        } else {
            this.show('setup');
        }
    }
};

window.ScreenManager = ScreenManager;
