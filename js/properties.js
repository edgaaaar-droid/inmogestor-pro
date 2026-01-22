// Properties Manager
const Properties = {
    container: null,
    modal: null,
    currentImages: [],

    init() {
        this.container = document.getElementById('propertiesContainer');
        this.modal = document.getElementById('propertyModal');
        this.bindEvents();
        this.render();
        this.sanitizeDatabase(); // Run once on init to fix bad data
    },

    sanitizeDatabase() {
        const props = Storage.getProperties();
        let fixed = 0;
        props.forEach(p => {
            // Fix Earnings to be Pure Numbers
            if (p.status === 'sold' && p.saleData) {
                const original = p.saleData.myEarnings;
                // Use the robust parser
                const numberVal = this.parseLocalFloat(original);

                // If it was a string or different, update it to Number
                if (typeof original !== 'number' || original !== numberVal) {
                    p.saleData.myEarnings = numberVal;
                    // Also fix other fields if needed
                    p.saleData.financials.commissionPercent = this.parseLocalFloat(p.saleData.financials.commissionPercent);
                    fixed++;
                }
            }
        });
        if (fixed > 0) {
            Storage.saveProperties(props);
            console.log(`Database Sanitized: Fixed ${fixed} properties.`);
            App.updateDashboard(); // Refresh dash immediately
        }
    },

    updateOwnerSelect() {
        const select = document.getElementById('propertyOwner');
        if (!select) return;
        const clients = Storage.getClients().filter(c => c.type === 'seller' || c.type === 'landlord');
        select.innerHTML = '<option value="">Sin propietario asignado</option>' +
            clients.map(c => `<option value="${c.id}">${c.name} (${c.type === 'seller' ? 'Vendedor' : 'Propietario'})</option>`).join('');
    },

    bindEvents() {
        document.getElementById('addPropertyBtn')?.addEventListener('click', () => this.openModal());
        document.getElementById('propertyForm')?.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('propertyImages')?.addEventListener('change', (e) => this.handleImages(e));
        document.getElementById('filterStatus')?.addEventListener('change', () => this.render());
        document.getElementById('filterType')?.addEventListener('change', () => this.render());
        document.getElementById('filterCaptacion')?.addEventListener('change', () => this.render());

        // Image upload drag and drop
        const uploadArea = document.getElementById('propertyImageUpload');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
            uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
            uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); this.handleImageDrop(e); });
        }

        // Clipboard paste support (Ctrl+V images from WhatsApp, etc.)
        document.addEventListener('paste', (e) => this.handleImagePaste(e));

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.container.className = btn.dataset.view === 'list' ? 'properties-list' : 'properties-grid';
            });
        });
    },

    // Toggle price fields based on operation type
    togglePriceFields() {
        const operation = document.getElementById('propertyOperation')?.value;
        const singlePriceGroup = document.getElementById('singlePriceGroup');
        const salePriceGroup = document.getElementById('salePriceGroup');
        const rentPriceGroup = document.getElementById('rentPriceGroup');

        if (!singlePriceGroup || !salePriceGroup || !rentPriceGroup) return;

        if (operation === 'both') {
            singlePriceGroup.style.display = 'none';
            salePriceGroup.style.display = 'block';
            rentPriceGroup.style.display = 'block';
        } else {
            singlePriceGroup.style.display = 'block';
            salePriceGroup.style.display = 'none';
            rentPriceGroup.style.display = 'none';
        }
    },

    render() {
        const container = document.getElementById('section-properties'); // Ensure we target the section container for header overwrite, OR just propertiesContainer innerHTML? 
        // Wait, current implementation uses this.container = document.getElementById('propertiesContainer');
        // But the previous plan tried to overwrite 'section-properties' innerHTML to add the header buttons.
        // Let's look at app.js renderSections - it creates the header.
        // The header is static in app.js. To add buttons DYNAMICALLY, we should either:
        // A) Modify App.js (static)
        // B) Inject them in render() by targeting the header element.

        let properties = Storage.getProperties();
        const statusFilter = document.getElementById('filterStatus')?.value;
        const typeFilter = document.getElementById('filterType')?.value;
        const captacionFilter = document.getElementById('filterCaptacion')?.value;

        if (statusFilter) properties = properties.filter(p => p.status === statusFilter);
        if (typeFilter) properties = properties.filter(p => p.type === typeFilter);
        if (captacionFilter) properties = properties.filter(p => p.captacionSource === captacionFilter);

        // Inject Buttons into Header if not present OR update if missing Report
        const headerActions = document.querySelector('#section-properties .section-header');
        let btnGroup = document.getElementById('excelBtnGroup');

        if (headerActions) {
            if (!btnGroup) {
                btnGroup = document.createElement('div');
                btnGroup.id = 'excelBtnGroup';
                btnGroup.className = 'btn-group';
                btnGroup.style.marginRight = '1rem';
                if (headerActions.lastElementChild) {
                    headerActions.insertBefore(btnGroup, headerActions.lastElementChild);
                } else {
                    headerActions.appendChild(btnGroup);
                }
            }
            // Always update content to ensure "Reporte" button is there
            btnGroup.innerHTML = `
                 <button class="btn btn-secondary btn-sm" onclick="Properties.openEarningsReport()">📊 Reporte</button>
                 <button class="btn btn-secondary btn-sm" onclick="Properties.exportToExcel()">📤 Excel (Pro)</button>
                 <button class="btn btn-secondary btn-sm" onclick="Properties.triggerImport()">📥 Importar Masivo</button>
            `;
        }

        if (properties.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏠</div>
                    <p class="empty-state-text">No hay propiedades registradas</p>
                    <button class="btn btn-primary" onclick="Properties.openModal()">Agregar primera propiedad</button>
                </div>
            `;
            return;
        }

        this.container.innerHTML = properties.map(p => this.renderCard(p)).join('');
        this.container.querySelectorAll('.property-card').forEach(card => {
            card.addEventListener('click', () => this.showDetail(card.dataset.id));
        });
    },

    // ===== EXCEL / CSV SYSTEM =====

    async exportToExcel() {
        const properties = Storage.getProperties();
        if (properties.length === 0) return App.showToast('No hay propiedades para exportar', 'warning');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Propiedades');

        // Styles
        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE9F56' } }, // C21 Gold
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } }
        };

        const borderLink = { style: 'thin', color: { argb: 'FF000000' } };
        const cellBorder = { top: borderLink, left: borderLink, bottom: borderLink, right: borderLink };

        // Columns
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 15 },
            { header: 'Título', key: 'title', width: 30 },
            { header: 'Operación', key: 'operation', width: 15 },
            { header: 'Precio', key: 'price', width: 15 },
            { header: 'Moneda', key: 'currency', width: 10 },
            { header: 'Estado', key: 'status', width: 15 },
            { header: 'Dirección', key: 'address', width: 30 },
            { header: 'Dorm.', key: 'bedrooms', width: 10 },
            { header: 'Baños', key: 'bathrooms', width: 10 },
            { header: 'M²', key: 'area', width: 10 },
            { header: 'Estac.', key: 'parking', width: 10 },
            { header: 'Descripción', key: 'description', width: 40 },
            { header: 'Agente Capt.', key: 'captadorAgent', width: 20 },
            { header: 'Agencia Capt.', key: 'captadorAgency', width: 20 },
            { header: 'Fuente Capt.', key: 'captacionSource', width: 20 },
            { header: 'Fecha Capt.', key: 'captacionDate', width: 15 },
            { header: 'P. Venta', key: 'salePrice', width: 15 },
            { header: 'Fecha Venta', key: 'saleDate', width: 15 },
            { header: 'Com. Total', key: 'saleCommission', width: 15 },
            { header: 'Mi Ganancia', key: 'saleEarnings', width: 15 }
        ];

        // Apply Header Styles
        worksheet.getRow(1).height = 25;
        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });

        // Add Data
        properties.forEach(p => {
            const sale = p.saleData || {};
            worksheet.addRow({
                id: p.id,
                title: p.title,
                operation: p.operation,
                price: p.price,
                currency: p.currency,
                status: p.status,
                address: p.address,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                area: p.area,
                parking: p.parking,
                description: p.description,
                captadorAgent: p.captadorAgent || '',
                captadorAgency: p.captadorAgency || '',
                captacionSource: p.captacionSource || '',
                captacionDate: p.captacionDate || '',
                salePrice: sale.price || '',
                saleDate: sale.date || '',
                saleCommission: sale.financials?.commissionPercent ? sale.financials.commissionPercent + '%' : '',
                saleEarnings: sale.myEarnings || ''
            });
        });

        // Apply Borders to Data
        const lastRow = worksheet.lastRow.number;
        const lastCol = worksheet.columnCount;

        for (let r = 2; r <= lastRow; r++) {
            const row = worksheet.getRow(r);
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Internal thin borders
                cell.border = cellBorder;

                // Outer Thick Borders override
                const isLeft = colNumber === 1;
                const isRight = colNumber === lastCol;
                const isBottom = r === lastRow;

                if (isLeft || isRight || isBottom) {
                    const b = { ...cell.border };
                    if (isLeft) b.left = { style: 'medium' };
                    if (isRight) b.right = { style: 'medium' };
                    if (isBottom) b.bottom = { style: 'medium' };
                    cell.border = b;
                }
            });
        }

        // Export
        // Export
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `propiedades_c21sky_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
    },

    async downloadTemplate() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Plantilla Importación');

        // Reuse Styles
        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE9F56' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } }
        };

        // Columns (Same as Export)
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 15 },
            { header: 'Título', key: 'title', width: 30 },
            { header: 'Tipo', key: 'type', width: 15 }, // NEW Column 3
            { header: 'Operación', key: 'operation', width: 15 }, // Col 4
            { header: 'Precio', key: 'price', width: 15 }, // Col 5
            { header: 'Moneda', key: 'currency', width: 10 }, // Col 6
            { header: 'Estado', key: 'status', width: 15 }, // Col 7
            { header: 'Dirección', key: 'address', width: 30 },
            { header: 'Dorm.', key: 'bedrooms', width: 10 },
            { header: 'Baños', key: 'bathrooms', width: 10 },
            { header: 'M²', key: 'area', width: 10 },
            { header: 'Estac.', key: 'parking', width: 10 },
            { header: 'Descripción', key: 'description', width: 40 },
            { header: 'Agente Capt.', key: 'captadorAgent', width: 20 },
            { header: 'Agencia Capt.', key: 'captadorAgency', width: 20 },
            { header: 'Fuente Capt.', key: 'captacionSource', width: 20 },
            { header: 'Fecha Capt.', key: 'captacionDate', width: 15 },
            { header: 'P. Venta', key: 'salePrice', width: 15 },
            { header: 'Fecha Venta', key: 'saleDate', width: 15 },
            { header: 'Com. Total', key: 'saleCommission', width: 15 },
            { header: 'Mi Ganancia', key: 'saleEarnings', width: 15 }
        ];

        // Apply Header Styles
        worksheet.getRow(1).height = 25;
        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });

        // --- DATA VALIDATIONS (DROPDOWNS) ---
        // We apply to rows 2 to 1000 to cover future input
        for (let i = 2; i <= 1000; i++) {
            // C: Type (Now Col 3)
            worksheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Casa,Departamento,Terreno,Comercial,Oficina"']
            };
            // D: Operation (Now Col 4)
            worksheet.getCell(`D${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Venta,Alquiler"']
            };
            // F: Currency (Now Col 6)
            worksheet.getCell(`F${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"USD,EUR,ARS"']
            };
            // G: Status (Now Col 7)
            worksheet.getCell(`G${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Disponible,Reservado,Vendido,Alquilado"']
            };
            // P: Source (Now Col 16)
            worksheet.getCell(`P${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Propia - Exclusividad,Propia - Cartera,C21 Cartera,C21 Sky,C21 Captaciones"']
            };
        }

        // Add Example Row
        worksheet.addRow({
            id: '',
            title: 'Ej: Departamento en Palermo',
            type: 'Departamento',
            operation: 'Venta',
            price: 150000,
            currency: 'USD',
            status: 'Disponible',
            address: 'Av. Libertador 1234',
            bedrooms: 2,
            bathrooms: 1,
            area: 60,
            parking: 1,
            description: 'Hermoso departamento con vista...',
            captadorAgent: 'Edgar Paniagua',
            captadorAgency: 'C21 Sky',
            captacionSource: 'Propia - Exclusividad',
            captacionDate: new Date().toISOString().split('T')[0]
        });

        // Export
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `plantilla_carga_c21sky.xlsx`;
        link.click();
    },

    triggerImport() {
        let input = document.getElementById('excelImportInput');
        if (!input) {
            input = document.createElement('input');
            input.id = 'excelImportInput';
            input.type = 'file';
            input.accept = '.xlsx, .xls'; // Accept Excel files
            input.style.display = 'none';
            input.onchange = (e) => this.handleImportFile(e.target.files[0]);
            document.body.appendChild(input);
        }
        input.value = '';
        input.click();
    },

    handleImportFile(file) {
        if (!file) return;
        App.showToast('Leyendo archivo...', 'info'); // Debug feedback
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                App.showToast('Procesando datos...', 'info'); // Debug feedback
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                this.processExcelImport(workbook);
            } catch (err) {
                console.error('Import Error:', err);
                App.showToast('Error crítico al leer Excel: ' + err.message, 'error');
            }
        };
        reader.onerror = () => App.showToast('Error de lectura de archivo', 'error');
        reader.readAsArrayBuffer(file);
    },

    processExcelImport(workbook) {
        const worksheet = workbook.getWorksheet(1); // Get first sheet
        if (!worksheet) return App.showToast('El archivo Excel está vacío o no tiene hojas.', 'warning');

        // Count data rows (excluding header)
        let dataRows = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) dataRows.push(row);
        });

        if (dataRows.length === 0) return App.showToast('El archivo no contiene datos.', 'warning');

        // ALWAYS BULK IMPORT (User Preference)
        // Directly save to DB and show in list.
        let importedCount = 0;
        let skippedCount = 0;

        dataRows.forEach(row => {
            // Helper to safe get value
            const getVal = (idx) => {
                const val = row.getCell(idx).value;
                return (val === null || val === undefined) ? '' : String(val);
            };

            const pId = (getVal(1) && getVal(1).length > 5 && getVal(1) !== 'undefined') ? getVal(1) : Storage.generateId();
            // REMOVED: Skipping if exists. Now we UPSERT (Update or Insert)
            // const exists = Storage.getProperties().find(p => p.id === pId);
            // if (exists) { skippedCount++; return; }

            // Normalize Data based on Template Dropdowns
            // Map Spanish Template values to Internal Codes
            const opMap = { 'venta': 'sale', 'alquiler': 'rent', 'renta': 'rent' };
            const stMap = { 'disponible': 'available', 'reservado': 'reserved', 'vendido': 'sold', 'alquilado': 'rented' };
            const typeMap = { 'casa': 'house', 'departamento': 'apartment', 'terreno': 'land', 'comercial': 'commercial', 'oficina': 'office' };
            const srcMap = {
                'propia - exclusividad': 'propia_exclusiva',
                'propia - cartera': 'propia_cartera',
                'c21 cartera': 'c21_cartera',
                'c21 sky': 'c21_sky',
                'c21 captaciones': 'c21_captaciones'
            };

            const rawType = (getVal(3) || 'apartment').toLowerCase().trim(); // New Col 3
            const rawOp = (getVal(4) || 'sale').toLowerCase().trim(); // Shifted to 4
            const rawSt = (getVal(7) || 'available').toLowerCase().trim(); // Shifted to 7
            const rawSrc = (getVal(16) || 'propia_exclusiva').toLowerCase().trim(); // Shifted to 16

            const type = typeMap[rawType] || 'apartment';
            const op = opMap[rawOp] || (rawOp.includes('alq') ? 'rent' : 'sale');
            const st = stMap[rawSt] || (rawSt.includes('vend') ? 'sold' : 'available');
            const src = srcMap[rawSrc] || 'propia_exclusiva';

            const newProp = {
                id: pId,
                title: getVal(2) || 'Sin Título',
                type: type,
                operation: op,
                price: parseFloat(getVal(5)) || 0, // Shifted
                currency: getVal(6) || 'USD', // Shifted
                status: st,
                address: getVal(8) || '', // Shifted
                bedrooms: parseInt(getVal(9)) || 0,
                bathrooms: parseInt(getVal(10)) || 0,
                area: parseInt(getVal(11)) || 0,
                parking: parseInt(getVal(12)) || 0,
                description: getVal(13) || '',
                captadorAgent: getVal(14) || '',
                captadorAgency: getVal(15) || '',
                captacionSource: src,
                captacionDate: getVal(17) || new Date().toISOString().split('T')[0],
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                images: [] // Empty by default for import
            };

            // Restore Sale Data if available/sold
            if (getVal(18) || st === 'sold') { // Shifted
                const price = this.parseLocalFloat(getVal(18)) || newProp.price;

                let rawComm = getVal(20);
                if (typeof rawComm === 'string') rawComm = rawComm.replace('%', '');
                let commVal = this.parseLocalFloat(rawComm);

                // Smart Percent: If Excel gives 0.055 (5.5%), convert to 5.5
                if (commVal > 0 && commVal < 1) commVal = commVal * 100;

                const commDetails = {
                    commissionPercent: commVal || 0,
                    myEarnings: this.parseLocalFloat(getVal(21)) || 0
                };

                // Auto-Calculate Earnings
                if (commDetails.myEarnings === 0 && price > 0 && commDetails.commissionPercent > 0) {
                    const totalComm = price * (commDetails.commissionPercent / 100);
                    const officeBase = totalComm * 0.50;
                    commDetails.myEarnings = officeBase * 0.50;

                    // DEBUG: If still 0 or NaN, logic failed
                    if (!commDetails.myEarnings) {
                        console.warn('Calc Failed:', { price, comm: commDetails.commissionPercent });
                    }
                }

                // Temporary Debug Toast for first row
                if (rowNumber === 2) {
                    App.showToast(`Debug Fila 2: Precio=${price}, Com=${commDetails.commissionPercent}%, Ganancia=${commDetails.myEarnings}`, 'info', 8000);
                }

                newProp.saleData = {
                    price: price,
                    date: getVal(19) || new Date().toISOString().split('T')[0],
                    financials: commDetails,
                    myEarnings: commDetails.myEarnings
                };
            }




            Storage.saveProperty(newProp);
            importedCount++;
        });

        this.render();
        App.updateDashboard();
        App.closeModal('propertyModal');
        App.showToast(`Importación Masiva: ${importedCount} nuevas. ${skippedCount} omitidas.`, 'success');
    },

    fillFormWithRow(row) {
        const getVal = (idx) => {
            const val = row.getCell(idx).value;
            return (val === null || val === undefined) ? '' : String(val);
        };

        // 1:ID (Ignore ID for new form fill, let system gen new one or keep logic)
        // Usually if filling form, it's a NEW property, so ignore ID.
        document.getElementById('propertyTitle').value = getVal(2);
        document.getElementById('propertyOperation').value = getVal(3).toLowerCase() || 'sale';
        document.getElementById('propertyPrice').value = getVal(4);
        document.getElementById('propertyCurrency').value = getVal(5) || 'USD';
        document.getElementById('propertyStatus').value = getVal(6).toLowerCase() || 'available';
        document.getElementById('propertyAddress').value = getVal(7);
        document.getElementById('propertyBedrooms').value = getVal(8);
        document.getElementById('propertyBathrooms').value = getVal(9);
        document.getElementById('propertyArea').value = getVal(10);
        document.getElementById('propertyParking').value = getVal(11);
        document.getElementById('propertyDescription').value = getVal(12);

        // Captacion
        if (document.getElementById('propertyCaptadorAgent')) document.getElementById('propertyCaptadorAgent').value = getVal(13);
        if (document.getElementById('propertyCaptadorAgency')) document.getElementById('propertyCaptadorAgency').value = getVal(14);
        if (document.getElementById('propertyCaptacionSource')) document.getElementById('propertyCaptacionSource').value = getVal(15);
        if (document.getElementById('propertyCaptacionDate')) document.getElementById('propertyCaptacionDate').value = getVal(16);
    },

    renderCard(property) {
        const statusLabels = { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido', rented: 'Alquilado' };
        const typeIcons = { house: '🏠', apartment: '🏢', land: '🌳', commercial: '🏪', office: '💼' };
        const typeLabels = { house: 'Casa', apartment: 'Departamento', land: 'Terreno', commercial: 'Comercial', office: 'Oficina' };
        const captacionLabels = { propia_exclusiva: 'Exclusividad', propia_cartera: 'Cartera Propia', c21_cartera: 'C21 Cartera', c21_sky: 'C21 Sky', c21_captaciones: 'C21 Captaciones' };
        const mainImage = property.images?.[0] || '';
        const canMarkAsSold = property.status === 'available' || property.status === 'reserved';

        // Build captador info section
        let captadorSection = '';

        // C21 Sky ID Logic: Show ID ONLY if source is C21 related
        const showId = ['c21_sky', 'c21_captaciones', 'c21_cartera'].includes(property.captacionSource);

        if (property.captadorAgent || property.captadorAgency || showId) {
            captadorSection = `
                <div class="captador-info">
                    ${property.captadorAgent ? `<span class="captador-name">👤 ${property.captadorAgent}</span>` : ''}
                    ${property.captadorAgency ? `<span class="captador-agency">🏢 ${property.captadorAgency}</span>` : ''}
                    ${showId && property.captacionId ? `<div style="margin-top:4px;font-size:0.75rem;color:var(--primary);font-weight:600;">ID: ${property.captacionId}</div>` : ''}
                </div>
            `;
        }

        return `
            <div class="property-card" data-id="${property.id}">
                <div class="property-image">
                    ${mainImage ? `<img src="${mainImage}" alt="${property.title}">` : `<div class="placeholder-image">${typeIcons[property.type] || '🏠'}</div>`}
                    <span class="property-status status-${property.status}">${statusLabels[property.status]}</span>
                    <span class="property-type-badge">${typeIcons[property.type] || '🏠'} ${typeLabels[property.type] || property.type}</span>
                    ${property.captacionSource ? `<span class="captacion-badge">${captacionLabels[property.captacionSource] || property.captacionSource}</span>` : ''}
                </div>
                <div class="property-info">
                    <h3 class="property-title">${property.title}</h3>
                    <p class="property-address">📍 ${property.address}</p>
                    ${property.operation === 'both' ? `
                        <p class="property-price" style="display:flex;flex-direction:column;gap:2px;">
                            <span style="color:var(--success);">💰 Venta: ${property.currency} ${this.formatPrice(property.salePrice || property.price)}</span>
                            <span style="color:var(--info);">🔑 Alquiler: ${property.currency} ${this.formatPrice(property.rentPrice)}/mes</span>
                        </p>
                    ` : `
                        <p class="property-price">${property.currency} ${this.formatPrice(property.price)}${property.operation === 'rent' ? '/mes' : ''}</p>
                    `}
                    <div class="property-features">
                        ${property.bedrooms ? `<span>🛏️ ${property.bedrooms}</span>` : ''}
                        ${property.bathrooms ? `<span>🚿 ${property.bathrooms}</span>` : ''}
                        ${property.area ? `<span>📐 ${property.area}m²</span>` : ''}
                    </div>
                    ${captadorSection}
                    ${canMarkAsSold ? `<button class="btn-sold" onclick="event.stopPropagation(); Properties.openSaleModal('${property.id}')">💰 Vendido</button>` : ''}
                </div>
            </div>
        `;
    },

    openModal(property = null) {
        const form = document.getElementById('propertyForm');
        const title = document.getElementById('propertyModalTitle');
        this.currentImages = [];

        if (property) {
            title.textContent = 'Editar Propiedad';
            // Inject Top Save Button for better UX
            const headerBtnContainer = document.getElementById('modalHeaderBtnContainer');
            if (headerBtnContainer) {
                headerBtnContainer.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('propertyForm').dispatchEvent(new Event('submit'))">💾 Guardar Cambios</button>`;
            } else {
                // Create container if not exists (quick hack or standard append)
                const header = this.modal.querySelector('.modal-header');
                if (header && !header.querySelector('.header-actions')) {
                    const actions = document.createElement('div');
                    actions.className = 'header-actions';
                    actions.id = 'modalHeaderBtnContainer';
                    actions.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('propertyForm').dispatchEvent(new Event('submit'))" style="margin-right:1rem;">💾 Guardar</button>`;
                    header.insertBefore(actions, header.querySelector('.modal-close'));
                }
            }

            document.getElementById('propertyId').value = property.id;
            document.getElementById('propertyTitle').value = property.title || '';
            document.getElementById('propertyType').value = property.type || '';
            document.getElementById('propertyStatus').value = property.status || 'available';
            document.getElementById('propertyOperation').value = property.operation || 'sale';

            // Handle dual pricing
            if (property.operation === 'both') {
                document.getElementById('propertySalePrice').value = property.salePrice || property.price || '';
                document.getElementById('propertyRentPrice').value = property.rentPrice || '';
                document.getElementById('propertyPrice').value = '';
            } else {
                document.getElementById('propertyPrice').value = property.price || '';
                if (document.getElementById('propertySalePrice')) document.getElementById('propertySalePrice').value = '';
                if (document.getElementById('propertyRentPrice')) document.getElementById('propertyRentPrice').value = '';
            }
            this.togglePriceFields();

            document.getElementById('propertyCurrency').value = property.currency || 'USD';
            document.getElementById('propertyAddress').value = property.address || '';
            document.getElementById('propertyLat').value = property.lat || '';
            document.getElementById('propertyLng').value = property.lng || '';
            document.getElementById('propertyArea').value = property.area || '';
            document.getElementById('propertyBedrooms').value = property.bedrooms || '';
            document.getElementById('propertyBathrooms').value = property.bathrooms || '';
            document.getElementById('propertyParking').value = property.parking || '';
            document.getElementById('propertyDescription').value = property.description || '';
            document.getElementById('propertyFeatures').value = property.features?.join(', ') || '';
            this.currentImages = property.images || [];
            if (document.getElementById('propertyOwner')) {
                document.getElementById('propertyOwner').value = property.ownerId || '';
            }
            // Captación fields
            if (document.getElementById('propertyCaptacionSource')) {
                document.getElementById('propertyCaptacionSource').value = property.captacionSource || '';
            }
            if (document.getElementById('propertyCaptadorAgent')) {
                document.getElementById('propertyCaptadorAgent').value = property.captadorAgent || '';
            }
            if (document.getElementById('propertyCaptadorAgency')) {
                document.getElementById('propertyCaptadorAgency').value = property.captadorAgency || '';
            }
            if (document.getElementById('propertyCaptacionId')) {
                document.getElementById('propertyCaptacionId').value = property.captacionId || '';
            }
            if (document.getElementById('propertyCaptacionDate')) {
                document.getElementById('propertyCaptacionDate').value = property.captacionDate || '';
            }
        } else {
            title.textContent = 'Nueva Propiedad';
            // Inject Top Save + Import Buttons
            const headerBtnContainer = document.getElementById('modalHeaderBtnContainer');
            if (headerBtnContainer) {
                headerBtnContainer.innerHTML = `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="Properties.triggerImport()" style="margin-right:0.5rem;" title="Importar Excel con datos">📥 Importar Excel</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="Properties.downloadTemplate()" style="margin-right:1rem;" title="Descargar plantilla vacía">📄 Plantilla</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('propertyForm').dispatchEvent(new Event('submit'))">💾 Guardar</button>
                 `;
            } else {
                // Create if missing
                const header = this.modal.querySelector('.modal-header');
                if (header && !header.querySelector('.header-actions')) {
                    const actions = document.createElement('div');
                    actions.className = 'header-actions';
                    actions.id = 'modalHeaderBtnContainer';
                    actions.innerHTML = `
                        <button type="button" class="btn btn-secondary btn-sm" onclick="Properties.triggerImport()" style="margin-right:0.5rem;">📥 Importar Excel</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="Properties.downloadTemplate()" style="margin-right:1rem;">📄 Plantilla</button>
                        <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('propertyForm').dispatchEvent(new Event('submit'))">💾 Guardar</button>
                     `;
                    header.insertBefore(actions, header.querySelector('.modal-close'));
                }
            }

            form.reset();
            document.getElementById('propertyId').value = '';
            // Reset dual price fields to default state
            this.togglePriceFields();
        }
        this.updateOwnerSelect();

        this.renderImagePreviews();
        this.modal.classList.add('active');

        // Initialize mini-map after modal is visible
        setTimeout(() => {
            const lat = property?.lat || null;
            const lng = property?.lng || null;
            this.initMiniMap(lat, lng);
        }, 300);
    },

    closeModal() {
        this.modal.classList.remove('active');
        this.currentImages = [];
    },

    async handleImages(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await Storage.processImage(file);
                this.currentImages.push(base64);
            }
        }
        this.renderImagePreviews();
    },

    async handleImageDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await Storage.processImage(file);
                this.currentImages.push(base64);
            }
        }
        this.renderImagePreviews();
    },

    async handleImagePaste(e) {
        // Only process if property modal is open
        if (!this.modal.classList.contains('active')) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        let imageFound = false;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const base64 = await Storage.processImage(file);
                    this.currentImages.push(base64);
                    imageFound = true;
                }
            }
        }

        if (imageFound) {
            this.renderImagePreviews();
            App.showToast('📷 Imagen pegada desde portapapeles', 'success');
        }
    },

    renderImagePreviews() {
        const container = document.getElementById('propertyImagePreview');
        if (!container) return;

        container.innerHTML = this.currentImages.map((img, i) => `
            <div class="image-preview">
                <img src="${img}" alt="Preview ${i + 1}" onclick="App.openLightbox(Properties.currentImages, ${i})" style="cursor:zoom-in;">
                <button type="button" class="remove-image" onclick="event.stopPropagation(); Properties.removeImage(${i})">×</button>
            </div>
        `).join('');
    },

    removeImage(index) {
        this.currentImages.splice(index, 1);
        this.renderImagePreviews();
    },

    async handleSubmit(e) {
        e.preventDefault();

        const operation = document.getElementById('propertyOperation').value;

        // Handle dual pricing for both (sale + rent)
        let price = 0;
        let salePrice = null;
        let rentPrice = null;

        if (operation === 'both') {
            salePrice = parseFloat(document.getElementById('propertySalePrice').value) || 0;
            rentPrice = parseFloat(document.getElementById('propertyRentPrice').value) || 0;
            price = salePrice; // Use sale price as main price for compatibility
        } else {
            price = parseFloat(document.getElementById('propertyPrice').value) || 0;
        }

        const property = {
            id: document.getElementById('propertyId').value || null,
            title: document.getElementById('propertyTitle').value,
            type: document.getElementById('propertyType').value,
            status: document.getElementById('propertyStatus').value,
            operation: operation,
            price: price,
            salePrice: salePrice,
            rentPrice: rentPrice,
            currency: document.getElementById('propertyCurrency').value,
            address: document.getElementById('propertyAddress').value,
            lat: parseFloat(document.getElementById('propertyLat').value) || null,
            lng: parseFloat(document.getElementById('propertyLng').value) || null,
            area: parseFloat(document.getElementById('propertyArea').value) || null,
            bedrooms: parseInt(document.getElementById('propertyBedrooms').value) || null,
            bathrooms: parseInt(document.getElementById('propertyBathrooms').value) || null,
            parking: parseInt(document.getElementById('propertyParking').value) || null,
            description: document.getElementById('propertyDescription').value,
            features: document.getElementById('propertyFeatures').value.split(',').map(f => f.trim()).filter(f => f),
            images: this.currentImages,
            ownerId: document.getElementById('propertyOwner')?.value || null,
            // Captación fields
            captacionSource: document.getElementById('propertyCaptacionSource')?.value || null,
            captadorAgent: document.getElementById('propertyCaptadorAgent')?.value || null,
            captadorAgency: document.getElementById('propertyCaptadorAgency')?.value || null,
            captacionId: document.getElementById('propertyCaptacionId')?.value || null,
            captacionDate: document.getElementById('propertyCaptacionDate')?.value || null
        };

        // Secretary restriction: can only add NEW items (not edit), and they go to pending
        if (Storage.isSecretary()) {
            if (property.id) {
                // Trying to edit existing - BLOCKED
                App.showToast('❌ No tienes permiso para editar. Solo puedes agregar nuevos datos.', 'error');
                return;
            }
            // New item - send to pending approvals
            await Storage.savePending('property', property);
            this.closeModal();
            this.render();
            return;
        }

        Storage.saveProperty(property);
        this.closeModal();
        this.render();
        App.updateDashboard();
        App.showToast('Propiedad guardada correctamente', 'success');
    },

    showDetail(id) {
        const property = Storage.getProperties().find(p => p.id === id);
        if (!property) return;

        const modal = document.getElementById('detailModal');
        const content = modal.querySelector('.modal-content');
        const statusLabels = { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido', rented: 'Alquilado' };
        const typeLabels = { house: 'Casa', apartment: 'Departamento', land: 'Terreno', commercial: 'Comercial', office: 'Oficina' };

        content.innerHTML = `
            <div class="modal-header">
                <h2>${property.title}</h2>
                <button class="modal-close" onclick="App.closeModal('detailModal')">×</button>
            </div>
            <div class="modal-body">
                <div class="detail-gallery">
                    ${property.images?.length ? property.images.map((img, i) => `
                        <img src="${img}" alt="Imagen ${i + 1}" onclick="App.openLightbox(${JSON.stringify(property.images)}, ${i})" style="cursor:pointer; max-height:200px; border-radius:8px; margin-right:8px;">
                    `).join('') : '<p>Sin imágenes</p>'}
                </div>
                <div class="detail-info" style="margin-top:1rem;">
                    <p><strong>Estado:</strong> <span class="property-status status-${property.status}">${statusLabels[property.status]}</span></p>
                    <p><strong>Tipo:</strong> ${typeLabels[property.type]}</p>
                    <p><strong>Precio:</strong> ${property.currency} ${this.formatPrice(property.price)}</p>
                    <p><strong>Dirección:</strong> ${property.address}</p>
                    ${(() => { const owner = property.ownerId ? Storage.getClients().find(c => c.id === property.ownerId) : null; return owner ? `<p><strong>Propietario:</strong> <a href="tel:${owner.phone}" style="color:var(--primary);">${owner.name} 📞</a></p>` : ''; })()}
                    ${property.area ? `<p><strong>Superficie:</strong> ${property.area} m²</p>` : ''}
                    ${property.bedrooms ? `<p><strong>Habitaciones:</strong> ${property.bedrooms}</p>` : ''}
                    ${property.bathrooms ? `<p><strong>Baños:</strong> ${property.bathrooms}</p>` : ''}
                    ${property.description ? `<p><strong>Descripción:</strong> ${property.description}</p>` : ''}
                    ${property.features?.length ? `<p><strong>Características:</strong> ${property.features.join(', ')}</p>` : ''}
                </div>
                
                ${property.status === 'sold' && property.saleData ? `
                <div style="margin-top:1rem;padding:1rem;background:linear-gradient(to right, #1a1a1a, #2d2d2d);border-radius:var(--radius-sm);border-left:4px solid var(--primary);">
                    <h4 style="margin:0 0 0.75rem 0;color:var(--primary);">💰 Detalles de la Venta</h4>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.9rem; color:white;">
                        <p><strong>Precio Final:</strong> ${property.saleData.currency} ${this.formatPrice(property.saleData.price)}</p>
                        <p><strong>Fecha:</strong> ${property.saleData.date}</p>
                        <p><strong>Comisión:</strong> ${property.saleData.financials?.commissionPercent}%</p>
                        <p><strong>Mi Ganancia:</strong> <span style="color:var(--success);font-weight:bold;">${property.saleData.currency} ${this.formatPrice(property.saleData.myEarnings)}</span></p>
                    </div>
                </div>
                ` : ''}

                ${property.captacionSource ? (() => {
                // C21 Sky ID Logic for Modal
                const showId = ['c21_sky', 'c21_captaciones', 'c21_cartera'].includes(property.captacionSource);

                return `
                    <div style="margin-top:1rem;padding:1rem;background:var(--bg-tertiary);border-radius:var(--radius-sm);border:1px solid var(--border-color);">
                        <h4 style="margin:0 0 0.75rem 0;color:var(--primary);">📋 Datos de Captación</h4>
                        <p><strong>Fuente:</strong> ${{ propia_exclusiva: 'Propia - Exclusividad Firmada', propia_cartera: 'Propia - Cartera Privada', c21_cartera: 'C21 Cartera Privada', c21_sky: 'C21 Sky Captaciones', c21_captaciones: 'C21 Captaciones' }[property.captacionSource] || property.captacionSource}</p>
                        ${property.captadorAgent ? `<p><strong>Agente Captador:</strong> ${property.captadorAgent}</p>` : ''}
                        
                        ${showId && property.captacionId ?
                        `<p style="margin-top:0.5rem;font-size:1.1em;color:var(--primary);"><strong>ID C21:</strong> <code style="background:rgba(190, 159, 86, 0.2);padding:0.25rem 0.75rem;border-radius:4px;border:1px solid var(--primary);">${property.captacionId}</code></p>`
                        : ''
                    }
                        
                        ${property.captacionDate ? `<p><strong>Fecha:</strong> ${property.captacionDate}</p>` : ''}
                    </div>
                    `;
            })() : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeModal('detailModal')">Cerrar</button>
                <button class="btn btn-primary" onclick="PDFGenerator.generatePropertyReport('${property.id}')" style="background-color:#4f46e5;" title="Ver y descargar informe de gestión">👁️ Ver Informe PDF</button>
                <button class="btn btn-warning" onclick="Properties.edit('${property.id}')">Editar</button>
                <button class="btn btn-danger" onclick="Properties.delete('${property.id}')">Eliminar</button>
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
        const property = Storage.getProperties().find(p => p.id === id);
        if (property) this.openModal(property);
    },

    delete(id) {
        // Secretary restriction: cannot delete
        if (Storage.isSecretary()) {
            App.showToast('❌ No tienes permiso para eliminar datos.', 'error');
            return;
        }
        if (confirm('¿Estás seguro de eliminar esta propiedad?')) {
            Storage.deleteProperty(id);
            App.closeModal('detailModal');
            this.render();
            App.updateDashboard();
            App.showToast('Propiedad eliminada', 'warning');
        }
    },

    formatPrice(price) {
        return new Intl.NumberFormat('es-AR').format(price);
    },

    // ===== SALE REGISTRATION SYSTEM =====

    // ===== SALE REGISTRATION SYSTEM =====

    openSaleModal(propertyId) {
        const property = Storage.getProperties().find(p => p.id === propertyId);
        if (!property) return;

        const saleModal = document.getElementById('saleModal');
        const content = saleModal.querySelector('.modal-content');
        const settings = Storage.getSettings();
        const colleagues = Storage.getColleagues();

        // Default: If I am the captador, I likely have the captacion side.
        // If 2 puntas, I have both.
        const isMyCaptation = property.captacionSource?.startsWith('propia_') ||
            property.captadorAgent === settings.agentName;

        content.innerHTML = `
            <div class="modal-header">
                <h2>💰 Registrar Venta</h2>
                <button class="modal-close" onclick="App.closeModal('saleModal')">×</button>
            </div>
            <div class="modal-body">
                <div class="sale-property-info" style="background:var(--bg-tertiary);padding:1rem;border-radius:var(--radius-sm);margin-bottom:1.5rem;">
                    <h3 style="margin:0 0 0.5rem 0;">${property.title}</h3>
                    <p style="margin:0;color:var(--text-secondary);">📍 ${property.address}</p>
                    <p style="margin:0.5rem 0 0 0;font-size:1.25rem;font-weight:600;color:var(--primary);">${property.currency} ${this.formatPrice(property.price)}</p>
                </div>
                <form id="saleForm" class="form-grid">
                    <input type="hidden" id="salePropertyId" value="${property.id}">
                    
                    <!-- Venta Details -->
                    <div class="form-group">
                        <label>Precio Final de Venta *</label>
                        <input type="number" id="saleFinalPrice" required value="${property.price}" placeholder="Precio final" onchange="Properties.updateSaleCalculation()">
                    </div>
                    <div class="form-group">
                        <label>Moneda</label>
                        <select id="saleCurrency" onchange="Properties.updateSaleCalculation()">
                            <option value="USD" ${property.currency === 'USD' ? 'selected' : ''}>USD</option>
                            <option value="MXN" ${property.currency === 'MXN' ? 'selected' : ''}>MXN</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Fecha de Cierre *</label>
                        <input type="date" id="saleDate" required value="${new Date().toISOString().split('T')[0]}">
                    </div>

                    <!-- Puntas / Rol -->
                    <div class="form-group">
                        <label>Tipo de Operación (Puntas) *</label>
                        <select id="saleRole" required onchange="Properties.updateSaleCalculation()">
                            <option value="">Seleccionar...</option>
                            <option value="ambos" selected>2 Puntas (Capté y Vendí - 100%)</option>
                            <option value="captador" ${isMyCaptation ? '' : ''}>1 Punta (Solo Captador - 50%)</option>
                            <option value="vendedor" ${!isMyCaptation ? '' : ''}>1 Punta (Solo Vendedor - 50%)</option>
                        </select>
                    </div>
                    
                    <!-- Colleague Section -->
                    <div class="form-group full-width" id="colleagueSection" style="display:none;background:var(--bg-secondary);padding:1rem;border-radius:var(--radius-sm);border-left:4px solid var(--text-muted);">
                        <h4 style="margin:0 0 1rem 0;color:var(--text-primary);font-size:0.9rem;">🤝 Datos del Colega (Otra Punta)</h4>
                        <div class="form-grid" style="gap:1rem;">
                            <div class="form-group">
                                <label>Nombre del Colega</label>
                                <input type="text" id="saleColleagueName" list="colleaguesList" placeholder="Nombre..." onchange="Properties.onColleagueSelect()">
                                <datalist id="colleaguesList">
                                    ${colleagues.map(c => `<option value="${c.name}" data-agency="${c.agency || ''}">`).join('')}
                                </datalist>
                            </div>
                            <div class="form-group">
                                <label>Agencia / Inmobiliaria</label>
                                <input type="text" id="saleColleagueAgency" placeholder="Agencia...">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Calculator Panel -->
                    <div class="form-group full-width" style="background:var(--bg-tertiary);padding:1.25rem;border-radius:var(--radius-sm);margin-top:0.5rem;border:1px solid var(--border-color);">
                        <h4 style="margin:0 0 1rem 0; color:var(--primary);">💵 Desglose de Comisión</h4>
                        
                        <div class="form-grid" style="gap:1rem; margin-bottom:1rem;">
                            <div class="form-group">
                                <label>Comisión Total Op. (%)</label>
                                <input type="number" id="saleCommissionPercent" step="0.5" value="5" min="0" max="100" onchange="Properties.updateSaleCalculation()" style="font-weight:bold;">
                            </div>
                            
                            <div class="form-group">
                                <label title="Porcentaje del total que corresponde a C21 Sky (Base de cálculo)">Base C21 Sky (%)</label>
                                <input type="number" id="saleOfficeSplitPercent" step="1" value="50" min="0" max="100" onchange="Properties.updateSaleCalculation()">
                                <span style="font-size:0.7rem;color:var(--text-muted);">El % del total que recibe la oficina</span>
                            </div>

                            <div class="form-group">
                                <label>Tu Nivel C21</label>
                                <select id="saleAgentLevelSelect" onchange="Properties.updateAgentPercentage()">
                                    <option value="bronce" ${settings.agentLevel === 'bronce' ? 'selected' : ''}>Bronce</option>
                                    <option value="plata" ${settings.agentLevel === 'plata' ? 'selected' : ''}>Plata</option>
                                    <option value="oro" ${settings.agentLevel === 'oro' ? 'selected' : ''}>Oro</option>
                                    <option value="platino" ${settings.agentLevel === 'platino' ? 'selected' : ''}>Platino</option>
                                </select>
                            </div>

                             <div class="form-group">
                                <label>Tu % Cobro (Sobre Base)</label>
                                <input type="number" id="saleAgentPercentManual" step="1" value="${this.getAgentPercent(settings.agentLevel || 'bronce')}" onchange="Properties.updateSaleCalculation()">
                            </div>
                        </div>

                        <!-- Results Box -->
                        <div id="calculationResults" style="background:var(--bg-primary); padding:1rem; border-radius:var(--radius-sm); border-left:4px solid var(--primary); display:grid; gap:0.5rem;">
                            <!-- Dynamic Content -->
                        </div>
                    </div>
                    
                    <div class="form-group full-width">
                        <label>Notas adicionales</label>
                        <textarea id="saleNotes" rows="2" placeholder="Observaciones sobre la venta..."></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="App.closeModal('saleModal')">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="Properties.handleSaleSubmit()">✓ Confirmar Venta</button>
            </div>
        `;

        saleModal.classList.add('active');
        this.updateSaleCalculation();
    },

    getAgentPercent(level) {
        const levels = { bronce: 60, plata: 65, oro: 70, platino: 75 };
        return levels[level] || 60;
    },

    updateAgentPercentage() {
        const level = document.getElementById('saleAgentLevelSelect').value;
        const percentInput = document.getElementById('saleAgentPercentManual');
        percentInput.value = this.getAgentPercent(level);
        this.updateSaleCalculation();
    },

    onColleagueSelect() {
        const nameInput = document.getElementById('saleColleagueName');
        const agencyInput = document.getElementById('saleColleagueAgency');
        const colleagues = Storage.getColleagues();
        const found = colleagues.find(c => c.name.toLowerCase() === nameInput.value.toLowerCase());
        if (found && found.agency) agencyInput.value = found.agency;
    },

    updateSaleCalculation() {
        const getVal = (id) => document.getElementById(id)?.value;

        const price = this.parseLocalFloat(getVal('saleFinalPrice'));
        const commPercent = this.parseLocalFloat(getVal('saleCommissionPercent'));
        const role = getVal('saleRole');
        const officeSplitPercent = this.parseLocalFloat(getVal('saleOfficeSplitPercent'));
        const agentPercent = this.parseLocalFloat(getVal('saleAgentPercentManual'));
        const currency = getVal('saleCurrency');

        // Visual toggle for colleague
        const colleagueSection = document.getElementById('colleagueSection');
        if (colleagueSection) colleagueSection.style.display = (role === 'ambos') ? 'none' : 'block';

        // 1. Total Operation Commission
        const totalCommission = price * (commPercent / 100);

        // 2. Base "C21 Sky"
        const c21Base = totalCommission * (officeSplitPercent / 100);

        // 3. User Earnings
        const myEarnings = c21Base * (agentPercent / 100);

        // Render
        const resultsDiv = document.getElementById('calculationResults');
        resultsDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--text-secondary);">
                <span>Comisión Total Operación (${commPercent}%)</span>
                <span>$${this.formatPrice(totalCommission)} ${currency}</span>
            </div>
            
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--text-secondary);">
                <span>Base C21 Sky (${officeSplitPercent}%)</span>
                <span>$${this.formatPrice(c21Base)} ${currency}</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; padding-top:0.5rem; border-top:1px dashed var(--border-color);">
                <span style="font-weight:600; color:var(--text-primary);">MI GANANCIA FINAL (${agentPercent}%)</span>
                <span style="font-size:1.4rem; font-weight:700; color:var(--success);">$${this.formatPrice(myEarnings)} ${currency}</span>
            </div>
            
            <input type="hidden" id="calculatedMyEarnings" value="${myEarnings}">
        `;
    },

    formatPrice(price) {
        if (!price && price !== 0) return '0';
        return Number(price).toLocaleString('es-DE'); // Formats as 150.000 (German/Arg standard)
    },

    // Helper for Dot/Comma decimals
    // Smart Money Parser (Handles 1.000,00 and 1,000.00)
    parseLocalFloat(str) {
        if (!str) return 0;
        let s = String(str).trim();
        if (!s) return 0;

        // Remove currency symbols and spaces
        s = s.replace(/[^0-9,.-]/g, '');

        // Check for last occurrence of comma and dot
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');

        // Scenario 1: Only Comma (Latin/EU decimal: 10,5 or 1000,00)
        if (lastComma !== -1 && lastDot === -1) {
            return parseFloat(s.replace(',', '.'));
        }

        // Scenario 2: Only Dot (US decimal: 10.5 or 1000.00 - OR Latin Thousands: 1.000)
        // Ambiguous: 1.000 could be 1k or 1.0. 
        // Assumption: If multiple dots, it's thousands. If one dot...
        if (lastComma === -1 && lastDot !== -1) {
            const parts = s.split('.');
            if (parts.length > 2) {
                // Multiple dots -> Thousands separator -> Remove them
                return parseFloat(s.replace(/\./g, ''));
            }
            // Single dot -> Decimal
            return parseFloat(s);
        }

        // Scenario 3: Mixed (1.000,00 vs 1,000.00)
        if (lastComma !== -1 && lastDot !== -1) {
            if (lastComma > lastDot) {
                // Comma is last -> Decimal (Latin: 1.000,00)
                // Remove dots, replace comma with dot
                return parseFloat(s.replace(/\./g, '').replace(',', '.'));
            } else {
                // Dot is last -> Decimal (US: 1,000.00)
                // Remove commas
                return parseFloat(s.replace(/,/g, ''));
            }
        }

        // Scenario 4: Plain number
        return parseFloat(s);
    },

    handleSaleSubmit() {
        // Safe Get Helper
        const getVal = (id) => document.getElementById(id)?.value;

        const id = getVal('salePropertyId');
        const price = this.parseLocalFloat(getVal('saleFinalPrice'));

        if (!price || price <= 0) return App.showToast('Ingresa un precio final válido', 'error');

        const role = getVal('saleRole');

        // Capture all values safely
        const saleData = {
            date: getVal('saleDate'),
            price: price,
            notes: getVal('saleNotes'),
            financials: {
                commissionPercent: this.parseLocalFloat(getVal('saleCommissionPercent')),
                // Determine if shared based on role selection
                isShared: role !== 'ambos',
                officeSplitPercent: this.parseLocalFloat(getVal('saleOfficeSplitPercent'))
            },
            role: role, // Save the selected role
            colleague: {
                name: getVal('saleColleagueName') || '',
                agency: getVal('saleColleagueAgency') || ''
            },
            // Safe parse of earnings using the ROBUST parseLocalFloat
            // Extract just the number string first, then parse
            myEarnings: this.parseLocalFloat(document.getElementById('calculatedMyEarnings')?.innerText)
        };

        // Fallback checks
        if (!saleData.date) return App.showToast('Ingresa la fecha de cierre', 'error');

        // Save Data
        const property = Storage.getProperties().find(p => p.id === id);
        if (property) {
            property.status = 'sold';
            property.saleData = saleData;
            property.updatedAt = new Date().toISOString();

            Storage.saveProperty(property);

            // Save colleague if exists
            if (saleData.colleague.name) {
                Storage.saveColleague(saleData.colleague);
            }

            App.closeModal('saleModal');
            this.render();
            App.updateDashboard();
            App.showToast('¡Venta registrada exitosamente!', 'success');
        }
    },

    openEarningsReport(filter = 'all') {
        const modal = document.getElementById('earningsModal');
        const content = modal.querySelector('.modal-content');

        const properties = Storage.getProperties();
        let operations = properties.filter(p => (p.status === 'sold' || p.status === 'rented') && p.saleData);

        // Filter Logic
        if (filter === 'sale') operations = operations.filter(p => p.operation === 'sale' || p.operation === 'venta');
        if (filter === 'rent') operations = operations.filter(p => p.operation === 'rent' || p.operation === 'alquiler');

        // Calculations
        const totalVolume = operations.reduce((sum, p) => sum + (p.saleData.price || 0), 0);
        const totalEarnings = operations.reduce((sum, p) => sum + (p.saleData.myEarnings || 0), 0);

        content.innerHTML = `
            <div class="modal-header">
                <h2>📊 Reporte de Operaciones</h2>
                <button class="modal-close" onclick="document.getElementById('earningsModal').classList.remove('active')">×</button>
            </div>
            <div class="modal-body">
                <!-- KPI Cards -->
                <div class="stats-grid" style="margin-bottom:2rem;">
                    <div class="stat-card" style="background:var(--bg-secondary); border-left:4px solid var(--success);">
                        <div class="stat-info">
                            <span class="stat-value" style="color:var(--success);">$${this.formatPrice(totalEarnings)}</span>
                            <span class="stat-label">Ganancia Neta</span>
                        </div>
                    </div>
                    <div class="stat-card" style="background:var(--bg-secondary); border-left:4px solid var(--primary);">
                        <div class="stat-info">
                            <span class="stat-value" style="color:var(--primary);">$${this.formatPrice(totalVolume)}</span>
                            <span class="stat-label">Volumen Total</span>
                        </div>
                    </div>
                    <div class="stat-card" style="background:var(--bg-secondary); border-left:4px solid var(--info);">
                        <div class="stat-info">
                            <span class="stat-value" style="color:var(--info);">${operations.length}</span>
                            <span class="stat-label">Operaciones</span>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="filters-bar" style="margin-bottom:1rem;">
                    <div class="filter-group">
                        <button class="btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="Properties.openEarningsReport('all')">Todos</button>
                        <button class="btn btn-sm ${filter === 'sale' ? 'btn-primary' : 'btn-secondary'}" onclick="Properties.openEarningsReport('sale')">Ventas</button>
                        <button class="btn btn-sm ${filter === 'rent' ? 'btn-primary' : 'btn-secondary'}" onclick="Properties.openEarningsReport('rent')">Alquileres</button>
                    </div>
                </div>

                <!-- Table -->
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; color:white;">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border-color); text-align:left;">
                                <th style="padding:1rem;">Fecha</th>
                                <th style="padding:1rem;">Propiedad</th>
                                <th style="padding:1rem;">Tipo</th>
                                <th style="padding:1rem;">Precio Op.</th>
                                <th style="padding:1rem;">Comisión</th>
                                <th style="padding:1rem;">Ganancia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${operations.length === 0 ? '<tr><td colspan="6" style="padding:2rem; text-align:center; color:var(--text-secondary);">No hay operaciones registradas</td></tr>' :
                operations.map(p => `
                                    <tr style="border-bottom:1px solid var(--border-color);">
                                        <td style="padding:1rem; color:var(--text-secondary);">${p.saleData.date}</td>
                                        <td style="padding:1rem; font-weight:600;">${p.title}</td>
                                        <td style="padding:1rem;"><span class="badge ${p.operation.includes('sale') ? 'badge-success' : 'badge-info'}">${p.operation === 'sale' ? 'Venta' : 'Alquiler'}</span></td>
                                        <td style="padding:1rem;">$${this.formatPrice(p.saleData.price)}</td>
                                        <td style="padding:1rem;">${p.saleData.financials?.commissionPercent}%</td>
                                        <td style="padding:1rem; color:var(--success); font-weight:700;">$${this.formatPrice(p.saleData.myEarnings)}</td>
                                    </tr>
                                `).join('')
            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        modal.classList.add('active');
    },

    // ===== MAP SYSTEM (Leaflet) =====
    generalMap: null,
    miniMap: null,
    miniMapMarker: null,

    // General Map (dedicated section)
    initGeneralMap() {
        const container = document.getElementById('generalMapContainer');
        if (!container) return;

        if (!this.generalMap) {
            // Default: Asunción, Paraguay
            this.generalMap = L.map('generalMapContainer').setView([-25.2867, -57.6470], 12);

            // Street layer (default)
            this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            });

            // Satellite layer (Esri World Imagery)
            this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri'
            });

            // Add street layer by default
            this.streetLayer.addTo(this.generalMap);
            this.isSatelliteView = false;
        }

        this.renderGeneralMap();

        // Leaflet resize fix
        setTimeout(() => {
            this.generalMap.invalidateSize();
        }, 150);
    },

    // Toggle satellite view
    toggleSatelliteView() {
        if (!this.generalMap) return;

        const btn = document.getElementById('mapSatelliteBtn');

        if (this.isSatelliteView) {
            this.generalMap.removeLayer(this.satelliteLayer);
            this.streetLayer.addTo(this.generalMap);
            this.isSatelliteView = false;
            if (btn) btn.innerHTML = '🛰️ Satélite';
        } else {
            this.generalMap.removeLayer(this.streetLayer);
            this.satelliteLayer.addTo(this.generalMap);
            this.isSatelliteView = true;
            if (btn) btn.innerHTML = '🗺️ Mapa';
        }
    },

    renderGeneralMap() {
        if (!this.generalMap) return;

        // Clear existing markers
        this.generalMap.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                this.generalMap.removeLayer(layer);
            }
        });

        const statusFilter = document.getElementById('mapFilterStatus')?.value || '';
        const showSigns = document.getElementById('mapShowSigns')?.checked ?? true;

        let properties = Storage.getProperties();

        if (statusFilter) {
            properties = properties.filter(p => p.status === statusFilter);
        }

        const statusLabels = { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido', rented: 'Alquilado' };
        const statusColors = { available: '#10b981', reserved: '#f59e0b', sold: '#ef4444', rented: '#06b6d4' };

        let propCount = 0;
        let signCount = 0;

        // Render properties
        properties.forEach(p => {
            if (p.lat && p.lng) {
                propCount++;
                const color = statusColors[p.status] || '#BE9F56';

                // Custom icon with status color
                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background:${color}; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                const marker = L.marker([p.lat, p.lng], { icon }).addTo(this.generalMap);

                marker.bindPopup(`
                    <div style="min-width:180px; font-family:Inter,sans-serif;">
                        <b style="font-size:1rem;">🏠 ${p.title}</b><br>
                        <span style="color:#666;">📍 ${p.address || 'Sin dirección'}</span><br>
                        <span style="font-size:1.1rem; font-weight:bold; color:#BE9F56;">${p.currency} ${this.formatPrice(p.price)}</span><br>
                        <span style="display:inline-block; margin-top:4px; padding:2px 8px; border-radius:4px; font-size:0.75rem; background:${color}; color:white;">${statusLabels[p.status] || p.status}</span>
                        <br><button onclick="Properties.showDetail('${p.id}')" style="margin-top:8px; padding:4px 12px; background:#BE9F56; color:white; border:none; border-radius:4px; cursor:pointer;">Ver Detalle</button>
                    </div>
                `);
            }
        });

        // Render signs if checkbox is checked
        if (showSigns) {
            const signs = Storage.getSigns();
            signs.forEach(s => {
                if (s.lat && s.lng) {
                    signCount++;
                    const signColor = s.type === 'venta' ? '#ef4444' : '#3b82f6'; // Red for sale, blue for rent

                    // Custom icon for signs - different shape (square with rounded corners)
                    const icon = L.divIcon({
                        className: 'custom-marker sign-marker',
                        html: `<div style="background:${signColor}; width:20px; height:20px; border-radius:4px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:10px;">📋</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });

                    const marker = L.marker([s.lat, s.lng], { icon }).addTo(this.generalMap);

                    marker.bindPopup(`
                        <div style="min-width:160px; font-family:Inter,sans-serif;">
                            <b style="font-size:0.95rem;">📋 Cartel ${s.type === 'venta' ? '🔴 Venta' : '🔵 Alquiler'}</b><br>
                            <span style="color:#666;">📞 ${s.phone || 'Sin teléfono'}</span><br>
                            <span style="color:#666;">📍 ${s.address || 'Sin dirección'}</span><br>
                            <span style="font-size:0.75rem; color:#888;">${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}</span>
                        </div>
                    `);
                }
            });
        }

        // Update the title with count
        const headerTitle = document.querySelector('#section-map .section-header h1');
        if (headerTitle) {
            let countText = `${propCount} propiedad${propCount !== 1 ? 'es' : ''}`;
            if (showSigns && signCount > 0) {
                countText += `, ${signCount} cartel${signCount !== 1 ? 'es' : ''}`;
            }
            headerTitle.innerHTML = `📍 Mapa <small style="font-size:0.5em; color:var(--text-muted);">(${countText})</small>`;
        }
    },

    // Mini-Map for Property Form
    initMiniMap(lat = null, lng = null) {
        const container = document.getElementById('propertyMiniMap');
        if (!container) return;

        // Destroy existing if any
        if (this.miniMap) {
            this.miniMap.remove();
            this.miniMap = null;
            this.miniMapMarker = null;
        }

        const defaultLat = lat || -25.2867;
        const defaultLng = lng || -57.6470;

        this.miniMap = L.map('propertyMiniMap').setView([defaultLat, defaultLng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OSM'
        }).addTo(this.miniMap);

        // Add marker if we have coordinates
        if (lat && lng) {
            this.miniMapMarker = L.marker([lat, lng]).addTo(this.miniMap);
        }

        // Click to set location
        this.miniMap.on('click', (e) => {
            const { lat, lng } = e.latlng;

            // Update form fields
            document.getElementById('propertyLat').value = lat.toFixed(6);
            document.getElementById('propertyLng').value = lng.toFixed(6);

            // Update or create marker
            if (this.miniMapMarker) {
                this.miniMapMarker.setLatLng([lat, lng]);
            } else {
                this.miniMapMarker = L.marker([lat, lng]).addTo(this.miniMap);
            }
        });

        // Resize fix
        setTimeout(() => {
            this.miniMap.invalidateSize();
        }, 200);
    }
};
