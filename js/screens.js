/**
 * EZ Play TV - Screen Manager Module
 */

const ScreenManager = {
    currentScreen: null,

    /**
     * Show a screen by ID
     */
    show(id) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

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
            case 'channels':
                // Load channels content if not already loaded
                if (!UI.channels || UI.channels.length === 0) {
                    UI.loadChannelsContent();
                } else {
                    // Update list to reflect selection state
                    UI.renderChannels();
                }
                break;
            case 'movies':
                // Load movies content if not already loaded
                if (!UI.movies || UI.movies.length === 0) {
                    UI.loadMoviesContent();
                }
                break;
            case 'series':
                // Load series content if not already loaded
                if (!UI.series || UI.series.length === 0) {
                    UI.loadSeriesContent();
                }
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
                    // Find channel card with this ID (simplified check by class/attribute if we had one, but we likely rely on order)
                    // Since we don't have easy ID lookup in DOM, we might cycle or just trust the index if we track it.
                    // IMPORTANT: We need a way to find the channel card. 
                    // Let's defer to UI helper or specific selector if we marked it.
                    // The UI.renderChannels adds 'selected' class to the current one?
                    // Let's assume we can find a selected card.

                    // Actually, Actions.playChannel sets UI.channels[index].
                    // Let's try to find a channel card that matches.
                    // If we are coming back, the grid is likely re-rendered or static.

                    // Best bet: Check for a 'selected' channel card or similar
                    const selected = document.querySelector('.channel-card.selected');
                    if (selected) {
                        firstEl = selected;
                    } else {
                        // Fallback: If we have Player.currentChannel, maybe we can find it by some attribute?
                        // For now, let's stick to the default list or try to keep previous focus if we could value it.
                        // But standard behavior requested is to stay on "selected channel".

                        // Let's update Navigation/UI to mark the playing channel as selected in the grid
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
