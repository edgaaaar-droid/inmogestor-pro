// PDF Generator Service
// Requires jsPDF library

const PDFGenerator = {
    async generatePropertyReport(propertyId) {
        try {
            const property = Storage.getProperties().find(p => p.id === propertyId);
            if (!property) throw new Error('Propiedad no encontrada');

            const visits = Storage.getFollowups().filter(f =>
                f.propertyId === propertyId &&
                f.type === 'visit'
            ).sort((a, b) => new Date(b.date) - new Date(a.date));

            // Initialize jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Branding Colors - C21 Sky Palette
            const goldColor = [190, 159, 86]; // #BE9F56 Gold
            const darkColor = [20, 20, 20]; // #141414 Black/Dark
            const lightColor = [250, 250, 250]; // #FAFAFA White-ish
            const grayColor = [100, 100, 100]; // #646464 Gray

            // --- HEADER ---
            // Dark Background
            doc.setFillColor(...darkColor);
            doc.rect(0, 0, 210, 50, 'F');

            // Agent Logo/Name Area
            const settings = Storage.getSettings();

            // Gold Line Accent
            doc.setDrawColor(...goldColor);
            doc.setLineWidth(1);
            doc.line(20, 15, 20, 35); // Vertical gold line decoration

            // Title
            doc.setTextColor(...goldColor);
            doc.setFontSize(26);
            doc.setFont('helvetica', 'bold');
            doc.text("INFORME DE GESTIÓN", 25, 25);

            // Subtitle
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("PREPARADO EXCLUSIVAMENTE PARA EL PROPIETARIO", 25, 32);

            // Date (Right side)
            const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
            doc.setTextColor(200, 200, 200);
            doc.setFontSize(9);
            doc.text(today.toUpperCase(), 190, 25, { align: 'right' });

            // Agent Info (Right side, below date)
            doc.setTextColor(...goldColor);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text((settings.agentName || 'Edgar Paniagua').toUpperCase(), 190, 32, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text((settings.agentAgency || 'C21 SKY').toUpperCase(), 190, 37, { align: 'right' });


            // --- PROPERTY SECTION ---
            let y = 70;

            // Property Title
            doc.setTextColor(...darkColor);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(property.title, 20, y);

            // Price Tag Style
            const price = `${property.currency} ${Number(property.price).toLocaleString('es-ES')}`;
            doc.setFillColor(...goldColor);
            doc.rect(150, y - 6, 40, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text(price, 170, y, { align: 'center' });

            y += 10;
            doc.setDrawColor(220, 220, 220);
            doc.line(20, y, 190, y);
            y += 15;

            // Details Grid
            doc.setTextColor(...darkColor);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            const typeLabels = {
                house: 'Casa', apartment: 'Departamento', land: 'Terreno',
                commercial: 'Comercial', office: 'Oficina'
            };

            const leftCol = 20;
            const rightCol = 110;
            const rowHeight = 9;

            // Row 1
            doc.setFont('helvetica', 'bold');
            doc.text('TIPO DE PROPIEDAD', leftCol, y);
            doc.text('ESTADO ACTUAL', rightCol, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.text((typeLabels[property.type] || property.type).toUpperCase(), leftCol, y);
            doc.text(this.translateStatus(property.status).toUpperCase(), rightCol, y);
            y += rowHeight;

            // Row 2
            doc.setFont('helvetica', 'bold');
            doc.text('DIRECCIÓN', leftCol, y);
            doc.text('FUENTE CAPTACIÓN', rightCol, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.text(property.address, leftCol, y);
            doc.text(this.translateCaptacion(property.captacionSource || 'No especificado').toUpperCase(), rightCol, y);
            y += rowHeight;

            // ID Check for PDF
            const showId = ['c21_sky', 'c21_captaciones', 'c21_cartera'].includes(property.captacionSource);
            if (showId && property.captacionId) {
                // Row 3
                doc.setFont('helvetica', 'bold');
                doc.text('ID PROPIEDAD (C21)', leftCol, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                doc.text(property.captacionId, leftCol, y);
                y += rowHeight;
            } else {
                y += rowHeight; // Spacer
            }


            // --- STATS HIGHLIGHTS ---
            y += 10;

            // Background box for stats
            doc.setFillColor(20, 20, 20); // Dark box
            doc.rect(20, y, 170, 35, 'F');
            doc.setDrawColor(...goldColor);
            doc.rect(20, y, 170, 35, 'D'); // Gold border

            const interested = visits.filter(v => ['interested', 'very_interested', 'offer'].includes(v.result)).length;
            const daysOnMarket = Math.floor((new Date() - new Date(property.createdAt || new Date())) / (1000 * 60 * 60 * 24));
            // Handle NaN if date invalid
            const daysText = isNaN(daysOnMarket) ? 'RECIENTE' : `${daysOnMarket} DÍAS`;

            // Stats Text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);

            // Col 1
            doc.text("TOTAL VISITAS", 45, y + 12, { align: 'center' });
            doc.setTextColor(...goldColor);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(visits.length.toString(), 45, y + 22, { align: 'center' });

            // Col 2
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("INTERESADOS", 105, y + 12, { align: 'center' });
            doc.setTextColor(...goldColor);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(interested.toString(), 105, y + 22, { align: 'center' });

            // Col 3
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("TIEMPO EN MERCADO", 165, y + 12, { align: 'center' });
            doc.setTextColor(...goldColor);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(daysText, 165, y + 22, { align: 'center' });


            // --- TABLE SECTION ---
            y += 50;

            doc.setTextColor(...darkColor);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("BITÁCORA DE VISITAS", 20, y);

            // Gold underline
            doc.setDrawColor(...goldColor);
            doc.setLineWidth(0.5);
            doc.line(20, y + 2, 75, y + 2);

            y += 10;

            if (visits.length === 0) {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text("No existen registros de visitas para este periodo.", 20, y + 10);
            } else {
                // Table Header - Minimalist Luxury
                doc.setFillColor(240, 240, 240);
                doc.rect(20, y, 170, 10, 'F');

                doc.setTextColor(...darkColor);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');

                doc.text("FECHA", 25, y + 7);
                doc.text("CLIENTE", 55, y + 7);
                doc.text("RESULTADO Y COMENTARIOS", 100, y + 7);

                y += 10;

                // Table Rows
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);

                visits.forEach((visit, index) => {
                    const client = Storage.getClients().find(c => c.id === visit.clientId);
                    const clientName = client ? client.name : 'Cliente no reg.';
                    const date = new Date(visit.date).toLocaleDateString();

                    // Check for page break
                    if (y > 260) {
                        doc.addPage();
                        y = 20;
                    }

                    // Row
                    doc.setTextColor(50, 50, 50);
                    doc.text(date, 25, y + 8);

                    doc.setFont('helvetica', 'bold');
                    doc.text(clientName.substring(0, 20), 55, y + 8);

                    // Status pill equivalent (colored text)
                    const resultText = this.translateResult(visit.result);
                    let resultColor = darkColor;
                    if (visit.result === 'interested') resultColor = [16, 185, 129]; // Green
                    if (visit.result === 'not_interested') resultColor = [239, 68, 68]; // Red
                    if (visit.result === 'thinking') resultColor = [245, 158, 11]; // Amber

                    doc.setTextColor(...resultColor);
                    doc.setFontSize(8);
                    doc.text(resultText.toUpperCase(), 100, y + 8);

                    // Feedback
                    doc.setTextColor(80, 80, 80);
                    doc.setFont('helvetica', 'normal');
                    const feedback = visit.feedback ? visit.feedback.replace(/\n/g, ' ') : '';
                    if (feedback) {
                        const splitFeedback = doc.splitTextToSize(feedback, 80);
                        doc.text(splitFeedback, 100, y + 14);
                        y += (splitFeedback.length * 4) + 12; // Dynamic height
                    } else {
                        y += 15;
                    }

                    // Separator line
                    doc.setDrawColor(240, 240, 240);
                    doc.line(20, y - 2, 190, y - 2);
                });
            }

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);

                // Footer styling
                doc.setFillColor(20, 20, 20);
                doc.rect(0, 285, 210, 12, 'F');

                doc.setTextColor(...goldColor);
                doc.setFontSize(8);
                doc.text("C21 SKY - EDGAR PANIAGUA", 20, 292);

                doc.setTextColor(150, 150, 150);
                doc.text(`Página ${i} de ${pageCount}`, 190, 292, { align: 'right' });
            }

            // Save PDF
            try {
                const pdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                const newWindow = window.open(pdfUrl, '_blank');
                if (!newWindow) {
                    const filename = `Informe_${property.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
                    doc.save(filename);
                    App.showToast('Informe descargado.', 'success');
                } else {
                    App.showToast('Informe generado con éxito.', 'success');
                }
            } catch (err) {
                console.error('Error opening PDF:', err);
                const filename = `Informe_Premium_${property.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
                doc.save(filename);
            }

        } catch (e) {
            console.error('Error detallado:', e);
            App.showToast('Error generando informe', 'error');
        }
    },

    translateStatus(status) {
        // ... (unchanged helpers)
        const map = {
            available: 'Disponible',
            reserved: 'Reservado',
            sold: 'Vendido',
            rented: 'Alquilado'
        };
        return map[status] || status;
    },

    translateCaptacion(type) {
        const map = {
            propia_exclusiva: 'Propia (Exclusiva)',
            propia_cartera: 'Propia (Cartera)',
            c21_cartera: 'C21 Cartera',
            c21_sky: 'C21 Sky',
            c21_captaciones: 'C21 Captaciones'
        };
        return map[type] || type;
    },

    translateResult(result) {
        const map = {
            interested: 'Interesado',
            very_interested: 'Muy Interesado',
            offer: 'Oferta Recibida',
            not_interested: 'No Interesado',
            thinking: 'Lo está evaluando',
            rescheduled: 'Reagendado'
        };
        return map[result] || 'Pendiente';
    }
};
