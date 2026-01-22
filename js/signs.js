// Signs Manager - Captación de Carteles
const Signs = {
    container: null,
    modal: null,
    currentPhotos: [],
    miniMap: null,
    miniMapMarker: null,
    signsMap: null,

    init() {
        this.container = document.getElementById('section-signs');
        this.modal = document.getElementById('signModal');
        this.render();
        this.bindEvents();
    },

    bindEvents() {
        // Close modal on overlay click
        this.modal?.querySelector('.modal-overlay')?.addEventListener('click', () => this.closeModal());

        // Global paste for images
        document.addEventListener('paste', (e) => {
            if (this.modal?.classList.contains('active')) {
                this.handleImagePaste(e);
            }
        });
    },

    render() {
        const signs = Storage.getSigns();
        const filter = document.getElementById('signFilter')?.value || 'all';
        const contactFilter = document.getElementById('signContactFilter')?.value || 'all';

        let filtered = signs;
        if (filter !== 'all') {
            filtered = filtered.filter(s => s.type === filter);
        }
        if (contactFilter !== 'all') {
            const isContacted = contactFilter === 'contacted';
            filtered = filtered.filter(s => s.contacted === isContacted);
        }

        // Stats
        const totalVenta = signs.filter(s => s.type === 'venta').length;
        const totalAlquiler = signs.filter(s => s.type === 'alquiler').length;
        const totalPendientes = signs.filter(s => !s.contacted).length;
        const totalContactados = signs.filter(s => s.contacted).length;

        this.container.innerHTML = `
            <div class="section-header">
                <h1>📋 Captación de Carteles</h1>
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    <button class="btn btn-quick-sign" onclick="Signs.openQuickMode()" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 700; animation: pulse-glow 2s infinite;">
                        <span>⚡</span> Cartel Rápido
                    </button>
                    <button class="btn btn-primary" onclick="Signs.openModal()">
                        <span>➕</span> Nuevo Cartel
                    </button>
                </div>
            </div>

            <div class="stats-grid" style="margin-bottom: 1.5rem;">
                <div class="stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">🔴</div>
                    <div class="stat-info">
                        <span class="stat-value">${totalVenta}</span>
                        <span class="stat-label">En Venta</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">🔵</div>
                    <div class="stat-info">
                        <span class="stat-value">${totalAlquiler}</span>
                        <span class="stat-label">En Alquiler</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">⏳</div>
                    <div class="stat-info">
                        <span class="stat-value">${totalPendientes}</span>
                        <span class="stat-label">Pendientes</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">✅</div>
                    <div class="stat-info">
                        <span class="stat-value">${totalContactados}</span>
                        <span class="stat-label">Contactados</span>
                    </div>
                </div>
            </div>

            <div class="filters-bar" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <select id="signFilter" class="form-control" style="width: auto;" onchange="Signs.render()">
                    <option value="all">Todos los tipos</option>
                    <option value="venta">🔴 Solo Venta</option>
                    <option value="alquiler">🔵 Solo Alquiler</option>
                </select>
                <select id="signContactFilter" class="form-control" style="width: auto;" onchange="Signs.render()">
                    <option value="all">Todos los estados</option>
                    <option value="pending">⏳ Pendientes</option>
                    <option value="contacted">✅ Contactados</option>
                </select>
                <button class="btn btn-secondary" onclick="Signs.showMapView()">
                    <span>🗺️</span> Ver Mapa
                </button>
            </div>

            <div class="signs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
                ${filtered.length === 0 ? `
                    <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                        <span style="font-size: 4rem;">📋</span>
                        <h3>No hay carteles registrados</h3>
                        <p style="color: var(--text-secondary);">Agrega tu primer cartel de captación</p>
                    </div>
                ` : filtered.map(sign => this.renderCard(sign)).join('')}
            </div>
        `;
    },

    renderCard(sign) {
        const typeColor = sign.type === 'venta' ? '#ef4444' : '#3b82f6';
        const typeIcon = sign.type === 'venta' ? '🔴' : '🔵';
        const typeLabel = sign.type === 'venta' ? 'VENTA' : 'ALQUILER';
        const statusIcon = sign.contacted ? '✅' : '⏳';
        const statusLabel = sign.contacted ? 'Contactado' : 'Pendiente';
        const statusColor = sign.contacted ? '#10b981' : '#f59e0b';
        const photo = sign.photos?.[0] || '';
        const dateStr = new Date(sign.createdAt).toLocaleDateString('es-AR');

        // Contact type icons
        const contactTypeInfo = {
            'owner': { icon: '🏠', label: 'Dueño' },
            'manager': { icon: '🔑', label: 'Encargado' },
            'agent': { icon: '🏢', label: 'Asesor' }
        };
        const contactType = sign.contactType ? contactTypeInfo[sign.contactType] : null;

        return `
            <div class="sign-card" style="background: var(--card-bg); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color);">
                <div class="sign-photo" style="height: 180px; background: ${photo ? `url('${photo}') center/cover` : 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))'}; position: relative;">
                    ${!photo ? '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3rem;">📷</div>' : ''}
                    <div style="position: absolute; top: 0.75rem; left: 0.75rem; display: flex; gap: 0.5rem;">
                        <span style="background: ${typeColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                            ${typeIcon} ${typeLabel}
                        </span>
                    </div>
                    <div style="position: absolute; top: 0.75rem; right: 0.75rem;">
                        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                            ${statusIcon} ${statusLabel}
                        </span>
                    </div>
                </div>
                <div class="sign-info" style="padding: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 1.25rem;">📞</span>
                        <span style="font-weight: 600; font-size: 1.1rem;">${sign.phone || 'Sin teléfono'}</span>
                    </div>
                    ${sign.address ? `
                        <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                            <span>📍</span>
                            <span>${sign.address}</span>
                        </div>
                    ` : ''}
                    ${sign.neighborhood ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">
                            <span>🏘️</span>
                            <span>${sign.neighborhood}</span>
                        </div>
                    ` : ''}
                    ${sign.ownerName ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                            <span>${contactType ? contactType.icon : '👤'}</span>
                            <span>${sign.ownerName}${contactType ? ` (${contactType.label})` : ''}</span>
                        </div>
                    ` : (contactType ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                            <span>${contactType.icon}</span>
                            <span>${contactType.label}</span>
                        </div>
                    ` : '')}
                    ${sign.price ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; color: var(--primary); font-weight: 600;">
                            <span>💰</span>
                            <span>$${sign.price.toLocaleString('es-AR')}</span>
                        </div>
                    ` : ''}
                    ${sign.hasAgent !== undefined ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85rem; color: ${sign.hasAgent ? '#ef4444' : '#10b981'};">
                            <span>${sign.hasAgent ? '🏢' : '✓'}</span>
                            <span>${sign.hasAgent ? 'Ya tiene inmobiliaria' : 'Sin inmobiliaria'}</span>
                        </div>
                    ` : ''}
                    ${sign.previouslyListed === true ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85rem; color: #f59e0b;">
                            <span>🔄</span>
                            <span>Estuvo antes a la venta</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.75rem;">
                        <span>📅</span>
                        <span>${dateStr}</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" onclick="Signs.showDetail('${sign.id}')">Ver detalle</button>
                        <button class="btn btn-sm btn-secondary" onclick="Signs.edit('${sign.id}')">Editar</button>
                        ${!sign.contacted ? `
                            <button class="btn btn-sm btn-primary" onclick="Signs.markContacted('${sign.id}')">Marcar contactado</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    openModal(sign = null) {
        this.currentPhotos = sign?.photos || [];
        const isEdit = !!sign;

        this.modal.querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h2>${isEdit ? 'Editar Cartel' : 'Nuevo Cartel'}</h2>
                <button class="modal-close" onclick="Signs.closeModal()">&times;</button>
            </div>
            <form id="signForm" class="modal-body">
                <input type="hidden" id="signId" value="${sign?.id || ''}">
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo de Operación *</label>
                        <select id="signType" class="form-control" required>
                            <option value="venta" ${sign?.type === 'venta' ? 'selected' : ''}>🔴 Venta</option>
                            <option value="alquiler" ${sign?.type === 'alquiler' ? 'selected' : ''}>🔵 Alquiler</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Teléfono del Cartel *</label>
                        <input type="tel" id="signPhone" class="form-control" value="${sign?.phone || ''}" placeholder="Ej: 11-1234-5678" required>
                    </div>
                </div>

                <div class="form-group">
                    <label>Dirección / Ubicación</label>
                    <input type="text" id="signAddress" class="form-control" value="${sign?.address || ''}" placeholder="Ej: Av. Corrientes 1234, CABA">
                </div>

                <div class="form-group">
                    <label>Zona / Barrio</label>
                    <input type="text" id="signNeighborhood" class="form-control" value="${sign?.neighborhood || ''}" placeholder="Ej: Palermo, cerca de plaza, zona residencial...">
                </div>

                <div class="form-group">
                    <label>Fotos del Cartel</label>
                    <div class="image-upload-zone" id="signPhotoZone" style="border: 2px dashed var(--border-color); border-radius: 12px; padding: 2rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <input type="file" id="signPhotoInput" multiple accept="image/*" hidden>
                        <input type="file" id="signCameraInput" accept="image/*" capture="environment" hidden>
                        
                        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📷</div>
                        <p style="margin: 0; color: var(--text-secondary); margin-bottom: 1rem;">Arrastra fotos o selecciona:</p>
                        
                        <div style="display:flex; gap:0.5rem; justify-content:center;">
                             <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('signPhotoInput').click()">📁 Galería</button>
                             <button type="button" class="btn btn-sm btn-primary" onclick="document.getElementById('signCameraInput').click()">📷 Tomar Foto</button>
                        </div>
                        <div id="ocrStatus" style="display:none; color:var(--primary); font-size:0.85rem; margin-top:0.75rem; font-weight:500;">
                            🤖 Analizando imagen en busca de teléfono...
                        </div>
                    </div>
                    <div id="signPhotoPreview" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;"></div>
                </div>

                <div class="form-group">
                    <label>Ubicación en Mapa</label>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="text" id="signLocationSearch" class="form-control" placeholder="Buscar ciudad, barrio o dirección..." style="flex: 1;">
                        <button type="button" class="btn btn-secondary" onclick="Signs.searchLocation()" style="white-space: nowrap;">🔍 Buscar</button>
                    </div>
                    <div id="signMiniMap" style="height: 250px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color);"></div>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">Haz clic en el mapa para marcar la ubicación exacta</p>
                    <div class="form-row" style="margin-top: 0.5rem;">
                        <input type="text" id="signLat" class="form-control" value="${sign?.lat || ''}" placeholder="Latitud" style="font-size: 0.85rem;">
                        <input type="text" id="signLng" class="form-control" value="${sign?.lng || ''}" placeholder="Longitud" style="font-size: 0.85rem;">
                    </div>
                </div>

                <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-secondary);">Información de Contacto (opcional)</h3>

                <div class="form-row">
                    <div class="form-group">
                        <label>¿Ya contactado?</label>
                        <select id="signContacted" class="form-control">
                            <option value="false" ${!sign?.contacted ? 'selected' : ''}>⏳ No, pendiente</option>
                            <option value="true" ${sign?.contacted ? 'selected' : ''}>✅ Sí, ya contacté</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Fecha de Contacto</label>
                        <input type="date" id="signContactDate" class="form-control" value="${sign?.contactDate || ''}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre del Contacto</label>
                        <input type="text" id="signOwnerName" class="form-control" value="${sign?.ownerName || ''}" placeholder="Nombre completo">
                    </div>
                    <div class="form-group">
                        <label>Tipo de Contacto</label>
                        <select id="signContactType" class="form-control">
                            <option value="" ${!sign?.contactType ? 'selected' : ''}>Sin definir</option>
                            <option value="owner" ${sign?.contactType === 'owner' ? 'selected' : ''}>🏠 Dueño Directo</option>
                            <option value="manager" ${sign?.contactType === 'manager' ? 'selected' : ''}>🔑 Encargado</option>
                            <option value="agent" ${sign?.contactType === 'agent' ? 'selected' : ''}>🏢 Asesor Inmobiliario</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Precio</label>
                        <input type="number" id="signPrice" class="form-control" value="${sign?.price || ''}" placeholder="Ej: 150000">
                    </div>
                    <div class="form-group">
                        <label>¿Estuvo antes a la venta?</label>
                        <select id="signPreviouslyListed" class="form-control">
                            <option value="" ${sign?.previouslyListed === undefined || sign?.previouslyListed === '' ? 'selected' : ''}>No sé</option>
                            <option value="false" ${sign?.previouslyListed === false ? 'selected' : ''}>No, primera vez</option>
                            <option value="true" ${sign?.previouslyListed === true ? 'selected' : ''}>Sí, estuvo antes</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" id="previousListingInfoGroup" style="display: ${sign?.previouslyListed === true ? 'block' : 'none'};">
                    <label>Detalles del listado anterior</label>
                    <input type="text" id="signPreviousListingInfo" class="form-control" value="${sign?.previousListingInfo || ''}" placeholder="Ej: Hace 6 meses, con otra inmobiliaria...">
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>¿Trabaja con inmobiliaria?</label>
                        <select id="signHasAgent" class="form-control">
                            <option value="" ${sign?.hasAgent === undefined ? 'selected' : ''}>No sé / No pregunté</option>
                            <option value="false" ${sign?.hasAgent === false ? 'selected' : ''}>✅ No, está disponible</option>
                            <option value="true" ${sign?.hasAgent === true ? 'selected' : ''}>🏢 Sí, ya tiene agente</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Info de Inmobiliaria</label>
                        <input type="text" id="signAgentInfo" class="form-control" value="${sign?.agentInfo || ''}" placeholder="Nombre de la inmobiliaria">
                    </div>
                </div>

                <div class="form-group">
                    <label>Notas Adicionales</label>
                    <textarea id="signNotes" class="form-control" rows="3" placeholder="Cualquier información adicional...">${sign?.notes || ''}</textarea>
                </div>

                <div id="customFieldsContainer"></div>

                <button type="button" class="btn btn-secondary" onclick="Signs.addCustomField()" style="margin-bottom: 1rem;">
                    <span>➕</span> Agregar Campo Personalizado
                </button>
            </form>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Signs.closeModal()">Cancelar</button>
                <button type="submit" form="signForm" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Agregar Cartel'}</button>
            </div>
        `;

        // Events
        const uploadZone = document.getElementById('signPhotoZone');
        const photoInput = document.getElementById('signPhotoInput');

        uploadZone.addEventListener('click', () => photoInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary)';
            uploadZone.style.background = 'rgba(245, 158, 11, 0.1)';
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = 'var(--border-color)';
            uploadZone.style.background = 'transparent';
        });
        uploadZone.addEventListener('drop', (e) => this.handleImageDrop(e));
        photoInput.addEventListener('change', (e) => {
            this.handleImages(e);
            if (e.target.files[0]) this.scanImageForPhone(e.target.files[0]);
        });

        // Camera event
        document.getElementById('signCameraInput').addEventListener('change', (e) => {
            this.handleImages(e);
            if (e.target.files[0]) this.scanImageForPhone(e.target.files[0]);
        });

        document.getElementById('signForm').addEventListener('submit', (e) => this.handleSubmit(e));

        // Toggle previous listing info field
        document.getElementById('signPreviouslyListed').addEventListener('change', (e) => {
            const group = document.getElementById('previousListingInfoGroup');
            group.style.display = e.target.value === 'true' ? 'block' : 'none';
        });

        this.modal.classList.add('active');
        this.renderPhotoPreview();

        // Init mini map after modal is visible
        setTimeout(() => {
            this.initMiniMap(sign?.lat, sign?.lng);

            // Auto-detect GPS location for new signs
            if (!isEdit && navigator.geolocation) {
                this.autoDetectLocation();
            }
        }, 100);

        // Load custom fields
        if (sign?.customFields) {
            const container = document.getElementById('customFieldsContainer');
            Object.entries(sign.customFields).forEach(([key, value]) => {
                this.addCustomField(key, value);
            });
        }
    },

    // Auto-detect GPS location from device
    autoDetectLocation() {
        App.showToast('📍 Obteniendo ubicación GPS...', 'info');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // Reverse Geocode
                this.reverseGeocode(lat, lng);

                // Update map
                if (this.miniMap) {
                    this.miniMap.setView([lat, lng], 16);

                    if (this.miniMapMarker) {
                        this.miniMap.removeLayer(this.miniMapMarker);
                    }
                    this.miniMapMarker = L.marker([lat, lng]).addTo(this.miniMap);
                }

                // Update input fields
                document.getElementById('signLat').value = lat.toFixed(6);
                document.getElementById('signLng').value = lng.toFixed(6);

                App.showToast('✓ Ubicación GPS detectada', 'success');
            },
            (error) => {
                console.log('GPS error:', error);
                App.showToast('No se pudo obtener ubicación GPS', 'warning');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    },

    async reverseGeocode(lat, lng) {
        const addressInput = document.getElementById('signAddress');
        // Only fill if empty
        if (addressInput && addressInput.value.trim() === '') {
            try {
                // Show loading indicator in placeholder?
                addressInput.placeholder = '📍 Buscando dirección...';

                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const data = await response.json();

                if (data && data.display_name) {
                    // Simpler address format: Road, House Number, Neighbourhood, City
                    // Nominatim returns messy display_name. data.address object is better.
                    let addr = data.display_name;

                    if (data.address) {
                        const parts = [];
                        if (data.address.road) parts.push(data.address.road);
                        if (data.address.house_number) parts.push(data.address.house_number);
                        if (data.address.neighbourhood) parts.push(data.address.neighbourhood);
                        if (data.address.city || data.address.town || data.address.village) parts.push(data.address.city || data.address.town || data.address.village);

                        if (parts.length > 0) addr = parts.join(', ');
                    }

                    addressInput.value = addr;
                    App.showToast('📍 Dirección completada desde el mapa', 'success');
                }
            } catch (error) {
                console.error('Geocoding error:', error);
            } finally {
                addressInput.placeholder = 'Ej: Av. Corrientes 1234, CABA';
            }
        }
    },

    closeModal() {
        this.modal.classList.remove('active');
        this.currentPhotos = [];
        if (this.miniMap) {
            this.miniMap.remove();
            this.miniMap = null;
        }
    },

    async handleImages(e) {
        const files = Array.from(e.target.files);
        let addedCount = 0;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await Storage.processImage(file);
                if (base64) {
                    this.currentPhotos.push(base64);
                    addedCount++;
                }
            }
        }

        // Clear input to allow re-selecting the same file
        e.target.value = '';

        if (addedCount > 0) {
            this.renderPhotoPreview();
            App.showToast(`📸 ${addedCount} foto(s) agregada(s)`, 'success');
        }
    },

    async handleImageDrop(e) {
        e.preventDefault();
        const zone = document.getElementById('signPhotoZone');
        zone.style.borderColor = 'var(--border-color)';
        zone.style.background = 'transparent';

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await Storage.processImage(file);
                this.currentPhotos.push(base64);
            }
        }
        this.renderPhotoPreview();
    },

    async handleImagePaste(e) {
        const items = Array.from(e.clipboardData?.items || []);
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                const base64 = await Storage.processImage(file);
                this.currentPhotos.push(base64);
                this.renderPhotoPreview();
                this.scanImageForPhone(file);
            }
        }
    },

    async scanImageForPhone(file) {
        // Simple OCR check
        if (typeof Tesseract === 'undefined') return;

        const status = document.getElementById('ocrStatus');
        if (status) status.style.display = 'block';

        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng');

            // Regex for numbers: 09xx xxx xxx or 021 xxx xxxx (allowing spaces/dashes)
            // Flexible pattern: (09\d|021|\+595) followed by 6-8 digits
            const phoneRegex = /(?:09[6-9]\d|021|\+595)[\s-]*\d{3}[\s-]*\d{3,4}/g;
            const matches = text.match(phoneRegex);

            if (matches && matches.length > 0) {
                // Clean detected number
                const foundNumber = matches[0].replace(/[^\d+]/g, ''); // keep digits and plus

                const currentPhone = document.getElementById('signPhone').value;

                // If field empty or user confirms replacement
                if (!currentPhone || confirm(`🤖 OCR detectó un número: ${matches[0]}\n\n¿Quieres usarlo?`)) {
                    document.getElementById('signPhone').value = matches[0]; // Use original format or foundNumber?
                    App.showToast('✓ Teléfono detectado', 'success');
                }
            } else {
                // Try searching just for 6+ digits if strict regex fails? 
                // No, too many false positives. Stick to prefix.
            }
        } catch (err) {
            console.error('OCR Error:', err);
        } finally {
            if (status) status.style.display = 'none';
        }
    },

    renderPhotoPreview() {
        const container = document.getElementById('signPhotoPreview');
        if (!container) return;

        container.innerHTML = this.currentPhotos.map((photo, idx) => `
            <div style="position: relative; width: 100px; height: 100px;">
                <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                <button type="button" onclick="Signs.removePhoto(${idx})" style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: #ef4444; color: white; border: none; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
        `).join('');
    },

    removePhoto(index) {
        this.currentPhotos.splice(index, 1);
        this.renderPhotoPreview();
    },

    initMiniMap(lat = null, lng = null) {
        const mapContainer = document.getElementById('signMiniMap');
        if (!mapContainer || typeof L === 'undefined') return;

        // Default to Asunción, Paraguay
        const defaultLat = -25.2637;
        const defaultLng = -57.5759;
        const initialLat = lat || defaultLat;
        const initialLng = lng || defaultLng;

        this.miniMap = L.map('signMiniMap').setView([initialLat, initialLng], lat ? 16 : 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.miniMap);

        if (lat && lng) {
            this.miniMapMarker = L.marker([lat, lng]).addTo(this.miniMap);
        }

        // Click to place marker
        this.miniMap.on('click', (e) => {
            const { lat, lng } = e.latlng;

            if (this.miniMapMarker) {
                this.miniMap.removeLayer(this.miniMapMarker);
            }

            this.miniMapMarker = L.marker([lat, lng]).addTo(this.miniMap);
            document.getElementById('signLat').value = lat.toFixed(6);
            document.getElementById('signLng').value = lng.toFixed(6);

            // Reverse Geocode
            this.reverseGeocode(lat, lng);
        });

        // Enter key on search field
        document.getElementById('signLocationSearch')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchLocation();
            }
        });
    },

    async searchLocation() {
        const searchInput = document.getElementById('signLocationSearch');
        const query = searchInput?.value?.trim();
        if (!query) return;

        const btn = searchInput.nextElementSibling;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        btn.disabled = true;

        try {
            // Use Nominatim (OpenStreetMap) free geocoding API
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            const results = await response.json();

            if (results.length > 0) {
                const { lat, lon, display_name } = results[0];
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                // Move map to location
                this.miniMap.setView([latitude, longitude], 15);

                // Place marker
                if (this.miniMapMarker) {
                    this.miniMap.removeLayer(this.miniMapMarker);
                }
                this.miniMapMarker = L.marker([latitude, longitude]).addTo(this.miniMap);

                // Update lat/lng fields
                document.getElementById('signLat').value = latitude.toFixed(6);
                document.getElementById('signLng').value = longitude.toFixed(6);

                App.showToast(`📍 ${display_name.split(',').slice(0, 2).join(',')}`, 'success');
            } else {
                App.showToast('No se encontró la ubicación', 'error');
            }
        } catch (error) {
            console.error('Error buscando ubicación:', error);
            App.showToast('Error al buscar ubicación', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async handleSubmit(e) {
        e.preventDefault();

        const hasAgentVal = document.getElementById('signHasAgent').value;
        const previouslyListedVal = document.getElementById('signPreviouslyListed').value;

        // Collect custom fields
        const customFields = {};
        document.querySelectorAll('.custom-field-row').forEach(row => {
            const key = row.querySelector('.custom-field-key')?.value?.trim();
            const value = row.querySelector('.custom-field-value')?.value?.trim();
            if (key && value) {
                customFields[key] = value;
            }
        });

        const sign = {
            id: document.getElementById('signId').value || null,
            type: document.getElementById('signType').value,
            phone: document.getElementById('signPhone').value.trim(),
            address: document.getElementById('signAddress').value.trim(),
            neighborhood: document.getElementById('signNeighborhood').value.trim(),
            photos: this.currentPhotos,
            lat: parseFloat(document.getElementById('signLat').value) || null,
            lng: parseFloat(document.getElementById('signLng').value) || null,
            contacted: document.getElementById('signContacted').value === 'true',
            contactDate: document.getElementById('signContactDate').value || null,
            ownerName: document.getElementById('signOwnerName').value.trim(),
            contactType: document.getElementById('signContactType').value || null,
            price: parseFloat(document.getElementById('signPrice').value) || null,
            previouslyListed: previouslyListedVal === '' ? undefined : previouslyListedVal === 'true',
            previousListingInfo: document.getElementById('signPreviousListingInfo').value.trim(),
            hasAgent: hasAgentVal === '' ? undefined : hasAgentVal === 'true',
            agentInfo: document.getElementById('signAgentInfo').value.trim(),
            notes: document.getElementById('signNotes').value.trim(),
            customFields: Object.keys(customFields).length > 0 ? customFields : undefined
        };

        // Secretary restriction: can only add NEW items (not edit), and they go to pending
        if (Storage.isSecretary()) {
            if (sign.id) {
                App.showToast('❌ No tienes permiso para editar. Solo puedes agregar nuevos datos.', 'error');
                return;
            }
            await Storage.savePending('sign', sign);
            this.closeModal();
            this.render();
            return;
        }

        Storage.saveSign(sign);
        this.closeModal();
        this.render();
        App.showToast(sign.id ? 'Cartel actualizado' : 'Cartel agregado', 'success');
    },

    edit(id) {
        // Secretary restriction: cannot edit
        if (Storage.isSecretary()) {
            App.showToast('❌ No tienes permiso para editar. Solo puedes agregar nuevos datos.', 'error');
            return;
        }
        const sign = Storage.getSigns().find(s => s.id === id);
        if (sign) this.openModal(sign);
    },

    delete(id) {
        // Secretary restriction: cannot delete
        if (Storage.isSecretary()) {
            App.showToast('❌ No tienes permiso para eliminar datos.', 'error');
            return;
        }
        if (confirm('¿Eliminar este cartel?')) {
            Storage.deleteSign(id);
            this.render();
            App.showToast('Cartel eliminado', 'success');
        }
    },

    markContacted(id) {
        const sign = Storage.getSigns().find(s => s.id === id);
        if (sign) {
            sign.contacted = true;
            sign.contactDate = new Date().toISOString().split('T')[0];
            Storage.saveSign(sign);
            this.render();
            App.showToast('Marcado como contactado', 'success');
        }
    },

    showDetail(id) {
        const sign = Storage.getSigns().find(s => s.id === id);
        if (!sign) return;

        const detailModal = document.getElementById('detailModal');
        const typeColor = sign.type === 'venta' ? '#ef4444' : '#3b82f6';
        const typeIcon = sign.type === 'venta' ? '🔴' : '🔵';
        const typeLabel = sign.type === 'venta' ? 'VENTA' : 'ALQUILER';

        detailModal.querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h2><span style="color: ${typeColor}">${typeIcon}</span> Cartel de ${typeLabel}</h2>
                <button class="modal-close" onclick="document.getElementById('detailModal').classList.remove('active')">&times;</button>
            </div>
            <div class="modal-body">
                ${sign.photos?.length ? `
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                        ${sign.photos.map(p => `<img src="${p}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="App.openLightbox('${p}')">`).join('')}
                    </div>
                ` : ''}
                
                <div class="detail-grid" style="display: grid; gap: 1rem;">
                    <div class="detail-item">
                        <strong>📞 Teléfono:</strong>
                        <a href="tel:${sign.phone}" style="color: var(--primary);">${sign.phone}</a>
                    </div>
                    ${sign.address ? `<div class="detail-item"><strong>📍 Dirección:</strong> ${sign.address}</div>` : ''}
                    ${sign.neighborhood ? `<div class="detail-item"><strong>🏘️ Zona/Barrio:</strong> ${sign.neighborhood}</div>` : ''}
                    <div class="detail-item"><strong>Estado:</strong> ${sign.contacted ? '✅ Contactado' : '⏳ Pendiente'}</div>
                    ${sign.contactDate ? `<div class="detail-item"><strong>📅 Fecha Contacto:</strong> ${sign.contactDate}</div>` : ''}
                    ${sign.ownerName || sign.contactType ? `
                        <div class="detail-item">
                            <strong>👤 Contacto:</strong> 
                            ${sign.ownerName || 'Sin nombre'}
                            ${sign.contactType ? `<span style="background: var(--bg-secondary); padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin-left: 0.5rem;">
                                ${sign.contactType === 'owner' ? '🏠 Dueño' : sign.contactType === 'manager' ? '🔑 Encargado' : '🏢 Asesor'}
                            </span>` : ''}
                        </div>
                    ` : ''}
                    ${sign.price ? `<div class="detail-item"><strong>💰 Precio:</strong> $${sign.price.toLocaleString('es-AR')}</div>` : ''}
                    ${sign.previouslyListed !== undefined ? `
                        <div class="detail-item">
                            <strong>🔄 Listado Previo:</strong> 
                            ${sign.previouslyListed ? `Sí, estuvo antes${sign.previousListingInfo ? ` - ${sign.previousListingInfo}` : ''}` : 'No, primera vez'}
                        </div>
                    ` : ''}
                    ${sign.hasAgent !== undefined ? `<div class="detail-item"><strong>🏢 Inmobiliaria:</strong> ${sign.hasAgent ? 'Sí - ' + (sign.agentInfo || 'Sin dato') : 'No, disponible'}</div>` : ''}
                    ${sign.notes ? `<div class="detail-item"><strong>📝 Notas:</strong><br>${sign.notes}</div>` : ''}
                    ${sign.customFields ? `
                        <hr style="border: none; border-top: 1px solid var(--border-color);">
                        <h4 style="margin: 0.5rem 0;">Campos Personalizados</h4>
                        ${Object.entries(sign.customFields).map(([k, v]) => `<div class="detail-item"><strong>${k}:</strong> ${v}</div>`).join('')}
                    ` : ''}
                </div>

                ${sign.lat && sign.lng ? `
                    <div id="detailSignMap" style="height: 200px; margin-top: 1.5rem; border-radius: 12px; overflow: hidden;"></div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Signs.delete('${sign.id}'); document.getElementById('detailModal').classList.remove('active');">Eliminar</button>
                <button class="btn btn-secondary" onclick="document.getElementById('detailModal').classList.remove('active'); Signs.edit('${sign.id}');">Editar</button>
                ${!sign.contacted ? `<button class="btn btn-primary" onclick="Signs.markContacted('${sign.id}'); document.getElementById('detailModal').classList.remove('active');">Marcar Contactado</button>` : ''}
            </div>
        `;

        detailModal.classList.add('active');

        // Init detail map
        if (sign.lat && sign.lng) {
            setTimeout(() => {
                const detailMap = L.map('detailSignMap').setView([sign.lat, sign.lng], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(detailMap);
                L.marker([sign.lat, sign.lng]).addTo(detailMap);
            }, 100);
        }
    },

    addCustomField(key = '', value = '') {
        const container = document.getElementById('customFieldsContainer');
        const row = document.createElement('div');
        row.className = 'custom-field-row form-row';
        row.style.marginBottom = '0.75rem';
        row.innerHTML = `
            <input type="text" class="form-control custom-field-key" value="${key}" placeholder="Nombre del campo">
            <input type="text" class="form-control custom-field-value" value="${value}" placeholder="Valor">
            <button type="button" class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()" style="flex-shrink: 0;">✕</button>
        `;
        container.appendChild(row);
    },

    showMapView() {
        const signs = Storage.getSigns();
        const detailModal = document.getElementById('detailModal');

        detailModal.querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h2>🗺️ Mapa de Carteles</h2>
                <button class="modal-close" onclick="document.getElementById('detailModal').classList.remove('active')">&times;</button>
            </div>
            <div class="modal-body" style="padding: 0;">
                <div id="signsFullMap" style="height: 500px;"></div>
            </div>
            <div class="modal-footer">
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <span>🔴 Venta</span>
                    <span>🔵 Alquiler</span>
                    <span>| ✅ Contactado</span>
                    <span>⏳ Pendiente</span>
                </div>
                <button class="btn btn-secondary" onclick="document.getElementById('detailModal').classList.remove('active')">Cerrar</button>
            </div>
        `;

        detailModal.classList.add('active');

        setTimeout(() => {
            // Default to Asunción, Paraguay
            const fullMap = L.map('signsFullMap').setView([-25.2637, -57.5759], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(fullMap);

            const signsWithLocation = signs.filter(s => s.lat && s.lng);

            signsWithLocation.forEach(sign => {
                const color = sign.type === 'venta' ? '#ef4444' : '#3b82f6';
                const statusIcon = sign.contacted ? '✅' : '⏳';

                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                        ${sign.type === 'venta' ? '🏠' : '🔑'}
                    </div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                const marker = L.marker([sign.lat, sign.lng], { icon }).addTo(fullMap);
                marker.bindPopup(`
                    <div style="min-width: 200px;">
                        <strong>${sign.type === 'venta' ? '🔴 Venta' : '🔵 Alquiler'}</strong> ${statusIcon}<br>
                        📞 ${sign.phone || 'Sin tel.'}<br>
                        ${sign.address ? `📍 ${sign.address}<br>` : ''}
                        ${sign.ownerName ? `👤 ${sign.ownerName}<br>` : ''}
                        ${sign.price ? `💰 $${sign.price.toLocaleString('es-AR')}<br>` : ''}
                        <button onclick="Signs.showDetail('${sign.id}'); document.getElementById('detailModal').classList.remove('active');" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; cursor: pointer;">Ver detalle</button>
                    </div>
                `);
            });

            // Fit bounds if there are markers
            if (signsWithLocation.length > 0) {
                const group = L.featureGroup(signsWithLocation.map(s => L.marker([s.lat, s.lng])));
                fullMap.fitBounds(group.getBounds().pad(0.1));
            }
        }, 100);
    },

    // ===== QUICK SIGN MODE =====
    quickModeData: {
        type: 'venta',
        phone: '',
        address: '',
        lat: null,
        lng: null,
        photos: []
    },
    quickMapInstance: null,
    recognition: null,
    isListening: false,

    openQuickMode() {
        // Reset quick mode data
        this.quickModeData = {
            type: 'venta',
            phone: '',
            address: '',
            lat: null,
            lng: null,
            photos: []
        };
        this.quickMapInstance = null;

        // Create fullscreen overlay
        const overlay = document.createElement('div');
        overlay.id = 'quickSignOverlay';
        overlay.className = 'quick-sign-overlay';
        overlay.innerHTML = `
            <div class="quick-sign-container">
                <div class="quick-sign-header">
                    <button class="quick-close-btn" onclick="Signs.closeQuickMode()">✕</button>
                    <h2>⚡ Cartel Rápido</h2>
                    <div id="quickGpsStatus" class="quick-gps-status">📍 Buscando GPS...</div>
                </div>

                <div class="quick-sign-body">
                    <!-- Type Toggle -->
                    <div class="quick-type-toggle">
                        <button id="quickTypeVenta" class="quick-type-btn active" onclick="Signs.setQuickType('venta')">
                            🔴 VENTA
                        </button>
                        <button id="quickTypeAlquiler" class="quick-type-btn" onclick="Signs.setQuickType('alquiler')">
                            🔵 ALQUILER
                        </button>
                    </div>

                    <!-- Photo Capture -->
                    <div class="quick-photo-section">
                        <input type="file" id="quickCameraInput" accept="image/*" capture="environment" hidden>
                        <div id="quickPhotoPreview" style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; min-height: 80px;">
                            <div class="quick-add-photo-btn" onclick="document.getElementById('quickCameraInput').click()" style="width: 80px; height: 80px; background: rgba(255,255,255,0.1); border: 2px dashed rgba(255,255,255,0.3); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; flex-shrink: 0;">
                                📷
                            </div>
                            <!-- Photos will appear here -->
                        </div>
                    </div>

                    <!-- Phone Input with Voice -->
                    <div class="quick-input-group">
                        <label>📞 Teléfono</label>
                        <div class="quick-input-row">
                            <input type="tel" id="quickPhone" class="quick-input" placeholder="Ej: 0981 123 456">
                            <button class="quick-voice-btn" onclick="Signs.startVoiceDictation('phone')" title="Dictar teléfono">
                                <span id="voiceBtnPhone">🎤</span>
                            </button>
                        </div>
                    </div>

                    <!-- Address Input with Voice -->
                    <div class="quick-input-group">
                        <label>📍 Dirección</label>
                        <div class="quick-input-row">
                            <input type="text" id="quickAddress" class="quick-input" placeholder="Detectada automáticamente o dicta...">
                            <button class="quick-voice-btn" onclick="Signs.startVoiceDictation('address')" title="Dictar dirección">
                                <span id="voiceBtnAddress">🎤</span>
                            </button>
                        </div>
                    </div>

                    <!-- GPS Map Visual -->
                    <div id="quickMap" style="height: 180px; width: 100%; border-radius: 12px; margin-top: 1rem; display: none; border: 2px solid var(--border-color);"></div>
                    <div id="quickCoords" style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); text-align: center; margin-top: 0.5rem; display: none;"></div>

                    <!-- Voice Status -->
                    <div id="voiceStatus" class="quick-voice-status" style="display: none;">
                        <span class="voice-pulse"></span> Escuchando...
                    </div>

                    <!-- GPS Coords (hidden but needed) -->
                    <input type="hidden" id="quickLat">
                    <input type="hidden" id="quickLng">
                </div>

                <div class="quick-sign-footer">
                    <button class="quick-save-btn" onclick="Signs.saveQuickSign()">
                        ✅ GUARDAR CARTEL
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Bind camera event
        document.getElementById('quickCameraInput').addEventListener('change', (e) => this.handleQuickPhoto(e));

        // Auto-detect GPS immediately
        this.autoDetectQuickGPS();

        // Initialize speech recognition
        this.initSpeechRecognition();
    },

    closeQuickMode() {
        const overlay = document.getElementById('quickSignOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
        if (this.quickMapInstance) {
            this.quickMapInstance.remove();
            this.quickMapInstance = null;
        }

        if (this.recognition) {
            this.recognition.abort();
            this.isListening = false;
        }
    },

    setQuickType(type) {
        this.quickModeData.type = type;
        document.getElementById('quickTypeVenta').classList.toggle('active', type === 'venta');
        document.getElementById('quickTypeAlquiler').classList.toggle('active', type === 'alquiler');
    },

    async handleQuickPhoto(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Show loading state?
        const btn = document.querySelector('.quick-add-photo-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '⏳';

        let addedCount = 0;

        try {
            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    const base64 = await Storage.processImage(file);
                    if (base64) {
                        this.quickModeData.photos.push(base64);
                        addedCount++;
                        // OCR only on first image?
                        if (this.quickModeData.photos.length === 1) {
                            this.scanQuickPhoneOCR(file);
                        }
                    }
                }
            }

            this.renderQuickPhotos();
            if (addedCount > 0) {
                App.showToast(`📸 ${addedCount} foto(s) agregada(s)`, 'success');
            }
        } catch (err) {
            console.error('Photo error:', err);
            App.showToast('Error procesando fotos', 'error');
        } finally {
            btn.innerHTML = originalContent;
            e.target.value = ''; // Reset input
        }
    },

    renderQuickPhotos() {
        const container = document.getElementById('quickPhotoPreview');
        if (!container) return;

        // Keep the add button
        const addBtn = container.querySelector('.quick-add-photo-btn');

        // Clear everything after the button
        while (addBtn.nextSibling) {
            addBtn.nextSibling.remove();
        }

        // Append photos
        this.quickModeData.photos.forEach((photo, idx) => {
            const div = document.createElement('div');
            div.style.cssText = 'position: relative; width: 80px; height: 80px; flex-shrink: 0;';
            div.innerHTML = `
                <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
                <button onclick="Signs.removeQuickPhoto(${idx})" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #ef4444; border-radius: 50%; border: none; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer;">×</button>
            `;
            container.appendChild(div);
        });
    },

    removeQuickPhoto(index) {
        this.quickModeData.photos.splice(index, 1);
        this.renderQuickPhotos();
    },

    async scanQuickPhoneOCR(file) {
        if (typeof Tesseract === 'undefined') return;

        const phoneInput = document.getElementById('quickPhone');
        if (phoneInput.value.trim()) return; // Already has phone

        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng');
            const phoneRegex = /(?:09[6-9]\d|021|\+595)[\s-]*\d{3}[\s-]*\d{3,4}/g;
            const matches = text.match(phoneRegex);

            if (matches && matches.length > 0) {
                phoneInput.value = matches[0];
                this.quickModeData.phone = matches[0];
                App.showToast('📞 Teléfono detectado por OCR', 'success');
            }
        } catch (err) {
            console.error('OCR error:', err);
        }
    },

    autoDetectQuickGPS() {
        const statusEl = document.getElementById('quickGpsStatus');

        if (!navigator.geolocation) {
            statusEl.innerHTML = '❌ GPS no disponible';
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                this.quickModeData.lat = lat;
                this.quickModeData.lng = lng;
                document.getElementById('quickLat').value = lat;
                document.getElementById('quickLng').value = lng;

                statusEl.innerHTML = '✅ GPS detectado';

                // Show Map & Coords
                const mapEl = document.getElementById('quickMap');
                const coordsEl = document.getElementById('quickCoords');

                if (mapEl && typeof L !== 'undefined') {
                    mapEl.style.display = 'block';
                    if (coordsEl) {
                        coordsEl.style.display = 'block';
                        coordsEl.textContent = `📍 Lat: ${lat.toFixed(5)} | Lng: ${lng.toFixed(5)}`;
                    }

                    if (this.quickMapInstance) {
                        this.quickMapInstance.remove();
                    }

                    setTimeout(() => {
                        this.quickMapInstance = L.map('quickMap', {
                            zoomControl: false,
                            dragging: false,
                            scrollWheelZoom: false,
                            doubleClickZoom: false,
                            boxZoom: false,
                            attributionControl: false
                        }).setView([lat, lng], 17);

                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.quickMapInstance);
                        L.marker([lat, lng]).addTo(this.quickMapInstance);

                        this.quickMapInstance.invalidateSize();
                    }, 100);
                }
                statusEl.style.color = '#10b981';

                // Reverse geocode for address
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                    const data = await response.json();

                    if (data && data.address) {
                        const parts = [];
                        if (data.address.road) parts.push(data.address.road);
                        if (data.address.house_number) parts.push(data.address.house_number);
                        if (data.address.neighbourhood) parts.push(data.address.neighbourhood);
                        if (data.address.city || data.address.town) parts.push(data.address.city || data.address.town);

                        const addressInput = document.getElementById('quickAddress');
                        if (!addressInput.value.trim() && parts.length > 0) {
                            addressInput.value = parts.join(', ');
                            this.quickModeData.address = addressInput.value;
                        }
                    }
                } catch (err) {
                    console.error('Geocode error:', err);
                }
            },
            (error) => {
                statusEl.innerHTML = '⚠️ No se pudo obtener GPS';
                statusEl.style.color = '#f59e0b';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    },

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.log('Speech Recognition not supported');
            // Hide voice buttons if not supported
            document.querySelectorAll('.quick-voice-btn').forEach(btn => btn.style.display = 'none');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'es-PY'; // Spanish Paraguay
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.handleVoiceResult(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            this.stopVoiceDictation();
            if (event.error !== 'aborted') {
                App.showToast('Error de voz: ' + event.error, 'error');
            }
        };

        this.recognition.onend = () => {
            this.stopVoiceDictation();
        };
    },

    currentVoiceField: null,

    startVoiceDictation(field) {
        if (!this.recognition) {
            App.showToast('Dictado por voz no soportado', 'error');
            return;
        }

        if (this.isListening) {
            this.recognition.abort();
            this.stopVoiceDictation();
            return;
        }

        this.currentVoiceField = field;
        this.isListening = true;

        // Update UI
        const voiceStatus = document.getElementById('voiceStatus');
        voiceStatus.style.display = 'flex';

        const btnIcon = document.getElementById(field === 'phone' ? 'voiceBtnPhone' : 'voiceBtnAddress');
        btnIcon.textContent = '🔴';
        btnIcon.parentElement.classList.add('listening');

        try {
            this.recognition.start();
        } catch (e) {
            console.error('Recognition start error:', e);
            this.stopVoiceDictation();
        }
    },

    stopVoiceDictation() {
        this.isListening = false;

        const voiceStatus = document.getElementById('voiceStatus');
        if (voiceStatus) voiceStatus.style.display = 'none';

        // Reset all buttons
        document.querySelectorAll('.quick-voice-btn').forEach(btn => {
            btn.classList.remove('listening');
            const icon = btn.querySelector('span');
            if (icon) icon.textContent = '🎤';
        });
    },

    handleVoiceResult(transcript) {
        const field = this.currentVoiceField;
        let processedText = transcript.trim();

        if (field === 'phone') {
            // Extract numbers from voice for phone
            // Handle spoken numbers like "cero nueve ocho uno" -> "0981"
            const numberWords = {
                'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
                'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9'
            };

            let phoneNumber = processedText.toLowerCase();
            Object.entries(numberWords).forEach(([word, digit]) => {
                phoneNumber = phoneNumber.replace(new RegExp(word, 'g'), digit);
            });

            // Remove non-digits except spaces
            phoneNumber = phoneNumber.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ').trim();

            document.getElementById('quickPhone').value = phoneNumber;
            this.quickModeData.phone = phoneNumber;
            App.showToast(`📞 Teléfono: ${phoneNumber}`, 'success');
        } else {
            // Address - use as-is
            document.getElementById('quickAddress').value = processedText;
            this.quickModeData.address = processedText;
            App.showToast(`📍 Dirección: ${processedText}`, 'success');
        }

        this.stopVoiceDictation();
    },

    saveQuickSign() {
        // Get latest values from inputs
        const phone = document.getElementById('quickPhone').value.trim();
        const address = document.getElementById('quickAddress').value.trim();

        if (!phone) {
            App.showToast('❌ El teléfono es obligatorio', 'error');
            document.getElementById('quickPhone').focus();
            return;
        }

        const sign = {
            type: this.quickModeData.type,
            phone: phone,
            address: address,
            lat: parseFloat(document.getElementById('quickLat').value) || null,
            lng: parseFloat(document.getElementById('quickLng').value) || null,
            photos: this.quickModeData.photos,
            contacted: false,
            createdAt: new Date().toISOString(),
            quickCapture: true
        };

        // Secretary restriction
        if (Storage.isSecretary()) {
            Storage.savePending('sign', sign);
        } else {
            Storage.saveSign(sign);
        }

        this.closeQuickMode();
        this.render();
        App.showToast('⚡ Cartel guardado rápidamente!', 'success');
    }
};