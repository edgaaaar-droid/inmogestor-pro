// Financials Module - Expense Tracking & Profit Calculation
const Financials = {
    init() {
        console.log('Financials initialized');
    },

    render() {
        const container = document.getElementById('section-financials');
        if (!container) return;

        const expenses = Storage.getExpenses().sort((a, b) => new Date(b.date) - new Date(a.date));
        const stats = this.calculateStats();

        container.innerHTML = `
            <div class="section-header">
                <div>
                    <h1>💰 Finanzas & Rentabilidad</h1>
                    <p class="section-subtitle">Control de gastos y cálculo de ganancia real</p>
                </div>
                <button class="btn btn-primary" onclick="Financials.showAddExpenseModal()">
                    + Registrar Gasto
                </button>
            </div>

            <!-- Financial Summary Cards -->
            <div class="dashboard-grid">
                <div class="card stat-card">
                    <div class="card-body">
                        <div class="stat-icon" style="background:rgba(16, 185, 129, 0.1); color:#10b981;">💵</div>
                        <div class="stat-info">
                            <h3>Ingresos Totales</h3>
                            <p class="stat-value text-success">$${stats.totalIncome.toLocaleString()}</p>
                            <span class="stat-label">Comisiones cobradas</span>
                        </div>
                    </div>
                </div>

                <div class="card stat-card">
                    <div class="card-body">
                        <div class="stat-icon" style="background:rgba(239, 68, 68, 0.1); color:#ef4444;">💸</div>
                        <div class="stat-info">
                            <h3>Gastos Operativos</h3>
                            <p class="stat-value text-danger">$${stats.totalExpenses.toLocaleString()}</p>
                            <span class="stat-label">Costos registrados</span>
                        </div>
                    </div>
                </div>

                <div class="card stat-card" style="grid-column: 1 / -1;">
                    <div class="card-body">
                        <div class="stat-icon" style="background:rgba(59, 130, 246, 0.1); color:#3b82f6;">📈</div>
                        <div class="stat-info">
                            <h3>Ganancia Real Neta</h3>
                            <p class="stat-value" style="color: ${stats.netProfit >= 0 ? '#10b981' : '#ef4444'}; font-size: 2rem;">
                                $${stats.netProfit.toLocaleString()}
                            </p>
                            <span class="stat-label">Rentabilidad final (Ingresos - Gastos)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Expenses List -->
            <div class="card" style="margin-top: 1.5rem;">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>Historial de Gastos</h3>
                    <div class="filter-group">
                        <select id="expenseFilterYear" onchange="Financials.render()" style="padding: 5px; border-radius: 5px; border: 1px solid var(--border-color);">
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                        </select>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-container">
                        ${this.renderExpensesTable(expenses)}
                    </div>
                </div>
            </div>
        `;
    },

    renderExpensesTable(expenses) {
        if (expenses.length === 0) {
            return '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay gastos registrados.</div>';
        }

        return `
            <table class="table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th>Monto</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(exp => `
                        <tr>
                            <td>${new Date(exp.date).toLocaleDateString()}</td>
                            <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-primary);">${exp.category}</span></td>
                            <td>${exp.note || '-'}</td>
                            <td style="color: #ef4444; font-weight: bold;">-$${parseInt(exp.amount).toLocaleString()}</td>
                            <td>
                                <button onclick="Financials.deleteExpense('${exp.id}')" style="background:none; border:none; cursor:pointer;">❌</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    calculateStats() {
        const expenses = Storage.getExpenses();
        const sales = Storage.getSales(); // Assuming sales logic exists or properties marked as sold

        // Calculate Total Income (Commissions from Sold Properties)
        const soldProperties = Storage.getProperties().filter(p => p.status === 'sold');

        // Sum commission from properties
        let totalIncome = soldProperties.reduce((sum, p) => {
            // Check for explicit saleData.myEarnings first (structure from properties.js)
            let commission = 0;
            if (p.saleData && p.saleData.myEarnings) {
                commission = parseFloat(p.saleData.myEarnings);
            } else if (p.commissionAmount) {
                commission = parseFloat(p.commissionAmount);
            } else {
                // Fallback estimate
                commission = (p.price || 0) * 0.05 * 0.5;
            }
            return sum + (commission || 0);
        }, 0);

        // Also add manual sales records if any
        totalIncome += sales.reduce((sum, s) => sum + (parseFloat(s.commission) || 0), 0);

        const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        return {
            totalIncome,
            totalExpenses,
            netProfit: totalIncome - totalExpenses
        };
    },

    showAddExpenseModal() {
        const modal = document.getElementById('detailModal'); // Reuse generic modal
        const content = modal.querySelector('.modal-content');

        content.innerHTML = `
            <div class="modal-header">
                <h2>📝 Registrar Gasto</h2>
                <button class="modal-close" onclick="document.getElementById('detailModal').classList.remove('active')">×</button>
            </div>
            <form id="expenseForm" class="modal-body" onsubmit="Financials.handleSaveExpense(event)">
                <div class="form-group">
                    <label>Monto del Gasto ($)</label>
                    <input type="number" id="expAmount" required placeholder="Ej: 50000" min="0" step="100" style="font-size: 1.2rem; font-weight: bold;">
                </div>
                
                <div class="form-group">
                    <label>Fecha</label>
                    <input type="date" id="expDate" required value="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                    <label>Categoría</label>
                    <div class="category-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                        <label class="radio-card">
                            <input type="radio" name="expCategory" value="Combustible" checked>
                            <span class="card-content">⛽ Combustible</span>
                        </label>
                        <label class="radio-card">
                            <input type="radio" name="expCategory" value="Comida">
                            <span class="card-content">🍔 Comida/Viáticos</span>
                        </label>
                        <label class="radio-card">
                            <input type="radio" name="expCategory" value="Marketing">
                            <span class="card-content">📢 Marketing/Ads</span>
                        </label>
                        <label class="radio-card">
                            <input type="radio" name="expCategory" value="Papeleria">
                            <span class="card-content">📄 Papelería</span>
                        </label>
                        <label class="radio-card">
                            <input type="radio" name="expCategory" value="Mantenimiento">
                            <span class="card-content">🔧 Mantenimiento Auto</span>
                        </label>
                        <label class="radio-card">
                            <input type="radio" name="expCategory" value="Otro">
                            <span class="card-content">📦 Otro</span>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label>Nota / Descripción (Opcional)</label>
                    <input type="text" id="expNote" placeholder="Ej: Carga tanque lleno">
                </div>

                <button type="submit" class="btn btn-primary btn-block">Guardar Gasto</button>
            </form>
            <style>
                .radio-card input { display: none; }
                .radio-card .card-content {
                    display: block; padding: 10px; border: 1px solid var(--border-color);
                    border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s;
                }
                .radio-card input:checked + .card-content {
                    background: var(--primary); color: white; border-color: var(--primary);
                }
            </style>
        `;

        modal.classList.add('active');
    },

    handleSaveExpense(e) {
        e.preventDefault();

        const expense = {
            amount: parseFloat(document.getElementById('expAmount').value),
            date: document.getElementById('expDate').value,
            category: document.querySelector('input[name="expCategory"]:checked').value,
            note: document.getElementById('expNote').value || ''
        };

        Storage.saveExpense(expense);
        document.getElementById('detailModal').classList.remove('active');
        App.showToast('✅ Gasto registrado', 'success');
        this.render(); // Refresh view
    },

    deleteExpense(id) {
        if (confirm('¿Borrar este gasto?')) {
            Storage.deleteExpense(id);
            this.render();
            App.showToast('🗑️ Gasto eliminado', 'success');
        }
    }
};
