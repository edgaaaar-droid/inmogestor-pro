// Main App Controller

// Global function to force app update (clears cache and reloads)
async function forceAppUpdate() {
    try {
        // Show updating message
        alert('🔄 Actualizando app... Esto tomará unos segundos.');

        // Unregister all service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }

        // Clear all caches
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
        }

        // Force hard reload
        window.location.reload(true);
    } catch (error) {
        console.error('Error updating app:', error);
        // Fallback: just reload
        window.location.reload(true);
    }
}

// Current app version - increment this with each deploy
const APP_VERSION = 39;

// Auto-check for updates on page load
(async function checkForUpdates() {
    try {
        // Fetch sw.js with cache bypass to get server version
        const response = await fetch('./sw.js?t=' + Date.now());
        const text = await response.text();

        // Extract version number from CACHE_NAME
        const match = text.match(/CACHE_NAME\s*=\s*['"]inmogestor-pro-v(\d+)['"]/);
        if (match) {
            const serverVersion = parseInt(match[1]);
            console.log(`📱 Version: local=v${APP_VERSION}, server=v${serverVersion}`);

            if (serverVersion > APP_VERSION) {
                console.log('🔄 Nueva versión disponible! Actualizando...');
                // Auto-update silently
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) await reg.unregister();
                const cacheKeys = await caches.keys();
                for (const key of cacheKeys) await caches.delete(key);
                window.location.reload(true);
            }
        }
    } catch (e) {
        console.log('Version check skipped:', e.message);
    }
})();

const App = {
    currentSection: 'dashboard',

    async init() {
        // Wait for auth state
        const user = await Auth.init();

        if (!user) {
            // Show login screen
            this.showLoginRequired();
            // Hide loading if exists
            const loader = document.getElementById('appLoader');
            if (loader) loader.style.display = 'none';
            return;
        }

        // Show App Container (Security: Reveal only now)
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.style.display = 'flex';

        // Hide loading
        const loader = document.getElementById('appLoader');
        if (loader) loader.style.display = 'none';

        // Set current user in storage
        Storage.setCurrentUser(user.uid);

        // Continue normal initialization
        this.bindEvents();
        this.loadTheme();
        this.updateDate();
        this.renderSections();
        Properties.init();
        Clients.init();
        Followups.init();
        Signs.init();
        this.updateDashboard();
        this.handleHash();

        // Initialize Firebase sync (now with user context)
        Storage.initFirebase();

        // Initialize user role for sub-user system
        await Storage.initUserRole();

        // Check for pending invitations (shows banner if any)
        Auth.showInvitationBanner();

        // Proactive Legacy Check for Admin (Data Recovery)
        if (Auth.isAdmin() && Storage.getProperties().length === 0) {
            (async () => {
                const legacy = await Auth.checkLegacyData();
                if (legacy && legacy.count > 0) {
                    const banner = document.createElement('div');
                    banner.id = 'legacyRecoveryBanner';
                    banner.style.cssText = 'background:#fee2e2; color:#991b1b; padding:1rem; text-align:center; border-bottom:1px solid #ef4444; font-size:0.9rem;';
                    banner.innerHTML = `
                        <strong>⚠️ ATENCIÓN:</strong> Tienes ${legacy.count} datos antiguos sin sincronizar (versión anterior).
                        <button onclick="Auth.handleLegacyRecovery()" class="btn btn-sm btn-danger" style="margin-left:1rem;">⟳ Importar y Recuperar</button>
                    `;
                    const container = document.querySelector('.app-container');
                    if (container) container.prepend(banner);
                }
            })();
        }

        // Update user display in sidebar
        this.updateUserDisplay(user);

        // Modal close handlers
        document.querySelectorAll('.modal-overlay, .modal-cancel').forEach(el => {
            el.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        document.querySelectorAll('.modal-close').forEach(el => {
            el.addEventListener('click', () => {
                el.closest('.modal').classList.remove('active');
            });
        });
    },

    showLoginRequired() {
        // Create login required overlay
        const overlay = document.createElement('div');
        overlay.className = 'login-required-overlay';
        overlay.id = 'loginRequiredOverlay';
        overlay.innerHTML = `
            <div class="login-prompt">
                <img src="img/profile.jpg" alt="InmoGestor" class="login-prompt-logo">
                <h2>InmoGestor Pro</h2>
                <p>Inicia sesión para acceder a tu sistema de gestión inmobiliaria</p>
                <button class="btn btn-primary" onclick="Auth.showLoginModal()">
                    🔐 Iniciar Sesión
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    updateUserDisplay(user) {
        const sidebarHeader = document.querySelector('.sidebar-header');
        if (sidebarHeader && user) {
            const displayName = user.displayName || user.email.split('@')[0];
            const isAdmin = Auth.isAdmin();

            // Update the sidebar header to show user info
            sidebarHeader.innerHTML = `
                <div class="logo">
                    <img src="img/profile.jpg" alt="${displayName}" class="logo-avatar">
                    <div style="display:flex;flex-direction:column;line-height:1.1;">
                        <span class="logo-text" style="font-size:1.1rem;">${displayName}</span>
                        <span style="font-size:0.75rem;color:var(--text-muted);">${user.email}</span>
                        ${isAdmin ? '<span style="font-size:0.65rem;color:var(--primary);font-weight:600;">👑 ADMIN</span>' : ''}
                    </div>
                </div>
            `;

            // Check if sub-user and update header
            (async () => {
                const role = await Auth.getUserRole();
                if (role?.role === 'secretary') {
                    sidebarHeader.querySelector('.logo > div').insertAdjacentHTML('beforeend',
                        '<span style="font-size:0.65rem;color:#3b82f6;font-weight:600;">👥 SECRETARIO</span>'
                    );
                }
            })();
        }

        // Update body class for role-based UI visibility
        if (user) {
            const isAdmin = Auth.isAdmin();
            document.body.classList.toggle('is-admin', isAdmin);

            // Check sub-user role
            (async () => {
                const role = await Auth.getUserRole();
                const isSecretary = role?.role === 'secretary';
                const isSubUser = !!role;

                document.body.classList.toggle('is-secretary', isSecretary);
                document.body.classList.toggle('is-subuser', isSubUser);

                // Update pending count in settings if exists
                if (!isSecretary) {
                    const pendingCount = await Auth.getPendingApprovalsCount();
                    const pendingBadge = document.getElementById('settingsPendingBadge');
                    if (pendingBadge) {
                        pendingBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
                        pendingBadge.textContent = pendingCount;
                    }
                }

                // Update sidebar header badge
                const sidebarHeader = document.querySelector('.sidebar-header');
                if (sidebarHeader && isSecretary) {
                    const existingBadge = sidebarHeader.querySelector('.secretary-badge');
                    if (!existingBadge) {
                        sidebarHeader.querySelector('.logo > div').insertAdjacentHTML('beforeend',
                            '<span class="secretary-badge" style="font-size:0.65rem;color:#3b82f6;font-weight:600;">👥 SECRETARIO</span>'
                        );
                    }
                }
            })();
        }
    },

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(item.dataset.section);
            });
        });

        // Mobile menu
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });

        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

        // Global search
        document.getElementById('globalSearch')?.addEventListener('input', (e) => this.handleSearch(e.target.value));

        // Hash change
        window.addEventListener('hashchange', () => this.handleHash());

        // Export/Import buttons
        document.getElementById('exportDataBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('importDataBtn')?.addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
        document.getElementById('importFileInput')?.addEventListener('change', (e) => this.importData(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
                document.getElementById('lightbox').classList.remove('active');
            }
        });
    },

    renderSections() {
        // Render dashboard section
        document.getElementById('section-dashboard').innerHTML = `
            <div class="section-header">
                <div>
                    <h1>Dashboard</h1>
                    <p class="section-subtitle">Resumen de tu actividad inmobiliaria</p>
                </div>
            </div>
            <!-- Lifetime Earnings Widget -->
            <div class="card earnings-card" style="margin-bottom:1.5rem; background:linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border:1px solid var(--primary); color:white;">
                <div class="card-body" style="display:flex; justify-content:space-between; align-items:center; padding:1.5rem;">
                    <div>
                        <h3 style="margin:0; font-size:1rem; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:1px;">Ganancia Total Acumulada</h3>
                        <div style="display:flex; align-items:baseline; margin-top:0.5rem;">
                            <span id="earningsAmount" style="font-size:2.5rem; font-weight:700; color:var(--primary); margin-right:1rem;">$ ••••••</span>
                            <span id="earningsCurrency" style="font-size:1rem; color:rgba(255,255,255,0.5);">USD</span>
                        </div>
                    </div>
                    <button class="btn-icon" id="toggleEarningsBtn" title="Mostrar/Ocultar" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:white; opacity:0.7;">
                        👁️
                    </button>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card stat-primary">
                    <div class="stat-icon">🏡</div>
                    <div class="stat-info">
                        <span class="stat-value" id="totalProperties">0</span>
                        <span class="stat-label">Propiedades</span>
                    </div>
                </div>
                <div class="stat-card stat-success">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <span class="stat-value" id="totalClients">0</span>
                        <span class="stat-label">Clientes</span>
                    </div>
                </div>
                <div class="stat-card stat-warning">
                    <div class="stat-icon">📅</div>
                    <div class="stat-info">
                        <span class="stat-value" id="pendingFollowups">0</span>
                        <span class="stat-label">Seguimientos Pendientes</span>
                    </div>
                </div>
                <div class="stat-card stat-info">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <span class="stat-value" id="completedDeals">0</span>
                        <span class="stat-label">Operaciones Cerradas</span>
                    </div>
                </div>
            </div>
            <div class="card kpi-card" style="margin-bottom:1.5rem;">
                <div class="card-header"><h3>📊 KPIs - Indicadores Clave</h3></div>
                <div class="card-body">
                    <div class="kpi-grid" id="kpiGrid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;"></div>
                </div>
            </div>
            <div class="dashboard-grid">
                <div class="card recent-activity">
                    <div class="card-header"><h3>📝 Actividad Reciente</h3></div>
                    <div class="card-body"><ul class="activity-list" id="recentActivity"></ul></div>
                </div>
                <div class="card upcoming-followups">
                    <div class="card-header"><h3>📅 Próximos Seguimientos</h3></div>
                    <div class="card-body"><ul class="followup-list" id="upcomingFollowups"></ul></div>
                </div>
            </div>
        `;

        // Render properties section
        document.getElementById('section-properties').innerHTML = `
            <div class="section-header">
                <h1>Propiedades</h1>
                <button class="btn btn-primary" id="addPropertyBtn"><span>+</span> Nueva Propiedad</button>
            </div>
            <div class="filters-bar">
                <div class="filter-group">
                    <select id="filterStatus" class="filter-select">
                        <option value="">Todos los estados</option>
                        <option value="available">Disponible</option>
                        <option value="reserved">Reservado</option>
                        <option value="sold">Vendido</option>
                        <option value="rented">Alquilado</option>
                    </select>
                    <select id="filterType" class="filter-select">
                        <option value="">Todos los tipos</option>
                        <option value="house">Casa</option>
                        <option value="apartment">Departamento</option>
                        <option value="land">Terreno</option>
                        <option value="commercial">Comercial</option>
                        <option value="office">Oficina</option>
                    </select>
                    <select id="filterCaptacion" class="filter-select">
                        <option value="">Todas las captaciones</option>
                        <option value="propia_exclusiva">Propia - Exclusividad</option>
                        <option value="propia_cartera">Propia - Cartera Privada</option>
                        <option value="c21_cartera">C21 Cartera Privada</option>
                        <option value="c21_sky">C21 Sky</option>
                        <option value="c21_captaciones">C21 Captaciones</option>
                    </select>
                </div>
                <div class="view-toggle">
                    <button class="view-btn active" data-view="grid">▦</button>
                    <button class="view-btn" data-view="list">☰</button>
                </div>
            </div>
            <div class="properties-grid" id="propertiesContainer"></div>
        `;

        // Render clients section
        document.getElementById('section-clients').innerHTML = `
            <div class="section-header">
                <h1>Clientes</h1>
                <button class="btn btn-primary" id="addClientBtn"><span>+</span> Nuevo Cliente</button>
            </div>
            <div class="filters-bar">
                <div class="filter-group">
                    <select id="filterClientType" class="filter-select">
                        <option value="">Todos los tipos</option>
                        <option value="buyer">Comprador</option>
                        <option value="seller">Vendedor</option>
                        <option value="tenant">Inquilino</option>
                        <option value="landlord">Propietario</option>
                    </select>
                    <select id="filterClientStatus" class="filter-select">
                        <option value="">Todos los estados</option>
                        <option value="active">Activo</option>
                        <option value="interested">Interesado</option>
                        <option value="closed">Cerrado</option>
                    </select>
                </div>
            </div>
            <div class="clients-grid" id="clientsContainer"></div>
        `;

        // Render followups section
        document.getElementById('section-followups').innerHTML = `
            <div class="section-header">
                <h1>Seguimientos</h1>
                <button class="btn btn-primary" id="addFollowupBtn"><span>+</span> Nuevo Seguimiento</button>
            </div>
            <div class="filters-bar">
                <div class="filter-group">
                    <select id="filterFollowupStatus" class="filter-select">
                        <option value="">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="completed">Completado</option>
                        <option value="cancelled">Cancelado</option>
                    </select>
                    <select id="filterFollowupType" class="filter-select">
                        <option value="">Todos los tipos</option>
                        <option value="call">Llamada</option>
                        <option value="meeting">Reunión</option>
                        <option value="visit">Visita</option>
                        <option value="other">Otro</option>
                    </select>
                </div>
            </div>
            <div class="followups-container">
                <div class="calendar-view" id="calendarView">
                    <div class="calendar-header">
                        <button class="calendar-nav" id="prevMonth">◀</button>
                        <h3 id="calendarMonth">Enero 2026</h3>
                        <button class="calendar-nav" id="nextMonth">▶</button>
                    </div>
                    <div class="calendar-grid" id="calendarGrid"></div>
                </div>
                <div class="followups-list" id="followupsContainer"></div>
            </div>
        `;

        // Render map section
        document.getElementById('section-map').innerHTML = `
            <div class="section-header">
                <div>
                    <h1>📍 Mapa de Propiedades</h1>
                    <p class="section-subtitle">Visualiza todas tus propiedades en el mapa</p>
                </div>
                <div class="filter-group">
                    <select id="mapFilterStatus" class="filter-select" onchange="Properties.renderGeneralMap()">
                        <option value="">Todas</option>
                        <option value="available" selected>Disponibles</option>
                        <option value="reserved">Reservadas</option>
                        <option value="sold">Vendidas</option>
                        <option value="rented">Alquiladas</option>
                    </select>
                </div>
            </div>
            <div id="generalMapContainer" style="height:calc(100vh - 200px); width:100%; border-radius:var(--radius); overflow:hidden; background:var(--bg-tertiary);"></div>
        `;

        // Render modals
        this.renderModals();
    },

    renderModals() {
        document.getElementById('propertyModal').querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h2 id="propertyModalTitle">Nueva Propiedad</h2>
                <button class="modal-close">×</button>
            </div>
            <form id="propertyForm" class="modal-body">
                <input type="hidden" id="propertyId">
                <div class="form-grid">
                    <div class="form-group"><label>Título *</label><input type="text" id="propertyTitle" required placeholder="Ej: Casa moderna"></div>
                    <div class="form-group"><label>Tipo *</label><select id="propertyType" required><option value="">Seleccionar...</option><option value="house">Casa</option><option value="apartment">Departamento</option><option value="land">Terreno</option><option value="commercial">Comercial</option><option value="office">Oficina</option></select></div>
                    <div class="form-group"><label>Estado *</label><select id="propertyStatus"><option value="available">Disponible</option><option value="reserved">Reservado</option><option value="sold">Vendido</option><option value="rented">Alquilado</option></select></div>
                    <div class="form-group"><label>Operación *</label><select id="propertyOperation" onchange="Properties.togglePriceFields()"><option value="sale">Venta</option><option value="rent">Alquiler</option><option value="both">Venta + Alquiler</option></select></div>
                    <div class="form-group" id="singlePriceGroup"><label>Precio *</label><input type="number" id="propertyPrice" placeholder="150000"></div>
                    <div class="form-group" id="salePriceGroup" style="display:none;"><label>💰 Precio Venta *</label><input type="number" id="propertySalePrice" placeholder="150000"></div>
                    <div class="form-group" id="rentPriceGroup" style="display:none;"><label>🔑 Precio Alquiler *</label><input type="number" id="propertyRentPrice" placeholder="1500"></div>
                    <div class="form-group"><label>Moneda</label><select id="propertyCurrency"><option value="USD">USD</option><option value="EUR">EUR</option><option value="PYG">PYG (Gs)</option><option value="ARS">ARS</option></select></div>
                    <div class="form-group full-width"><label>Dirección *</label><input type="text" id="propertyAddress" required placeholder="Calle, número, ciudad"></div>
                    <div class="form-group"><label>Latitud (Mapa)</label><input type="text" id="propertyLat" placeholder="-25.2867 (Opcional)"></div>
                    <div class="form-group"><label>Longitud (Mapa)</label><input type="text" id="propertyLng" placeholder="-57.6470 (Opcional)"></div>
                    <div class="form-group full-width" style="margin-top:0.5rem;">
                        <label>📍 Ubicación en Mapa <small style="color:var(--text-muted);">(Clic para seleccionar)</small></label>
                        <div id="propertyMiniMap" style="height:200px; width:100%; border-radius:var(--radius); background:var(--bg-tertiary); border:1px solid var(--border-color);"></div>
                    </div>
                    <div class="form-group"><label>Superficie (m²)</label><input type="number" id="propertyArea" placeholder="120"></div>
                    <div class="form-group"><label>Habitaciones</label><input type="number" id="propertyBedrooms" placeholder="3"></div>
                    <div class="form-group"><label>Baños</label><input type="number" id="propertyBathrooms" placeholder="2"></div>
                    <div class="form-group"><label>Estacionamientos</label><input type="number" id="propertyParking" placeholder="1"></div>
                    
                    <div class="form-group full-width" style="background:var(--bg-tertiary);padding:1rem;border-radius:var(--radius-sm);margin:0.5rem 0;">
                        <h4 style="margin:0 0 0.75rem 0;color:var(--primary);">📋 Datos de Captación</h4>
                    </div>
                    <div class="form-group"><label>Fuente de Captación *</label><select id="propertyCaptacionSource" required>
                        <option value="">Seleccionar...</option>
                        <option value="propia_exclusiva">Propia - Exclusividad Firmada</option>
                        <option value="propia_cartera">Propia - Cartera Privada</option>
                        <option value="c21_cartera">C21 Cartera Privada</option>
                        <option value="c21_sky">C21 Sky Captaciones</option>
                        <option value="c21_captaciones">C21 Captaciones</option>
                    </select></div>
                    <div class="form-group"><label>Agencia del Captador</label><input type="text" id="propertyCaptadorAgency" placeholder="Ej: C21 Sky, C21 Vallarta"></div>
                    <div class="form-group"><label>Nombre del Captador</label><input type="text" id="propertyCaptadorAgent" placeholder="Nombre del agente"></div>
                    <div class="form-group"><label>ID Captación</label><input type="text" id="propertyCaptacionId" placeholder="ID de exclusividad"></div>
                    <div class="form-group"><label>Fecha de Captación</label><input type="date" id="propertyCaptacionDate"></div>
                    
                    <div class="form-group full-width"><label>Descripción</label><textarea id="propertyDescription" rows="2" placeholder="Descripción..."></textarea></div>
                    <div class="form-group full-width"><label>Características</label><input type="text" id="propertyFeatures" placeholder="Piscina, Jardín, etc."></div>
                    <div class="form-group full-width"><label>Propietario (Dueño)</label><select id="propertyOwner"><option value="">Sin propietario asignado</option></select></div>
                    <div class="form-group full-width">
                        <label>Imágenes</label>
                        <div class="image-upload-area" id="propertyImageUpload">
                            <input type="file" id="propertyImages" multiple accept="image/*" hidden>
                            <div class="upload-placeholder"><span class="upload-icon">📷</span><p>Arrastra imágenes o <button type="button" class="btn-link" onclick="document.getElementById('propertyImages').click()">selecciona</button></p></div>
                            <div class="image-preview-grid" id="propertyImagePreview"></div>
                        </div>
                    </div>
                </div>
            </form>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
                <button type="submit" form="propertyForm" class="btn btn-primary">Guardar</button>
            </div>
        `;

        document.getElementById('clientModal').querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h2 id="clientModalTitle">Nuevo Cliente</h2>
                <button class="modal-close">×</button>
            </div>
            <form id="clientForm" class="modal-body">
                <input type="hidden" id="clientId">
                <div class="form-grid">
                    <div class="form-group"><label>Nombre *</label><input type="text" id="clientName" required placeholder="Nombre completo"></div>
                    <div class="form-group"><label>Tipo *</label><select id="clientType" required><option value="">Seleccionar...</option><option value="buyer">Comprador</option><option value="seller">Vendedor</option><option value="tenant">Inquilino</option><option value="landlord">Propietario</option></select></div>
                    <div class="form-group"><label>Teléfono *</label><input type="tel" id="clientPhone" required placeholder="+54 11 1234-5678"></div>
                    <div class="form-group"><label>Email</label><input type="email" id="clientEmail" placeholder="email@ejemplo.com"></div>
                    <div class="form-group"><label>Estado</label><select id="clientStatus"><option value="active">Activo</option><option value="interested">Interesado</option><option value="closed">Cerrado</option></select></div>
                    <div class="form-group"><label>Presupuesto</label><input type="text" id="clientBudget" placeholder="USD 100,000 - 150,000"></div>
                    <div class="form-group full-width"><label>Preferencias</label><textarea id="clientPreferences" rows="2" placeholder="Qué busca..."></textarea></div>
                    <div class="form-group full-width"><label>Notas</label><textarea id="clientNotes" rows="2" placeholder="Notas..."></textarea></div>
                </div>
            </form>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
                <button type="submit" form="clientForm" class="btn btn-primary">Guardar</button>
            </div>
        `;

        document.getElementById('followupModal').querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h2 id="followupModalTitle">Nuevo Seguimiento</h2>
                <button class="modal-close">×</button>
            </div>
            <form id="followupForm" class="modal-body">
                <input type="hidden" id="followupId">
                <div class="form-grid">
                    <div class="form-group"><label>Tipo de Actividad *</label><select id="followupType" required><option value="">Seleccionar...</option><option value="visit">🏠 Visita a Propiedad</option><option value="call">📞 Llamada</option><option value="meeting">🤝 Reunión</option><option value="showing">👁️ Mostrar Propiedad</option><option value="negotiation">💰 Negociación</option><option value="other">📌 Otro</option></select></div>
                    <div class="form-group"><label>Estado *</label><select id="followupStatus"><option value="pending">⏳ Pendiente</option><option value="completed">✅ Completado</option><option value="cancelled">❌ Cancelado</option></select></div>
                    
                    <div class="form-group full-width" style="background:var(--bg-tertiary);padding:1rem;border-radius:var(--radius-sm);margin:0.5rem 0;">
                        <h4 style="margin:0 0 0.75rem 0;color:var(--primary);">📅 Fecha y Horarios</h4>
                    </div>
                    <div class="form-group"><label>Fecha *</label><input type="date" id="followupDate" required></div>
                    <div class="form-group"><label>Hora Inicio</label><input type="time" id="followupTime"></div>
                    <div class="form-group"><label>Hora Fin</label><input type="time" id="followupTimeEnd"></div>
                    <div class="form-group"><label></label></div>
                    
                    <div class="form-group full-width" style="background:var(--bg-tertiary);padding:1rem;border-radius:var(--radius-sm);margin:0.5rem 0;">
                        <h4 style="margin:0 0 0.75rem 0;color:var(--primary);">🏠 Propiedad y Clientes</h4>
                    </div>
                    <div class="form-group full-width"><label>Propiedad a Visitar</label><select id="followupProperty"><option value="">Seleccionar propiedad...</option></select></div>
                    <div class="form-group full-width"><label>Clientes que Participan</label><select id="followupClient"><option value="">Seleccionar cliente...</option></select></div>
                    
                    <div class="form-group full-width"><label>Descripción de la Actividad *</label><input type="text" id="followupTitle" required placeholder="Ej: Visita con familia García para ver el departamento"></div>
                    
                    <div class="form-group full-width" style="background:var(--bg-tertiary);padding:1rem;border-radius:var(--radius-sm);margin:0.5rem 0;">
                        <h4 style="margin:0 0 0.75rem 0;color:var(--primary);">📊 Resultado de la Actividad</h4>
                    </div>
                    <div class="form-group"><label>Resultado</label><select id="followupResult"><option value="">Pendiente de resultado</option><option value="interested">✅ Interesado</option><option value="very_interested">🔥 Muy Interesado</option><option value="offer">💰 Hizo Oferta</option><option value="not_interested">❌ No Interesado</option><option value="thinking">🤔 Lo está pensando</option><option value="rescheduled">📅 Reagendado</option></select></div>
                    <div class="form-group"><label></label></div>
                    <div class="form-group full-width"><label>Feedback / Opinión de la Visita</label><textarea id="followupFeedback" rows="3" placeholder="¿Qué comentó el cliente? ¿Qué le gustó? ¿Qué objeciones tuvo?"></textarea></div>
                    <div class="form-group full-width"><label>Notas Adicionales</label><textarea id="followupNotes" rows="2" placeholder="Próximos pasos, recordatorios..."></textarea></div>
                </div>
            </form>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
                <button type="submit" form="followupForm" class="btn btn-primary">Guardar</button>
            </div>
        `;
    },

    navigateTo(section) {
        this.currentSection = section;

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Update active section
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.toggle('active', sec.id === `section-${section}`);
        });

        // Close mobile menu
        document.getElementById('sidebar').classList.remove('active');

        // Update hash
        window.location.hash = section;
    },

    handleHash() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        if (['dashboard', 'properties', 'clients', 'followups', 'signs', 'map'].includes(hash)) {
            this.navigateTo(hash);
            // Initialize general map when navigating to map section
            if (hash === 'map') {
                setTimeout(() => Properties.initGeneralMap(), 100);
            }
        }
    },

    updateDashboard() {
        const properties = Storage.getProperties();
        const clients = Storage.getClients();
        const followups = Storage.getFollowups();
        const activities = Storage.getActivities();

        // Stats
        document.getElementById('totalProperties').textContent = properties.length;
        document.getElementById('totalClients').textContent = clients.length;
        document.getElementById('pendingFollowups').textContent = followups.filter(f => f.status === 'pending').length;
        document.getElementById('completedDeals').textContent = properties.filter(p => p.status === 'sold' || p.status === 'rented').length;

        // --- LIFETIME EARNINGS LOGIC ---
        // Simplified Sum (Data is now sanitized by Properties.sanitizeDatabase)
        const totalEarnings = properties.reduce((sum, p) => {
            if (p.status === 'sold' && p.saleData && p.saleData.myEarnings) {
                return sum + (Number(p.saleData.myEarnings) || 0);
            }
            return sum;
        }, 0);

        const earningsAmount = document.getElementById('earningsAmount');
        const toggleBtn = document.getElementById('toggleEarningsBtn');
        let showEarnings = false; // Default hidden

        // Initial State (Formatted)
        const formattedEarnings = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(totalEarnings);

        earningsAmount.textContent = '$ ••••••';
        earningsAmount.dataset.value = formattedEarnings;

        // Re-bind click (hacky but works for simple redraw)
        toggleBtn.onclick = () => {
            showEarnings = !showEarnings;
            earningsAmount.textContent = showEarnings ? `$ ${formattedEarnings}` : '$ ••••••';
            toggleBtn.textContent = showEarnings ? '👁️‍🗨️' : '👁️';
            // Optional: Save preference to localStorage if desired
        };

        // KPIs
        this.renderKPIs(properties, clients, followups);

        // Recent activity
        const activityList = document.getElementById('recentActivity');
        if (activities.length === 0) {
            activityList.innerHTML = '<li class="activity-empty">No hay actividad reciente</li>';
        } else {
            activityList.innerHTML = activities.slice(0, 5).map(a => {
                const icons = { property: '🏠', client: '👤', followup: '📅' };
                const time = this.timeAgo(new Date(a.timestamp));
                return `<li class="activity-item"><span class="activity-icon">${icons[a.type] || '📌'}</span><span class="activity-text">${a.description}</span><span class="activity-time">${time}</span></li>`;
            }).join('');
        }

        // Upcoming followups
        const today = new Date().toISOString().split('T')[0];
        const upcomingList = document.getElementById('upcomingFollowups');
        const upcoming = followups.filter(f => f.status === 'pending' && f.date >= today).slice(0, 5);

        if (upcoming.length === 0) {
            upcomingList.innerHTML = '<li class="followup-empty">No hay seguimientos próximos</li>';
        } else {
            upcomingList.innerHTML = upcoming.map(f => {
                const client = Storage.getClients().find(c => c.id === f.clientId);
                return `<li class="activity-item"><span class="activity-icon">📅</span><span class="activity-text"><strong>${f.title}</strong><br><small>${f.date} ${f.time || ''} ${client ? '• ' + client.name : ''}</small></span></li>`;
            }).join('');
        }
    },

    renderKPIs(properties, clients, followups) {
        const kpiGrid = document.getElementById('kpiGrid');
        if (!kpiGrid) return;

        // Calculate KPIs
        const available = properties.filter(p => p.status === 'available').length;
        const sold = properties.filter(p => p.status === 'sold').length;
        const rented = properties.filter(p => p.status === 'rented').length;
        const reserved = properties.filter(p => p.status === 'reserved').length;

        const conversionRate = properties.length > 0 ? Math.round(((sold + rented) / properties.length) * 100) : 0;

        const totalValue = properties.reduce((sum, p) => sum + (p.price || 0), 0);
        const avgPrice = properties.length > 0 ? Math.round(totalValue / properties.length) : 0;

        const activeClients = clients.filter(c => c.status === 'active').length;
        const propertiesWithOwner = properties.filter(p => p.ownerId).length;

        const completedFollowups = followups.filter(f => f.status === 'completed').length;
        const followupRate = followups.length > 0 ? Math.round((completedFollowups / followups.length) * 100) : 0;

        kpiGrid.innerHTML = `
            <div class="kpi-item" style="text-align:center; padding:1rem; background:var(--bg-tertiary); border-radius:var(--radius-sm);">
                <div style="font-size:2rem; font-weight:700; color:var(--success);">${conversionRate}%</div>
                <div style="font-size:0.875rem; color:var(--text-secondary);">Tasa de Conversión</div>
            </div>
            <div class="kpi-item" style="text-align:center; padding:1rem; background:var(--bg-tertiary); border-radius:var(--radius-sm);">
                <div style="font-size:2rem; font-weight:700; color:var(--primary);">$${this.formatNumber(avgPrice)}</div>
                <div style="font-size:0.875rem; color:var(--text-secondary);">Precio Promedio</div>
            </div>
            <div class="kpi-item" style="text-align:center; padding:1rem; background:var(--bg-tertiary); border-radius:var(--radius-sm);">
                <div style="font-size:2rem; font-weight:700; color:var(--warning);">${available}</div>
                <div style="font-size:0.875rem; color:var(--text-secondary);">Disponibles</div>
            </div>
            <div class="kpi-item" style="text-align:center; padding:1rem; background:var(--bg-tertiary); border-radius:var(--radius-sm);">
                <div style="font-size:2rem; font-weight:700; color:var(--info);">${reserved}</div>
                <div style="font-size:0.875rem; color:var(--text-secondary);">Reservadas</div>
            </div>
            <div class="kpi-item" style="text-align:center; padding:1rem; background:var(--bg-tertiary); border-radius:var(--radius-sm);">
                <div style="font-size:2rem; font-weight:700; color:var(--success);">${followupRate}%</div>
                <div style="font-size:0.875rem; color:var(--text-secondary);">Seguimientos Completados</div>
            </div>
            <div class="kpi-item" style="text-align:center; padding:1rem; background:var(--bg-tertiary); border-radius:var(--radius-sm);">
                <div style="font-size:2rem; font-weight:700; color:var(--primary);">${propertiesWithOwner}</div>
                <div style="font-size:0.875rem; color:var(--text-secondary);">Con Propietario</div>
            </div>
        `;
    },

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
        return num.toString();
    },

    handleSearch(query) {
        if (!query) return;
        query = query.toLowerCase();

        const properties = Storage.getProperties().filter(p =>
            p.title.toLowerCase().includes(query) || p.address.toLowerCase().includes(query)
        );
        const clients = Storage.getClients().filter(c =>
            c.name.toLowerCase().includes(query) || c.phone.includes(query)
        );

        if (properties.length > 0) {
            this.navigateTo('properties');
        } else if (clients.length > 0) {
            this.navigateTo('clients');
        }
    },

    loadTheme() {
        // Force Dark/Gold Theme
        document.documentElement.setAttribute('data-theme', 'dark');
    },

    toggleTheme() {
        // Disabled
    },

    updateThemeButton(theme) {
        // Disabled
    },

    updateDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const date = new Date().toLocaleDateString('es-ES', options);
        document.getElementById('currentDate').textContent = date.charAt(0).toUpperCase() + date.slice(1);
    },

    closeModal(id) {
        document.getElementById(id)?.classList.remove('active');
    },

    openLightbox(images, index = 0) {
        if (!images || images.length === 0) return;

        const lightbox = document.getElementById('lightbox');
        const img = document.getElementById('lightboxImage');
        let currentIndex = index;

        // Store images globally for navigation
        this.lightboxImages = images;
        this.lightboxIndex = currentIndex;

        const show = (i) => {
            if (images[i]) {
                img.src = images[i];
                this.lightboxIndex = i;
            }
        };

        const prev = () => {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            show(currentIndex);
        };

        const next = () => {
            currentIndex = (currentIndex + 1) % images.length;
            show(currentIndex);
        };

        show(currentIndex);
        lightbox.classList.add('active');

        // Update nav buttons
        const navDiv = lightbox.querySelector('.lightbox-nav');
        if (navDiv && images.length > 1) {
            navDiv.innerHTML = `
                <button onclick="App.lightboxPrev()" style="padding:0.5rem 1rem;background:rgba(255,255,255,0.2);border:none;color:white;border-radius:4px;cursor:pointer;">◀ Anterior</button>
                <span style="color:white;">${currentIndex + 1} / ${images.length}</span>
                <button onclick="App.lightboxNext()" style="padding:0.5rem 1rem;background:rgba(255,255,255,0.2);border:none;color:white;border-radius:4px;cursor:pointer;">Siguiente ▶</button>
            `;
        }

        lightbox.querySelector('.lightbox-close').onclick = () => lightbox.classList.remove('active');
        lightbox.onclick = (e) => {
            if (e.target === lightbox) lightbox.classList.remove('active');
        };
    },

    lightboxPrev() {
        if (!this.lightboxImages) return;
        this.lightboxIndex = (this.lightboxIndex - 1 + this.lightboxImages.length) % this.lightboxImages.length;
        document.getElementById('lightboxImage').src = this.lightboxImages[this.lightboxIndex];
        const navDiv = document.getElementById('lightbox').querySelector('.lightbox-nav');
        if (navDiv) {
            navDiv.querySelector('span').textContent = `${this.lightboxIndex + 1} / ${this.lightboxImages.length}`;
        }
    },

    lightboxNext() {
        if (!this.lightboxImages) return;
        this.lightboxIndex = (this.lightboxIndex + 1) % this.lightboxImages.length;
        document.getElementById('lightboxImage').src = this.lightboxImages[this.lightboxIndex];
        const navDiv = document.getElementById('lightbox').querySelector('.lightbox-nav');
        if (navDiv) {
            navDiv.querySelector('span').textContent = `${this.lightboxIndex + 1} / ${this.lightboxImages.length}`;
        }
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'info' ? 'ℹ️' : '✕';
        toast.innerHTML = `<span>${icon}</span> ${message}`;
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    },

    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        const intervals = { año: 31536000, mes: 2592000, día: 86400, hora: 3600, minuto: 60 };

        for (const [unit, value] of Object.entries(intervals)) {
            const count = Math.floor(seconds / value);
            if (count >= 1) {
                return `hace ${count} ${unit}${count > 1 ? (unit === 'mes' ? 'es' : 's') : ''}`;
            }
        }
        return 'hace un momento';
    },

    // ===== EXPORT/IMPORT DATA =====

    exportData() {
        const data = {
            properties: Storage.getProperties(),
            clients: Storage.getClients(),
            followups: Storage.getFollowups(),
            colleagues: Storage.getColleagues(),
            sales: Storage.getSales(),
            signs: Storage.getSigns(),
            settings: Storage.getSettings(),
            activities: Storage.getActivities(),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `InmoGestorPro_Backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`✓ Backup exportado: InmoGestorPro_Backup_${date}.json`, 'success');
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate data structure
                if (!data.properties && !data.clients && !data.followups) {
                    throw new Error('Archivo inválido');
                }

                // Confirm import
                const propCount = data.properties?.length || 0;
                const clientCount = data.clients?.length || 0;
                const followupCount = data.followups?.length || 0;
                const saleCount = data.sales?.length || 0;

                if (!confirm(`¿Importar datos?\n\n• ${propCount} propiedades\n• ${clientCount} clientes\n• ${followupCount} seguimientos\n• ${saleCount} ventas\n\n⚠️ Esto reemplazará TODOS los datos actuales.`)) {
                    event.target.value = '';
                    return;
                }

                // Import all data
                if (data.properties) Storage.set(Storage.KEYS.PROPERTIES, data.properties);
                if (data.clients) Storage.set(Storage.KEYS.CLIENTS, data.clients);
                if (data.followups) Storage.set(Storage.KEYS.FOLLOWUPS, data.followups);
                if (data.colleagues) Storage.set(Storage.KEYS.COLLEAGUES, data.colleagues);
                if (data.sales) Storage.set(Storage.KEYS.SALES, data.sales);
                if (data.signs) Storage.set(Storage.KEYS.SIGNS, data.signs);
                if (data.settings) Storage.set(Storage.KEYS.SETTINGS, data.settings);

                // Refresh UI
                Properties.render();
                Clients.render();
                Followups.render();
                this.updateDashboard();

                this.showToast('✓ Datos importados correctamente', 'success');
            } catch (err) {
                this.showToast('✕ Error al importar: archivo inválido', 'error');
                console.error('Import error:', err);
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
