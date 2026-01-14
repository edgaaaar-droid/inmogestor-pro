// Storage Manager - LocalStorage wrapper with image handling
const Storage = {
    KEYS: {
        PROPERTIES: 'inmogestor_properties',
        CLIENTS: 'inmogestor_clients',
        FOLLOWUPS: 'inmogestor_followups',
        ACTIVITIES: 'inmogestor_activities',
        THEME: 'inmogestor_theme',
        COLLEAGUES: 'inmogestor_colleagues',
        SALES: 'inmogestor_sales',
        SETTINGS: 'inmogestor_settings',
        SIGNS: 'inmogestor_signs'
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    // Properties
    getProperties() {
        return this.get(this.KEYS.PROPERTIES) || [];
    },

    saveProperty(property) {
        const properties = this.getProperties();
        if (property.id) {
            const index = properties.findIndex(p => p.id === property.id);
            if (index !== -1) {
                properties[index] = { ...properties[index], ...property, updatedAt: new Date().toISOString() };
            }
        } else {
            property.id = this.generateId();
            property.createdAt = new Date().toISOString();
            properties.push(property);
        }
        this.set(this.KEYS.PROPERTIES, properties);
        this.addActivity('property', property.id ? 'updated' : 'created', property.title);
        this.triggerCloudSync();
        return property;
    },

    deleteProperty(id) {
        const properties = this.getProperties().filter(p => p.id !== id);
        this.set(this.KEYS.PROPERTIES, properties);
        this.addActivity('property', 'deleted', 'Propiedad eliminada');
        this.triggerCloudSync();
    },

    // Clients
    getClients() {
        return this.get(this.KEYS.CLIENTS) || [];
    },

    saveClient(client) {
        const clients = this.getClients();
        if (client.id) {
            const index = clients.findIndex(c => c.id === client.id);
            if (index !== -1) {
                clients[index] = { ...clients[index], ...client, updatedAt: new Date().toISOString() };
            }
        } else {
            client.id = this.generateId();
            client.createdAt = new Date().toISOString();
            clients.push(client);
        }
        this.set(this.KEYS.CLIENTS, clients);
        this.addActivity('client', client.id ? 'updated' : 'created', client.name);
        this.triggerCloudSync();
        return client;
    },

    deleteClient(id) {
        const clients = this.getClients().filter(c => c.id !== id);
        this.set(this.KEYS.CLIENTS, clients);
        this.addActivity('client', 'deleted', 'Cliente eliminado');
        this.triggerCloudSync();
    },

    // Followups
    getFollowups() {
        return this.get(this.KEYS.FOLLOWUPS) || [];
    },

    saveFollowup(followup) {
        const followups = this.getFollowups();
        if (followup.id) {
            const index = followups.findIndex(f => f.id === followup.id);
            if (index !== -1) {
                followups[index] = { ...followups[index], ...followup, updatedAt: new Date().toISOString() };
            }
        } else {
            followup.id = this.generateId();
            followup.createdAt = new Date().toISOString();
            followups.push(followup);
        }
        this.set(this.KEYS.FOLLOWUPS, followups);
        this.addActivity('followup', followup.id ? 'updated' : 'created', followup.title);
        this.triggerCloudSync();
        return followup;
    },

    deleteFollowup(id) {
        const followups = this.getFollowups().filter(f => f.id !== id);
        this.set(this.KEYS.FOLLOWUPS, followups);
        this.addActivity('followup', 'deleted', 'Seguimiento eliminado');
        this.triggerCloudSync();
    },

    // Activities
    getActivities() {
        return this.get(this.KEYS.ACTIVITIES) || [];
    },

    addActivity(type, action, description) {
        const activities = this.getActivities();
        activities.unshift({
            id: this.generateId(),
            type,
            action,
            description,
            timestamp: new Date().toISOString()
        });
        // Keep only last 50 activities
        this.set(this.KEYS.ACTIVITIES, activities.slice(0, 50));
    },

    // Theme
    getTheme() {
        return this.get(this.KEYS.THEME) || 'light';
    },

    setTheme(theme) {
        this.set(this.KEYS.THEME, theme);
    },

    // Utils
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Image handling - compress and store as base64
    async processImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 800;
                    let { width, height } = img;

                    if (width > height && width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    // Export/Import
    exportData() {
        return {
            properties: this.getProperties(),
            clients: this.getClients(),
            followups: this.getFollowups(),
            exportedAt: new Date().toISOString()
        };
    },

    importData(data) {
        if (data.properties) this.set(this.KEYS.PROPERTIES, data.properties);
        if (data.clients) this.set(this.KEYS.CLIENTS, data.clients);
        if (data.followups) this.set(this.KEYS.FOLLOWUPS, data.followups);
    },

    // Colleagues (Base de datos de colegas Century 21)
    getColleagues() {
        return this.get(this.KEYS.COLLEAGUES) || [];
    },

    saveColleague(colleague) {
        const colleagues = this.getColleagues();
        // Check if colleague already exists (by name, case insensitive)
        const existingIndex = colleagues.findIndex(c =>
            c.name.toLowerCase() === colleague.name.toLowerCase()
        );

        if (existingIndex !== -1) {
            // Update existing colleague
            colleagues[existingIndex] = { ...colleagues[existingIndex], ...colleague };
        } else {
            // Add new colleague
            colleague.id = this.generateId();
            colleague.createdAt = new Date().toISOString();
            colleagues.push(colleague);
        }
        this.set(this.KEYS.COLLEAGUES, colleagues);
        return colleague;
    },

    deleteColleague(id) {
        const colleagues = this.getColleagues().filter(c => c.id !== id);
        this.set(this.KEYS.COLLEAGUES, colleagues);
    },

    // Sales (Historial de ventas)
    getSales() {
        return this.get(this.KEYS.SALES) || [];
    },

    saveSale(sale) {
        const sales = this.getSales();
        if (sale.id) {
            const index = sales.findIndex(s => s.id === sale.id);
            if (index !== -1) {
                sales[index] = { ...sales[index], ...sale, updatedAt: new Date().toISOString() };
            }
        } else {
            sale.id = this.generateId();
            sale.createdAt = new Date().toISOString();
            sales.push(sale);
        }
        this.set(this.KEYS.SALES, sales);
        this.addActivity('sale', 'registered', `Venta registrada: ${sale.propertyTitle}`);
        return sale;
    },

    // Settings (Configuración del agente)
    getSettings() {
        return this.get(this.KEYS.SETTINGS) || {
            agentLevel: 'bronce',
            commissionPercentage: 60,
            agentName: 'Edgar Paniagua',
            agentAgency: 'C21 Sky'
        };
    },

    saveSettings(settings) {
        const current = this.getSettings();
        this.set(this.KEYS.SETTINGS, { ...current, ...settings });
    },

    // Signs (Captación de carteles)
    getSigns() {
        return this.get(this.KEYS.SIGNS) || [];
    },

    saveSign(sign) {
        const signs = this.getSigns();
        if (sign.id) {
            const index = signs.findIndex(s => s.id === sign.id);
            if (index !== -1) {
                signs[index] = { ...signs[index], ...sign, updatedAt: new Date().toISOString() };
            }
        } else {
            sign.id = this.generateId();
            sign.createdAt = new Date().toISOString();
            signs.push(sign);
        }
        this.set(this.KEYS.SIGNS, signs);
        this.addActivity('sign', sign.id ? 'updated' : 'created', `Cartel ${sign.type}: ${sign.phone || 'Sin teléfono'}`);
        this.triggerCloudSync();
        return sign;
    },

    deleteSign(id) {
        const signs = this.getSigns().filter(s => s.id !== id);
        this.set(this.KEYS.SIGNS, signs);
        this.addActivity('sign', 'deleted', 'Cartel eliminado');
        this.triggerCloudSync();
    },

    // ===== FIREBASE CLOUD SYNC =====

    firebaseEnabled: false,
    syncInProgress: false,

    async initFirebase() {
        try {
            if (typeof db !== 'undefined') {
                this.firebaseEnabled = true;
                console.log('✓ Firebase conectado');
                this.syncFromCloud();
            }
        } catch (e) {
            console.log('Firebase no disponible, usando solo localStorage');
            this.firebaseEnabled = false;
        }
    },

    async syncToCloud() {
        if (!this.firebaseEnabled || this.syncInProgress) return;

        try {
            this.syncInProgress = true;
            const data = {
                properties: this.getProperties(),
                clients: this.getClients(),
                followups: this.getFollowups(),
                colleagues: this.getColleagues(),
                sales: this.getSales(),
                settings: this.getSettings(),
                signs: this.getSigns(),
                lastSync: new Date().toISOString()
            };

            await db.collection('userData').doc('main').set(data);
            console.log('☁️ Datos sincronizados a la nube');
            this.updateSyncStatus('synced');
        } catch (e) {
            console.error('Error sincronizando a la nube:', e);
            this.updateSyncStatus('error');
        } finally {
            this.syncInProgress = false;
        }
    },

    async syncFromCloud() {
        if (!this.firebaseEnabled) return;

        try {
            const doc = await db.collection('userData').doc('main').get();
            if (doc.exists) {
                const data = doc.data();
                // Only sync if cloud data is newer or local is empty
                const localProps = this.getProperties();
                if (localProps.length === 0 && data.properties?.length > 0) {
                    this.set(this.KEYS.PROPERTIES, data.properties);
                    this.set(this.KEYS.CLIENTS, data.clients || []);
                    this.set(this.KEYS.FOLLOWUPS, data.followups || []);
                    this.set(this.KEYS.COLLEAGUES, data.colleagues || []);
                    this.set(this.KEYS.SALES, data.sales || []);
                    this.set(this.KEYS.SIGNS, data.signs || []);
                    if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);
                    console.log('☁️ Datos restaurados desde la nube');
                    location.reload(); // Refresh to show synced data
                }
            }
            this.updateSyncStatus('synced');
        } catch (e) {
            console.error('Error obteniendo datos de la nube:', e);
            this.updateSyncStatus('error');
        }
    },

    updateSyncStatus(status) {
        const statusEl = document.getElementById('syncStatus');
        if (statusEl) {
            const icons = { synced: '☁️', syncing: '🔄', error: '⚠️', offline: '📴' };
            statusEl.textContent = icons[status] || '☁️';
            statusEl.title = status === 'synced' ? 'Sincronizado con la nube' :
                status === 'error' ? 'Error de sincronización' : 'Sincronizando...';
        }
    },

    // Auto-sync after save operations
    triggerCloudSync() {
        if (this.firebaseEnabled) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = setTimeout(() => this.syncToCloud(), 2000);
        }
    }
};
