// Authentication Module - Firebase Auth
const Auth = {
    currentUser: null,
    authStateListeners: [],

    // ADMIN EMAIL - Super usuario con acceso a todos los datos
    ADMIN_EMAIL: 'edgar_santiago1@hotmail.com',

    // Initialize auth and listen for state changes
    init() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged((user) => {
                this.currentUser = user;
                this.notifyListeners(user);
                resolve(user);
            });
        });
    },

    // Check if current user is admin
    isAdmin() {
        return this.currentUser && this.currentUser.email === this.ADMIN_EMAIL;
    },

    // Register a new user
    async register(email, password, displayName) {
        try {
            const result = await firebase.auth().createUserWithEmailAndPassword(email, password);

            // Update profile with display name
            await result.user.updateProfile({ displayName });

            // Create user document in Firestore
            await db.collection('users').doc(result.user.uid).set({
                email: email,
                displayName: displayName,
                createdAt: new Date().toISOString()
            });

            // Migrate existing local data to this new user
            await Storage.migrateLocalDataToUser(result.user.uid);

            return { success: true, user: result.user };
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    // Login existing user
    async login(email, password) {
        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);

            // Ensure user document exists in Firestore (for users registered before this feature)
            const userDoc = await db.collection('users').doc(result.user.uid).get();
            if (!userDoc.exists) {
                await db.collection('users').doc(result.user.uid).set({
                    email: result.user.email,
                    displayName: result.user.displayName || 'Usuario',
                    createdAt: new Date().toISOString()
                });
            }

            return { success: true, user: result.user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    // Logout
    async logout() {
        try {
            await firebase.auth().signOut();
            // Clear local storage on logout
            localStorage.clear();
            location.reload();
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    // Send password reset email
    async sendPasswordReset(email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    // Change password (requires recent login)
    async changePassword(newPassword) {
        try {
            if (!this.currentUser) {
                return { success: false, error: 'No hay usuario autenticado' };
            }
            await this.currentUser.updatePassword(newPassword);
            return { success: true };
        } catch (error) {
            console.error('Change password error:', error);
            if (error.code === 'auth/requires-recent-login') {
                return { success: false, error: 'Por seguridad, debes volver a iniciar sesión para cambiar la contraseña' };
            }
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    },

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    },

    // Add state change listener
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
    },

    // Notify all listeners
    notifyListeners(user) {
        this.authStateListeners.forEach(cb => cb(user));
    },

    // Get user-friendly error messages
    getErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'Este email ya está registrado',
            'auth/invalid-email': 'Email inválido',
            'auth/operation-not-allowed': 'Operación no permitida',
            'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
            'auth/user-disabled': 'Usuario deshabilitado',
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
            'auth/network-request-failed': 'Error de conexión. Verifica tu internet'
        };
        return messages[code] || 'Error de autenticación';
    },

    // Show login modal
    showLoginModal() {
        document.getElementById('authModal').classList.add('active');
        document.getElementById('authForm').reset();
        this.switchToLogin();
    },

    // Hide login modal
    hideLoginModal() {
        document.getElementById('authModal').classList.remove('active');
    },

    // Switch to login view
    switchToLogin() {
        document.getElementById('authModalTitle').textContent = 'Iniciar Sesión';
        document.getElementById('authNameGroup').style.display = 'none';
        document.getElementById('authForgotPassword').style.display = 'block';
        document.getElementById('authSubmitBtn').textContent = 'Iniciar Sesión';
        document.getElementById('authSwitchText').innerHTML =
            '¿No tienes cuenta? <a href="#" onclick="Auth.switchToRegister(); return false;">Regístrate</a>';
        document.getElementById('authMode').value = 'login';
    },

    // Switch to register view
    switchToRegister() {
        document.getElementById('authModalTitle').textContent = 'Crear Cuenta';
        document.getElementById('authNameGroup').style.display = 'block';
        document.getElementById('authForgotPassword').style.display = 'none';
        document.getElementById('authSubmitBtn').textContent = 'Crear Cuenta';
        document.getElementById('authSwitchText').innerHTML =
            '¿Ya tienes cuenta? <a href="#" onclick="Auth.switchToLogin(); return false;">Inicia Sesión</a>';
        document.getElementById('authMode').value = 'register';
    },

    // Switch to forgot password view
    switchToForgotPassword() {
        document.getElementById('authModalTitle').textContent = 'Recuperar Contraseña';
        document.getElementById('authNameGroup').style.display = 'none';
        document.getElementById('authPasswordGroup').style.display = 'none';
        document.getElementById('authForgotPassword').style.display = 'none';
        document.getElementById('authSubmitBtn').textContent = 'Enviar Email';
        document.getElementById('authSwitchText').innerHTML =
            '<a href="#" onclick="Auth.switchToLogin(); return false;">← Volver al inicio de sesión</a>';
        document.getElementById('authMode').value = 'forgot';
    },

    // Handle form submission
    async handleSubmit(event) {
        event.preventDefault();

        const mode = document.getElementById('authMode').value;
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword')?.value || '';
        const name = document.getElementById('authName')?.value || '';

        const submitBtn = document.getElementById('authSubmitBtn');
        const errorEl = document.getElementById('authError');

        // Disable button and show loading
        submitBtn.disabled = true;
        errorEl.textContent = '';

        if (mode === 'forgot') {
            submitBtn.textContent = 'Enviando...';
            const result = await this.sendPasswordReset(email);
            if (result.success) {
                errorEl.style.color = 'var(--success)';
                errorEl.textContent = '✓ Email enviado. Revisa tu bandeja de entrada.';
                submitBtn.textContent = 'Email Enviado';
            } else {
                errorEl.style.color = 'var(--danger)';
                errorEl.textContent = result.error;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Email';
            }
            return;
        }

        submitBtn.textContent = mode === 'login' ? 'Iniciando...' : 'Creando cuenta...';

        let result;
        if (mode === 'login') {
            result = await this.login(email, password);
        } else {
            result = await this.register(email, password, name);
        }

        if (result.success) {
            this.hideLoginModal();
            location.reload(); // Reload to initialize with user data
        } else {
            errorEl.style.color = 'var(--danger)';
            errorEl.textContent = result.error;
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta';
        }
    },

    // Show change password modal
    showChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.classList.add('active');
            document.getElementById('changePasswordForm')?.reset();
            document.getElementById('changePasswordError').textContent = '';
        }
    },

    // Handle change password
    async handleChangePassword(event) {
        event.preventDefault();

        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorEl = document.getElementById('changePasswordError');
        const submitBtn = event.target.querySelector('button[type="submit"]');

        if (newPassword !== confirmPassword) {
            errorEl.textContent = 'Las contraseñas no coinciden';
            return;
        }

        if (newPassword.length < 6) {
            errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Cambiando...';

        const result = await this.changePassword(newPassword);

        if (result.success) {
            document.getElementById('changePasswordModal').classList.remove('active');
            App.showToast('✓ Contraseña cambiada correctamente', 'success');
        } else {
            errorEl.textContent = result.error;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Cambiar Contraseña';
        }
    },

    // ===== ADMIN FUNCTIONS =====

    // Get list of all users (admin only) - reads from Firestore users collection
    async getAllUsers() {
        if (!this.isAdmin()) {
            console.warn('Solo el administrador puede ver todos los usuarios');
            return [];
        }

        try {
            const usersSnapshot = await db.collection('users').get();
            const users = [];

            usersSnapshot.forEach(doc => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return users;
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    },

    // Get a specific user's data (admin only)
    async getUserData(userId) {
        if (!this.isAdmin()) {
            console.warn('Solo el administrador puede ver datos de otros usuarios');
            return null;
        }

        try {
            const doc = await db.collection('users').doc(userId).collection('data').doc('main').get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    },

    // Show admin panel (if user is admin)
    async showAdminPanel() {
        if (!this.isAdmin()) {
            App.showToast('Acceso denegado', 'error');
            return;
        }

        App.showToast('Cargando datos del sistema...', 'info');

        // Get all users and their data
        const usersData = await this.getAllUsersWithData();

        // Calculate global stats
        const globalStats = this.calculateGlobalStats(usersData);

        const modal = document.getElementById('adminModal');
        if (!modal) return;

        const content = modal.querySelector('.modal-content');
        content.innerHTML = `
            <div class="modal-header">
                <h2>👑 Panel de Administrador</h2>
                <button class="modal-close" onclick="document.getElementById('adminModal').classList.remove('active')">×</button>
            </div>
            <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
                
                <!-- Global Stats -->
                <div class="admin-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="admin-stat-card" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${globalStats.totalUsers}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">👥 Usuarios</div>
                    </div>
                    <div class="admin-stat-card" style="background: linear-gradient(135deg, #10b981, #059669); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${globalStats.totalProperties}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">🏠 Propiedades</div>
                    </div>
                    <div class="admin-stat-card" style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${globalStats.totalClients}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">👔 Clientes</div>
                    </div>
                    <div class="admin-stat-card" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${globalStats.totalSigns}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">📋 Carteles</div>
                    </div>
                </div>

                <!-- User Filter -->
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Filtrar por Usuario:</label>
                    <select id="adminUserFilter" class="form-control" onchange="Auth.filterAdminData(this.value)">
                        <option value="all">📊 Todos los usuarios</option>
                        ${usersData.map(u => `
                            <option value="${u.id}">${u.displayName || u.email || u.id.substring(0, 8)}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Tabs -->
                <div class="admin-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    <button class="btn btn-sm admin-tab active" onclick="Auth.showAdminTab('users')" data-tab="users">👥 Usuarios</button>
                    <button class="btn btn-sm admin-tab" onclick="Auth.showAdminTab('properties')" data-tab="properties">🏠 Propiedades</button>
                    <button class="btn btn-sm admin-tab" onclick="Auth.showAdminTab('clients')" data-tab="clients">👔 Clientes</button>
                    <button class="btn btn-sm admin-tab" onclick="Auth.showAdminTab('signs')" data-tab="signs">📋 Carteles</button>
                </div>

                <!-- Users Tab -->
                <div id="adminTabUsers" class="admin-tab-content">
                    <h3 style="margin-bottom: 1rem;">Usuarios Registrados (${usersData.length})</h3>
                    <div class="admin-users-list">
                        ${usersData.map(u => `
                            <div class="admin-user-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;">
                                <div>
                                    <strong>${u.displayName || 'Sin nombre'}</strong>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${u.email || u.id.substring(0, 12)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                                        🏠 ${u.propertiesCount} props | 👔 ${u.clientsCount} clientes | 📋 ${u.signsCount} carteles
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-primary" onclick="Auth.viewUserData('${u.id}')">
                                    👁️ Ver Datos
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Properties Tab -->
                <div id="adminTabProperties" class="admin-tab-content" style="display: none;">
                    <h3 style="margin-bottom: 1rem;">Todas las Propiedades (${globalStats.totalProperties})</h3>
                    <div id="adminPropertiesList" style="max-height: 400px; overflow-y: auto;">
                        ${this.renderAllProperties(usersData)}
                    </div>
                </div>

                <!-- Clients Tab -->
                <div id="adminTabClients" class="admin-tab-content" style="display: none;">
                    <h3 style="margin-bottom: 1rem;">Todos los Clientes (${globalStats.totalClients})</h3>
                    <div id="adminClientsList" style="max-height: 400px; overflow-y: auto;">
                        ${this.renderAllClients(usersData)}
                    </div>
                </div>

                <!-- Signs Tab -->
                <div id="adminTabSigns" class="admin-tab-content" style="display: none;">
                    <h3 style="margin-bottom: 1rem;">Todos los Carteles (${globalStats.totalSigns})</h3>
                    <div id="adminSignsList" style="max-height: 400px; overflow-y: auto;">
                        ${this.renderAllSigns(usersData)}
                    </div>
                </div>

            </div>
        `;

        // Store data for filtering
        this.adminUsersData = usersData;
        modal.classList.add('active');
    },

    // Get all users with their complete data
    async getAllUsersWithData() {
        const usersSnapshot = await db.collection('users').get();
        const usersData = [];

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();

            // Get user's data subcollection
            const dataDoc = await db.collection('users').doc(userId).collection('data').doc('main').get();
            const data = dataDoc.exists ? dataDoc.data() : {};

            usersData.push({
                id: userId,
                email: userData.email || null,
                displayName: userData.displayName || null,
                properties: data.properties || [],
                clients: data.clients || [],
                signs: data.signs || [],
                followups: data.followups || [],
                propertiesCount: (data.properties || []).length,
                clientsCount: (data.clients || []).length,
                signsCount: (data.signs || []).length
            });
        }

        return usersData;
    },

    // Calculate global statistics
    calculateGlobalStats(usersData) {
        return {
            totalUsers: usersData.length,
            totalProperties: usersData.reduce((sum, u) => sum + u.propertiesCount, 0),
            totalClients: usersData.reduce((sum, u) => sum + u.clientsCount, 0),
            totalSigns: usersData.reduce((sum, u) => sum + u.signsCount, 0)
        };
    },

    // Render all properties from all users
    renderAllProperties(usersData, filterUserId = null) {
        let allProperties = [];

        usersData.forEach(user => {
            if (filterUserId && filterUserId !== 'all' && user.id !== filterUserId) return;

            user.properties.forEach(prop => {
                allProperties.push({
                    ...prop,
                    userName: user.displayName || user.email || user.id.substring(0, 8),
                    userId: user.id
                });
            });
        });

        if (allProperties.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">No hay propiedades</p>';
        }

        return allProperties.map(prop => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem; border-left: 4px solid ${prop.status === 'disponible' ? '#10b981' : prop.status === 'reservada' ? '#f59e0b' : '#3b82f6'};">
                <div>
                    <strong>${prop.title || 'Sin título'}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        📍 ${prop.address || 'Sin dirección'} | 💰 $${(prop.price || 0).toLocaleString()}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--primary); margin-top: 0.25rem;">
                        👤 ${prop.userName}
                    </div>
                </div>
                <span style="padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; background: ${prop.status === 'disponible' ? '#10b981' : prop.status === 'reservada' ? '#f59e0b' : '#3b82f6'}; color: white;">
                    ${prop.status || 'N/A'}
                </span>
            </div>
        `).join('');
    },

    // Render all clients from all users
    renderAllClients(usersData, filterUserId = null) {
        let allClients = [];

        usersData.forEach(user => {
            if (filterUserId && filterUserId !== 'all' && user.id !== filterUserId) return;

            user.clients.forEach(client => {
                allClients.push({
                    ...client,
                    userName: user.displayName || user.email || user.id.substring(0, 8),
                    userId: user.id
                });
            });
        });

        if (allClients.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">No hay clientes</p>';
        }

        return allClients.map(client => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;">
                <div>
                    <strong>${client.name || 'Sin nombre'}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        📞 ${client.phone || 'Sin tel.'} | ✉️ ${client.email || 'Sin email'}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--primary); margin-top: 0.25rem;">
                        👤 ${client.userName}
                    </div>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted);">
                    ${client.type === 'comprador' ? '🏠 Comprador' : client.type === 'vendedor' ? '💰 Vendedor' : client.type === 'inquilino' ? '🔑 Inquilino' : '👤 Cliente'}
                </span>
            </div>
        `).join('');
    },

    // Render all signs from all users
    renderAllSigns(usersData, filterUserId = null) {
        let allSigns = [];

        usersData.forEach(user => {
            if (filterUserId && filterUserId !== 'all' && user.id !== filterUserId) return;

            user.signs.forEach(sign => {
                allSigns.push({
                    ...sign,
                    userName: user.displayName || user.email || user.id.substring(0, 8),
                    userId: user.id
                });
            });
        });

        if (allSigns.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">No hay carteles</p>';
        }

        return allSigns.map(sign => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem; border-left: 4px solid ${sign.type === 'venta' ? '#ef4444' : '#3b82f6'};">
                <div>
                    <strong>📞 ${sign.phone || 'Sin tel.'}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        📍 ${sign.address || 'Sin dirección'} | ${sign.type === 'venta' ? '🔴 Venta' : '🔵 Alquiler'}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--primary); margin-top: 0.25rem;">
                        👤 ${sign.userName}
                    </div>
                </div>
                <span style="padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; background: ${sign.contacted ? '#10b981' : '#f59e0b'}; color: white;">
                    ${sign.contacted ? '✅ Contactado' : '⏳ Pendiente'}
                </span>
            </div>
        `).join('');
    },

    // Show admin tab
    showAdminTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));

        // Show selected tab
        const tabId = 'adminTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
        document.getElementById(tabId).style.display = 'block';
        document.querySelector(`.admin-tab[data-tab="${tabName}"]`).classList.add('active');
    },

    // Filter admin data by user
    filterAdminData(userId) {
        if (!this.adminUsersData) return;

        const filteredData = userId === 'all' ? this.adminUsersData : this.adminUsersData.filter(u => u.id === userId);

        // Update properties list
        document.getElementById('adminPropertiesList').innerHTML = this.renderAllProperties(this.adminUsersData, userId);
        document.getElementById('adminClientsList').innerHTML = this.renderAllClients(this.adminUsersData, userId);
        document.getElementById('adminSignsList').innerHTML = this.renderAllSigns(this.adminUsersData, userId);
    },

    // View specific user's data
    async viewUserData(userId) {
        const data = await this.getUserData(userId);

        if (!data) {
            App.showToast('No se encontraron datos para este usuario', 'warning');
            return;
        }

        // Temporarily switch to view this user's data
        const originalUserId = Storage.currentUserId;
        Storage.currentUserId = userId;

        // Refresh UI with this user's data
        Storage.set(Storage.KEYS.PROPERTIES, data.properties || []);
        Storage.set(Storage.KEYS.CLIENTS, data.clients || []);
        Storage.set(Storage.KEYS.FOLLOWUPS, data.followups || []);
        Storage.set(Storage.KEYS.SIGNS, data.signs || []);

        Storage.refreshUI();

        App.showToast(`👁️ Viendo datos del usuario ${userId.substring(0, 8)}...`, 'info');

        document.getElementById('adminModal').classList.remove('active');

        // Show a banner to return to admin view
        const banner = document.createElement('div');
        banner.id = 'adminViewBanner';
        banner.className = 'update-banner';
        banner.innerHTML = `
            <span>👁️ Modo Administrador - Viendo usuario: ${userId.substring(0, 8)}...</span>
            <button onclick="Auth.exitAdminView('${originalUserId}')" class="btn btn-sm">Volver a mi cuenta</button>
        `;
        document.body.appendChild(banner);
    },

    // Exit admin view mode
    async exitAdminView(originalUserId) {
        document.getElementById('adminViewBanner')?.remove();
        Storage.currentUserId = originalUserId;

        // Reload the original user's data
        await Storage.syncFromCloud();
        Storage.refreshUI();

        App.showToast('✓ Volviste a tu cuenta', 'success');
    }
};

