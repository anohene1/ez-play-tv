/**
 * EZ Play TV - Account Management Module
 */

const AccountManager = {
    STORAGE_KEY: 'iptv_accounts',
    ACTIVE_KEY: 'iptv_active_account',
    
    accounts: [],
    activeAccountId: null,
    
    /**
     * Initialize account manager
     */
    init() {
        this.load();
    },
    
    /**
     * Load accounts from localStorage
     */
    load() {
        try {
            this.accounts = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            this.activeAccountId = localStorage.getItem(this.ACTIVE_KEY) || null;
            
            // Set first account as active if none set
            if (!this.activeAccountId && this.accounts.length > 0) {
                this.activeAccountId = this.accounts[0].id;
                this.saveActiveId();
            }
        } catch (e) {
            console.error('Failed to load accounts:', e);
            this.accounts = [];
            this.activeAccountId = null;
        }
    },
    
    /**
     * Save accounts to localStorage
     */
    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.accounts));
        } catch (e) {
            console.error('Failed to save accounts:', e);
        }
    },
    
    /**
     * Save active account ID
     */
    saveActiveId() {
        try {
            if (this.activeAccountId) {
                localStorage.setItem(this.ACTIVE_KEY, this.activeAccountId);
            } else {
                localStorage.removeItem(this.ACTIVE_KEY);
            }
        } catch (e) {
            console.error('Failed to save active account:', e);
        }
    },
    
    /**
     * Add a new account
     */
    add(url, mac, name = 'My IPTV') {
        const account = {
            id: Date.now().toString(),
            name: name || 'My IPTV',
            url: url,
            mac: mac,
            createdAt: new Date().toISOString()
        };

        this.accounts.push(account);
        this.save();

        // Set as active if first account
        if (this.accounts.length === 1) {
            this.activeAccountId = account.id;
            this.saveActiveId();
        }
        
        return account;
    },
    
    /**
     * Remove an account
     */
    remove(id) {
        this.accounts = this.accounts.filter(a => a.id !== id);
        this.save();
        
        // Update active if deleted
        if (this.activeAccountId === id) {
            this.activeAccountId = this.accounts.length > 0 ? this.accounts[0].id : null;
            this.saveActiveId();
        }
    },
    
    /**
     * Set active account
     */
    setActive(id) {
        if (this.accounts.find(a => a.id === id)) {
            this.activeAccountId = id;
            this.saveActiveId();
            return true;
        }
        return false;
    },
    
    /**
     * Get active account
     */
    getActive() {
        return this.accounts.find(a => a.id === this.activeAccountId) || null;
    },
    
    /**
     * Get all accounts
     */
    getAll() {
        return this.accounts;
    },
    
    /**
     * Check if any accounts exist
     */
    hasAccounts() {
        return this.accounts.length > 0;
    },
    
    /**
     * Get account by ID
     */
    getById(id) {
        return this.accounts.find(a => a.id === id) || null;
    }
};

// Export for use in other modules
window.AccountManager = AccountManager;
