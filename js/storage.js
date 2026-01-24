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
        SIGNS: 'inmogestor_signs',
        EXPENSES: 'inmogestor_expenses'
    },

    // Current user ID for multi-user support
    currentUserId: null,

    // User role info (secretary or owner)
    userRole: null,
    mainUserId: null,

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
            const stringValue = JSON.stringify(value);
            localStorage.setItem(key, stringValue);
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast('⚠️ Memoria llena. No se pueden guardar más datos.', 'error');
                }
            }
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
                    const maxSize = 1200; // Increased quality slightly
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
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => {
                    console.error('Error loading image object');
                    resolve(null); // Resolve null so we don't hang
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                console.error('Error reading file');
                resolve(null);
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

    // Merge legacy data safely matching current user
    async mergeLegacyData(data) {
        let count = 0;

        // Disable sync temporarily to avoid flooding
        this.firebaseEnabled = false;

        try {
            if (data.properties && Array.isArray(data.properties)) {
                data.properties.forEach(p => {
                    // Ensure it doesn't exist or is older
                    const existing = this.getProperties().find(e => e.id === p.id);
                    if (!existing) {
                        this.saveProperty(p);
                        count++;
                    }
                });
            }
            if (data.clients && Array.isArray(data.clients)) {
                data.clients.forEach(c => {
                    const existing = this.getClients().find(e => e.id === c.id);
                    if (!existing) {
                        this.saveClient(c);
                        count++;
                    }
                });
            }
            if (data.signs && Array.isArray(data.signs)) {
                data.signs.forEach(s => {
                    const existing = this.getSigns().find(e => e.id === s.id);
                    if (!existing) {
                        this.saveSign(s);
                        count++;
                    }
                });
            }
        } finally {
            // Re-enable sync and force one push
            this.firebaseEnabled = true;
            this.triggerCloudSync();
        }

        return count;
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

        const success = this.set(this.KEYS.SIGNS, signs);
        if (!success) {
            console.error('Failed to save signs to storage');
            return false;
        }

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

    // Financials (Gastos y Costos)
    getExpenses() {
        return this.get('inmogestor_expenses') || [];
    },

    saveExpense(expense) {
        const expenses = this.getExpenses();
        if (expense.id) {
            const index = expenses.findIndex(e => e.id === expense.id);
            if (index !== -1) {
                expenses[index] = { ...expenses[index], ...expense, updatedAt: new Date().toISOString() };
            }
        } else {
            expense.id = this.generateId();
            expense.createdAt = new Date().toISOString();
            expenses.push(expense);
        }
        this.set('inmogestor_expenses', expenses);
        this.addActivity('expense', expense.id ? 'updated' : 'created', `Gasto: ${expense.category} - $${expense.amount}`);
        this.triggerCloudSync();
        return expense;
    },

    deleteExpense(id) {
        const expenses = this.getExpenses().filter(e => e.id !== id);
        this.set('inmogestor_expenses', expenses);
        this.triggerCloudSync();
    },

    // ===== FIREBASE CLOUD SYNC =====

    firebaseEnabled: false,
    syncInProgress: false,
    isRemoteUpdate: false, // Flag to prevent sync loops
    realtimeUnsubscribe: null, // Store unsubscribe function

    // Set current user ID
    setCurrentUser(userId) {
        this.currentUserId = userId;
        console.log('👤 Usuario establecido:', userId);
    },

    // Get Firestore document path for current user
    getUserDocPath() {
        if (!this.currentUserId) {
            console.warn('No hay usuario autenticado');
            return null;
        }
        return `users/${this.currentUserId}/data/main`;
    },

    async initFirebase() {
        try {
            if (typeof db !== 'undefined') {
                this.firebaseEnabled = true;
                console.log('✓ Firebase conectado');

                // Wait for user authentication before syncing
                if (this.currentUserId) {
                    // Initial sync from cloud
                    await this.syncFromCloud();
                    // Start real-time listener
                    this.startRealtimeListener();
                }
            }
        } catch (e) {
            console.log('Firebase no disponible, usando solo localStorage');
            this.firebaseEnabled = false;
        }
    },

    // Real-time listener for cross-device sync
    startRealtimeListener() {
        if (!this.firebaseEnabled || this.realtimeUnsubscribe || !this.currentUserId) return;

        const docPath = this.getUserDocPath();
        if (!docPath) return;

        console.log('🔄 Iniciando listener en tiempo real...');

        // Parse the path to get collection and document
        const pathParts = docPath.split('/');
        this.realtimeUnsubscribe = db.collection(pathParts[0]).doc(pathParts[1])
            .collection(pathParts[2]).doc(pathParts[3]).onSnapshot((doc) => {
                // Skip if this is a local change we just pushed
                if (this.syncInProgress || this.isRemoteUpdate) return;

                if (doc.exists) {
                    const cloudData = doc.data();
                    const localLastSync = localStorage.getItem('inmogestor_lastSync');

                    // Check if cloud data is newer than our local data
                    if (cloudData.lastSync && cloudData.lastSync !== localLastSync) {
                        console.log('🔄 Cambios detectados desde otro dispositivo');
                        this.applyRemoteChanges(cloudData);
                    }
                }
            }, (error) => {
                console.error('Error en listener tiempo real:', error);
            });
    },

    // Apply changes from remote device
    applyRemoteChanges(data) {
        this.isRemoteUpdate = true;

        try {
            // Update localStorage with cloud data
            if (data.properties) this.set(this.KEYS.PROPERTIES, data.properties);
            if (data.clients) this.set(this.KEYS.CLIENTS, data.clients);
            if (data.followups) this.set(this.KEYS.FOLLOWUPS, data.followups);
            if (data.colleagues) this.set(this.KEYS.COLLEAGUES, data.colleagues);
            if (data.sales) this.set(this.KEYS.SALES, data.sales);
            if (data.signs) this.set(this.KEYS.SIGNS, data.signs);
            if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);

            // Store last sync time to avoid re-applying
            localStorage.setItem('inmogestor_lastSync', data.lastSync);

            // Refresh UI without page reload
            this.refreshUI();

            // Show notification to user
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('🔄 Datos actualizados desde otro dispositivo', 'info');
            }

            console.log('✓ Datos remotos aplicados');
            this.updateSyncStatus('synced');
        } catch (e) {
            console.error('Error aplicando cambios remotos:', e);
        } finally {
            this.isRemoteUpdate = false;
        }
    },

    // Refresh all UI components without page reload
    refreshUI() {
        try {
            // Refresh each module if available
            if (typeof Properties !== 'undefined' && Properties.render) {
                Properties.render();
            }
            if (typeof Clients !== 'undefined' && Clients.render) {
                Clients.render();
            }
            if (typeof Followups !== 'undefined' && Followups.render) {
                Followups.render();
            }
            if (typeof Signs !== 'undefined' && Signs.render) {
                Signs.render();
            }
            // Update dashboard stats
            if (typeof App !== 'undefined' && App.updateDashboard) {
                App.updateDashboard();
            }
            console.log('✓ UI refrescada');
        } catch (e) {
            console.error('Error refrescando UI:', e);
        }
    },

    async syncToCloud() {
        if (!this.firebaseEnabled || this.syncInProgress || this.isRemoteUpdate || !this.currentUserId) return;

        const docPath = this.getUserDocPath();
        if (!docPath) return;

        try {
            this.syncInProgress = true;
            const syncTime = new Date().toISOString();
            const data = {
                properties: this.getProperties(),
                clients: this.getClients(),
                followups: this.getFollowups(),
                colleagues: this.getColleagues(),
                sales: this.getSales(),
                settings: this.getSettings(),
                signs: this.getSigns(),
                lastSync: syncTime
            };

            // Parse the path to get collection and document
            const pathParts = docPath.split('/');
            await db.collection(pathParts[0]).doc(pathParts[1])
                .collection(pathParts[2]).doc(pathParts[3]).set(data);

            // Store sync time locally to avoid re-applying our own changes
            localStorage.setItem('inmogestor_lastSync', syncTime);

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
        if (!this.firebaseEnabled || !this.currentUserId) return;

        const docPath = this.getUserDocPath();
        if (!docPath) return;

        try {
            // Parse the path to get collection and document
            const pathParts = docPath.split('/');
            const doc = await db.collection(pathParts[0]).doc(pathParts[1])
                .collection(pathParts[2]).doc(pathParts[3]).get();

            if (doc.exists) {
                const data = doc.data();
                const localLastSync = localStorage.getItem('inmogestor_lastSync');

                // Sync if:
                // 1. Local is empty (New install / Clear data)
                // 2. Cloud has newer data (Timestamp mismatch) -> This fixes the "missing data" on startup
                // 3. User requested aggressive sync (Implicitly covered by timestamp check usually, but we make it robust)

                const localProps = this.getProperties();
                const shouldSync = (localProps.length === 0 && data.properties?.length > 0) ||
                    (data.lastSync && data.lastSync !== localLastSync);

                if (shouldSync) {
                    this.applyRemoteChanges(data);
                    console.log('☁️ Sincronización automática al iniciar: Datos actualizados');
                } else {
                    console.log('☁️ Sincronización al iniciar: Datos ya estaban actualizados');
                }
            }
        } catch (e) {
            console.error('Error obteniendo datos de la nube:', e);
            this.updateSyncStatus('error');
        }
    },

    async manualSync() {
        if (!this.firebaseEnabled || !this.currentUserId) {
            App.showToast('Error: No hay conexión o usuario', 'error');
            return;
        }

        try {
            App.showToast('🔄 Buscando datos en la nube...', 'info');
            const docPath = this.getUserDocPath();
            const pathParts = docPath.split('/');
            const doc = await db.collection(pathParts[0]).doc(pathParts[1])
                .collection(pathParts[2]).doc(pathParts[3]).get();

            if (doc.exists) {
                const data = doc.data();
                // Force apply changes regardless of timestamps
                this.applyRemoteChanges(data);
                App.showToast('✅ Datos sincronizados correctamente', 'success');
            } else {
                App.showToast('No se encontraron datos en la nube', 'warning');
            }
        } catch (e) {
            console.error('Manual sync error:', e);
            App.showToast('Error al sincronizar: ' + e.message, 'error');
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
        if (this.firebaseEnabled && this.currentUserId) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = setTimeout(() => this.syncToCloud(), 2000);
        }
    },

    // Migrate existing local data to new user account
    async migrateLocalDataToUser(userId) {
        // Get existing local data
        const localData = {
            properties: this.getProperties(),
            clients: this.getClients(),
            followups: this.getFollowups(),
            colleagues: this.getColleagues(),
            sales: this.getSales(),
            signs: this.getSigns(),
            settings: this.getSettings()
        };

        // Check if there's data to migrate
        const hasData = localData.properties.length > 0 ||
            localData.clients.length > 0 ||
            localData.followups.length > 0;

        if (hasData && this.firebaseEnabled) {
            try {
                // Set user ID temporarily for migration
                this.currentUserId = userId;

                // Upload to new user's Firestore path
                const docPath = this.getUserDocPath();
                const pathParts = docPath.split('/');

                await db.collection(pathParts[0]).doc(pathParts[1])
                    .collection(pathParts[2]).doc(pathParts[3]).set({
                        ...localData,
                        lastSync: new Date().toISOString(),
                        migratedAt: new Date().toISOString()
                    });

                console.log('✓ Datos locales migrados al nuevo usuario');
            } catch (e) {
                console.error('Error migrando datos:', e);
            }
        }
    },

    // Initialize user role for sub-user system
    async initUserRole() {
        if (!this.currentUserId || typeof Auth === 'undefined') return;

        try {
            this.userRole = await Auth.getUserRole();
            this.mainUserId = await Auth.getMainUserId();

            console.log('🔐 User role loaded:', this.userRole);
            console.log('🔐 Main user ID:', this.mainUserId);

            // SELF-HEALING: Check if my role matches what the parent user says
            if (this.mainUserId && this.mainUserId !== this.currentUserId) {
                try {
                    const parentDoc = await db.collection('users').doc(this.mainUserId).get();
                    if (parentDoc.exists) {
                        const subUsers = parentDoc.data().subUsers || [];
                        const myEntry = subUsers.find(s => s.subUserId === this.currentUserId);

                        if (myEntry && myEntry.role && myEntry.role !== this.userRole?.role) {
                            console.log(`🔄 Rol desactualizado. Actualizando de ${this.userRole?.role} a ${myEntry.role}`);

                            // Update my local document
                            await db.collection('users').doc(this.currentUserId).update({
                                role: myEntry.role
                            });

                            // Reload role info
                            this.userRole = await Auth.getUserRole();
                            console.log('✅ Rol actualizado:', this.userRole);
                        }
                    }
                } catch (err) {
                    console.error('Error syncing role from parent:', err);
                }
            }

            // If sub-user (secretary or captador), sync from main user's data
            if ((this.userRole?.role === 'secretary' || this.userRole?.role === 'captador') && this.mainUserId) {
                const roleLabel = this.userRole.role === 'captador' ? 'Captador' : 'Secretario';
                console.log(`👥 ${roleLabel} detectado, sincronizando con usuario principal...`);
                this.currentUserId = this.mainUserId; // Use main user's data path
                await this.syncFromCloud();
            }
        } catch (e) {
            console.error('Error initializing user role:', e);
        }
    },

    // Save item as pending (for sub-users)
    async savePending(type, data) {
        if (!this.mainUserId) return false;

        try {
            const dataRef = db.collection('users').doc(this.mainUserId)
                .collection('data').doc('main');
            const dataDoc = await dataRef.get();
            const existingData = dataDoc.exists ? dataDoc.data() : {};
            const pending = existingData.pendingApprovals || [];

            // Add ID and metadata to the data
            data.id = this.generateId();
            data.createdAt = new Date().toISOString();
            data.createdBy = Auth.currentUser?.uid; // Track who created it

            pending.push({
                type: type, // 'property', 'client', 'sign'
                data: data,
                addedBy: Auth.currentUser?.uid,
                addedByName: Auth.currentUser?.displayName || Auth.currentUser?.email,
                addedAt: new Date().toISOString()
            });

            await dataRef.update({ pendingApprovals: pending });

            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('✓ Enviado para aprobación', 'success');
            }

            return true;
        } catch (e) {
            console.error('Error saving pending:', e);
            return false;
        }
    },

    // Check if current user is a sub-user (secretary)
    isSecretary() {
        return this.userRole?.role === 'secretary';
    },

    // Check if current user is a captador
    isCaptador() {
        return this.userRole?.role === 'captador';
    },

    // Check if current user is any type of sub-user
    isSubUser() {
        return this.isSecretary() || this.isCaptador();
    }
};
