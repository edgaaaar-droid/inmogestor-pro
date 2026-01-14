// Followups Manager
const Followups = {
    container: null,
    calendarGrid: null,
    modal: null,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),

    init() {
        this.container = document.getElementById('followupsContainer');
        this.calendarGrid = document.getElementById('calendarGrid');
        this.modal = document.getElementById('followupModal');
        this.bindEvents();
        this.render();
        this.renderCalendar();
        this.updateClientSelect();
        this.updatePropertySelect();
    },

    bindEvents() {
        document.getElementById('addFollowupBtn')?.addEventListener('click', () => this.openModal());
        document.getElementById('followupForm')?.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('prevMonth')?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth')?.addEventListener('click', () => this.changeMonth(1));
        document.getElementById('filterFollowupStatus')?.addEventListener('change', () => this.render());
        document.getElementById('filterFollowupType')?.addEventListener('change', () => this.render());
    },

    render() {
        let followups = Storage.getFollowups();
        const statusFilter = document.getElementById('filterFollowupStatus')?.value;
        const typeFilter = document.getElementById('filterFollowupType')?.value;

        if (statusFilter) followups = followups.filter(f => f.status === statusFilter);
        if (typeFilter) followups = followups.filter(f => f.type === typeFilter);

        // Sort by date
        followups.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (followups.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <p class="empty-state-text">No hay seguimientos registrados</p>
                    <button class="btn btn-primary" onclick="Followups.openModal()">Agregar seguimiento</button>
                </div>
            `;
            return;
        }

        this.container.innerHTML = followups.map(f => this.renderItem(f)).join('');
        this.container.querySelectorAll('.followup-item').forEach(item => {
            item.addEventListener('click', () => this.showDetail(item.dataset.id));
        });
    },

    renderItem(followup) {
        const date = new Date(followup.date);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const typeIcons = { call: '📞', meeting: '🤝', visit: '🏠', other: '📌' };
        const statusClass = followup.status === 'completed' ? 'status-completed' : (followup.status === 'cancelled' ? 'status-cancelled' : '');

        const client = Storage.getClients().find(c => c.id === followup.clientId);
        const property = Storage.getProperties().find(p => p.id === followup.propertyId);

        return `
            <div class="followup-item ${statusClass}" data-id="${followup.id}">
                <div class="followup-date">
                    <span class="day">${date.getDate()}</span>
                    <span class="month">${months[date.getMonth()]}</span>
                </div>
                <div class="followup-details">
                    <div class="followup-title">${typeIcons[followup.type] || '📌'} ${followup.title}</div>
                    <div class="followup-meta">
                        ${followup.time || ''}
                        ${client ? ` • 👤 ${client.name}` : ''}
                        ${property ? ` • 🏠 ${property.title.substring(0, 20)}...` : ''}
                    </div>
                </div>
                <div class="followup-status-badge status-${followup.status}">${followup.status}</div>
            </div>
        `;
    },

    renderCalendar() {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        document.getElementById('calendarMonth').textContent = `${months[this.currentMonth]} ${this.currentYear}`;

        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const today = new Date();

        const followups = Storage.getFollowups();
        const datesWithEvents = new Set(followups.map(f => f.date));

        let html = days.map(d => `<div class="calendar-day calendar-day-header">${d}</div>`).join('');

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = today.getDate() === day && today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;
            const hasEvent = datesWithEvents.has(dateStr);

            html += `<div class="calendar-day${isToday ? ' today' : ''}${hasEvent ? ' has-event' : ''}" data-date="${dateStr}">${day}</div>`;
        }

        this.calendarGrid.innerHTML = html;

        // Click on day to add followup
        this.calendarGrid.querySelectorAll('.calendar-day:not(.empty):not(.calendar-day-header)').forEach(day => {
            day.addEventListener('click', () => {
                document.getElementById('followupDate').value = day.dataset.date;
                this.openModal();
            });
        });
    },

    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
    },

    updateClientSelect() {
        const select = document.getElementById('followupClient');
        if (!select) return;

        const clients = Storage.getClients();
        select.innerHTML = '<option value="">Seleccionar cliente...</option>' +
            clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    },

    updatePropertySelect() {
        const select = document.getElementById('followupProperty');
        if (!select) return;

        const properties = Storage.getProperties();
        select.innerHTML = '<option value="">Seleccionar propiedad...</option>' +
            properties.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    },

    openModal(followup = null) {
        const form = document.getElementById('followupForm');
        const title = document.getElementById('followupModalTitle');

        this.updateClientSelect();
        this.updatePropertySelect();

        if (followup) {
            title.textContent = 'Editar Seguimiento';
            document.getElementById('followupId').value = followup.id;
            document.getElementById('followupType').value = followup.type || '';
            document.getElementById('followupStatus').value = followup.status || 'pending';
            document.getElementById('followupDate').value = followup.date || '';
            document.getElementById('followupTime').value = followup.time || '';
            if (document.getElementById('followupTimeEnd')) {
                document.getElementById('followupTimeEnd').value = followup.timeEnd || '';
            }
            document.getElementById('followupClient').value = followup.clientId || '';
            document.getElementById('followupProperty').value = followup.propertyId || '';
            document.getElementById('followupTitle').value = followup.title || '';
            if (document.getElementById('followupResult')) {
                document.getElementById('followupResult').value = followup.result || '';
            }
            if (document.getElementById('followupFeedback')) {
                document.getElementById('followupFeedback').value = followup.feedback || '';
            }
            document.getElementById('followupNotes').value = followup.notes || '';
        } else {
            title.textContent = 'Nuevo Seguimiento';
            form.reset();
            document.getElementById('followupId').value = '';
            // Set default date to today if not already set
            if (!document.getElementById('followupDate').value) {
                document.getElementById('followupDate').value = new Date().toISOString().split('T')[0];
            }
        }

        this.modal.classList.add('active');
    },

    closeModal() {
        this.modal.classList.remove('active');
    },

    handleSubmit(e) {
        e.preventDefault();

        const followup = {
            id: document.getElementById('followupId').value || null,
            type: document.getElementById('followupType').value,
            status: document.getElementById('followupStatus').value,
            date: document.getElementById('followupDate').value,
            time: document.getElementById('followupTime').value,
            timeEnd: document.getElementById('followupTimeEnd')?.value || null,
            clientId: document.getElementById('followupClient').value || null,
            propertyId: document.getElementById('followupProperty').value || null,
            title: document.getElementById('followupTitle').value,
            result: document.getElementById('followupResult')?.value || null,
            feedback: document.getElementById('followupFeedback')?.value || null,
            notes: document.getElementById('followupNotes').value
        };

        Storage.saveFollowup(followup);
        this.closeModal();
        this.render();
        this.renderCalendar();
        App.updateDashboard();
        App.showToast('Seguimiento guardado correctamente', 'success');
    },

    showDetail(id) {
        const followup = Storage.getFollowups().find(f => f.id === id);
        if (!followup) return;

        const modal = document.getElementById('detailModal');
        const content = modal.querySelector('.modal-content');
        const typeLabels = { call: 'Llamada', meeting: 'Reunión', visit: 'Visita', other: 'Otro' };
        const statusLabels = { pending: 'Pendiente', completed: 'Completado', cancelled: 'Cancelado' };

        const client = Storage.getClients().find(c => c.id === followup.clientId);
        const property = Storage.getProperties().find(p => p.id === followup.propertyId);

        content.innerHTML = `
            <div class="modal-header">
                <h2>${followup.title}</h2>
                <button class="modal-close" onclick="App.closeModal('detailModal')">×</button>
            </div>
            <div class="modal-body">
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;">
                    <p><strong>Tipo:</strong> ${typeLabels[followup.type] || followup.type}</p>
                    <p><strong>Estado:</strong> <span class="property-status status-${followup.status}">${statusLabels[followup.status] || followup.status}</span></p>
                    <p><strong>Fecha:</strong> ${followup.date}</p>
                    <p><strong>Horario:</strong> ${followup.time || '--:--'} ${followup.timeEnd ? ' - ' + followup.timeEnd : ''}</p>
                    
                    ${client ? `<div style="grid-column:span 2;background:var(--bg-tertiary);padding:0.5rem;border-radius:4px;"><strong>👤 Cliente:</strong> ${client.name} <a href="tel:${client.phone}" style="text-decoration:none;">📞</a></div>` : ''}
                    ${property ? `<div style="grid-column:span 2;background:var(--bg-tertiary);padding:0.5rem;border-radius:4px;"><strong>🏠 Propiedad:</strong> ${property.title}</div>` : ''}
                    
                    ${followup.result ? `<div style="grid-column:span 2;"><strong>📊 Resultado:</strong> <span style="font-weight:bold;">${{
                interested: '✅ Interesado',
                very_interested: '🔥 Muy Interesado',
                offer: '💰 Hizo Oferta',
                not_interested: '❌ No Interesado',
                thinking: '🤔 Lo está pensando',
                rescheduled: '📅 Reagendado'
            }[followup.result] || followup.result}</span></div>` : ''}
                    
                    ${followup.feedback ? `<div style="grid-column:span 2;background:var(--bg-secondary);padding:0.5rem;border-left:3px solid var(--primary);"><strong>💬 Feedback/Opinión:</strong><br>${followup.feedback}</div>` : ''}
                    
                    ${followup.notes ? `<div style="grid-column:span 2;margin-top:0.5rem;"><strong>📝 Notas internas:</strong><br>${followup.notes}</div>` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeModal('detailModal')">Cerrar</button>
                ${followup.status === 'pending' ? `<button class="btn btn-success" onclick="Followups.markComplete('${followup.id}')">✓ Completar</button>` : ''}
                <button class="btn btn-warning" onclick="Followups.edit('${followup.id}')">Editar</button>
                <button class="btn btn-danger" onclick="Followups.delete('${followup.id}')">Eliminar</button>
            </div>
        `;

        modal.classList.add('active');
    },

    markComplete(id) {
        const followup = Storage.getFollowups().find(f => f.id === id);
        if (followup) {
            followup.status = 'completed';
            Storage.saveFollowup(followup);
            App.closeModal('detailModal');
            this.render();
            this.renderCalendar();
            App.updateDashboard();
            App.showToast('Seguimiento completado', 'success');
        }
    },

    edit(id) {
        App.closeModal('detailModal');
        const followup = Storage.getFollowups().find(f => f.id === id);
        if (followup) this.openModal(followup);
    },

    delete(id) {
        if (confirm('¿Estás seguro de eliminar este seguimiento?')) {
            Storage.deleteFollowup(id);
            App.closeModal('detailModal');
            this.render();
            this.renderCalendar();
            App.updateDashboard();
            App.showToast('Seguimiento eliminado', 'warning');
        }
    }
};
