# EZ Play TV - webOS Application

A Stalker Portal IPTV client for LG webOS TVs.

## Project Structure

```
iptv-webos-app/
├── appinfo.json          # webOS app manifest
├── index.html            # Main entry point
├── css/
│   ├── main.css          # Base styles, variables, common components
│   ├── screens.css       # Setup, Profile, Home, Channels screen styles
│   └── movies-player.css # Movies and Player screen styles
├── js/
│   ├── app.js            # Main application initialization
│   ├── accounts.js       # Account management (localStorage)
│   ├── actions.js        # User interaction handlers
│   ├── data.js           # Sample/mock data
│   ├── navigation.js     # TV remote/keyboard navigation
│   ├── screens.js        # Screen management
│   └── ui.js             # UI rendering functions
└── images/
    ├── icon-80x80.png    # App icon (80x80)
    └── icon-130x130.png  # Large app icon (130x130)
```

## Features

- **Account Management**: Add multiple Stalker Portal accounts
- **Live TV**: Browse channels by country
- **Movies/VOD**: Browse movies by genre
- **TV Remote Navigation**: Full support for D-pad navigation
- **1080p Resolution**: Optimized for Full HD TVs

## Navigation

- **Arrow Keys**: Navigate between focusable elements
- **Enter/OK**: Select/activate focused element
- **Back/Escape**: Go back to previous screen

### Zone-Based Navigation

The app uses intelligent zone-based navigation:
- Sidebar: Up/Down navigates within sidebar, Right moves to content
- Content Grid: Arrow keys navigate within grid, Left moves to sidebar at edge
- Header: Left/Right within header, Down to content

## Building for webOS

### Prerequisites

1. Install webOS TV SDK: https://webostv.developer.lge.com/sdk/installation/
2. Install ares-cli tools

### Package the app

```bash
ares-package iptv-webos-app
```

### Install on TV (Developer Mode required)

```bash
ares-install --device <device-name> com.ezplaytv.app_1.0.0_all.ipk
```

### Launch the app

```bash
ares-launch --device <device-name> com.ezplaytv.app
```

## Development

### Testing in Browser

Open `index.html` in a browser. Use keyboard arrow keys to simulate TV remote.

### Screen Resolution

The app is designed for 1920x1080 resolution. For testing, set your browser window to this size.

## TODO

- [x] Integrate Stalker Portal API
- [x] Implement actual video playback
- [ ] Add Full EPG (Electronic Program Guide) integration
- [x] Implement search functionality
- [x] Add favorites/watchlist sync
- [ ] Settings screen
- [x] Loading states and error handling

## License

MIT
