/**
 * EZ Play TV - Navigation Module
 * Handles TV remote/keyboard navigation
 */

const Navigation = {
    /**
     * Initialize navigation
     */
    init() {
        document.addEventListener('keydown', (e) => {
            console.log('Key pressed:', e.key, 'Code:', e.code, 'KeyCode:', e.keyCode);
            this.handleKeyDown(e);
        });
    },

    /**
     * Get zone for an element
     */
    getZone(el) {
        if (el.closest('.channels-sidebar') || el.closest('.movies-sidebar')) return 'sidebar';
        if (el.closest('.favorites-sidebar')) return 'favorites-sidebar';
        if (el.closest('.country-list') || el.closest('.genre-list')) return 'sidebar';
        if (el.closest('.favorites-tabs')) return 'favorites-sidebar';
        if (el.closest('.channels-grid')) return 'channels-grid';
        if (el.closest('.movies-grid')) return 'movies-grid';
        if (el.closest('.favorites-grid')) return 'favorites-grid';
        if (el.closest('.channels-header') || el.closest('.movies-header') || el.closest('.favorites-header')) return 'header';
        if (el.closest('.sidebar-header')) return 'sidebar-header';
        if (el.closest('.mini-player')) return 'mini-player';
        if (el.closest('.category-cards')) return 'category-cards';
        if (el.closest('.home-header')) return 'home-header';
        if (el.closest('.setup-form')) return 'setup-form';
        if (el.closest('.setup-container')) return 'setup';
        if (el.closest('.accounts-list')) return 'accounts-list';
        if (el.closest('.profile-header')) return 'profile-header';
        if (el.closest('.profile-content')) return 'profile-content';
        return 'other';
    },

    /**
     * Handle key down events
     */
    handleKeyDown(e) {
        // Map webOS remote keys and standard keys
        // webOS Back button: keyCode 461 or key 'GoBack'
        // webOS Exit: keyCode 1001
        var key = e.key;
        var keyCode = e.keyCode;

        // Normalize back button
        if (keyCode === 461 || keyCode === 10009 || key === 'GoBack' || key === 'XF86Back') {
            key = 'Back';
        }
        // Also handle browser back/escape
        if (key === 'Backspace' || key === 'Escape') {
            key = 'Back';
        }

        const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Back', 'Unidentified', 'Yellow', 'Red', 'Green', 'Blue'];
        if (validKeys.indexOf(key) === -1 && keyCode !== 405 && keyCode !== 403 && keyCode !== 404 && keyCode !== 406) return;

        const activeScreen = document.querySelector('.screen.active');
        if (!activeScreen) return;
        const screenId = activeScreen.id;
        let current = document.activeElement;

        // Handle input fields specially
        if (current && current.tagName === 'INPUT') {
            if (key === 'Back') {
                if (current.value === '') {
                    e.preventDefault();
                    current.blur();
                    var parent = current.parentElement;
                    if (parent && parent.classList.contains('focusable')) {
                        parent.focus();
                    }
                }
                return; // Let backspace work in input
            }
            if (['ArrowDown', 'ArrowUp'].includes(key)) {
                e.preventDefault();
                current.blur();
                var parent = current.parentElement;
                if (parent && parent.classList.contains('focusable')) {
                    parent.focus();
                    current = parent;
                }
            } else {
                return; // Let other keys work in input
            }
        } else {
            e.preventDefault();
        }

        // Handle back navigation
        if (key === 'Back') {
            this.handleBack(screenId);
            return;
        }

        // Handle enter/select
        if (key === 'Enter') {
            if (current && current.classList.contains('focusable')) {
                const input = current.querySelector('input');
                if (input) {
                    input.focus();
                    return;
                }
                current.click();
            }
            return;
        }

        // Handle Yellow Button (Favorite) - 405
        if (keyCode === 405 || key === 'Yellow') {
            console.log('Yellow key pressed');

            // Check if we are in player screen
            if (activeScreen && activeScreen.id === 'player-screen') {
                Actions.toggleCurrentChannelFavorite();
                return;
            }

            // Otherwise check for focused channel card (grid view)
            const channelCard = current ? current.closest('.channel-card') : null;

            if (channelCard) {
                const channelId = channelCard.getAttribute('data-channel-id');
                if (channelId) {
                    Actions.toggleChannelFavoriteById(channelId);
                }
            }
            return;
        }

        // Spatial navigation
        this.navigateSpatially(activeScreen, current, key);
    },

    /**
     * Handle back button
     */
    handleBack(screenId) {
        if (screenId === 'channels-screen' || screenId === 'movies-screen' || screenId === 'series-screen' || screenId === 'profile-screen' || screenId === 'favorites-screen') {
            ScreenManager.show('home');
        } else if (screenId === 'movie-details-screen') {
            ScreenManager.show('movies');
        } else if (screenId === 'series-details-screen') {
            ScreenManager.show('series');
        } else if (screenId === 'player-screen') {
            // Stop the player
            Player.stop();

            // Go back to previous screen
            const prevScreen = ScreenManager.previousScreen;
            if (prevScreen && prevScreen !== 'player') {
                ScreenManager.show(prevScreen);
            } else {
                // Fallback to channels if no previous screen
                ScreenManager.show('channels');
            }
        } else if (screenId === 'settings-screen') {
            ScreenManager.show('home');
        }
    },

    /**
     * Spatial navigation logic
     */
    navigateSpatially(activeScreen, current, key) {
        const focusables = Array.from(activeScreen.querySelectorAll('.focusable'));
        if (!focusables.length) return;

        if (!current || !current.classList.contains('focusable') || !activeScreen.contains(current)) {
            focusables[0].focus();
            return;
        }

        const currentZone = this.getZone(current);
        const currentRect = current.getBoundingClientRect();
        const currentCenterX = currentRect.left + currentRect.width / 2;
        const currentCenterY = currentRect.top + currentRect.height / 2;

        const isHorizontalKey = key === 'ArrowLeft' || key === 'ArrowRight';
        const isVerticalKey = key === 'ArrowUp' || key === 'ArrowDown';

        const candidates = [];

        focusables.forEach(el => {
            if (el === current) return;

            const elZone = this.getZone(el);
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = centerX - currentCenterX;
            const dy = centerY - currentCenterY;

            let isCandidate = false;
            let distance = 0;

            // Zone-based navigation rules
            const result = this.checkZoneNavigation(currentZone, elZone, key, dx, dy, currentRect, isHorizontalKey, isVerticalKey);
            if (result.isCandidate) {
                candidates.push({ el, distance: result.distance });
            }
        });

        if (candidates.length > 0) {
            candidates.sort((a, b) => a.distance - b.distance);
            candidates[0].el.focus();
            candidates[0].el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },

    /**
     * Check zone-specific navigation rules
     */
    checkZoneNavigation(currentZone, elZone, key, dx, dy, currentRect, isHorizontalKey, isVerticalKey) {
        let isCandidate = false;
        let distance = 0;

        switch (currentZone) {
            case 'sidebar':
            case 'sidebar-header':
                if (isVerticalKey && (elZone === 'sidebar' || elZone === 'sidebar-header')) {
                    if (key === 'ArrowUp' && dy < -5) isCandidate = true;
                    else if (key === 'ArrowDown' && dy > 5) isCandidate = true;
                    if (isCandidate) distance = Math.abs(dy) + Math.abs(dx) * 0.1;
                } else if (key === 'ArrowRight' && ['channels-grid', 'movies-grid', 'header', 'mini-player', 'favorites-grid'].includes(elZone)) {
                    isCandidate = true;
                    distance = Math.abs(dx) + Math.abs(dy) * 0.5;
                }
                break;

            case 'favorites-sidebar':
                if (isVerticalKey && elZone === 'favorites-sidebar') {
                    if (key === 'ArrowUp' && dy < -5) isCandidate = true;
                    else if (key === 'ArrowDown' && dy > 5) isCandidate = true;
                    if (isCandidate) distance = Math.abs(dy) + Math.abs(dx) * 0.1;
                } else if (key === 'ArrowRight' && (elZone === 'favorites-grid' || elZone === 'header' || elZone === 'channels-grid' || elZone === 'movies-grid')) {
                    // Added channels-grid and movies-grid just in case we reused those classes
                    isCandidate = true;
                    distance = Math.abs(dx) + Math.abs(dy) * 0.5;
                }
                break;

            case 'favorites-grid':
                if (elZone === 'favorites-grid') {
                    if (key === 'ArrowUp' && dy < -5) { isCandidate = true; distance = Math.abs(dy) + Math.abs(dx) * 0.8; }
                    else if (key === 'ArrowDown' && dy > 5) { isCandidate = true; distance = Math.abs(dy) + Math.abs(dx) * 0.8; }
                    else if (key === 'ArrowLeft' && dx < -5) { isCandidate = true; distance = Math.abs(dx) + Math.abs(dy) * 0.8; }
                    else if (key === 'ArrowRight' && dx > 5) { isCandidate = true; distance = Math.abs(dx) + Math.abs(dy) * 0.8; }
                } else if (key === 'ArrowLeft' && (elZone === 'favorites-sidebar')) {
                    isCandidate = true;
                    distance = Math.abs(dy) * 0.5 + Math.abs(dx) * 0.1;
                } else if (key === 'ArrowUp' && elZone === 'header') {
                    isCandidate = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 0.3;
                }
                break;

            case 'channels-grid':
                if (isVerticalKey && elZone === 'channels-grid') {
                    if (key === 'ArrowUp' && dy < -5) isCandidate = true;
                    else if (key === 'ArrowDown' && dy > 5) isCandidate = true;
                    if (isCandidate) distance = Math.abs(dy) + Math.abs(dx) * 0.1;
                } else if (key === 'ArrowUp' && elZone === 'header' && dy < -5) {
                    isCandidate = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 0.3;
                } else if (key === 'ArrowLeft' && (elZone === 'sidebar' || elZone === 'sidebar-header')) {
                    isCandidate = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 0.1;
                } else if (key === 'ArrowRight' && elZone === 'mini-player') {
                    isCandidate = true;
                    distance = Math.abs(dx) + Math.abs(dy) * 0.3;
                }
                break;

            case 'movies-grid':
                const atLeftEdge = currentRect.left < 500;
                const atTopEdge = currentRect.top < 200;

                if (elZone === 'movies-grid') {
                    if (key === 'ArrowUp' && dy < -5) { isCandidate = true; distance = Math.abs(dy) + Math.abs(dx) * 0.8; }
                    else if (key === 'ArrowDown' && dy > 5) { isCandidate = true; distance = Math.abs(dy) + Math.abs(dx) * 0.8; }
                    else if (key === 'ArrowLeft' && dx < -5) { isCandidate = true; distance = Math.abs(dx) + Math.abs(dy) * 0.8; }
                    else if (key === 'ArrowRight' && dx > 5) { isCandidate = true; distance = Math.abs(dx) + Math.abs(dy) * 0.8; }
                } else if (key === 'ArrowLeft' && atLeftEdge && (elZone === 'sidebar' || elZone === 'sidebar-header')) {
                    isCandidate = true;
                    distance = Math.abs(dy) * 0.5 + Math.abs(dx) * 0.1;
                } else if (key === 'ArrowUp' && atTopEdge && elZone === 'header') {
                    isCandidate = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 0.3;
                }
                break;

            case 'header':
                if (isHorizontalKey && elZone === 'header') {
                    if (key === 'ArrowLeft' && dx < -5) isCandidate = true;
                    else if (key === 'ArrowRight' && dx > 5) isCandidate = true;
                    if (isCandidate) distance = Math.abs(dx) + Math.abs(dy) * 0.1;
                } else if (key === 'ArrowDown' && (elZone === 'channels-grid' || elZone === 'movies-grid' || elZone === 'favorites-grid')) {
                    isCandidate = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 0.3;
                } else if (key === 'ArrowLeft' && (elZone === 'sidebar' || elZone === 'sidebar-header' || elZone === 'favorites-sidebar')) {
                    isCandidate = true;
                    distance = Math.abs(dx) + Math.abs(dy) * 0.3;
                }
                break;

            case 'mini-player':
                if (key === 'ArrowLeft' && (elZone === 'channels-grid' || elZone === 'header')) {
                    isCandidate = true;
                    distance = Math.abs(dx) + Math.abs(dy) * 0.3;
                }
                break;

            case 'category-cards':
                if (isHorizontalKey && elZone === 'category-cards') {
                    if (key === 'ArrowLeft' && dx < -5) isCandidate = true;
                    else if (key === 'ArrowRight' && dx > 5) isCandidate = true;
                    if (isCandidate) distance = Math.abs(dx) + Math.abs(dy) * 0.1;
                } else if (key === 'ArrowUp' && elZone === 'home-header') {
                    isCandidate = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 0.3;
                }
                break;

            case 'home-header':
                if (isHorizontalKey && elZone === 'home-header') {
                    if (key === 'ArrowLeft' && dx < -5) isCandidate = true;
                    else if (key === 'ArrowRight' && dx > 5) isCandidate = true;
                    if (isCandidate) distance = Math.abs(dx) + Math.abs(dy) * 0.1;
                } else if (key === 'ArrowDown' && elZone === 'category-cards') {
                    isCandidate = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 0.3;
                }
                break;

            default:
                if (key === 'ArrowUp' && dy < -5) { isCandidate = true; distance = Math.abs(dy) + Math.abs(dx) * 0.5; }
                else if (key === 'ArrowDown' && dy > 5) { isCandidate = true; distance = Math.abs(dy) + Math.abs(dx) * 0.5; }
                else if (key === 'ArrowLeft' && dx < -5) { isCandidate = true; distance = Math.abs(dx) + Math.abs(dy) * 0.5; }
                else if (key === 'ArrowRight' && dx > 5) { isCandidate = true; distance = Math.abs(dx) + Math.abs(dy) * 0.5; }
        }

        return { isCandidate, distance };
    }
};

window.Navigation = Navigation;
