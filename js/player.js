/**
 * EZ Play TV - Video Player Module
 * Handles video playback with HLS.js and mpegts.js
 */

const Player = {
    videoElement: null,
    hlsPlayer: null,
    mpegtsPlayer: null,
    currentUrl: '',
    currentType: '', // 'hls', 'mpegts', 'native'
    isPlaying: false,
    currentChannel: null,
    currentVod: null,

    // Callbacks
    onError: null,
    onPlaying: null,
    onPaused: null,
    onBuffering: null,
    onTimeUpdate: null,

    /**
     * Initialize the player
     */
    init(videoElementId = 'video-player') {
        this.videoElement = document.getElementById(videoElementId);

        if (!this.videoElement) {
            console.error('Video element not found:', videoElementId);
            return false;
        }

        // Set up video event listeners
        this.videoElement.addEventListener('playing', () => {
            this.isPlaying = true;
            if (this.onPlaying) this.onPlaying();
        });

        this.videoElement.addEventListener('pause', () => {
            this.isPlaying = false;
            if (this.onPaused) this.onPaused();
        });

        this.videoElement.addEventListener('waiting', () => {
            if (this.onBuffering) this.onBuffering(true);
        });

        this.videoElement.addEventListener('canplay', () => {
            if (this.onBuffering) this.onBuffering(false);
        });

        this.videoElement.addEventListener('timeupdate', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate({
                    currentTime: this.videoElement.currentTime,
                    duration: this.videoElement.duration,
                });
            }
        });

        this.videoElement.addEventListener('error', (e) => {
            console.error('Video error:', e);
            if (this.onError) this.onError(e);
        });

        console.log('Player initialized');
        return true;
    },

    /**
     * Get proxied URL for development
     */
    getProxiedUrl(url) {
        // For development/browser testing, route through local proxy to bypass CORS
        // We assume proxy is running on localhost:3000
        const PROXY_BASE = 'http://localhost:3000/?url=';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return PROXY_BASE + encodeURIComponent(url);
        }
        return url;
    },

    /**
     * Detect stream type from URL
     */
    detectStreamType(url) {
        if (!url) return 'native';

        const lowerUrl = url.toLowerCase();

        // Check for extension in URL path or query parameters
        if (lowerUrl.includes('.m3u8') || lowerUrl.includes('extension=m3u8')) {
            console.log('Stream detected as HLS');
            return 'hls';
        }

        if (lowerUrl.includes('.ts') || lowerUrl.includes('extension=ts')) {
            console.log('Stream detected as MPEG-TS');
            return 'mpegts';
        }

        // Fallbacks
        if (lowerUrl.includes('type=m3u8')) return 'hls';
        if (lowerUrl.includes('type=ts')) return 'mpegts';

        console.log('Stream type detection indeterminate, defaulting to native');
        return 'native';
    },

    /**
     * Play a stream URL
     */
    async play(url, forceType = null) {
        console.log('Playing URL:', url);

        // Stop any existing playback
        this.stop();

        // Apply proxy for development
        const playUrl = this.getProxiedUrl(url);
        if (playUrl !== url) {
            console.log('Using proxied URL:', playUrl);
        }

        this.currentUrl = playUrl;
        this.currentType = forceType || this.detectStreamType(url); // Detect type from original URL

        console.log('Stream type:', this.currentType);

        try {
            switch (this.currentType) {
                case 'hls':
                    await this.playHls(playUrl);
                    break;
                case 'mpegts':
                    await this.playMpegts(playUrl);
                    break;
                default:
                    await this.playNative(playUrl);
            }

            return true;
        } catch (error) {
            console.error('Playback error:', error);

            // Try fallback methods
            if (this.currentType === 'hls') {
                console.log('HLS failed, trying native...');
                try {
                    await this.playNative(playUrl);
                    return true;
                } catch (e) {
                    console.error('Native fallback also failed:', e);
                }
            }

            if (this.onError) this.onError(error);
            return false;
        }
    },

    /**
     * Play using HLS.js
     */
    async playHls(url) {
        if (typeof Hls === 'undefined') {
            throw new Error('HLS.js not loaded');
        }

        if (!Hls.isSupported()) {
            // Try native HLS (Safari, iOS)
            if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                return this.playNative(url);
            }
            throw new Error('HLS not supported');
        }

        return new Promise((resolve, reject) => {
            this.hlsPlayer = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 60 * 1000 * 1000,
                maxBufferHole: 0.5,
                startLevel: -1, // Auto quality
            });

            this.hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => {
                console.log('HLS media attached');
                this.hlsPlayer.loadSource(url);
            });

            this.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                console.log('HLS manifest parsed, levels:', data.levels.length);
                this.videoElement.play()
                    .then(resolve)
                    .catch(reject);
            });

            this.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Network error, trying to recover...');
                            this.hlsPlayer.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Media error, trying to recover...');
                            this.hlsPlayer.recoverMediaError();
                            break;
                        default:
                            this.hlsPlayer.destroy();
                            reject(new Error('Fatal HLS error: ' + data.type));
                    }
                }
            });

            this.hlsPlayer.attachMedia(this.videoElement);
        });
    },

    /**
     * Play using mpegts.js
     */
    async playMpegts(url) {
        if (typeof mpegts === 'undefined') {
            throw new Error('mpegts.js not loaded');
        }

        if (!mpegts.isSupported()) {
            throw new Error('mpegts not supported');
        }

        return new Promise((resolve, reject) => {
            this.mpegtsPlayer = mpegts.createPlayer({
                type: 'mpegts',
                url: url,
                isLive: true,
            }, {
                enableWorker: true,
                enableStashBuffer: true,
                stashInitialSize: 128 * 1024,
                autoCleanupSourceBuffer: true,
                autoCleanupMaxBackwardDuration: 30,
                autoCleanupMinBackwardDuration: 15,
            });

            this.mpegtsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
                console.error('mpegts error:', errorType, errorDetail, errorInfo);
                reject(new Error('mpegts error: ' + errorType));
            });

            this.mpegtsPlayer.on(mpegts.Events.LOADING_COMPLETE, () => {
                console.log('mpegts loading complete');
            });

            this.mpegtsPlayer.attachMediaElement(this.videoElement);
            this.mpegtsPlayer.load();

            this.videoElement.play()
                .then(resolve)
                .catch(reject);
        });
    },

    /**
     * Play using native HTML5 video
     */
    async playNative(url) {
        return new Promise((resolve, reject) => {
            this.videoElement.src = url;

            const onCanPlay = () => {
                this.videoElement.removeEventListener('canplay', onCanPlay);
                this.videoElement.removeEventListener('error', onError);
                this.videoElement.play()
                    .then(resolve)
                    .catch(reject);
            };

            const onError = (e) => {
                this.videoElement.removeEventListener('canplay', onCanPlay);
                this.videoElement.removeEventListener('error', onError);
                reject(new Error('Native playback error'));
            };

            this.videoElement.addEventListener('canplay', onCanPlay);
            this.videoElement.addEventListener('error', onError);

            this.videoElement.load();
        });
    },

    /**
     * Stop playback
     */
    stop() {
        // Destroy HLS player
        if (this.hlsPlayer) {
            this.hlsPlayer.destroy();
            this.hlsPlayer = null;
        }

        // Destroy mpegts player
        if (this.mpegtsPlayer) {
            this.mpegtsPlayer.pause();
            this.mpegtsPlayer.unload();
            this.mpegtsPlayer.detachMediaElement();
            this.mpegtsPlayer.destroy();
            this.mpegtsPlayer = null;
        }

        // Clear video source
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.removeAttribute('src');
            this.videoElement.load();
        }

        this.isPlaying = false;
        this.currentUrl = '';
        this.currentType = '';
    },

    /**
     * Pause playback
     */
    pause() {
        if (this.videoElement) {
            this.videoElement.pause();
        }
    },

    /**
     * Resume playback
     */
    resume() {
        if (this.videoElement) {
            this.videoElement.play().catch(e => {
                console.error('Resume failed:', e);
            });
        }
    },

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.resume();
        }
    },

    /**
     * Seek to position (seconds)
     */
    seek(seconds) {
        if (this.videoElement && !isNaN(this.videoElement.duration)) {
            this.videoElement.currentTime = Math.max(0, Math.min(seconds, this.videoElement.duration));
        }
    },

    /**
     * Seek relative (forward/backward)
     */
    seekRelative(delta) {
        if (this.videoElement) {
            this.seek(this.videoElement.currentTime + delta);
        }
    },

    /**
     * Set volume (0-1)
     */
    setVolume(volume) {
        if (this.videoElement) {
            this.videoElement.volume = Math.max(0, Math.min(1, volume));
        }
    },

    /**
     * Get volume
     */
    getVolume() {
        return this.videoElement ? this.videoElement.volume : 1;
    },

    /**
     * Toggle mute
     */
    toggleMute() {
        if (this.videoElement) {
            this.videoElement.muted = !this.videoElement.muted;
        }
    },

    /**
     * Set fullscreen
     */
    requestFullscreen() {
        if (this.videoElement) {
            if (this.videoElement.requestFullscreen) {
                this.videoElement.requestFullscreen();
            } else if (this.videoElement.webkitRequestFullscreen) {
                this.videoElement.webkitRequestFullscreen();
            }
        }
    },

    /**
     * Get current playback info
     */
    getPlaybackInfo() {
        if (!this.videoElement) return null;

        return {
            currentTime: this.videoElement.currentTime,
            duration: this.videoElement.duration,
            buffered: this.videoElement.buffered.length > 0
                ? this.videoElement.buffered.end(this.videoElement.buffered.length - 1)
                : 0,
            volume: this.videoElement.volume,
            muted: this.videoElement.muted,
            isPlaying: this.isPlaying,
            streamType: this.currentType,
        };
    },

    /**
     * Format time for display
     */
    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '--:--';

        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    },
};

window.Player = Player;
