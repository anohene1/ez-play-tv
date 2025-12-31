/**
 * EZ Play TV - Main Application
 * Entry point and initialization
 */

const App = {
    /**
     * Initialize the application
     */
    init() {
        console.log('EZ Play TV - Initializing...');

        // Initialize modules
        AccountManager.init();
        Navigation.init();
        UI.init();

        // Check which screen to show
        ScreenManager.checkInitialScreen();

        console.log('EZ Play TV - Ready');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// webOS specific handling
if (typeof webOS !== 'undefined') {
    // Handle webOS back button
    document.addEventListener('webOSRelaunch', (event) => {
        console.log('webOS relaunch event:', event);
    });

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('App hidden');
        } else {
            console.log('App visible');
        }
    });
}

window.App = App;
