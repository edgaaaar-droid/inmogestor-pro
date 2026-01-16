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

        const users = await this.getAllUsers();

        const modal = document.getElementById('adminModal');
        if (!modal) return;

        const content = modal.querySelector('.modal-content');
        content.innerHTML = `
            <div class="modal-header">
                <h2>👑 Panel de Administrador</h2>
                <button class="modal-close" onclick="document.getElementById('adminModal').classList.remove('active')">×</button>
            </div>
            <div class="modal-body">
                <h3 style="margin-bottom:1rem;">Usuarios Registrados (${users.length})</h3>
                <div class="admin-users-list">
                    ${users.length === 0 ? '<p style="color:var(--text-muted);">No hay usuarios registrados aún</p>' : ''}
                    ${users.map(u => `
                        <div class="admin-user-item" data-userid="${u.id}">
                            <div class="admin-user-info">
                                <strong>${u.id.substring(0, 8)}...</strong>
                                <span style="font-size:0.8rem;color:var(--text-muted);">
                                    ${u.data?.main?.properties?.length || 0} propiedades, 
                                    ${u.data?.main?.clients?.length || 0} clientes
                                </span>
                            </div>
                            <button class="btn btn-sm" onclick="Auth.viewUserData('${u.id}')">
                                Ver Datos
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        modal.classList.add('active');
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

