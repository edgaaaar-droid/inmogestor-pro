// Clients Manager
const Clients = {
    container: null,
    modal: null,

    init() {
        this.container = document.getElementById('clientsContainer');
        this.modal = document.getElementById('clientModal');
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('addClientBtn')?.addEventListener('click', () => this.openModal());
        document.getElementById('clientForm')?.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('filterClientType')?.addEventListener('change', () => this.render());
        document.getElementById('filterClientStatus')?.addEventListener('change', () => this.render());
    },

    injectHeaderButtons() {
        const headerActions = document.querySelector('#section-clients .section-header');
        if (headerActions && !document.getElementById('clientExcelBtnGroup')) {
            const btnGroup = document.createElement('div');
            btnGroup.id = 'clientExcelBtnGroup';
            btnGroup.className = 'btn-group';
            btnGroup.style.marginRight = '1rem';
            btnGroup.innerHTML = `
                 <button class="btn btn-secondary btn-sm" onclick="Clients.downloadTemplate()">📄 Plantilla</button>
                 <button class="btn btn-secondary btn-sm" onclick="Clients.triggerImport()">📥 Importar</button>
              `;
            if (headerActions.lastElementChild) {
                headerActions.insertBefore(btnGroup, headerActions.lastElementChild);
            } else {
                headerActions.appendChild(btnGroup);
            }
        }
    },

    render() {
        let clients = Storage.getClients();
        const typeFilter = document.getElementById('filterClientType')?.value;
        const statusFilter = document.getElementById('filterClientStatus')?.value;

        if (typeFilter) clients = clients.filter(c => c.type === typeFilter);
        if (statusFilter) clients = clients.filter(c => c.status === statusFilter);

        if (clients.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <p class="empty-state-text">No hay clientes registrados</p>
                    <button class="btn btn-primary" onclick="Clients.openModal()">Agregar primer cliente</button>
                    <div style="margin-top:1rem;">
                        <button class="btn btn-secondary btn-sm" onclick="Clients.downloadTemplate()">📄 Descargar Plantilla</button>
                        <button class="btn btn-secondary btn-sm" onclick="Clients.triggerImport()">📥 Importar Masivo</button>
                    </div>
                </div>
            `;
            // Also ensure buttons are in header for when state is NOT empty
            this.injectHeaderButtons();
            return;
        }

        this.injectHeaderButtons();

        this.container.innerHTML = clients.map(c => this.renderCard(c)).join('');

        this.container.innerHTML = clients.map(c => this.renderCard(c)).join('');
        this.container.querySelectorAll('.client-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('a')) this.showDetail(card.dataset.id);
            });
        });
    },

    renderCard(client) {
        const typeLabels = { buyer: 'Comprador', seller: 'Vendedor', tenant: 'Inquilino', landlord: 'Propietario' };
        const statusLabels = { active: 'Activo', interested: 'Interesado', closed: 'Cerrado' };
        const initials = client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        return `
            <div class="client-card" data-id="${client.id}">
                <div class="client-info">
                    <div class="client-avatar">${initials}</div>
                    <h3 class="client-name">${client.name}</h3>
                    <p class="client-type">${typeLabels[client.type] || client.type} • ${statusLabels[client.status] || client.status}</p>
                    <div class="client-contact">
                        <a href="tel:${client.phone}" onclick="event.stopPropagation()">📞 ${client.phone}</a>
                        ${client.email ? `<a href="mailto:${client.email}" onclick="event.stopPropagation()">✉️ ${client.email}</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    openModal(client = null) {
        const form = document.getElementById('clientForm');
        const title = document.getElementById('clientModalTitle');

        if (client) {
            title.textContent = 'Editar Cliente';
            document.getElementById('clientId').value = client.id;
            document.getElementById('clientName').value = client.name || '';
            document.getElementById('clientType').value = client.type || '';
            document.getElementById('clientPhone').value = client.phone || '';
            document.getElementById('clientEmail').value = client.email || '';
            document.getElementById('clientStatus').value = client.status || 'active';
            document.getElementById('clientBudget').value = client.budget || '';
            document.getElementById('clientPreferences').value = client.preferences || '';
            document.getElementById('clientNotes').value = client.notes || '';
        } else {
            title.textContent = 'Nuevo Cliente';
            form.reset();
            document.getElementById('clientId').value = '';
        }

        this.modal.classList.add('active');
    },

    closeModal() {
        this.modal.classList.remove('active');
    },

    async handleSubmit(e) {
        e.preventDefault();

        const client = {
            id: document.getElementById('clientId').value || null,
            name: document.getElementById('clientName').value,
            type: document.getElementById('clientType').value,
            phone: document.getElementById('clientPhone').value,
            email: document.getElementById('clientEmail').value,
            status: document.getElementById('clientStatus').value,
            budget: document.getElementById('clientBudget').value,
            preferences: document.getElementById('clientPreferences').value,
            notes: document.getElementById('clientNotes').value
        };

        // Secretary restriction: can only add NEW items (not edit), and they go to pending
        if (Storage.isSecretary()) {
            if (client.id) {
                App.showToast('❌ No tienes permiso para editar. Solo puedes agregar nuevos datos.', 'error');
                return;
            }
            await Storage.savePending('client', client);
            this.closeModal();
            this.render();
            return;
        }

        Storage.saveClient(client);
        this.closeModal();
        this.render();
        App.updateDashboard();
        Followups.updateClientSelect();
        App.showToast('Cliente guardado correctamente', 'success');
    },

    showDetail(id) {
        const client = Storage.getClients().find(c => c.id === id);
        if (!client) return;

        const modal = document.getElementById('detailModal');
        const content = modal.querySelector('.modal-content');
        const typeLabels = { buyer: 'Comprador', seller: 'Vendedor', tenant: 'Inquilino', landlord: 'Propietario' };
        const statusLabels = { active: 'Activo', interested: 'Interesado', closed: 'Cerrado' };
        const initials = client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        // Get client followups
        const followups = Storage.getFollowups().filter(f => f.clientId === id);

        content.innerHTML = `
            <div class="modal-header">
                <h2>${client.name}</h2>
                <button class="modal-close" onclick="App.closeModal('detailModal')">×</button>
            </div>
            <div class="modal-body">
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                    <div class="client-avatar" style="width:80px;height:80px;font-size:2rem;">${initials}</div>
                    <div>
                        <h3 style="margin:0;">${client.name}</h3>
                        <p style="margin:0.25rem 0;color:var(--text-secondary);">${typeLabels[client.type]} • ${statusLabels[client.status]}</p>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;">
                    <div>
                        <strong>Teléfono:</strong><br>
                        <a href="tel:${client.phone}" class="btn btn-primary" style="margin-top:0.5rem;">📞 Llamar: ${client.phone}</a>
                    </div>
                    ${client.email ? `<div><strong>Email:</strong><br><a href="mailto:${client.email}">${client.email}</a></div>` : ''}
                    ${client.budget ? `<div><strong>Presupuesto:</strong><br>${client.budget}</div>` : ''}
                    ${client.preferences ? `<div class="full-width"><strong>Preferencias:</strong><br>${client.preferences}</div>` : ''}
                    ${client.notes ? `<div class="full-width"><strong>Notas:</strong><br>${client.notes}</div>` : ''}
                </div>
                ${followups.length ? `
                    <h4 style="margin-top:1.5rem;">Seguimientos (${followups.length})</h4>
                    <div class="followup-list">
                        ${followups.map(f => `
                            <div class="followup-item">
                                <div><strong>${f.title}</strong><br><small>${f.date} ${f.time || ''}</small></div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeModal('detailModal')">Cerrar</button>
                <button class="btn btn-warning" onclick="Clients.edit('${client.id}')">Editar</button>
                <button class="btn btn-danger" onclick="Clients.delete('${client.id}')">Eliminar</button>
            </div>
        `;

        modal.classList.add('active');
    },

    edit(id) {
        // Secretary restriction: cannot edit
        if (Storage.isSecretary()) {
            App.showToast('❌ No tienes permiso para editar. Solo puedes agregar nuevos datos.', 'error');
            return;
        }
        App.closeModal('detailModal');
        const client = Storage.getClients().find(c => c.id === id);
        if (client) this.openModal(client);
    },

    delete(id) {
        // Secretary restriction: cannot delete
        if (Storage.isSecretary()) {
            App.showToast('❌ No tienes permiso para eliminar datos.', 'error');
            return;
        }
        if (confirm('¿Estás seguro de eliminar este cliente?')) {
            Storage.deleteClient(id);
            App.closeModal('detailModal');
            this.render();
            App.updateDashboard();
            Followups.updateClientSelect();
            App.showToast('Cliente eliminado', 'warning');
        }
    },

    // --- MASS IMPORT (EXCEL) ---

    async downloadTemplate() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Plantilla Clientes');

        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE9F56' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } }
        };

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 15 }, // Hidden/Optional
            { header: 'Nombre Completo', key: 'name', width: 25 },
            { header: 'Tipo', key: 'type', width: 15 }, // Dropdown
            { header: 'Teléfono', key: 'phone', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Estado', key: 'status', width: 15 }, // Dropdown
            { header: 'Presupuesto', key: 'budget', width: 20 },
            { header: 'Preferencias', key: 'preferences', width: 30 },
            { header: 'Notas', key: 'notes', width: 30 }
        ];

        worksheet.getRow(1).height = 25;
        worksheet.getRow(1).eachCell((cell) => cell.style = headerStyle);

        // DATA VALIDATION
        for (let i = 2; i <= 1000; i++) {
            // C: Type
            worksheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Comprador,Vendedor,Inquilino,Propietario"']
            };
            // F: Status
            worksheet.getCell(`F${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Activo,Interesado,Cerrado"']
            };
        }

        // Example Row
        worksheet.addRow({
            id: '',
            name: 'Juan Pérez',
            type: 'Comprador',
            phone: '+54 11 1234-5678',
            email: 'juan@ejemplo.com',
            status: 'Activo',
            budget: 'USD 80,000 - 120,000',
            preferences: 'Busca 2 ambientes en Palermo',
            notes: 'Contactar por la tarde'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `plantilla_clientes_c21sky.xlsx`;
        link.click();
    },

    triggerImport() {
        let input = document.getElementById('clientImportInput');
        if (!input) {
            input = document.createElement('input');
            input.id = 'clientImportInput';
            input.type = 'file';
            input.accept = '.xlsx, .xls';
            input.style.display = 'none';
            input.onchange = (e) => this.handleImportFile(e.target.files[0]);
            document.body.appendChild(input);
        }
        input.value = '';
        input.click();
    },

    handleImportFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                this.processExcelImport(workbook);
            } catch (err) {
                console.error('Import Error:', err);
                App.showToast('Error al leer el archivo Excel', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    processExcelImport(workbook) {
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) return App.showToast('El archivo está vacío', 'warning');

        let importedCount = 0;
        let skippedCount = 0;

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip Header

            const getVal = (idx) => {
                const val = row.getCell(idx).value;
                return (val === null || val === undefined) ? '' : String(val);
            };

            const cId = (getVal(1) && getVal(1).length > 5) ? getVal(1) : Storage.generateId();
            const exists = Storage.getClients().find(c => c.id === cId);

            if (exists) {
                skippedCount++;
                return;
            }

            // Normalization Maps (Spanish -> Code)
            const typeMap = { 'comprador': 'buyer', 'vendedor': 'seller', 'inquilino': 'tenant', 'propietario': 'landlord' };
            const statusMap = { 'activo': 'active', 'interesado': 'interested', 'cerrado': 'closed' };

            const rawType = (getVal(3) || 'buyer').toLowerCase().trim();
            const rawStatus = (getVal(6) || 'active').toLowerCase().trim();

            const type = typeMap[rawType] || 'buyer';
            const status = statusMap[rawStatus] || 'active';

            const newClient = {
                id: cId,
                name: getVal(2) || 'Sin Nombre',
                type: type,
                phone: getVal(4) || '',
                email: getVal(5) || '',
                status: status,
                budget: getVal(7) || '',
                preferences: getVal(8) || '',
                notes: getVal(9) || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            Storage.saveClient(newClient);
            importedCount++;
        });

        this.render();
        App.updateDashboard();
        App.showToast(`Importados: ${importedCount} clientes. Omitidos: ${skippedCount}.`, 'success');
    }
};
