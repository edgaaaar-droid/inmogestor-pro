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
        if (!this.currentUser || !this.currentUser.email) return false;
        return this.currentUser.email.toLowerCase().trim() === this.ADMIN_EMAIL.toLowerCase().trim();
    },

    // Get invitation code from URL (format: ?invite=userId or #invite=userId)
    getInviteCodeFromUrl() {
        // Check URL params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('invite')) {
            return urlParams.get('invite');
        }
        // Check hash params
        const hash = window.location.hash;
        if (hash.includes('invite=')) {
            const match = hash.match(/invite=([^&]+)/);
            return match ? match[1] : null;
        }
        return null;
    },

    // Generate invitation link for current user
    generateInviteLink() {
        if (!this.currentUser) return null;
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?invite=${this.currentUser.uid}`;
    },

    async register(email, password, displayName) {
        try {
            const result = await firebase.auth().createUserWithEmailAndPassword(email, password);

            // Update profile with display name
            await result.user.updateProfile({ displayName });

            // Check if there's an invitation code in the URL
            const inviteCode = this.getInviteCodeFromUrl();

            if (inviteCode) {
                // This is a secretary registration via invite link
                await db.collection('users').doc(result.user.uid).set({
                    email: email,
                    displayName: displayName,
                    createdAt: new Date().toISOString(),
                    parentUserId: inviteCode,
                    role: 'secretary'
                });

                // Update the main user's subUsers list
                const mainUserRef = db.collection('users').doc(inviteCode);
                const mainUserDoc = await mainUserRef.get();
                if (mainUserDoc.exists) {
                    const subUsers = mainUserDoc.data().subUsers || [];
                    subUsers.push({
                        email: email,
                        subUserId: result.user.uid,
                        role: 'secretary',
                        invitedAt: new Date().toISOString(),
                        status: 'active'
                    });
                    await mainUserRef.update({ subUsers });
                }

                // Clear the invite code from URL
                window.history.replaceState({}, document.title, window.location.pathname);

                App.showToast('✓ Te registraste como secretario', 'success');
            } else {
                // Normal registration
                await db.collection('users').doc(result.user.uid).set({
                    email: email,
                    displayName: displayName,
                    createdAt: new Date().toISOString()
                });
            }

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
    },

    // ===== SUB-USERS (SECRETARY) SYSTEM =====

    // Check if current user is a sub-user (secretary)
    async isSubUser() {
        if (!this.currentUser) return false;

        const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
        if (!userDoc.exists) return false;

        return userDoc.data().parentUserId ? true : false;
    },

    // Get the main user ID (returns own ID if not sub-user)
    async getMainUserId() {
        if (!this.currentUser) return null;

        const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
        if (!userDoc.exists) return this.currentUser.uid;

        return userDoc.data().parentUserId || this.currentUser.uid;
    },

    // Get user's role info
    async getUserRole() {
        if (!this.currentUser) return null;

        const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
        if (!userDoc.exists) return { role: 'owner', canEdit: true, canDelete: true };

        const data = userDoc.data();
        if (data.parentUserId) {
            return {
                role: 'secretary',
                parentUserId: data.parentUserId,
                canEdit: false,
                canDelete: false,
                canAdd: true // Adds go to pending
            };
        }

        return { role: 'owner', canEdit: true, canDelete: true, canAdd: true };
    },

    // Invite a sub-user (secretary)
    async inviteSubUser(email) {
        if (!this.currentUser) {
            return { success: false, error: 'No hay usuario autenticado' };
        }

        // Check if trying to invite self
        if (email === this.currentUser.email) {
            return { success: false, error: 'No puedes invitarte a ti mismo' };
        }

        try {
            // Get current user's document
            const userRef = db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();
            const userData = userDoc.data() || {};

            // Get or create subUsers array
            const subUsers = userData.subUsers || [];

            // Check if already invited
            if (subUsers.find(s => s.email === email)) {
                return { success: false, error: 'Este email ya fue invitado' };
            }

            // Add invitation
            subUsers.push({
                email: email,
                role: 'secretary',
                invitedAt: new Date().toISOString(),
                status: 'pending'
            });

            await userRef.update({ subUsers });

            return { success: true, message: `Invitación enviada a ${email}` };
        } catch (error) {
            console.error('Error inviting sub-user:', error);
            return { success: false, error: 'Error al enviar invitación' };
        }
    },

    // Check for pending invitations for current user
    async checkPendingInvitations() {
        if (!this.currentUser) return [];

        try {
            // Search all users to find invitations for this email
            const usersSnapshot = await db.collection('users').get();
            const invitations = [];

            usersSnapshot.forEach(doc => {
                const data = doc.data();
                const subUsers = data.subUsers || [];
                const invitation = subUsers.find(s =>
                    s.email === this.currentUser.email && s.status === 'pending'
                );
                if (invitation) {
                    invitations.push({
                        mainUserId: doc.id,
                        mainUserName: data.displayName || data.email,
                        mainUserEmail: data.email,
                        invitedAt: invitation.invitedAt
                    });
                }
            });

            return invitations;
        } catch (error) {
            console.error('Error checking invitations:', error);
            return [];
        }
    },

    // Accept invitation to become sub-user
    async acceptInvitation(mainUserId) {
        if (!this.currentUser) {
            return { success: false, error: 'No hay usuario autenticado' };
        }

        try {
            // Update main user's subUsers list
            const mainUserRef = db.collection('users').doc(mainUserId);
            const mainUserDoc = await mainUserRef.get();

            if (!mainUserDoc.exists) {
                return { success: false, error: 'Usuario principal no encontrado' };
            }

            const mainUserData = mainUserDoc.data();
            const subUsers = mainUserData.subUsers || [];
            const invitationIndex = subUsers.findIndex(s =>
                s.email === this.currentUser.email && s.status === 'pending'
            );

            if (invitationIndex === -1) {
                return { success: false, error: 'Invitación no encontrada' };
            }

            // Update invitation status
            subUsers[invitationIndex].status = 'active';
            subUsers[invitationIndex].acceptedAt = new Date().toISOString();
            subUsers[invitationIndex].subUserId = this.currentUser.uid;
            await mainUserRef.update({ subUsers });

            // Update current user's document to link to main user
            await db.collection('users').doc(this.currentUser.uid).update({
                parentUserId: mainUserId,
                role: 'secretary'
            });

            return {
                success: true,
                message: `Ahora eres secretario de ${mainUserData.displayName || mainUserData.email}`
            };
        } catch (error) {
            console.error('Error accepting invitation:', error);
            return { success: false, error: 'Error al aceptar invitación' };
        }
    },

    // Reject invitation
    async rejectInvitation(mainUserId) {
        if (!this.currentUser) return { success: false };

        try {
            const mainUserRef = db.collection('users').doc(mainUserId);
            const mainUserDoc = await mainUserRef.get();

            if (!mainUserDoc.exists) return { success: false };

            const subUsers = (mainUserDoc.data().subUsers || []).filter(s =>
                s.email !== this.currentUser.email
            );

            await mainUserRef.update({ subUsers });
            return { success: true };
        } catch (error) {
            return { success: false };
        }
    },

    // Get list of sub-users for current user
    async getSubUsers() {
        if (!this.currentUser) return [];

        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (!userDoc.exists) return [];

            return userDoc.data().subUsers || [];
        } catch (error) {
            return [];
        }
    },

    // Remove a sub-user
    async removeSubUser(email) {
        if (!this.currentUser) return { success: false };

        try {
            const userRef = db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) return { success: false };

            const subUsers = (userDoc.data().subUsers || []).filter(s => s.email !== email);
            await userRef.update({ subUsers });

            // Also remove parentUserId from the sub-user if they exist
            const subUserQuery = await db.collection('users').where('email', '==', email).get();
            subUserQuery.forEach(async (doc) => {
                if (doc.data().parentUserId === this.currentUser.uid) {
                    await doc.ref.update({
                        parentUserId: firebase.firestore.FieldValue.delete(),
                        role: firebase.firestore.FieldValue.delete()
                    });
                }
            });

            return { success: true };
        } catch (error) {
            return { success: false };
        }
    },

    // Get pending approvals count for main user
    async getPendingApprovalsCount() {
        const mainUserId = await this.getMainUserId();
        if (!mainUserId || mainUserId !== this.currentUser?.uid) return 0;

        try {
            const dataDoc = await db.collection('users').doc(mainUserId)
                .collection('data').doc('main').get();
            if (!dataDoc.exists) return 0;

            const data = dataDoc.data();
            return (data.pendingApprovals || []).length;
        } catch (error) {
            return 0;
        }
    },

    // Show sub-users management panel
    async showSubUsersPanel() {
        const subUsers = await this.getSubUsers();
        const pendingCount = await this.getPendingApprovalsCount();
        const inviteLink = this.generateInviteLink();

        const modal = document.getElementById('adminModal');
        if (!modal) return;

        modal.querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h2>👥 Mis Secretarios</h2>
                <button class="modal-close" onclick="document.getElementById('adminModal').classList.remove('active')">×</button>
            </div>
            <div class="modal-body">
                ${pendingCount > 0 ? `
                    <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; cursor: pointer;" onclick="Auth.showPendingApprovals()">
                        <strong>🔔 ${pendingCount} datos pendientes de aprobación</strong>
                        <div style="font-size: 0.85rem; opacity: 0.9;">Clic aquí para revisar y aprobar</div>
                    </div>
                ` : ''}

                <h3 style="margin-bottom: 1rem;">📲 Invitar Nuevo Secretario</h3>
                <p style="color: var(--text-muted); margin-bottom: 0.75rem; font-size: 0.9rem;">
                    Comparte este link con tu secretario por WhatsApp. Al abrirlo, podrá registrarse y quedará vinculado automáticamente.
                </p>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <input type="text" id="inviteLinkInput" class="form-control" value="${inviteLink}" readonly style="font-size: 0.85rem;">
                    <button class="btn btn-primary" onclick="Auth.copyInviteLink()">📋 Copiar</button>
                    <button class="btn btn-success" onclick="Auth.shareInviteLink()" style="background: #25D366;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg> WhatsApp
                    </button>
                </div>

                <h3 style="margin-bottom: 1rem;">Secretarios Actuales (${subUsers.filter(s => s.status === 'active').length})</h3>
                <div class="sub-users-list">
                    ${subUsers.length === 0 ? '<p style="color: var(--text-muted);">No tienes secretarios aún</p>' : ''}
                    ${subUsers.filter(s => s.status === 'active').map(s => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;">
                            <div>
                                <strong>${s.email}</strong>
                                <div style="font-size: 0.8rem; color: var(--success);">
                                    ✅ Activo ${s.acceptedAt ? '• desde ' + new Date(s.acceptedAt).toLocaleDateString() : ''}
                                </div>
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="Auth.handleRemoveSubUser('${s.email}')">
                                ✕ Remover
                            </button>
                        </div>
                    `).join('')}
                </div>
                </div>

                ${true ? `
                <div style="margin-top:2rem; border-top:1px solid var(--border-color); padding-top:1rem;">
                    <h3 style="color:var(--text-muted); font-size:1rem;">Zona de Mantenimiento (Visible Temporalmente)</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">Si perdiste datos antiguos, usa esta herramienta.</p>
                    <button id="recoveryBtn" class="btn btn-outline-danger btn-sm" onclick="Auth.handleLegacyRecovery()">
                        🕵️ Buscar y Recuperar Datos Antiguos
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        modal.classList.add('active');
    },

    // Copy invitation link to clipboard
    copyInviteLink() {
        const input = document.getElementById('inviteLinkInput');
        input.select();
        document.execCommand('copy');
        App.showToast('✓ Link copiado al portapapeles', 'success');
    },

    // Share invitation link via WhatsApp
    shareInviteLink() {
        const link = this.generateInviteLink();
        const message = `Hola! Te invito a ser mi secretario en InmoGestor Pro. Abre este link para registrarte:\n\n${link}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    },

    // Handle invite button click
    async handleInviteSubUser() {
        const email = document.getElementById('inviteEmail').value.trim();
        if (!email) {
            App.showToast('Ingresa un email', 'error');
            return;
        }

        const result = await this.inviteSubUser(email);
        if (result.success) {
            App.showToast(result.message, 'success');
            document.getElementById('inviteEmail').value = '';
            this.showSubUsersPanel(); // Refresh panel
        } else {
            App.showToast(result.error, 'error');
        }
    },

    // Handle remove sub-user
    async handleRemoveSubUser(email) {
        if (!confirm(`¿Remover a ${email} como secretario?`)) return;

        const result = await this.removeSubUser(email);
        if (result.success) {
            App.showToast('Secretario removido', 'success');
            this.showSubUsersPanel();
        }
    },

    // Show pending approvals
    async showPendingApprovals() {
        const mainUserId = await this.getMainUserId();

        try {
            const dataDoc = await db.collection('users').doc(mainUserId)
                .collection('data').doc('main').get();
            const data = dataDoc.data() || {};
            const pending = data.pendingApprovals || [];

            const modal = document.getElementById('adminModal');
            modal.querySelector('.modal-content').innerHTML = `
                <div class="modal-header">
                    <h2>🔔 Pendientes de Aprobación</h2>
                    <button class="modal-close" onclick="document.getElementById('adminModal').classList.remove('active')">×</button>
                </div>
                <div class="modal-body">
                    <button class="btn btn-secondary" onclick="Auth.showSubUsersPanel()" style="margin-bottom: 1rem;">
                        ← Volver a Secretarios
                    </button>
                    
                    ${pending.length === 0 ? '<p style="color: var(--text-muted);">No hay datos pendientes</p>' : ''}
                    ${pending.map((item, idx) => `
                        <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.75rem; border-left: 4px solid #f59e0b;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <span style="background: #f59e0b; color: white; padding: 0.1rem 0.5rem; border-radius: 12px; font-size: 0.7rem;">
                                        ${item.type === 'property' ? '🏠 Propiedad' : item.type === 'client' ? '👔 Cliente' : '📋 Cartel'}
                                    </span>
                                    <h4 style="margin: 0.5rem 0;">${item.data.title || item.data.name || item.data.phone || 'Sin título'}</h4>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                                        Agregado por: ${item.addedByName || 'Secretario'}<br>
                                        ${new Date(item.addedAt).toLocaleString('es-AR')}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-sm btn-primary" onclick="Auth.approvePending(${idx})">✓ Aprobar</button>
                                    <button class="btn btn-sm btn-secondary" onclick="Auth.rejectPending(${idx})">✕ Rechazar</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Error loading pending:', error);
        }
    },

    // Approve pending item
    async approvePending(index) {
        const mainUserId = await this.getMainUserId();

        try {
            const dataRef = db.collection('users').doc(mainUserId).collection('data').doc('main');
            const dataDoc = await dataRef.get();
            const data = dataDoc.data() || {};
            const pending = data.pendingApprovals || [];

            if (index >= pending.length) return;

            const item = pending[index];

            // Add to appropriate list
            const targetKey = item.type === 'property' ? 'properties' :
                item.type === 'client' ? 'clients' : 'signs';
            const targetList = data[targetKey] || [];
            targetList.push(item.data);

            // Remove from pending
            pending.splice(index, 1);

            await dataRef.update({
                [targetKey]: targetList,
                pendingApprovals: pending
            });

            App.showToast('✓ Dato aprobado', 'success');
            this.showPendingApprovals();
            Storage.syncFromCloud();
        } catch (error) {
            console.error('Error approving:', error);
            App.showToast('Error al aprobar', 'error');
        }
    },

    // Reject pending item
    async rejectPending(index) {
        if (!confirm('¿Rechazar este dato?')) return;

        const mainUserId = await this.getMainUserId();

        try {
            const dataRef = db.collection('users').doc(mainUserId).collection('data').doc('main');
            const dataDoc = await dataRef.get();
            const data = dataDoc.data() || {};
            const pending = data.pendingApprovals || [];

            pending.splice(index, 1);

            await dataRef.update({ pendingApprovals: pending });

            App.showToast('Dato rechazado', 'info');
            this.showPendingApprovals();
        } catch (error) {
            console.error('Error rejecting:', error);
        }
    },

    // Show invitation banner for sub-users
    async showInvitationBanner() {
        const invitations = await this.checkPendingInvitations();
        if (invitations.length === 0) return;

        const inv = invitations[0];
        const banner = document.createElement('div');
        banner.id = 'invitationBanner';
        banner.className = 'update-banner';
        banner.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
        banner.innerHTML = `
            <span>📩 ${inv.mainUserName} te invitó a ser su secretario</span>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="Auth.handleAcceptInvitation('${inv.mainUserId}')" class="btn btn-sm" style="background: white; color: #1d4ed8;">Aceptar</button>
                <button onclick="Auth.handleRejectInvitation('${inv.mainUserId}')" class="btn btn-sm">Rechazar</button>
            </div>
        `;
        document.body.appendChild(banner);
    },

    async handleAcceptInvitation(mainUserId) {
        const result = await this.acceptInvitation(mainUserId);
        document.getElementById('invitationBanner')?.remove();

        if (result.success) {
            App.showToast(result.message, 'success');
            location.reload(); // Reload to sync with main user's data
        } else {
            App.showToast(result.error, 'error');
        }
    },

    async handleRejectInvitation(mainUserId) {
        await this.rejectInvitation(mainUserId);
        document.getElementById('invitationBanner')?.remove();
        App.showToast('Invitación rechazada', 'info');
    },

    // Check for legacy root collections
    async checkLegacyData() {
        try {
            const propsSnap = await db.collection('properties').get();
            const clientsSnap = await db.collection('clients').get();
            const signsSnap = await db.collection('signs').get();

            const total = propsSnap.size + clientsSnap.size + signsSnap.size;

            if (total === 0) return null;

            return {
                properties: propsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                clients: clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                signs: signsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                count: total
            };
        } catch (e) {
            console.error('Error checking legacy:', e);
            return null;
        }
    },

    async handleLegacyRecovery() {
        const btn = document.getElementById('recoveryBtn');
        if (btn) btn.disabled = true;

        App.showToast('🔍 Buscando datos antiguos...', 'info');

        const data = await this.checkLegacyData();

        if (!data || data.count === 0) {
            App.showToast('No se encontraron datos antiguos en la raíz', 'info');
            if (btn) btn.disabled = false;
            return;
        }

        if (confirm(`⚠️ Se encontraron ${data.count} elementos antiguos (Propiedades: ${data.properties.length}, Clientes: ${data.clients.length}). \n\n¿Quieres importarlos a tu cuenta actual?`)) {
            const imported = await Storage.mergeLegacyData(data);
            App.showToast(`✓ Datos recuperados exitosamente. Recargando...`, 'success');
            setTimeout(() => location.reload(), 2000);
        } else {
            if (btn) btn.disabled = false;
        }
    }
};
