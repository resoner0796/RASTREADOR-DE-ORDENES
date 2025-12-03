const firebaseConfig = {
            apiKey: "AIzaSyDtlj3ppT9WBGMR60SZx0TZmAo3BXQWDX0",
            authDomain: "rastreador-de-ordenes.firebaseapp.com",
            projectId: "rastreador-de-ordenes",
            storageBucket: "rastreador-de-ordenes.appspot.com",
            messagingSenderId: "956052823395",
            appId: "1:956052823395:web:2ba74d9591d2b24c3cc756"
        };
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();

        document.addEventListener('DOMContentLoaded', () => {
            // State variables
            let workshopConfig = {
                mapping: { 'K46': 'MULTIPORT' },
                column: 'C'
            };
            let loadedOrders = new Map();
            let sapData = [];
            let sapLastUpdated = null;
            let sapLastUpdatedBy = null;
            let sapDateFilter = 'default';
            let activeOrderKey = null;
            let currentMode = 'rastreo';
            let mainMode = 'fwd';
            let currentVisibleData = [];
            let orderToUpdateKey = null;
            let rastreoStatusFilter = 'all';
            let rastreoLineFilter = 'all';
            let session = { user: null, isMaster: false, permissions: [] };
            let currentArea = 'MULTIPORT';
            let fwdListener = null;
            let sapListener = null;
            let initialSyncDoneForArea = {};
            let selectedSapOrders = new Set(); // <-- AGREGA ESTA LÍNEA

            // Key Maps
            const TRACKING_KEYS = { SERIAL: 'Product Serial Number', IS_SCRAP: 'Is Scrap', NOT_PACKED: 'Not Packed', CREATED_BY: 'Created By', DATE_REGISTERED: 'Date Registered', LINE: 'Line', STATION: 'Station' };
            const PACKING_KEYS = { SERIAL: 'Serial Number', EMPLOYEE_ID: 'Employee ID', PACKED_DATE: 'Finish Packed Date', BOX_ID: 'BoxID' };
            
            const REYNOSA_TIMEZONE = 'America/Matamoros';

            // Element cache
            // === ELEMENT CACHE ===
const doc = (id) => document.getElementById(id);
const appTitle = doc('app-title');
const fileDropArea = doc('fileDropArea');
const fileInput = doc('fileInput');
const updateFileInput = doc('updateFileInput');
const orderList = doc('orderList');
const statOrderNumber = doc('statOrderNumber');
const statCatalogNumber = doc('statCatalogNumber');
const statOrderQty = doc('statOrderQty');
const statPackedQty = doc('statPackedQty');
const statRemainingQty = doc('statRemainingQty');
const statScrapQty = doc('statScrapQty');
const totalOrdersStat = doc('totalOrdersStat');
const completedOrdersStat = doc('completedOrdersStat');
const modeRastreo = doc('modeRastreo');
const modeEmpaque = doc('modeEmpaque');
const rastreoFilterInput = doc('rastreoFilterInput');
const areaSelectBtn = doc('areaSelectBtn');
const adminBtn = doc('adminBtn');
const themeToggleBtn = doc('themeToggleBtn');
const logoutBtn = doc('logoutBtn');
const orderSearchInput = doc('orderSearchInput');
const showDailyPlanBtn = doc('showDailyPlanBtn');
const dailyPlanContainer = doc('dailyPlanContainer');
const lastUpdatedContainer = doc('lastUpdatedContainer');

const mobileControls = {
    status: doc('rastreoStatusFilters'),
    line: doc('rastreoLineFilters'),
    actions: doc('actionsCard')?.querySelector('.actions-container')
};
const desktopControls = {
    status: doc('rastreoStatusFiltersDesktop'),
    line: doc('rastreoLineFiltersDesktop'),
    actions: doc('desktop-actions-wrapper')
};

const placeholderText = doc('placeholderText');
const empaqueFilterInput = doc('empaqueFilterInput');
const sapFileDropArea = doc('sapFileDropArea');
const sapFileInput = doc('sapFileInput');
const sapPlaceholderText = doc('sapPlaceholderText');
const sapOrderList = doc('sapOrderList');
const sapTotalOrdersStat = doc('sapTotalOrdersStat');
const sapCompletedOrdersStat = doc('sapCompletedOrdersStat');
const sapResetFilterBtn = doc('sapResetFilter');
const sapLastUpdatedContainer = doc('sapLastUpdatedContainer');
const sapExportImageBtn = doc('sapExportImageBtn'); // <-- ¡AQUÍ ESTÁ LA LÍNEA QUE FALTABA!
const modeFwd = doc('modeFwd');
const modeSap = doc('modeSap');
const modalOverlay = doc('modalOverlay');
const modalTitle = doc('modalTitle');
const modalBody = doc('modalBody');
const modalClose = doc('modalClose');
const copyReportBtn = doc('copyReportBtn');


            // === EVENT LISTENERS ===
            modeFwd.addEventListener('click', () => switchMainMode('fwd'));
            modeSap.addEventListener('click', () => switchMainMode('sap'));
            fileDropArea.addEventListener('click', () => { if(!fileDropArea.classList.contains('disabled')) fileInput.click(); });
            fileDropArea.addEventListener('dragover', (e) => { if(!fileDropArea.classList.contains('disabled')) { e.preventDefault(); fileDropArea.classList.add('dragover'); }});
            fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('dragover'));
            fileDropArea.addEventListener('drop', (e) => {
                if(!fileDropArea.classList.contains('disabled')) {
                    e.preventDefault(); fileDropArea.classList.remove('dragover');
                    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
                }
            });
            fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFiles(e.target.files); });
            updateFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFiles(e.target.files, true); });
            modeRastreo.addEventListener('click', () => switchMode('rastreo'));
            modeEmpaque.addEventListener('click', () => switchMode('empaque'));
            rastreoFilterInput.addEventListener('input', () => renderRastreoView(activeOrderKey));
            empaqueFilterInput.addEventListener('input', () => renderEmpaqueView(activeOrderKey));
            orderSearchInput.addEventListener('input', updateOrderList); // <-- ¡AGREGA ESTA LÍNEA!

            
            const handleFilterClick = (e) => {
                if (e.target.matches('.filter-btn')) {
                    const group = e.target.closest('.filter-group');
                    const filterType = group.id.includes('Status') ? 'status' : 'line';
                    
                    document.querySelectorAll(`#${group.id}`).forEach(g => {
                        const active = g.querySelector('.active');
                        if(active) active.classList.remove('active');
                        const btnToActivate = g.querySelector(`[data-filter="${e.target.dataset.filter}"]`);
                        if(btnToActivate) btnToActivate.classList.add('active');
                    });

                    if (filterType === 'status') {
                        rastreoStatusFilter = e.target.dataset.filter;
                    } else {
                        rastreoLineFilter = e.target.dataset.filter;
                    }
                    renderRastreoView(activeOrderKey);
                }
            };
            
            mobileControls.status?.addEventListener('click', handleFilterClick);
            desktopControls.status?.addEventListener('click', handleFilterClick);
            mobileControls.line?.addEventListener('click', handleFilterClick);
            desktopControls.line?.addEventListener('click', handleFilterClick);

            sapFileDropArea.addEventListener('click', () => { if (!sapFileDropArea.classList.contains('disabled')) sapFileInput.click(); });
sapFileDropArea.addEventListener('dragover', (e) => { if (!sapFileDropArea.classList.contains('disabled')) { e.preventDefault(); sapFileDropArea.classList.add('dragover'); }});
sapFileDropArea.addEventListener('dragleave', () => sapFileDropArea.classList.remove('dragover'));
sapFileDropArea.addEventListener('drop', (e) => {
    if (!sapFileDropArea.classList.contains('disabled')) {
        e.preventDefault(); sapFileDropArea.classList.remove('dragover');
        // --- CORRECCIÓN ---
        // Volvemos a pasar solo el PRIMER archivo (files[0])
        if (e.dataTransfer.files.length) handleSapFile(e.dataTransfer.files[0]);
    }
});
sapFileInput.addEventListener('change', (e) => { 
    // --- CORRECCIÓN ---
    // Volvemos a pasar solo el PRIMER archivo (files[0])
    if (e.target.files.length) handleSapFile(e.target.files[0]); 
});

sapResetFilterBtn.addEventListener('click', () => {
    sapDateFilter = []; // Vaciamos el array para volver a la vista default
    renderSapView();
});

sapExportImageBtn.addEventListener('click', handleSapImageExport);

// --- AGREGA ESTE LISTENER ---
doc('sapBulkDeleteBtn').addEventListener('click', () => {
    const ordersToDelete = Array.from(selectedSapOrders);
    if (ordersToDelete.length === 0) {
        showModal('Error', 'No hay órdenes seleccionadas para eliminar.', 'warning');
        return;
    }

    showConfirmationModal(
        `¿Seguro que quieres eliminar ${ordersToDelete.length} órdenes? Esto las borrará SÓLO del histórico de SAP.`,
        () => deleteMultipleSapOrders(ordersToDelete)
    );
});
// --- FIN DE AGREGAR ---

modalClose.addEventListener('click', hideModal);
modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) hideModal(); });

adminBtn.addEventListener('click', () => {
    if (session.user && session.isMaster) {
        showAdminPanel();
    } else {
        showLogin();
    }
});
            areaSelectBtn.addEventListener('click', showAreaSelector);
            logoutBtn.addEventListener('click', logout);
            showDailyPlanBtn.addEventListener('click', generateDailyPlanReport);

            statOrderNumber.addEventListener('click', () => {
                const orderNumberText = statOrderNumber.textContent;
                if (orderNumberText && orderNumberText !== 'N/A' && orderNumberText !== 'Órdenes del Día') {
                    copyTextToClipboard(orderNumberText,
                        () => { // Success
                            const originalText = statOrderNumber.textContent;
                            statOrderNumber.textContent = '¡Copiado!';
                            setTimeout(() => {
                                statOrderNumber.textContent = originalText;
                            }, 1500);
                        },
                        (err) => { // Error
                            console.error('Error al copiar la orden: ', err);
                            showModal('Error', 'No se pudo copiar el texto.', 'error');
                        }
                    );
                }
            });

async function handleSapImageExport() {
    if (!sapData || sapData.length === 0) {
        showModal('Exportar Captura', 'No hay datos en la tabla de SAP para exportar.', 'warning');
        return;
    }

    const originalButtonText = sapExportImageBtn.textContent;
    sapExportImageBtn.textContent = 'Generando...';
    sapExportImageBtn.disabled = true;

    // Ocultamos botones temporalmente para que no salgan en la captura
    sapResetFilterBtn.style.visibility = 'hidden';
    sapExportImageBtn.style.visibility = 'hidden';

    // El elemento que queremos capturar
    const elementToCapture = doc('sap-tableCard'); 

    try {
        const canvas = await html2canvas(elementToCapture, {
            scale: 2,
            useCORS: true,
            backgroundColor: document.body.classList.contains('dark-theme') ? '#22252a' : '#f9fafb'
        });

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg', 0.95);
        const dateStamp = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
        a.download = `Captura_SAP_${currentArea}_${dateStamp}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (e) {
        console.error("Error al generar la imagen de SAP:", e);
        showModal('Error', 'Ocurrió un error al generar el archivo de imagen.', 'error');
    } finally {
        // Volvemos a mostrar los botones y restauramos el estado del botón de exportar
        sapResetFilterBtn.style.visibility = 'visible';
        sapExportImageBtn.style.visibility = 'visible';
        sapExportImageBtn.textContent = originalButtonText;
        sapExportImageBtn.disabled = false;
    }
}

            // ===================================
            // === CORE APP CONTROL & UTILITIES ===
            // ===================================
            function copyTextToClipboard(text, successCallback, errorCallback) {
                // Fallback for older browsers or insecure contexts (like iframes)
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed"; // Avoid scrolling to bottom
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.width = "2em";
                textArea.style.height = "2em";
                textArea.style.padding = "0";
                textArea.style.border = "none";
                textArea.style.outline = "none";
                textArea.style.boxShadow = "none";
                textArea.style.background = "transparent";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        if(successCallback) successCallback();
                    } else {
                        if(errorCallback) errorCallback();
                    }
                } catch (err) {
                    if(errorCallback) errorCallback(err);
                }
                document.body.removeChild(textArea);
            }

            function switchMainMode(mode) {
                if (mainMode === mode) return;
                const oldView = doc(`${mainMode}View`);
                const newView = doc(`${mode}View`);
                oldView.style.opacity = 0;
                setTimeout(() => {
                    oldView.style.display = 'none';
                    document.body.classList.remove('mode-fwd', 'mode-sap');
                    newView.style.display = 'block';
                    document.body.classList.add(`mode-${mode}`);
                    requestAnimationFrame(() => { newView.style.opacity = 1; });
                    mainMode = mode;
                    localStorage.setItem('mainMode', mode);
                    modeFwd.classList.toggle('active', mode === 'fwd');
                    modeSap.classList.toggle('active', mode === 'sap');
                    appTitle.textContent = mode === 'fwd' ? 'Centro de Rastreo de Órdenes' : 'Análisis de Órdenes SAP';
                    render();
                }, 300);
            }
            
            function showModal(title, content, type = 'info', showCopyBtn = false) {
                modalOverlay.querySelector('.modal-content').className = `modal-content ${type}`;
                modalTitle.textContent = title;
                modalBody.innerHTML = content;
                copyReportBtn.textContent = 'Copiar al Portapapeles';
                copyReportBtn.style.display = showCopyBtn ? 'block' : 'none';
                if (showCopyBtn) {
                    copyReportBtn.onclick = () => {
                        const reportContent = modalBody.querySelector('.status-report')?.innerText || modalBody.innerText;
                        copyTextToClipboard(reportContent,
                            () => {
                                copyReportBtn.textContent = '¡Copiado!';
                                setTimeout(() => copyReportBtn.textContent = 'Copiar al Portapapeles', 2000);
                            },
                            () => {
                                showModal('Error', 'No se pudo copiar el reporte.', 'error');
                            }
                        );
                    };
                }
                modalOverlay.classList.add('visible');
            }

            function showConfirmationModal(message, onConfirmCallback) {
                const content = `
                    <p>${message}</p>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button id="confirmBtn" class="btn btn-danger" style="flex: 1;">Confirmar</button>
                        <button id="cancelBtn" class="btn" style="flex: 1; background-color: var(--border-color);">Cancelar</button>
                    </div>
                `;
                showModal('Confirmar Acción', content);
                doc('confirmBtn').onclick = () => {
                    onConfirmCallback();
                    hideModal();
                };
                doc('cancelBtn').onclick = hideModal;
            }

            function hideModal() { modalOverlay.classList.remove('visible'); }

            function excelSerialToDate(serial) {
                if (typeof serial !== 'number' || isNaN(serial)) return null;
                try {
                    const decoded = XLSX.SSF.parse_date_code(serial);
                    if (decoded) {
                        const hours = (decoded.H === 0 && decoded.M === 0 && decoded.S === 0) ? 12 : decoded.H;
                        return new Date(Date.UTC(decoded.y, decoded.m - 1, decoded.d, hours, decoded.M, decoded.S));
                    }
                } catch(e) { console.error("Error al parsear la fecha serial de Excel:", e); }
                return null;
            }
            
            function formatDateTimeFromSerial(serial) {
                if (typeof serial !== 'number' || isNaN(serial)) return '';
                try {
                    const decoded = XLSX.SSF.parse_date_code(serial);
                    if (decoded) {
                        const day = String(decoded.d).padStart(2, '0');
                        const month = String(decoded.m).padStart(2, '0');
                        const year = decoded.y;
                        const hours = String(decoded.H).padStart(2, '0');
                        const minutes = String(decoded.M).padStart(2, '0');
                        return `${day}/${month}/${year} ${hours}:${minutes}`;
                    }
                } catch(e) { console.error("Error al formatear fecha/hora desde serial de Excel:", e); }
                return '';
            }

            function formatDate(date) {
                if (!(date instanceof Date) || isNaN(date)) return '';
                return date.toLocaleDateString('es-ES', { timeZone: REYNOSA_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
            }
            function formatDateTime(date) {
                if (!(date instanceof Date) || isNaN(date)) return '';
                return date.toLocaleString('es-ES', {
                    timeZone: REYNOSA_TIMEZONE,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                }).replace(',', '');
            }
            function findHeader(headers, keyText) { return headers && headers.find(h => h && h.toLowerCase() === keyText.toLowerCase()); }
            
            // =========================
            // === FWD VIEW FUNCTIONS ===
            // =========================
            async function saveOrderToFirebase(orderKey, orderData, area) {
                try {
                    const empaqueDataForDB = Array.from(orderData.empaqueData.entries()).map(([boxId, serials]) => ({ boxId, serials }));
                    const dataToSave = { ...orderData, empaqueData: empaqueDataForDB };
                    await db.collection('areas').doc(area).collection('orders').doc(orderKey).set(dataToSave, { merge: true });
                } catch (e) {
                    console.error("Error al guardar en Firebase: ", e);
                    showModal('Error al Guardar', `No se pudo guardar la orden ${orderKey}.`, 'error');
                }
            }

            async function deleteOrderFromFirebase(orderKey) {
                try {
                    await db.collection('areas').doc(currentArea).collection('orders').doc(orderKey).delete();
                } catch (e) {
                    console.error("Error al eliminar en Firebase: ", e);
                    showModal('Error al Eliminar', `No se pudo eliminar la orden ${orderKey}.`, 'error');
                }
            }

            function handleFiles(files, isUpdate = false) {
                const canEdit = session.isMaster || (session.permissions && session.permissions.includes(currentArea));
                if (!canEdit) {
                    showModal('Acceso Denegado', `No tienes permisos para modificar el área ${currentArea}.`, 'error');
                    return;
                }

                const excelFiles = Array.from(files).filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
                const filePromises = excelFiles.map(file => processFile(file, isUpdate));

                Promise.all(filePromises)
                    .then(results => {
                        const updatePromises = [];
                        results.forEach(result => {
                            if (result) {
                                loadedOrders.set(result.key, result.data);
                                updatePromises.push(saveOrderToFirebase(result.key, result.data, currentArea));
                            }
                        });
                        
                        Promise.all(updatePromises).then(() => {
                            showModal('Éxito', `${results.length} orden(es) actualizadas con detalles.`, 'success');
                        });
                    })
                    .catch(err => {
                        showModal('Error al Cargar', err.message || 'Uno o más archivos no pudieron ser procesados.', 'error');
                        console.error("Error detallado en handleFiles:", err);
                    });
            }

            function processFile(file, isUpdate) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const orderNumber = String(worksheet['B3']?.v || `Archivo_${file.name.slice(0, 10)}`);

                // --- 🔒 INICIO DEL CANDADO DE SEGURIDAD 🔒 ---
                // 1. Validamos la ESTRUCTURA (que el header esté donde debe)
                const serialHeaderCell = worksheet['B20'];
                if (!serialHeaderCell || !serialHeaderCell.v || serialHeaderCell.v.toString().trim() !== TRACKING_KEYS.SERIAL) {
                    reject(new Error(
                        `El archivo "${file.name}" no es un reporte de rastreo válido. ` +
                        `No se encontró el encabezado '${TRACKING_KEYS.SERIAL}' en la celda B20.`
                    ));
                    return; // Detenemos la ejecución aquí
                }
                // --- FIN DEL CANDADO 1 ---

                const keyToUse = isUpdate ? orderToUpdateKey : orderNumber;
                let existingOrderData;

                if (loadedOrders.has(keyToUse)) {
                    // La orden ya existe, la tomamos para actualizarla.
                    existingOrderData = loadedOrders.get(keyToUse);
                } else {
                    // La orden es nueva. Creamos una estructura base con las celdas correctas.
                    console.log(`La orden ${orderNumber} no fue cargada por SAP. Creando nueva entrada.`);
                    existingOrderData = {
                        // AJUSTE: Leemos la cantidad total de la celda O3
                        orderQty: parseInt(worksheet['O3']?.v || 0),
                        // AJUSTE: Leemos el catálogo de la celda I3
                        catalogNumber: String(worksheet['I3']?.v || 'N/A'),

                        orderDate: new Date(),
                        packedQty: 0,
                        rastreoData: [],
                        empaqueData: new Map(),
                        headers: { rastreo: [], empaque: [] }
                    };
                }

                const TRACKING_COLS = ['B', 'C', 'G', 'K', 'M', 'P', 'V', 'Y', 'Z', 'AA', 'AB'];
                const PACKING_COLS = ['AE', 'AF', 'AK', 'AO'];
                const rastreoRawData = extractTableData(worksheet, TRACKING_COLS, 20);
                const packingRawData = extractTableData(worksheet, PACKING_COLS, 20);

                // --- 🔒 INICIO DEL CANDADO 2 🔒 ---
                // 2. Validamos los DATOS (si es que hay datos)
                if (rastreoRawData.length > 0) {
                    // Como ya validamos el header, podemos usar la KEY con confianza
                    const firstSerial = String(rastreoRawData[0][TRACKING_KEYS.SERIAL] || '').trim();
                    if (!firstSerial.startsWith('S#')) {
                        reject(new Error(
                            `El archivo "${file.name}" no es válido. ` +
                            `El primer serial ('${firstSerial}') no inicia con 'S#'.`
                        ));
                        return; // Detenemos la ejecución
                    }
                }
                // --- FIN DEL CANDADO 2 ---

                const orderData = {
                    ...existingOrderData,
                    // Confirmado: Leemos la cantidad empacada de la celda U3
                    packedQty: parseInt(worksheet['U3']?.v || existingOrderData.packedQty || 0),
                    rastreoData: processRastreoData(rastreoRawData),
                    empaqueData: groupEmpaqueData(packingRawData),
                    headers: {
                        rastreo: Object.keys(rastreoRawData[0] || {}),
                        empaque: Object.keys(packingRawData[0] || {})
                    },
                    lastUpdated: new Date(),
                    lastUpdatedBy: session.user
                };

                resolve({ key: keyToUse, data: orderData });
            } catch (err) {
                console.error("Error detallado en processFile:", err);
                reject(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}
            function extractTableData(worksheet, cols, startRow) {
                const headers = {};
                cols.forEach(col => {
                    const cell = worksheet[col + startRow];
                    if(cell && cell.v) headers[col] = cell.v.toString().trim();
                });

                if (Object.keys(headers).length === 0) return [];
                
                const jsonData = [];
                const range = XLSX.utils.decode_range(worksheet['!ref']);
                for (let rowNum = startRow + 1; rowNum <= range.e.r + 1; ++rowNum) {
                    const row = {};
                    let hasData = false;
                    for(const col in headers) {
                        const headerName = headers[col];
                        const cellAddress = col + rowNum;
                        const cell = worksheet[cellAddress];
                        if(cell && cell.v !== undefined) {
                            row[headerName] = cell.v;
                            hasData = true;
                        } else {
                            row[headerName] = '';
                        }
                    }
                    if (hasData) jsonData.push(row);
                }
                return jsonData;
            }
            
            function processRastreoData(data) {
                if (!data || data.length === 0) return [];
                const now = new Date();
                const headers = Object.keys(data[0] || {});
                const scrapHeader = findHeader(headers, TRACKING_KEYS.IS_SCRAP);
                const dateHeader = findHeader(headers, TRACKING_KEYS.DATE_REGISTERED);

                return data.map(row => {
                    let status = 'normal';
                    const isScrap = String(row[scrapHeader]).trim().toUpperCase() === 'X';

                    if (isScrap) {
                        status = 'scrap';
                    } else {
                        const dateSerial = row[dateHeader];
                        const registeredDate = excelSerialToDate(dateSerial);
                        if (registeredDate) {
                            const ageInMillis = now.getTime() - registeredDate.getTime();
                            const ageInHours = ageInMillis / (1000 * 60 * 60);

                            if (ageInHours > 25) {
                                status = 'very_delayed';
                            } else if (ageInHours > 8) {
                                status = 'delayed';
                            } else {
                                status = 'today';
                            }
                        }
                    }
                    return { ...row, status };
                });
            }

            function groupEmpaqueData(data) {
                if (!data || data.length === 0) return new Map();
                const boxIdHeader = findHeader(Object.keys(data[0]), PACKING_KEYS.BOX_ID);
                if (!boxIdHeader) return new Map();

                return data.reduce((acc, row) => {
                    const boxId = row[boxIdHeader];
                    if (boxId && String(boxId).trim() !== '') {
                        if (!acc.has(boxId)) acc.set(boxId, []);
                        acc.get(boxId).push(row);
                    }
                    return acc;
                }, new Map());
            }
            
            function switchMode(mode) {
                currentMode = mode;
                doc('rastreoView').style.display = mode === 'rastreo' ? 'block' : 'none';
                doc('empaqueView').style.display = mode === 'empaque' ? 'block' : 'none';

                modeRastreo.classList.toggle('active', mode === 'rastreo');
                modeEmpaque.classList.toggle('active', mode === 'empaque');
                render();
            }

            function updateOrderList() {
    // ---> INICIO DE CAMBIOS: Obtenemos el texto de búsqueda y lo preparamos
    const searchText = orderSearchInput ? orderSearchInput.value.trim().toUpperCase() : '';
    const isSearching = searchText !== '';

    // Guardamos los grupos que estaban expandidos antes de redibujar
    const expandedMonths = new Set();
    if (!isSearching) { // Solo guardamos el estado si NO estamos buscando
        orderList.querySelectorAll('.month-group.expanded').forEach(group => {
            if (group.dataset.month) expandedMonths.add(group.dataset.month);
        });
    }
    const expandedDates = new Set();
    if (!isSearching) { // Solo guardamos el estado si NO estamos buscando
        orderList.querySelectorAll('.date-group.expanded').forEach(group => {
            if (group.dataset.date) expandedDates.add(group.dataset.date);
        });
    }

    orderList.innerHTML = '';

    // ---> CAMBIO: Filtramos las órdenes si hay texto en la búsqueda
    let filteredOrders = loadedOrders;
    if (isSearching) {
        const tempFiltered = new Map();
        loadedOrders.forEach((value, key) => {
            if (key.toUpperCase().includes(searchText)) {
                tempFiltered.set(key, value);
            }
        });
        filteredOrders = tempFiltered;
    }
    // ---> FIN DE CAMBIOS en esta sección

    if (filteredOrders.size === 0) {
        orderList.innerHTML = `<p class="text-dark" style="font-size:0.9rem;">${isSearching ? 'No se encontraron órdenes.' : `No hay órdenes cargadas para el área ${currentArea || ''}.`}</p>`;
        return;
    }

    const MONTH_NAMES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const groupedByMonth = new Map();

    // ---> CAMBIO: Usamos 'filteredOrders' en lugar de 'loadedOrders'
    for (const [key, order] of filteredOrders.entries()) {
        const date = order.orderDate || new Date(0);
        const monthYearKey = `${date.getMonth()}-${date.getFullYear()}`;
        if (!groupedByMonth.has(monthYearKey)) groupedByMonth.set(monthYearKey, []);
        groupedByMonth.get(monthYearKey).push({ key, ...order });
    }

    const sortedMonths = Array.from(groupedByMonth.keys()).sort((a, b) => {
        const [monthA, yearA] = a.split('-').map(Number);
        const [monthB, yearB] = b.split('-').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return monthB - monthA;
    });
    
    const todayString = new Date().toLocaleDateString('es-ES', {
        timeZone: REYNOSA_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric'
    });

    sortedMonths.forEach(monthYearKey => {
        const [monthIndex, year] = monthYearKey.split('-').map(Number);
        const monthName = `${MONTH_NAMES[monthIndex]} ${year}`;
        const ordersInMonth = groupedByMonth.get(monthYearKey);

        const monthGroupDiv = document.createElement('div');
        monthGroupDiv.className = 'month-group';
        monthGroupDiv.dataset.month = monthYearKey;

        const monthHeaderBtn = document.createElement('button');
        monthHeaderBtn.className = 'month-header';
        monthHeaderBtn.innerHTML = `<span>${monthName}</span> <span class="collapse-icon">►</span>`;

        const datesContainer = document.createElement('div');
        datesContainer.className = 'dates-for-month';

        const groupedByDate = new Map();
        ordersInMonth.forEach(order => {
            const date = order.orderDate || new Date(0);
            const dateString = formatDate(date);
            if (!groupedByDate.has(dateString)) groupedByDate.set(dateString, []);
            groupedByDate.get(dateString).push(order);
        });

        const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => {
            const dateA = new Date(a.split('/').reverse().join('-'));
            const dateB = new Date(b.split('/').reverse().join('-'));
            return dateB - dateA;
        });

        sortedDates.forEach(dateString => {
            const ordersOnDate = groupedByDate.get(dateString);
            const orderCount = ordersOnDate.length;
            const isToday = dateString === todayString;

            const dateGroupDiv = document.createElement('div');
            dateGroupDiv.className = 'date-group';
            dateGroupDiv.dataset.date = dateString;

            const dateHeaderBtn = document.createElement('button');
            dateHeaderBtn.className = 'date-header';
            
            const countText = `${orderCount} ${orderCount === 1 ? 'orden' : 'órdenes'}`;
            dateHeaderBtn.innerHTML = `
                <span>📅 ${dateString}</span>
                ${isToday ? `<span class="status-indicator">(${countText})</span>` : `<span class="order-count">(${countText})</span>`}
                <span class="collapse-icon">►</span>
            `;

            const ordersContainer = document.createElement('div');
            ordersContainer.className = 'orders-for-date';
            ordersOnDate.forEach(order => ordersContainer.appendChild(createOrderButton(order.key, order)));

            dateGroupDiv.appendChild(dateHeaderBtn);
            dateGroupDiv.appendChild(ordersContainer);
            datesContainer.appendChild(dateGroupDiv);

            dateHeaderBtn.addEventListener('click', () => {
                dateGroupDiv.classList.toggle('expanded');
            });

            // ---> CAMBIO: Forzamos la expansión si se está buscando algo
            if (isSearching || expandedDates.has(dateString)) {
                dateGroupDiv.classList.add('expanded');
            }
        });

        monthGroupDiv.appendChild(monthHeaderBtn);
        monthGroupDiv.appendChild(datesContainer);
        orderList.appendChild(monthGroupDiv);
        
        monthHeaderBtn.addEventListener('click', () => {
            monthGroupDiv.classList.toggle('expanded');
        });
        
        // ---> CAMBIO: Forzamos la expansión si se está buscando algo
        if (isSearching || expandedMonths.has(monthYearKey)) {
            monthGroupDiv.classList.add('expanded');
        }
    });
    
    setActiveOrder(activeOrderKey);
}

            function createOrderButton(key, orderData) {
                const item = document.createElement('div');
                item.className = 'order-item';

                const btn = document.createElement('button');
                btn.className = 'order-btn';
                btn.textContent = key;
                btn.dataset.key = key;
                btn.onclick = () => setActiveOrder(key);
                if (orderData && orderData.orderQty > 0 && orderData.orderQty <= orderData.packedQty) {
                    btn.classList.add('is-complete');
                }
                
                const progressBar = document.createElement('div');
                progressBar.className = 'order-progress-bar';
                const progressBarInner = document.createElement('div');
                progressBarInner.className = 'order-progress-bar-inner';
                const percentage = (orderData.orderQty > 0) ? (orderData.packedQty / orderData.orderQty) * 100 : 0;
                progressBarInner.style.width = `${Math.min(percentage, 100)}%`;

                if (percentage < 30) progressBarInner.style.backgroundColor = 'var(--danger-color)';
                else if (percentage < 70) progressBarInner.style.backgroundColor = 'var(--warning-color)';
                else progressBarInner.style.backgroundColor = 'var(--success-color)';
                
                progressBar.appendChild(progressBarInner);
                btn.appendChild(progressBar);
                item.appendChild(btn);

                const canManageThisArea = session.isMaster || (session.permissions && session.permissions.includes(currentArea));
                
                if (key !== 'all' && canManageThisArea && session.isMaster) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'icon-btn';
                    deleteBtn.title = 'Eliminar orden';
                    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
                    deleteBtn.onclick = () => {
                        showConfirmationModal(`¿Estás seguro de que quieres eliminar la orden ${key}?`, async () => {
                            await deleteOrderFromFirebase(key);
                        });
                    };
                    item.appendChild(deleteBtn);
                }
                return item;
            }

            function setActiveOrder(key) {
                activeOrderKey = key;
                document.querySelectorAll('.order-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.key === key);
                });
                render();
            }

            function render() {
                if (mainMode === 'fwd') {
                    renderControls();
                    renderSummary();
                    updateGlobalDashboard();
                    if (currentMode === 'rastreo') {
                        renderRastreoView(activeOrderKey);
                    } else {
                        renderEmpaqueView(activeOrderKey);
                    }
                } else if (mainMode === 'sap') {
                    renderSapView();
                }
                adjustStickyTops();
            }

            function renderSummary() {
                let orderQty = 0, packedQty = 0, scrapCount = 0; let ordersToProcess = [];
                lastUpdatedContainer.textContent = '';
                
                if (activeOrderKey === 'all' || activeOrderKey === null) {
                    const todayString = new Date().toLocaleDateString('es-ES', {
                        timeZone: REYNOSA_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric'
                    });
                    ordersToProcess = Array.from(loadedOrders.values()).filter(order => formatDate(order.orderDate) === todayString);
                    
                    if (ordersToProcess.length > 0) {
                        statOrderNumber.textContent = 'Órdenes del Día';
                        const firstCatalog = ordersToProcess[0].catalogNumber;
                        const allSameCatalog = ordersToProcess.every(o => o.catalogNumber === firstCatalog);
                        statCatalogNumber.textContent = allSameCatalog ? firstCatalog : 'Múltiples Catálogos';
                    } else {
                        statOrderNumber.textContent = 'N/A';
                        statCatalogNumber.textContent = 'No hay órdenes para hoy';
                    }
                
                } else if (loadedOrders.has(activeOrderKey)) {
                    ordersToProcess = [loadedOrders.get(activeOrderKey)];
                    const order = ordersToProcess[0];
                    statOrderNumber.textContent = activeOrderKey;
                    statCatalogNumber.textContent = order.catalogNumber;
                    
                    if (order.lastUpdated) {
                        let updatedText = `Última actualización: ${formatDateTime(order.lastUpdated)}`;
                        if (order.lastUpdatedBy) {
                            updatedText += ` por: ${order.lastUpdatedBy}`;
                        }
                        lastUpdatedContainer.textContent = updatedText;
                    }

                } else if (loadedOrders.size > 0) {
                    setActiveOrder(null);
                    return;
                } else {
                    statOrderNumber.textContent = 'N/A';
                    statCatalogNumber.textContent = '';
                }
                
                ordersToProcess.forEach(order => {
                    orderQty += order.orderQty || 0;
                    packedQty += order.packedQty || 0;
                    if(order.rastreoData) {
                       scrapCount += order.rastreoData.filter(row => row.status === 'scrap').length;
                    }
                });

                statOrderQty.textContent = orderQty;
                statPackedQty.textContent = packedQty;
                statRemainingQty.textContent = orderQty - packedQty;
                statScrapQty.textContent = scrapCount;
            }

            function updateGlobalDashboard() {
                const todayString = new Date().toLocaleDateString('es-ES', {
                    timeZone: REYNOSA_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric'
                });
                let todaysOrdersCount = 0; let completedOrdersToday = 0;
                for (const order of loadedOrders.values()) {
                    const orderDateString = formatDate(order.orderDate || new Date());
                    if (orderDateString === todayString) {
                        todaysOrdersCount++;
                        if (order.orderQty > 0 && order.orderQty <= order.packedQty) completedOrdersToday++;
                    }
                }
                totalOrdersStat.textContent = todaysOrdersCount;
                completedOrdersStat.textContent = completedOrdersToday;
            }
            
            function renderControls() {
                const hasOrders = loadedOrders.size > 0;
                const statusHTML = `
                    <button class="filter-btn ${rastreoStatusFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
                    <button class="filter-btn ${rastreoStatusFilter === 'today' ? 'active' : ''}" data-filter="today">En Movimiento</button>
                    <button class="filter-btn ${rastreoStatusFilter === 'delayed' ? 'active' : ''}" data-filter="delayed">Sin Movimiento</button>
                    <button class="filter-btn ${rastreoStatusFilter === 'scrap' ? 'active' : ''}" data-filter="scrap">Scrap</button>
                `;
                mobileControls.status.innerHTML = statusHTML;
                desktopControls.status.innerHTML = statusHTML;

                const actionsHTML = `
                    <button class="btn" id="exportImageButtonMobile" ${!hasOrders ? 'disabled' : ''}>Exportar Captura</button>
                    <button class="btn" id="exportStatusButtonMobile" ${!hasOrders ? 'disabled' : ''}>Reporte de Estatus</button>
                `;
                const desktopActionsHTML = `
                    <button class="btn" id="exportImageButtonDesktop" ${!hasOrders ? 'disabled' : ''}>Captura</button>
                    <button class="btn" id="exportStatusButtonDesktop" ${!hasOrders ? 'disabled' : ''}>Reporte</button>
                `;
                mobileControls.actions.innerHTML = actionsHTML;
                desktopControls.actions.innerHTML = desktopActionsHTML;

                doc('exportImageButtonMobile').addEventListener('click', handleImageExport);
                doc('exportImageButtonDesktop').addEventListener('click', handleImageExport);
                doc('exportStatusButtonMobile').addEventListener('click', handleStatusReport);
                doc('exportStatusButtonDesktop').addEventListener('click', handleStatusReport);
            }

            async function renderRastreoView(key) {
                const tableWrapper = doc('rastreoTable').parentElement;
                tableWrapper.style.opacity = '0';
                await new Promise(res => setTimeout(res, 150));
                
                if (!key) {
                    updateRastreoTable([], []);
                    updateLineCounts([], []);
                    placeholderText.textContent = 'Selecciona una orden de la lista para ver sus detalles.';
                    placeholderText.style.display = 'block';
                    tableWrapper.style.opacity = '1';
                    return;
                }
                
                let dataToShow = []; let headers = [];
                if (key === 'all') {
                    loadedOrders.forEach(order => { if(order.rastreoData) dataToShow.push(...order.rastreoData) });
                    if (loadedOrders.size > 0) headers = Array.from(loadedOrders.values()).find(o => o.headers.rastreo)?.headers.rastreo;
                } else if (loadedOrders.has(key)) {
                    const order = loadedOrders.get(key);
                    dataToShow = order.rastreoData || []; headers = order.headers.rastreo || [];
                }
                
                createRastreoLineFilters(dataToShow, headers);

                let filteredData = dataToShow;
                if (rastreoStatusFilter !== 'all') {
                    if (rastreoStatusFilter === 'delayed') {
                        filteredData = dataToShow.filter(row => row.status === 'delayed' || row.status === 'very_delayed');
                    } else {
                        filteredData = dataToShow.filter(row => row.status === rastreoStatusFilter);
                    }
                }
                
                const lineHeader = findHeader(headers, TRACKING_KEYS.LINE);
                if (rastreoLineFilter !== 'all' && lineHeader) filteredData = filteredData.filter(row => row[lineHeader] === rastreoLineFilter);
                const searchText = rastreoFilterInput.value.toLowerCase();
                if (searchText) filteredData = filteredData.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchText)));
                currentVisibleData = filteredData;
                
                placeholderText.style.display = (dataToShow.length > 0) ? 'none' : 'block';

                updateRastreoTable(filteredData, headers);
                updateLineCounts(filteredData, headers);
                
                tableWrapper.style.opacity = '1';
            }

            function createRastreoLineFilters(data, headers) {
                if (!headers) headers = [];
                const lineHeader = findHeader(headers, TRACKING_KEYS.LINE);
                
                let lineHTML = '';
                if (!lineHeader || !data || data.length === 0) {
                    lineHTML = `<p class="text-dark" style="font-size: 0.9rem; margin: 0;">N/A</p>`;
                } else {
                    const uniqueLines = [...new Set(data.map(row => row[lineHeader]).filter(Boolean))].sort();
                    lineHTML += `<button class="filter-btn ${rastreoLineFilter === 'all' ? 'active' : ''}" data-filter="all">Todas</button>`;
                    uniqueLines.forEach(line => {
                        lineHTML += `<button class="filter-btn ${rastreoLineFilter === line ? 'active' : ''}" data-filter="${line}">${line}</button>`;
                    });
                }
                
                mobileControls.line.innerHTML = lineHTML;
                desktopControls.line.innerHTML = lineHTML;
            }
            
            function updateRastreoTable(data, headers) {
    const table = doc('rastreoTable');
    if (!table) return;
    
    // --- OPTIMIZACIÓN MÓVIL ---
    // Si es móvil, limitamos a 50 filas iniciales para evitar crash
    const isMobile = window.innerWidth <= 992; 
    const MAX_ROWS = isMobile ? 50 : 500; 
    
    let dataToRender = data;
    let limitMessage = '';

    if (data.length > MAX_ROWS) {
        dataToRender = data.slice(0, MAX_ROWS);
        limitMessage = `<tr class="limit-warning"><td colspan="100%" style="padding:15px; font-weight:bold; color:var(--warning-color);">⚠️ Se muestran los primeros ${MAX_ROWS} registros de ${data.length} para optimizar rendimiento. (Usa filtros para ver específicos)</td></tr>`;
    }
    // ---------------------------

    const isMobileView = window.innerWidth <= 992; // Usar variable local para evitar conflictos
    let headersToRender;
    const serialHeader = findHeader(headers, TRACKING_KEYS.SERIAL);

    if (isMobileView) {
        headersToRender = [
            findHeader(headers, TRACKING_KEYS.SERIAL), findHeader(headers, TRACKING_KEYS.LINE),
            findHeader(headers, TRACKING_KEYS.STATION), findHeader(headers, TRACKING_KEYS.DATE_REGISTERED)
        ].filter(Boolean);
    } else {
        const headersToHide = [TRACKING_KEYS.CREATED_BY, TRACKING_KEYS.NOT_PACKED, TRACKING_KEYS.IS_SCRAP].map(h => findHeader(headers, h)).filter(Boolean);
        headersToRender = headers ? headers.filter(h => !headersToHide.includes(h) && h !== 'status') : [];
    }

    if (!dataToRender || dataToRender.length === 0 || !headersToRender || headersToRender.length === 0) {
        table.innerHTML = `<thead><tr><th></th></tr></thead><tbody></tbody>`;
        return;
    }
    
    // Renderizado del HTML
    table.innerHTML = `
        <thead><tr>${headersToRender.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
            ${dataToRender.map(row => `
                <tr class="is-${row.status}">
                    ${headersToRender.map(h => {
                        const isSerialColumn = h === serialHeader;
                        const cellClass = isSerialColumn ? 'serial-cell' : '';
                        // Nota: Sanitizar strings es buena práctica, pero aquí lo mantenemos simple
                        const clickHandler = isSerialColumn ? `onclick="copySerialNumber(this, '${String(row[h]).replace(/'/g, "\\'")}')"` : '';
                        return `<td class="${cellClass}" ${clickHandler} data-label="${h}">${formatCell(row[h], h, h === findHeader(headers, TRACKING_KEYS.DATE_REGISTERED))}</td>`
                    }).join('')}
                </tr>
            `).join('')}
            ${limitMessage}
        </tbody>`;
}

            function updateLineCounts(data, headers) {
                if (!headers) headers = [];
                const lineHeader = findHeader(headers, TRACKING_KEYS.LINE);
                if (!lineHeader) { lineCountsContainer.innerHTML = ''; return; }
                const counts = data.reduce((acc, row) => {
                    const line = row[lineHeader];
                    if (line) acc[line] = (acc[line] || 0) + 1;
                    return acc;
                }, {});
                
                lineCountsContainer.innerHTML = Object.entries(counts).sort().map(([line, count]) =>
                    `<div class="line-badge">${line}: <span>${count}</span></div>`
                ).join('');
            }
            
            async function showPackingDetailsModal(boxId, serials, headers) {
    const serialHeader = findHeader(headers, PACKING_KEYS.SERIAL);
    const employeeIdHeader = findHeader(headers, PACKING_KEYS.EMPLOYEE_ID);
    const packedDateHeader = findHeader(headers, PACKING_KEYS.PACKED_DATE);
    
    let grValue = "N/A", ordenValue = "N/A", usuarioValue = "N/A";
    try {
        const docSnap = await db.collection('boxID_historico').doc(boxId).get();
        
        // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
        // Cambiamos docSnap.exists() por docSnap.exists (sin los paréntesis)
        if (docSnap.exists) { 
            const data = docSnap.data();
            grValue = data.gr || "N/A";
            ordenValue = data.orden || "N/A";
            usuarioValue = data.usuario || "N/A";
        }
    } catch (e) {
        console.error("Error al obtener datos del BoxID:", e);
        grValue = "Error"; ordenValue = "Error"; usuarioValue = "Error";
    }

    let packerInfo = '';
    if (serials && serials.length > 0) {
        const latestSerial = serials.reduce((latest, current) => (current[packedDateHeader] > latest[packedDateHeader]) ? current : latest, serials[0]);
        const packerId = latestSerial[employeeIdHeader];
        
        const grHTML = `<span class="packer-info">GR: <strong class="copyable" onclick="copyGR(this, '${grValue}')" title="Haz clic para copiar">${grValue}</strong></span>`;
        const ordenHTML = `<span class="packer-info">Orden: <strong class="copyable" onclick="copyGR(this, '${ordenValue}')" title="Haz clic para copiar">${ordenValue}</strong></span>`;
        const usuarioHTML = `<span class="packer-info">Confirmado por: <strong>${usuarioValue}</strong></span>`;
        
        packerInfo = `<div class="packing-modal-header">
                        <span class="packer-info">EMPACADOR: <strong>${packerId || 'N/A'}</strong></span>
                        ${ordenHTML}
                        ${grHTML}
                        ${usuarioHTML}
                    </div>`;
    }
    
    let content = `${packerInfo}<ul class="packing-details-list">`;
    if (serials && serials.length > 0) {
        serials.forEach(serial => {
            content += `<li>
                <span>${serial[serialHeader]}</span>
                <span>${formatDateTimeFromSerial(serial[packedDateHeader])}</span>
            </li>`;
        });
    } else {
        content += '<li>No hay seriales en esta caja.</li>';
    }
    content += '</ul>';

    showModal(`Detalle de Caja: ${boxId}`, content);
}

            async function renderEmpaqueView(key) {
    const tableWrapper = doc('empaqueTableContainer');
    tableWrapper.style.opacity = '0';
    await new Promise(res => setTimeout(res, 150));

    let receivedBoxData = new Map();
    let grDataMap = new Map();
    try {
        const [boxSnapshot, grSnapshot] = await Promise.all([
            db.collection('boxID_historico').get(),
            db.collection('gr_historico').get()
        ]);
        boxSnapshot.forEach(doc => receivedBoxData.set(doc.id, doc.data()));
        grSnapshot.forEach(doc => grDataMap.set(doc.id, doc.data()));
    } catch (e) { console.error("Error al obtener datos históricos:", e); }
    
    let dataToShow = new Map(); let headers = [];
    if (key === 'all' || key === null) {
        loadedOrders.forEach(order => {
            if(order.empaqueData) order.empaqueData.forEach((serials, boxId) => {
                if (!dataToShow.has(boxId)) dataToShow.set(boxId, []);
                if(serials && serials.length > 0) dataToShow.get(boxId).push(...serials);
            });
        });
        if (loadedOrders.size > 0) {
            const orderWithHeaders = Array.from(loadedOrders.values()).find(o => o.headers && o.headers.empaque && o.headers.empaque.length > 0);
            if (orderWithHeaders) headers = orderWithHeaders.headers.empaque;
        }
    } else if (loadedOrders.has(key)) {
        const order = loadedOrders.get(key);
        dataToShow = order.empaqueData || new Map(); headers = order.headers.empaque || [];
    }

    if (!dataToShow || dataToShow.size === 0) {
        tableWrapper.innerHTML = `<table id="empaqueTable"><thead><tr><th>No hay datos de empaque.</th></tr></thead></table>`;
        tableWrapper.style.opacity = '1'; return;
    }

    const packedDateHeader = findHeader(headers, PACKING_KEYS.PACKED_DATE);
    const filterText = empaqueFilterInput.value.toLowerCase();
    
    let entriesFound = 0;
    const reversedEntries = Array.from(dataToShow.entries()).reverse();
    
    const grsToCopy = [];
    let tableBodyHTML = ''; 

    for (const [boxId, serials] of reversedEntries) {
        if(!serials || serials.length === 0) continue;
        const serialsMatchFilter = serials.some(s => String(s[findHeader(headers, PACKING_KEYS.SERIAL)]).toLowerCase().includes(filterText));
        if (filterText && !String(boxId).toLowerCase().includes(filterText) && !serialsMatchFilter) continue;
        entriesFound++;
        const latestSerial = serials.reduce((latest, current) => (current[packedDateHeader] > latest[packedDateHeader]) ? current : latest, serials[0]);

        const boxData = receivedBoxData.get(boxId);
        const statusClass = boxData ? 'boxid-received' : 'boxid-missing';
        const receivedDateText = boxData && boxData.receivedAt ? formatShortDateTime(boxData.receivedAt.toDate()) : 'N/A';
        const grValue = boxData && boxData.gr ? String(boxData.gr).trim() : 'N/A';
        
        if (grValue !== 'N/A') {
            grsToCopy.push(grValue);
        }

        const grInfo = grDataMap.get(grValue);
        const ordenValue = grInfo && grInfo.orden ? grInfo.orden : 'N/A';
        const usuarioValue = grInfo && grInfo.usuario ? grInfo.usuario : 'N/A';

        tableBodyHTML += `
            <tr class="box-row" data-boxid="${boxId}">
                <td data-label="BoxID" class="${statusClass}">${boxId}</td>
                <td data-label="Cantidad">${serials.length}</td>
                <td data-label="Último Empaque">${formatDateTimeFromSerial(latestSerial[packedDateHeader])}</td>
                <td data-label="Recibido Logística">${receivedDateText}</td>
                <td data-label="GR" class="copyable" onclick="copyGR(this, '${grValue}')" title="Haz clic para copiar">${grValue}</td>
                <td data-label="Orden">${ordenValue}</td>
                <td data-label="Usuario">${usuarioValue}</td>
            </tr>`;
    }
    
    const grColumnString = grsToCopy.join('\\n');

    // --- ¡AQUÍ ESTÁ EL ENCABEZADO ACTUALIZADO CON FILTROS! ---
    let tableHeaderHTML = `<thead><tr>
        <th><span>BoxID</span><input type="text" class="filter-input" placeholder="Filtrar..." data-col-index="0"></th>
        <th><span>Cantidad</span><input type="text" class="filter-input" placeholder="Filtrar..." data-col-index="1"></th>
        <th><span>Último Empaque</span><input type="text" class="filter-input" placeholder="Filtrar..." data-col-index="2"></th>
        <th><span>Recibido Logística</span><input type="text" class="filter-input" placeholder="Filtrar..." data-col-index="3"></th>
        <th class="copyable-header" onclick="copyColumnData(this, '${grColumnString}')" title="Haz clic para copiar toda la columna">
            <span>GR</span><input type="text" class="filter-input" placeholder="Filtrar..." data-col-index="4">
        </th>
        <th><span>Orden</span><input type="text" class="filter-input" placeholder="Filtrar..." data-col-index="5"></th>
        <th><span>Usuario</span><input type="text" class="filter-input" placeholder="Filtrar..." data-col-index="6"></th>
    </tr></thead>`;
    
    if (entriesFound === 0) { 
        tableWrapper.innerHTML = `<table id="empaqueTable"><thead><tr><th>No se encontraron resultados.</th></tr></thead></table>`; 
    } else { 
        tableWrapper.innerHTML = `<table id="empaqueTable">${tableHeaderHTML}<tbody>${tableBodyHTML}</tbody></table>`; 
    }

    tableWrapper.querySelectorAll('.box-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Evitamos que el modal se abra si se hizo clic en una celda copiable (GR)
            if (e.target.classList.contains('copyable')) return; 
            
            const boxId = row.dataset.boxid;
            const serialsForBox = dataToShow.get(boxId);
            showPackingDetailsModal(boxId, serialsForBox, headers);
        });
    });
    
    tableWrapper.style.opacity = '1';

    // --- ¡AQUÍ AÑADIMOS LA LÓGICA DE FILTRADO! ---
    tableWrapper.querySelectorAll('.filter-input').forEach(input => {
        // Evitamos que al hacer clic en el input se dispare el clic de la fila/encabezado
        input.addEventListener('click', (e) => {
            e.stopPropagation();
        }); 
        
        // Evitamos que al teclear en el input del GR se active el copiado de columna
        if (input.closest('.copyable-header')) {
            input.addEventListener('click', (e) => {
                e.preventDefault(); // Previene el evento de copiado
            });
        }
        
        input.addEventListener('keyup', () => {
            const table = doc('empaqueTable');
            // Aseguramos que solo tomamos los filtros del thead de esta tabla
            const filters = Array.from(table.querySelectorAll('thead .filter-input')); 
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                let shouldShow = true;
                filters.forEach(filter => {
                    const filterValue = filter.value.toLowerCase();
                    const colIndex = parseInt(filter.dataset.colIndex, 10); 
                    
                    if (filterValue) {
                        const cell = row.cells[colIndex];
                        const cellValue = cell ? cell.textContent.toLowerCase() : '';
                        if (!cellValue.includes(filterValue)) {
                            shouldShow = false;
                        }
                    }
                });
                row.style.display = shouldShow ? '' : 'none';
            });
        });
    });
}

// Función para copiar una columna completa de datos
window.copyColumnData = function(element, data) {
    if (!data) return;
    
    copyTextToClipboard(data,
        () => { // Success
            const originalText = element.textContent;
            element.textContent = '¡COPIADO!';
            element.style.color = 'var(--success-color)';
            setTimeout(() => {
                element.textContent = originalText;
                element.style.color = '';
            }, 2000);
        },
        (err) => { // Error
            console.error('Error al copiar la columna: ', err);
            const originalText = element.textContent;
            element.textContent = 'ERROR';
            element.style.color = 'var(--danger-color)';
             setTimeout(() => {
                element.textContent = originalText;
                element.style.color = '';
            }, 2000);
        }
    );
}


// Función para formatear la fecha como DD/MM/YY HH:MM
function formatShortDateTime(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}`;
}

// Función para copiar el GR con feedback visual
window.copyGR = function(element, gr) {
    if (!gr || gr === 'N/A') return;
    
    copyTextToClipboard(gr,
        () => { // Success
            const originalText = element.textContent;
            element.textContent = '¡Copiado!';
            element.style.color = 'var(--success-color)';
            setTimeout(() => {
                element.textContent = originalText;
                element.style.color = '';
            }, 1500);
        },
        (err) => { // Error
            console.error('Error al copiar el GR: ', err);
        }
    );
}

            
            async function handleImageExport(event) {
                if (!currentVisibleData || currentVisibleData.length === 0) {
                    showModal('Exportar Captura', 'No hay datos en la vista actual para exportar.', 'warning');
                    return;
                }

                const button = event.target.closest('button');
                const originalButtonText = button.textContent;
                button.textContent = 'Generando...';
                button.disabled = true;

                const cloneContainer = document.createElement('div');
                cloneContainer.style.position = 'absolute';
                cloneContainer.style.left = '-9999px';
                cloneContainer.style.top = '0';
                cloneContainer.style.display = 'inline-block';
                cloneContainer.style.background = 'var(--surface-color)';
                cloneContainer.style.padding = '20px';
                cloneContainer.style.borderRadius = '16px';

                const tableToClone = doc('rastreoTable');
                const clonedTable = tableToClone.cloneNode(true);
                
                if (activeOrderKey && activeOrderKey !== 'all') {
                    const caption = clonedTable.createCaption();
                    caption.textContent = activeOrderKey;
                }
                
                const style = document.createElement('style');
                style.innerHTML = `
                    :root { --surface-color: #1E293B; --border-color: #334155; --danger-color: #FB7185; --warning-color: #FBBF24; --orange-color: #F97316; --success-color: #34D399; --text-primary: #F8FAFC; --text-secondary: #94A3B8; }
                    table { color: var(--text-primary); background-color: var(--surface-color); border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 14px; }
                    caption { caption-side: top; text-align: center; font-size: 24px; font-weight: 700; color: var(--text-secondary); margin-bottom: 20px; font-family: 'Inter', sans-serif; }
                    th, td { padding: 12px 24px; text-align: center !important; border: 1px solid var(--border-color); white-space: nowrap; }
                    thead { display: table-header-group !important; background-color: #1a2436; position: static !important; }
                    th { font-weight: 600; color: var(--text-secondary); font-size: 12px; }
                    tr { display: table-row !important; }
                    td { display: table-cell !important; background-color: inherit !important; }
                    td::before { display: none !important; }
                    tr.is-scrap { background-color: rgba(251, 113, 133, 0.1) !important; }
                    tr.is-scrap td { color: var(--danger-color) !important; }
                    tr.is-very_delayed { background-color: rgba(249, 115, 22, 0.1) !important; }
                    tr.is-very_delayed td { color: var(--orange-color) !important; }
                    tr.is-delayed { background-color: rgba(251, 191, 36, 0.1) !important; }
                    tr.is-delayed td { color: var(--warning-color) !important; }
                    tr.is-today { background-color: rgba(52, 211, 153, 0.1) !important; }
                    tr.is-today td { color: var(--success-color) !important; }
                `;
                
                cloneContainer.appendChild(style);
                cloneContainer.appendChild(clonedTable);
                document.body.appendChild(cloneContainer);

                await new Promise(resolve => setTimeout(resolve, 100));

                try {
                    const canvas = await html2canvas(cloneContainer, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: null,
                    });

                    const a = document.createElement('a');
                    a.href = canvas.toDataURL('image/jpeg', 0.95);
                    const orderName = (activeOrderKey && activeOrderKey !== 'all') ? activeOrderKey : 'Multiples_Ordenes';
                    const dateStamp = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
                    a.download = `Captura_Rastreo_${orderName}_${dateStamp}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                } catch (e) {
                    console.error("Error al generar la imagen:", e);
                    showModal('Error', 'Ocurrió un error al generar el archivo de imagen.', 'error');
                } finally {
                    document.body.removeChild(cloneContainer);
                    button.textContent = originalButtonText;
                    button.disabled = false;
                }
            }

            function handleStatusReport() {
                const incompleteOrders = Array.from(loadedOrders.entries())
                    .filter(([key, order]) =>
                        (order.orderQty > order.packedQty) &&
                        (order.rastreoData && order.rastreoData.length > 0)
                    )
                    .map(([key, order]) => ({ key, ...order }));

                if (incompleteOrders.length === 0) {
                    showModal('Reporte de Estatus', `✅ No hay órdenes incompletas con seriales cargados en el área ${currentArea}.`, 'success');
                    return;
                }

                let reportHTML = `<div class="status-report">`;
                reportHTML += `<p><strong>Fecha del Reporte:</strong> ${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</p>`;

                incompleteOrders.forEach(order => {
                    const packedSerials = new Set();
                    if (order.empaqueData) {
                        order.empaqueData.forEach(serialsInBox => {
                            serialsInBox.forEach(serialData => {
                                const serialHeader = findHeader(Object.keys(serialData), PACKING_KEYS.SERIAL);
                                if(serialHeader) packedSerials.add(serialData[serialHeader]);
                            });
                        });
                    }

                    const serialHeader = findHeader(order.headers.rastreo, TRACKING_KEYS.SERIAL);
                    const stationHeader = findHeader(order.headers.rastreo, TRACKING_KEYS.STATION);

                    const pendingSerials = serialHeader ? order.rastreoData.filter(rastreoItem =>
                        !packedSerials.has(rastreoItem[serialHeader]) && rastreoItem.status !== 'scrap'
                    ) : [];

                    const delayedSerials = pendingSerials.filter(s => s.status === 'delayed' || s.status === 'very_delayed');
                    const inProgressSerials = pendingSerials.filter(s => s.status === 'today');
                    
                    const percentage = (order.orderQty > 0) ? (order.packedQty / order.orderQty) * 100 : 0;
                    let progressBarColor = 'var(--success-color)';
                    if (percentage < 30) progressBarColor = 'var(--danger-color)';
                    else if (percentage < 70) progressBarColor = 'var(--warning-color)';

                    reportHTML += `
                        <h4>📦 Orden: ${order.key} (${order.packedQty || 0}/${order.orderQty || 0})</h4>
                        <div class="order-progress-bar" style="height: 8px;">
                            <div class="order-progress-bar-inner" style="width: ${Math.min(percentage, 100)}%; background-color: ${progressBarColor};"></div>
                        </div>
                    `;

                    if (delayedSerials.length > 0) {
                        reportHTML += `<p style="margin-top: 15px;"><strong>⚠️ Sin Movimiento (${delayedSerials.length}):</strong></p><ul>`;
                        delayedSerials.forEach(serial => {
                            reportHTML += `<li>${serial[serialHeader]} - (Estación: ${serial[stationHeader] || 'N/A'})</li>`;
                        });
                        reportHTML += `</ul>`;
                    }
                    
                    if (inProgressSerials.length > 0) {
                        reportHTML += `<p><strong>✅ En Proceso (${inProgressSerials.length}):</strong></p><ul>`;
                        inProgressSerials.forEach(serial => {
                            reportHTML += `<li>${serial[serialHeader]} - (Estación: ${serial[stationHeader] || 'N/A'})</li>`;
                        });
                        reportHTML += `</ul>`;
                    }

                    if(pendingSerials.length === 0){
                        reportHTML += `<p style="margin-top: 15px;">No hay seriales pendientes de empacar para esta orden.</p>`;
                    }
                });

                reportHTML += `</div>`;
                showModal(`Reporte de Estatus: ${currentArea}`, reportHTML, 'info', true);
            }
            
            // ========================
            // === SAP VIEW FUNCTIONS ===
            // ========================
            async function saveSapDataToFirebase(data, area) {
                try {
                    const dataToSave = {
                        orders: data,
                        lastUpdated: new Date(),
                        lastUpdatedBy: session.user
                    };
                    await db.collection('areas').doc(area).collection('sap_data').doc('current_data').set(dataToSave);
                } catch (e) {
                    console.error(`Error al guardar datos SAP en Firebase para ${area}: `, e);
                    showModal('Error', `No se pudieron guardar los datos de SAP en la nube para ${area}.`, 'error');
                }
            }
            
            // --- NUEVA FUNCIÓN ---
        // --- FUNCIÓN MODIFICADA (YA NO BORRA DE FWD) ---
            async function deleteSapOrderFromFirebase(orderKey) {
                if (!orderKey) return;
                const canEdit = session.isMaster || (session.permissions && session.permissions.includes(currentArea));
                if (!canEdit) {
                    showModal('Acceso Denegado', `No tienes permisos para modificar el área ${currentArea}.`, 'error');
                    return;
                }

                try {
                    // Borra ÚNICAMENTE del histórico de SAP
                    const sapDocRef = db.collection('areas').doc(currentArea).collection('sap_historico').doc(orderKey);
                    await sapDocRef.delete();
                    
                    // El listener de snapshot se encargará de refrescar la UI.
                    console.log(`Orden ${orderKey} eliminada de 'sap_historico'.`);

                } catch (e) {
                    console.error("Error al eliminar la orden SAP de Firebase: ", e);
                    showModal('Error al Eliminar', `No se pudo eliminar la orden ${orderKey} del histórico de SAP.`, 'error');
                }
            }

        // --- AGREGA ESTAS DOS NUEVAS FUNCIONES ---

        function updateSapBulkDeleteButton() {
            const bulkDeleteBtn = doc('sapBulkDeleteBtn');
            if (bulkDeleteBtn) {
                const selectedCount = selectedSapOrders.size;
                if (selectedCount > 0) {
                    bulkDeleteBtn.textContent = `Eliminar (${selectedCount})`;
                    bulkDeleteBtn.style.display = 'inline-block';
                } else {
                    bulkDeleteBtn.style.display = 'none';
                }
            }
        }

        async function deleteMultipleSapOrders(orderKeys) {
            if (!orderKeys || orderKeys.length === 0) return;
            const canEdit = session.isMaster || (session.permissions && session.permissions.includes(currentArea));
            if (!canEdit) {
                showModal('Acceso Denegado', `No tienes permisos para modificar el área ${currentArea}.`, 'error');
                return;
            }

            const batch = db.batch();
            const collectionRef = db.collection('areas').doc(currentArea).collection('sap_historico');
            
            orderKeys.forEach(key => {
                const docRef = collectionRef.doc(key);
                batch.delete(docRef);
            });

            try {
                await batch.commit();
                console.log(`${orderKeys.length} órdenes eliminadas de 'sap_historico'.`);
                selectedSapOrders.clear(); // Limpiamos la selección
                updateSapBulkDeleteButton(); // Ocultamos el botón
                // El listener de snapshot se encargará de refrescar la UI
            } catch (e) {
                console.error("Error en el borrado múltiple de SAP: ", e);
                showModal('Error al Eliminar', `No se pudieron eliminar las órdenes seleccionadas del histórico de SAP.`, 'error');
            }
        }
            
            
            async function syncMultiAreaSapData(groupedData) {
                const totalOrders = Object.values(groupedData).reduce((sum, arr) => sum + arr.length, 0);
                const areasAffected = Object.keys(groupedData);

                showModal('Procesando...', `Sincronizando ${totalOrders} órdenes en ${areasAffected.length} áreas...`, 'info');

                const promises = [];
                for (const areaName in groupedData) {
                    if (Object.hasOwnProperty.call(groupedData, areaName)) {
                        const ordersForArea = groupedData[areaName];
                        promises.push(saveSapDataToFirebase(ordersForArea, areaName));
                        promises.push(syncSapOrdersToFwd(ordersForArea, areaName));
                        initialSyncDoneForArea[areaName] = true;
                    }
                }

                await Promise.all(promises);
                hideModal();
                showModal('Éxito', `Workshop general procesado. Se han sincronizado los datos para las áreas: ${areasAffected.join(', ')}.`, 'success');
            }

            async function handleSapFile(file) {
    if (!file) return;

    const canEdit = session.isMaster || (session.permissions && session.permissions.includes(currentArea));
    if (!canEdit) {
        showModal('Acceso Denegado', `No tienes permisos para modificar el área ${currentArea}.`, 'error');
        return;
    }

    showModal('Procesando SAP...', `<p>Leyendo el archivo y preparando para guardar en el histórico. Por favor, espere...</p>`);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            
            // 1. Procesa el archivo y obtiene los datos de las órdenes
            const processedData = processSapFile(workbook, session.isMaster);
            
            // Si es un archivo maestro, manejamos múltiples áreas
            if (session.isMaster && processedData.isMultiArea) {
                const areasAfectadas = Object.keys(processedData.data);
                showModal('Procesando Múltiples Áreas...', `Sincronizando órdenes en ${areasAfectadas.length} áreas...`);
                
                const promises = [];
                for (const areaName in processedData.data) {
                    const ordersForArea = processedData.data[areaName];
                    promises.push(saveSapOrdersToHistoric(ordersForArea, areaName)); // Guardamos en el histórico
                    promises.push(syncSapOrdersToFwd(ordersForArea, areaName));   // Sincronizamos con FWD
                }
                await Promise.all(promises);
                
                showModal('Éxito', `Workshop general procesado. Se han sincronizado los datos para las áreas: ${areasAfectadas.join(', ')}.`, 'success');

            } else { // Si es un archivo de una sola área
                const orders = processedData.isMultiArea ? processedData.data[currentArea] || [] : processedData;
                if(orders.length === 0) {
                    showModal('Sin Datos', 'El archivo no contiene órdenes válidas para el área actual.', 'warning');
                    return;
                }
                
                // 2. Guarda las órdenes en el nuevo histórico
                await saveSapOrdersToHistoric(orders, currentArea);
                
                // 3. Sincroniza los datos con la vista FWD como antes
                await syncSapOrdersToFwd(orders, currentArea);

                showModal('Éxito', `Archivo SAP cargado. Se han creado/actualizado ${orders.length} órdenes en el histórico del área ${currentArea}.`, 'success');
            }
            
            sapDateFilter = [];

        } catch (err) {
            console.error("Error procesando archivo SAP:", err);
            showModal('Error', `No se pudo procesar el archivo SAP. <br><small>${err.message}</small>`, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}


async function saveSapOrdersToHistoric(sapOrders, areaName) {
    if (!areaName || sapOrders.length === 0) return;
    
    const batch = db.batch();
    const historicCollectionRef = db.collection('areas').doc(areaName).collection('sap_historico');

    for (const sapOrder of sapOrders) {
        const orderId = String(sapOrder['Orden']);
        const orderRef = historicCollectionRef.doc(orderId);
        
        // Creamos un objeto con la info a guardar
        const dataToSave = {
            ...sapOrder,
            lastUpdated: new Date(), // Le añadimos una fecha de última actualización
            lastUpdatedBy: session.user
        };

        // set con merge:true es la clave. Si no existe, lo crea. Si ya existe, lo actualiza.
        batch.set(orderRef, dataToSave, { merge: true });
    }

    try {
        await batch.commit();
        console.log(`${sapOrders.length} órdenes de SAP guardadas en el histórico del área ${areaName}.`);
    } catch (e) {
        console.error(`Error al guardar en el histórico de SAP para ${areaName}:`, e);
        showModal('Error de Guardado', `No se pudo actualizar el histórico de SAP para ${areaName}.`, 'error');
    }
}

            async function syncSapOrdersToFwd(sapOrders, areaName) {
                if (!areaName || sapOrders.length === 0) return;
                
                const batch = db.batch();
                const ordersCollectionRef = db.collection('areas').doc(areaName).collection('orders');

                const existingOrdersSnapshot = await ordersCollectionRef.get();
                const existingOrdersMap = new Map();
                existingOrdersSnapshot.forEach(doc => {
                    existingOrdersMap.set(doc.id, doc.data());
                });

                for (const sapOrder of sapOrders) {
                    const orderId = String(sapOrder['Orden']);
                    const orderRef = ordersCollectionRef.doc(orderId);
                    
                    const existingOrder = existingOrdersMap.get(orderId);

                    const masterData = {
                        orderQty: sapOrder['Total orden'] || 0,
                        catalogNumber: sapOrder['Catalogo'] || 'N/A',
                        orderDate: excelSerialToDate(sapOrder['Finish']) || new Date(),
                    };

                    if (existingOrder) {
                        batch.update(orderRef, masterData);
                    } else {
                        const defaultData = {
                            packedQty: 0,
                            rastreoData: [],
                            empaqueData: [],
                            headers: { rastreo: [], empaque: [] },
                            lastUpdated: new Date(),
                            lastUpdatedBy: session.user
                        };
                        batch.set(orderRef, { ...defaultData, ...masterData });
                    }
                }

                try {
                    await batch.commit();
                    console.log(`${sapOrders.length} órdenes de SAP sincronizadas con FWD para el área ${areaName}.`);
                } catch (e) {
                    console.error(`Error al sincronizar órdenes de SAP a FWD para ${areaName}:`, e);
                    showModal('Error de Sincronización', `No se pudieron actualizar las órdenes en la vista FWD para ${areaName}.`, 'error');
                }
            }


            function processSapFile(workbook, isMasterUpload = false) {
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                if (!worksheet) throw new Error("No se encontró una hoja de cálculo en el archivo.");
                const getCellValue = (cellAddress) => (worksheet[cellAddress] ? worksheet[cellAddress].v : null);
                
                const range = XLSX.utils.decode_range(worksheet['!ref']);
                const reynosaTodayString = new Date().toLocaleDateString('en-CA', { timeZone: REYNOSA_TIMEZONE });
                
                if (isMasterUpload) {
                    const resultsByArea = {};
                    for (let i = range.s.r + 1; i <= range.e.r; i++) {
                        const rowNum = i + 1;
                        const orderId = getCellValue('A' + rowNum);
                        if (!orderId) continue;
                        
                        const orderIdStr = String(orderId).trim();
                        if (!orderIdStr.startsWith('900')) {
                            continue;
                        }

                        const areaCode = getCellValue(workshopConfig.column + rowNum);
                        const areaName = workshopConfig.mapping[areaCode];

                        if (areaName) {
                            if (!resultsByArea[areaName]) {
                                resultsByArea[areaName] = [];
                            }
                            const orderData = extractSapRow(worksheet, rowNum, reynosaTodayString);
                            resultsByArea[areaName].push(orderData);
                        }
                    }
                    return { isMultiArea: true, data: resultsByArea };
                } else {
                    const processedData = [];
                    for (let i = range.s.r + 1; i <= range.e.r; i++) {
                        const rowNum = i + 1;
                        const orderId = getCellValue('A' + rowNum);
                        if (!orderId) continue;

                        const orderIdStr = String(orderId).trim();
                        if (!orderIdStr.startsWith('900')) {
                            continue;
                        }

                        processedData.push(extractSapRow(worksheet, rowNum, reynosaTodayString));
                    }
                    return processedData;
                }
            }

            function extractSapRow(worksheet, rowNum, reynosaTodayString){
                const getCellValue = (cellAddress) => (worksheet[cellAddress] ? worksheet[cellAddress].v : null);
                const total = parseFloat(getCellValue('I' + rowNum)) || 0;
                const confirmed = parseFloat(getCellValue('J' + rowNum)) || 0;
                const faltante = total - confirmed;
                const stock1 = getCellValue('B' + rowNum) || '';
                const stock2 = getCellValue('L' + rowNum) || '';
                let status = 'incomplete';
                const finishDateSerial = getCellValue('G' + rowNum);
                const finishDate = excelSerialToDate(finishDateSerial);
                const finishDateStringCA = finishDate ? finishDate.toLocaleDateString('en-CA', { timeZone: REYNOSA_TIMEZONE }) : '';
                
                if (faltante <= 0) {
                    status = 'complete';
                } else if (finishDateStringCA && finishDateStringCA < reynosaTodayString) {
                    status = 'late';
                }

                return {
                    'Orden': getCellValue('A' + rowNum),
                    'Catalogo': getCellValue('D' + rowNum) || null,
                    'Material': getCellValue('C' + rowNum) || null,
                    'Special Stock': [stock1, stock2].filter(Boolean).join(' / ') || null,
                    'Finish': finishDateSerial,
                    'Total orden': total,
                    'Total confirmado': confirmed,
                    'Faltante': faltante,
                    'status': status
                };
            }

            function renderSapView() {
    const canEdit = session.isMaster || (session.permissions && session.permissions.includes(currentArea));
    sapFileDropArea.classList.toggle('disabled', !canEdit);
    if(sapFileDropArea.querySelector('p')) {
        sapFileDropArea.querySelector('p').textContent = canEdit
            ? (session.isMaster ? 'Arrastra un archivo maestro SAP (General o de Área)' : 'Arrastra un archivo maestro SAP (.xlsx)')
            : 'No tienes permisos para esta área';
    }
    
    const hasData = sapData.length > 0;
    sapPlaceholderText.style.display = hasData ? 'none' : 'block';
    sapExportImageBtn.disabled = !hasData;

    updateSapDashboard();
    updateSapOrderList();
    updateSapTable();

    // El botón "Mostrar Hoy/Tarde" ahora limpia el array de filtros
    sapResetFilterBtn.style.display = (sapDateFilter.length > 0 && hasData) ? 'inline-block' : 'none';
    
    if (sapLastUpdated) {
        let updatedText = `Última actualización: ${formatDateTime(sapLastUpdated)}`;
        if (sapLastUpdatedBy) {
            updatedText += ` por: ${sapLastUpdatedBy}`;
        }
        sapLastUpdatedContainer.textContent = updatedText;
    } else {
        sapLastUpdatedContainer.textContent = '';
    }
}
            
            function isSapOrderForToday(order) {
                const todayString = new Date().toLocaleDateString('es-ES', {
                    timeZone: REYNOSA_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric'
                });
                const finishDate = excelSerialToDate(order['Finish']);
                return finishDate && formatDate(finishDate) === todayString;
            }

            function updateSapDashboard() {
                if(sapData.length === 0) {
                    sapTotalOrdersStat.textContent = '0';
                    sapCompletedOrdersStat.textContent = '0';
                    return;
                }
                const ordersToday = sapData.filter(row => isSapOrderForToday(row)).length;
                const ordersCompletedToday = sapData.filter(row => row.status === 'complete' && isSapOrderForToday(row)).length;

                sapTotalOrdersStat.textContent = ordersToday;
                sapCompletedOrdersStat.textContent = ordersCompletedToday;
            }

            function updateSapOrderList() {
    if (sapData.length === 0) {
        sapOrderList.innerHTML = `<p class="text-dark" style="font-size:0.9rem;">Cargue un archivo para ver las órdenes.</p>`;
        return;
    }
    
    // Si el filtro no es un array (es 'default' o un solo día de antes), lo convertimos en array para facilitar
    if (!Array.isArray(sapDateFilter)) {
        sapDateFilter = sapDateFilter === 'default' ? [] : [sapDateFilter];
    }

    const groupedByDate = new Map();
    sapData.forEach(order => {
        const date = excelSerialToDate(order['Finish']) || new Date(0);
        const dateString = formatDate(date);
        if (!groupedByDate.has(dateString)) groupedByDate.set(dateString, 0);
        groupedByDate.set(dateString, groupedByDate.get(dateString) + 1);
    });

    const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateB - dateA;
    });

    const todayString = new Date().toLocaleDateString('es-ES', { timeZone: REYNOSA_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
    
    let html = '';
    sortedDates.forEach(dateString => {
        const orderCount = groupedByDate.get(dateString);
        const isToday = dateString === todayString;
        const countText = `${orderCount} ${orderCount === 1 ? 'orden' : 'órdenes'}`;

        html += `<div class="order-item">
                    <button class="date-header" data-date="${dateString}" style="width:100%; justify-content: space-between;">
                        <span>📅 ${dateString}</span>
                        ${isToday ? `<span class="status-indicator">(${countText})</span>` : `<span class="order-count">(${countText})</span>`}
                    </button>
                 </div>`;
    });
    
    sapOrderList.innerHTML = html;
    
    sapOrderList.querySelectorAll('.date-header').forEach(header => {
        // Marcamos como activos todos los que estén en nuestro array de filtros
        if (sapDateFilter.includes(header.dataset.date)) {
            header.classList.add('active');
        }
        
        header.addEventListener('click', () => {
            const clickedDate = header.dataset.date;
            const dateIndex = sapDateFilter.indexOf(clickedDate);

            // Lógica de Toggling: Si ya está, lo quitamos. Si no está, lo agregamos.
            if (dateIndex > -1) {
                sapDateFilter.splice(dateIndex, 1); // Quitar del array
            } else {
                sapDateFilter.push(clickedDate); // Agregar al array
            }
            
            // Volvemos a renderizar todo para reflejar los cambios
            renderSapView();
        });
    });
}
            
            function updateSapTable() {
    const table = doc('sapTable');
    if (sapData.length === 0) {
        table.innerHTML = '';
        selectedSapOrders.clear(); // Limpiamos por si acaso
        updateSapBulkDeleteButton(); // Ocultamos el botón
        return;
    }

    let dataToDisplay = [];
    // Si el array de filtros está vacío, usamos la lógica de "Hoy/Tarde"
    if (sapDateFilter.length === 0) {
        dataToDisplay = sapData.filter(row => row.status === 'late' || isSapOrderForToday(row));
    } else {
        // Si el array tiene fechas, filtramos por todas las fechas incluidas en él
        dataToDisplay = sapData.filter(row => {
            const orderDate = formatDate(excelSerialToDate(row['Finish']));
            return sapDateFilter.includes(orderDate);
        });
    }

    // El resto de la función para pintar la tabla no cambia...
    if (dataToDisplay.length === 0) {
        table.innerHTML = `<thead><tr><th>No hay órdenes para la selección actual.</th></tr></thead>`;
        // Aunque no haya datos visibles, puede haber selecciones de otros filtros
        updateSapBulkDeleteButton(); 
        return;
    }

    const canManageThisArea = session.isMaster || (session.permissions && session.permissions.includes(currentArea));
    
    // --- INICIO CAMBIO DE HEADERS ---
    const headers = ['Orden', 'Catalogo', 'Material', 'Special Stock', 'Finish', 'Total orden', 'Total confirmado', 'Faltante'];
    
    // Preparamos los strings para copiar columnas
    const allVisibleOrderKeys = dataToDisplay.map(row => String(row['Orden'])).join('\n'); // <-- El \n aquí es el que tronaba el onclick

    let headersHTML = '';
    // 1. Checkbox de "Seleccionar Todo" (si hay permisos)
    if (canManageThisArea) {
        headersHTML += `<th><input type="checkbox" id="sap-select-all-checkbox" title="Seleccionar Todo"></th>`;
    }
    
    // 2. Encabezado de "Orden" (AHORA CON ID Y SIN ONCLICK)
    headersHTML += `<th class="copyable-header" 
                        id="sap-copy-order-header" 
                        title="Clic para copiar TODA la columna 'Orden'">Orden</th>`;

    // 3. El resto de los headers
    headers.slice(1).forEach(h => { // Empezamos desde el 1 porque el 0 (Orden) ya lo pusimos
        headersHTML += `<th>${h.replace(/_/g, ' ')}</th>`;
    });

    // 4. Encabezado de "Acciones" (si hay permisos)
    if (canManageThisArea) {
        headers.push('Acciones'); // (Solo para que el conteo de map() de abajo funcione)
        headersHTML += `<th>Acciones</th>`;
    }
    // --- FIN CAMBIO DE HEADERS ---


    table.innerHTML = `
        <thead><tr>${headersHTML}</tr></thead>
        <tbody>
            ${dataToDisplay.map(row => {
                const orderKey = String(row['Orden']); // Aseguramos que sea string
                const isChecked = selectedSapOrders.has(orderKey); // Vemos si ya estaba seleccionada

                let actionButtonHTML = '';
                let checkboxHTML = '';

                if (canManageThisArea) {
                    // Checkbox para la fila
                    checkboxHTML = `
                        <td style="text-align: center;">
                            <input type="checkbox" class="sap-select-row-checkbox" 
                                   data-order-key="${orderKey}" 
                                   ${isChecked ? 'checked' : ''}>
                        </td>`;
                    
                    // Botón de eliminar de la fila
                    actionButtonHTML = `
                        <td data-label="Acciones" style="text-align: center;">
                            <button class="icon-btn sap-delete-btn" title="Eliminar orden SAP" 
                                    data-order-key="${orderKey}"
                                    style="font-size: 1rem; filter: grayscale(0) opacity(0.6);">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </td>`;
                }

                return `
                    <tr class="is-${row.status}-sap ${isChecked ? 'is-selected-row' : ''}"> 
                        ${checkboxHTML}
                        
                        <td data-label="Orden" class="serial-cell sap-copy-cell" 
                            title="Clic para copiar orden ${orderKey}" 
                            data-order-key="${orderKey}">${orderKey}</td>

                        <td data-label="Catalogo">${row['Catalogo']}</td>
                        <td data-label="Material">${row['Material']}</td>
                        <td data-label="Special Stock">${row['Special Stock']}</td>
                        <td data-label="Finish">${formatDate(excelSerialToDate(row['Finish']))}</td>
                        <td data-label="Total orden">${row['Total orden']}</td>
                        <td data-label="Total confirmado">${row['Total confirmado']}</td>
                        <td data-label="Faltante">${row['Faltante']}</td>
                        ${actionButtonHTML} 
                    </tr>
                `;
            }).join('')}
        </tbody>`;

    // === SECCIÓN DE LISTENERS (MODIFICADA) ===

    // 1. Conectar botones de eliminar (FILA)
    table.querySelectorAll('.sap-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.currentTarget.dataset.orderKey;
            // Llamamos a la función INTERNA
            showConfirmationModal(
                `¿Seguro que quieres eliminar la orden SAP ${key}? Esto la borrará SÓLO del histórico de SAP (No afectará la vista FWD).`, 
                () => deleteSapOrderFromFirebase(key)
            );
        });
    });

    // 2. Conectar celdas de copiar (CELDA)
    table.querySelectorAll('.sap-copy-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            // Evitamos que el clic en la celda active el checkbox
            e.stopPropagation(); 
            const key = e.currentTarget.dataset.orderKey;
            // Llamamos a la función INTERNA/GLOBAL (esta jala de ambas formas)
            copySerialNumber(e.currentTarget, key);
        });
    });

    // --- ¡AQUÍ ESTÁ LA NUEVA MAGIA! ---
    // 2.5. Conectar encabezado de copiar (COLUMNA)
    const copyHeader = doc('sap-copy-order-header');
    if (copyHeader) {
        copyHeader.addEventListener('click', (e) => {
            // 'allVisibleOrderKeys' sigue en scope, la usamos
            // Llamamos a la función GLOBAL 'copyColumnData' que ya existe
            window.copyColumnData(e.currentTarget, allVisibleOrderKeys); 
        });
    }
    // --- FIN DE LA NUEVA MAGIA ---

    // 3. Conectar "Seleccionar Todo"
    const selectAllCheckbox = doc('sap-select-all-checkbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('click', (e) => {
            const isChecked = e.currentTarget.checked;
            const rowCheckboxes = table.querySelectorAll('.sap-select-row-checkbox');
            
            rowCheckboxes.forEach(cb => {
                const key = cb.dataset.orderKey;
                cb.checked = isChecked;
                if (isChecked) {
                    selectedSapOrders.add(key);
                } else {
                    selectedSapOrders.delete(key);
                }
                cb.closest('tr').classList.toggle('is-selected-row', isChecked);
            });
            updateSapBulkDeleteButton();
        });
    }

    // 4. Conectar checkboxes de CADA fila
    table.querySelectorAll('.sap-select-row-checkbox').forEach(cb => {
        cb.addEventListener('click', (e) => {
            // Evitamos que el clic en el check propague a la celda/fila
            e.stopPropagation(); 
            const key = e.currentTarget.dataset.orderKey;
            const isChecked = e.currentTarget.checked;

            if (isChecked) {
                selectedSapOrders.add(key);
            } else {
                selectedSapOrders.delete(key);
            }
            e.currentTarget.closest('tr').classList.toggle('is-selected-row', isChecked);
            updateSapBulkDeleteButton();

            // Sincronizamos el "Seleccionar Todo"
            if (selectAllCheckbox) {
                const allVisibleCheckboxes = table.querySelectorAll('.sap-select-row-checkbox');
                const allChecked = Array.from(allVisibleCheckboxes).every(c => c.checked);
                selectAllCheckbox.checked = allChecked;
            }
        });
    });

    // Sincronizamos el botón de borrado en lote por si acaso
    updateSapBulkDeleteButton();
}
            function formatCell(value, header, isDateTime = false) {
                if (isDateTime) return formatDateTimeFromSerial(value);
                if (header && header.toLowerCase().includes('date')) return formatDate(excelSerialToDate(value));
                return value === undefined || value === null ? '' : value;
            }
            
            function syncFwdAndSapDates() {
                if (loadedOrders.size === 0 || sapData.length === 0) return;

                const sapDateMap = new Map(sapData.map(order => [String(order.Orden), order.Finish]));
                
                loadedOrders.forEach((orderData, orderKey) => {
                    if (sapDateMap.has(orderKey)) {
                        const sapFinishDateSerial = sapDateMap.get(orderKey);
                        const sapFinishDate = excelSerialToDate(sapFinishDateSerial);
                        if(sapFinishDate) {
                            orderData.orderDate = sapFinishDate;
                        }
                    }
                });
            }

            // ===================================
            // === AUTH & AREA FUNCTIONS ===
            // ===================================
            function showLogin() {
                let content = `
                    <p>Introduce tus credenciales para acceder.</p>
                    <input type="text" id="userInput" placeholder="Usuario" style="text-transform:uppercase">
                    <input type="password" id="passwordInput" placeholder="Contraseña">
                    <button id="loginBtn" class="btn" style="margin-top: 16px;">Autenticar</button>
                `;
                showModal('Inicio de Sesión', content);
                doc('loginBtn').addEventListener('click', checkCredentials);
                doc('passwordInput').addEventListener('keyup', (e) => { if (e.key === 'Enter') checkCredentials(); });
                doc('userInput').addEventListener('keyup', (e) => { if (e.key === 'Enter') checkCredentials(); });
            }

            async function checkCredentials() {
                const userInput = doc('userInput').value.trim().toUpperCase();
                const passwordInput = doc('passwordInput').value;
                if (!userInput || !passwordInput) {
                    showModal('Error', 'Debes ingresar el usuario y la contraseña.', 'error');
                    return;
                }

                try {
                    const userDoc = await db.collection('users').doc(userInput).get();
                    if (!userDoc.exists) {
                        showModal('Error', 'El usuario no existe.', 'error');
                        return;
                    }

                    const userData = userDoc.data();
                    if (userData.password === passwordInput) {
                        session = {
                            user: userData.username,
                            isMaster: userData.isMaster || false,
                            permissions: userData.permissions || []
                        };
                        sessionStorage.setItem('appSession', JSON.stringify(session));
                        hideModal();
                        updateUIAfterAuth();
                    } else {
                        showModal('Error', 'Contraseña incorrecta.', 'error');
                    }
                } catch (e) {
                    console.error("Error de autenticación: ", e);
                    showModal('Error', 'Ocurrió un error al verificar las credenciales.', 'error');
                }
            }
            
            function logout() {
                session = { user: null, isMaster: false, permissions: [] };
                sessionStorage.removeItem('appSession');
                updateUIAfterAuth();
            }

            function updateUIAfterAuth() {
                const isAuthenticated = !!session.user;
                const canEditCurrentArea = isAuthenticated && (session.isMaster || (session.permissions && session.permissions.includes(currentArea)));

                fileDropArea.classList.toggle('disabled', !canEditCurrentArea);
                fileDropArea.querySelector('p').textContent = canEditCurrentArea ? 'Arrastra archivos de detalle (.xlsx)' : 'No tienes permisos para esta área';
                
                sapFileDropArea.classList.toggle('disabled', !canEditCurrentArea);
                if(sapFileDropArea.querySelector('p')) {
                    sapFileDropArea.querySelector('p').textContent = canEditCurrentArea
                        ? (session.isMaster ? 'Arrastra un archivo maestro SAP (General o de Área)' : 'Arrastra un archivo maestro SAP (.xlsx)')
                        : 'No tienes permisos para esta área';
                }
                
                if (isAuthenticated) {
                    logoutBtn.style.display = 'flex';
                    if (session.isMaster) {
                        adminBtn.style.display = 'flex';
                        adminBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> ${session.user}`;
                    } else {
                        adminBtn.style.display = 'none';
                    }
                } else {
                    logoutBtn.style.display = 'none';
                    adminBtn.style.display = 'flex';
                    adminBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
                }

                dailyPlanContainer.style.display = session.isMaster ? 'flex' : 'none';
                areaSelectBtn.textContent = `Área: ${currentArea}`;
                
                updateOrderList();
                render();
            }

            async function showAreaSelector() {
                const areasSnapshot = await db.collection('areas').get();
                let areas = [];
                areasSnapshot.forEach(doc => {
                    if(doc.id !== 'CONFIG') areas.push({ id: doc.id, ...doc.data() })
                });
                areas.sort((a,b) => a.id.localeCompare(b.id));

                let content = '<h3>Selecciona un Área para Visualizar</h3><ul class="area-list" style="grid-template-columns: 1fr auto;">';
                areas.forEach(area => {
                    content += `<li><span>${area.name}</span> <button class="btn select-area-btn" data-area="${area.id}" style="width: auto; padding: 5px 10px;">Seleccionar</button></li>`;
                });
                content += '</ul>';
                showModal('Selector de Área', content);

                doc('modalBody').querySelectorAll('.select-area-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const newArea = e.target.dataset.area;
                        if (newArea !== currentArea) {
                            currentArea = newArea;
                            localStorage.setItem('currentArea', currentArea);
                            areaSelectBtn.textContent = `Área: ${currentArea}`;
                            setupListenersForArea(currentArea);
                        }
                        updateUIAfterAuth();
                        hideModal();
                    });
                });
            }

            async function showAdminPanel() {
                const [areasSnapshot, usersSnapshot] = await Promise.all([
                    db.collection('areas').get(),
                    db.collection('users').get()
                ]);

                let areas = [];
                areasSnapshot.forEach(doc => {
                    if(doc.id !== 'CONFIG') areas.push({ id: doc.id, ...doc.data() })
                });
                areas.sort((a,b) => a.id.localeCompare(b.id));

                let users = [];
                usersSnapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
                users.sort((a, b) => a.id.localeCompare(b.id));

                let content = `
                <div class="admin-section">
                    <h3 class="admin-section-header">Gestionar Usuarios</h3>
                    <div class="admin-section-content">
                        <ul class="area-list user-list">
                            ${users.map(user => `<li>
                                <span style="font-weight: bold;">${user.username} ${user.isMaster ? ' (Admin)' : ''}</span>
                                <div class="permissions-display">${(user.permissions || []).join(', ')}</div>
                                <div>
                                    ${user.username !== 'MULTIPORT' ? `
                                    <button class="btn edit-user-btn" data-id="${user.id}" style="width: auto; padding: 5px 10px;">Editar</button>
                                    <button class="btn btn-danger delete-user-btn" data-id="${user.id}" style="width: auto; padding: 5px 10px; margin-left: 5px;">Eliminar</button>
                                    ` : ''}
                                </div>
                            </li>`).join('')}
                        </ul>
                        <button id="createUserBtn" class="btn" style="margin-top: 20px;">Crear Nuevo Usuario</button>
                    </div>
                </div>

                <div class="admin-section">
                    <h3 class="admin-section-header">Gestionar Áreas y Contraseñas</h3>
                    <div class="admin-section-content">
                        <ul class="area-list">
                            ${areas.map(area => `<li>
                                <input type="text" class="area-name-input" data-id="${area.id}" value="${area.name}" disabled>
                                <input type="text" class="area-password-input" data-id="${area.id}" value="${area.password || ''}">
                                <div>
                                    <button class="btn save-area-btn" data-id="${area.id}" style="width: auto; padding: 5px 10px;">Guardar</button>
                                    ${!area.isMaster ? `<button class="btn btn-danger delete-area-btn" data-id="${area.id}" style="width: auto; padding: 5px 10px; margin-left: 5px;">Eliminar</button>` : ''}
                                </div>
                            </li>`).join('')}
                        </ul>
                        <h4 style="margin-top: 20px;">Crear Nueva Área</h4>
                        <input type="text" id="newAreaInput" placeholder="Nombre de Área (ej. ENSAMBLE)" style="text-transform:uppercase">
                        <input type="text" id="newPasswordInput" placeholder="Contraseña para la nueva área">
                        <button id="createAreaBtn" class="btn" style="margin-top: 10px;">Crear Área</button>
                    </div>
                </div>
                
                <div id="masterConfigSection" class="admin-section" style="display: block;">
                    <h3 class="admin-section-header">Configuración de Workshop General</h3>
                    <div class="admin-section-content">
                        <div class="config-item">
                            <label for="masterColumnInput">Columna de Código de Área:</label>
                            <input type="text" id="masterColumnInput" value="${workshopConfig.column}">
                        </div>
                        <h4>Mapeo de Códigos a Áreas</h4>
                        <ul id="areaMappingList" class="area-list"></ul>
                        <button id="addMappingBtn" class="btn" style="width: auto; padding: 5px 10px; margin-top: 10px;">Añadir Mapeo</button>
                        <button id="saveWorkshopConfigBtn" class="btn" style="margin-top: 20px;">Guardar Configuración General</button>
                    </div>
                </div>`;

                showModal('Panel de Administrador', content);
                
                doc('createUserBtn').addEventListener('click', () => createOrUpdateUser(null));

                doc('modalBody').querySelectorAll('.edit-user-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const userId = e.target.dataset.id;
                        const user = users.find(u => u.id === userId);
                        createOrUpdateUser(user);
                    });
                });
                doc('modalBody').querySelectorAll('.delete-user-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const userId = e.target.dataset.id;
                        showConfirmationModal(`¿Seguro que quieres eliminar al usuario "${userId}"?`, async () => {
                            await db.collection('users').doc(userId).delete();
                            showAdminPanel();
                        });
                    });
                });

                doc('modalBody').querySelectorAll('.admin-section-header').forEach(header => {
                    header.addEventListener('click', () => {
                        header.parentElement.classList.toggle('expanded');
                    });
                });

                const mappingList = doc('areaMappingList');
                mappingList.innerHTML = '';
                for (const code in workshopConfig.mapping) {
                    const areaName = workshopConfig.mapping[code];
                    mappingList.appendChild(createMappingItem(code, areaName));
                }
                doc('addMappingBtn').addEventListener('click', () => {
                    mappingList.appendChild(createMappingItem('', ''));
                });
                doc('saveWorkshopConfigBtn').addEventListener('click', saveWorkshopConfig);

                doc('createAreaBtn').addEventListener('click', async () => {
                    const newAreaName = doc('newAreaInput').value.trim().toUpperCase();
                    const newPassword = doc('newPasswordInput').value.trim();
                    if (newAreaName && newPassword) {
                        await db.collection('areas').doc(newAreaName).set({
                            name: newAreaName,
                            password: newPassword,
                            isMaster: false,
                            createdAt: new Date()
                        });
                        showAdminPanel();
                    } else {
                        showModal('Atención', 'Debes especificar un nombre y una contraseña para la nueva área.', 'warning');
                    }
                });

                doc('modalBody').querySelectorAll('.save-area-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const areaId = e.target.dataset.id;
                        const newPassword = doc('modalBody').querySelector(`.area-password-input[data-id="${areaId}"]`).value.trim();
                        if (newPassword) {
                            await db.collection('areas').doc(areaId).update({ password: newPassword });
                            showAdminPanel();
                        }
                    });
                });

                doc('modalBody').querySelectorAll('.delete-area-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const areaId = e.target.dataset.id;
                        showConfirmationModal(`¿Seguro que quieres eliminar el área "${areaId}" y todos sus datos?`, async () => {
                            await deleteAreaAndSubcollections(areaId);
                            showAdminPanel();
                        });
                    });
                });
            }
            
            async function createOrUpdateUser(userToEdit = null) {
                const isEditing = userToEdit !== null;
                const title = isEditing ? `Editar Usuario: ${userToEdit.username}` : 'Crear Nuevo Usuario';

                const areasSnapshot = await db.collection('areas').get();
                let areas = [];
                areasSnapshot.forEach(doc => { if (doc.id !== 'CONFIG') areas.push({ id: doc.id, ...doc.data() }); });
                areas.sort((a,b) => a.id.localeCompare(b.id));

                let modalContent = `
                    <input type="text" id="modalUserInput" placeholder="Nombre de Usuario" style="text-transform:uppercase" value="${isEditing ? userToEdit.username : ''}" ${isEditing ? 'disabled' : ''}>
                    <input type="text" id="modalPasswordInput" placeholder="${isEditing ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}">
                    <h5 style="margin-top:16px; margin-bottom: 8px;">Permisos de Área:</h5>
                    <div id="modalPermissions" class="permissions-list">
                        ${areas.map(area => {
                            const isChecked = isEditing && userToEdit.permissions && userToEdit.permissions.includes(area.id);
                            return `<label><input type="checkbox" value="${area.id}" ${isChecked ? 'checked' : ''}>${area.name}</label>`;
                        }).join('')}
                    </div>
                    <div style="margin-top: 16px;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="modalIsMasterInput" style="width: auto; margin: 0;" ${isEditing && userToEdit.isMaster ? 'checked' : ''}>
                            Asignar permisos de Administrador
                        </label>
                    </div>
                    <button id="saveUserBtn" class="btn" style="margin-top: 20px;">${isEditing ? 'Guardar Cambios' : 'Crear Usuario'}</button>
                `;
                showModal(title, modalContent);

                doc('saveUserBtn').onclick = async () => {
                    const username = doc('modalUserInput').value.trim().toUpperCase();
                    const password = doc('modalPasswordInput').value.trim();
                    
                    if (!username || (!isEditing && !password)) {
                        showModal('Error', 'El nombre de usuario y la contraseña son obligatorios.', 'error');
                        return;
                    }

                    const permissions = Array.from(doc('modalPermissions').querySelectorAll('input:checked')).map(cb => cb.value);
                    const isMaster = doc('modalIsMasterInput').checked;
                    
                    const userData = {
                        username: username,
                        permissions: permissions,
                        isMaster: isMaster
                    };

                    if (password) {
                        userData.password = password;
                    }

                    await db.collection('users').doc(username).set(userData, { merge: true });
                    showAdminPanel();
                };
            }
            
            async function deleteAreaAndSubcollections(areaId) {
                const subcollections = ['orders', 'sap_data'];
                for (const subcollection of subcollections) {
                    const snapshot = await db.collection('areas').doc(areaId).collection(subcollection).get();
                    const batch = db.batch();
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
                await db.collection('areas').doc(areaId).delete();
            }

            function createMappingItem(code, areaName) {
                const li = document.createElement('li');
                li.className = 'mapping-item';
                li.innerHTML = `
                    <input type="text" class="mapping-code" placeholder="Código (ej. K46)" value="${code}">
                    <input type="text" class="mapping-area" placeholder="Nombre de Área" value="${areaName}">
                    <button class="btn btn-danger" style="width: auto; padding: 5px 10px;" onclick="this.parentElement.remove()">X</button>
                `;
                return li;
            }

            async function saveWorkshopConfig() {
                const newColumn = doc('masterColumnInput').value.trim().toUpperCase() || 'C';
                const newMapping = {};
                doc('areaMappingList').querySelectorAll('.mapping-item').forEach(item => {
                    const code = item.querySelector('.mapping-code').value.trim().toUpperCase();
                    const area = item.querySelector('.mapping-area').value.trim().toUpperCase();
                    if (code && area) {
                        newMapping[code] = area;
                    }
                });
                
                const newConfig = { column: newColumn, mapping: newMapping };
                
                try {
                    await db.collection('areas').doc('CONFIG').set({ general_workshop: newConfig }, { merge: true });
                    workshopConfig = newConfig;
                    showModal('Éxito', 'La configuración del workshop general ha sido guardada.', 'success');
                } catch (e) {
                    console.error("Error guardando configuración:", e);
                    showModal('Error', 'No se pudo guardar la configuración.', 'error');
                }
            }

            async function loadWorkshopConfig() {
                try {
                    const configDoc = await db.collection('areas').doc('CONFIG').get();
                    if (configDoc.exists && configDoc.data().general_workshop) {
                        workshopConfig = configDoc.data().general_workshop;
                        console.log("Configuración de workshop cargada desde Firebase.");
                    } else {
                        console.log("No se encontró configuración de workshop, usando valores por defecto.");
                    }
                } catch(e) {
                    console.error("Error cargando configuración de workshop:", e);
                }
            }
            
            async function generateDailyPlanReport() {
                showModal('Plan del Día', '<h4 style="text-align: center;">Cargando reporte...</h4>');
                try {
                    const todayString = new Date().toLocaleDateString('es-ES', {
                        timeZone: REYNOSA_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric'
                    });

                    const areasSnapshot = await db.collection('areas').get();
                    const areaDocs = areasSnapshot.docs.filter(doc => doc.id !== 'CONFIG');
                    
                    const promises = areaDocs.map(doc => doc.ref.collection('sap_data').doc('current_data').get());
                    const allSapDataDocs = await Promise.all(promises);

                    let dailyOrdersByArea = {};
                    let totalDailyOrders = 0;

                    allSapDataDocs.forEach((sapDoc, index) => {
                        if (sapDoc.exists) {
                            const areaName = areaDocs[index].id;
                            const sapOrders = sapDoc.data().orders || [];
                            
                            const pendingOrdersForToday = sapOrders.filter(order =>
                                isSapOrderForToday(order) && order.status !== 'complete'
                            );
                            
                            const countForArea = pendingOrdersForToday.length;
                            
                            if (countForArea > 0) {
                                dailyOrdersByArea[areaName] = countForArea;
                                totalDailyOrders += countForArea;
                            }
                        }
                    });

                    let reportHTML = `
                        <div class="daily-plan-modal">
                            <div class="plan-header">
                                <div class="plan-stat">
                                    <span>Órdenes Pendientes</span>
                                    <p>${totalDailyOrders}</p>
                                </div>
                                <div class="plan-date">
                                    <span>Fecha</span>
                                    <p>${todayString}</p>
                                </div>
                            </div>
                            <div class="plan-title-separator">Plan de Trabajo por Área</div>
                            <ul class="plan-area-list">
                    `;

                    if (totalDailyOrders > 0) {
                        const sortedAreas = Object.keys(dailyOrdersByArea).sort();
                        for (const area of sortedAreas) {
                            reportHTML += `<li class="plan-area-item">
                                                <span class="area-name">${area}</span>
                                                <span class="area-count">${dailyOrdersByArea[area]}</span>
                                            </li>`;
                        }
                    } else {
                        reportHTML += `<li class="plan-area-item-empty">No hay órdenes pendientes para el día de hoy.</li>`;
                    }
                    
                    reportHTML += `</ul></div>`;
                    showModal('Plan del Día', reportHTML);

                } catch (e) {
                    console.error("Error al generar el reporte del plan diario:", e);
                    showModal('Error', 'No se pudo generar el reporte del plan diario.', 'error');
                }
            }


            // ===================================
            // === THEME & INITIALIZATION ===
            // ===================================
            let currentTheme = localStorage.getItem('theme') || 'dark';

            function applyTheme(theme) {
                document.body.className = `${theme}-theme`;
                const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
                const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
                themeToggleBtn.innerHTML = theme === 'light' ? moonIcon : sunIcon;
            }
            
            function adjustStickyTops() {
                requestAnimationFrame(() => {
                    const isCurrentlyMobile = window.innerWidth <= 992;
                    if (isCurrentlyMobile) return;

                    const fwdHeader = document.querySelector('#fwdView .header');
                    const fwdControls = document.getElementById('table-controls-header');
                    const sapHeader = document.querySelector('#sapView .global-header');
                    const sapControls = document.getElementById('sap-controls-header');
                    
                    if (fwdHeader && fwdControls) {
                        const headerHeight = fwdHeader.offsetHeight;
                        const topValue = 16 + headerHeight;
                        fwdControls.style.top = `${topValue}px`;
                    }

                    if (sapHeader && sapControls) {
                        const headerHeight = sapHeader.offsetHeight;
                        const topValue = 16 + headerHeight;
                        sapControls.style.top = `${topValue}px`;
                    }
                });
            }

            themeToggleBtn.addEventListener('click', () => {
                currentTheme = currentTheme === 'light' ? 'dark' : 'light';
                localStorage.setItem('theme', currentTheme);
                applyTheme(currentTheme);
            });

            function setupListenersForArea(area) {
    if (!area) return;
    // Detenemos los listeners anteriores para evitar duplicados
    if (fwdListener) fwdListener();
    if (sapListener) sapListener();

    // === LISTENER PARA FWD (RASTREO) - ESTE NO CAMBIA ===
    fwdListener = db.collection('areas').doc(area).collection('orders').onSnapshot(snapshot => {
        const ordersFromDB = new Map();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.orderDate && data.orderDate.toDate) { data.orderDate = data.orderDate.toDate(); }
            if (data.lastUpdated && data.lastUpdated.toDate) { data.lastUpdated = data.lastUpdated.toDate(); }
            const empaqueDataMap = new Map();
            if (data.empaqueData && Array.isArray(data.empaqueData)) {
                data.empaqueData.forEach(item => { empaqueDataMap.set(item.boxId, item.serials); });
            }
            data.empaqueData = empaqueDataMap;
            ordersFromDB.set(doc.id, data);
        });
        loadedOrders = ordersFromDB;
        syncFwdAndSapDates();
        updateOrderList();
        if (mainMode === 'fwd') render();
    }, err => {
        console.error("Error escuchando datos de FWD: ", err);
        showModal('Error de Conexión', `No se pudo conectar a los datos del área ${area}.`, 'error');
    });
    
    // === LISTENER PARA SAP (HISTÓRICO) - CON LA NUEVA LÓGICA ===
    sapListener = db.collection('areas').doc(area).collection('sap_historico').onSnapshot(snapshot => {
        let newSapData = [];
        let latestUpdate = null;
        let updatedBy = null;

        snapshot.forEach(doc => {
            const orderData = doc.data();
            newSapData.push(orderData);
            
            const orderLastUpdated = orderData.lastUpdated ? orderData.lastUpdated.toDate() : null;
            if (orderLastUpdated && (!latestUpdate || orderLastUpdated > latestUpdate)) {
                latestUpdate = orderLastUpdated;
                updatedBy = orderData.lastUpdatedBy;
            }
        });

        sapData = newSapData;
        sapLastUpdated = latestUpdate;
        sapLastUpdatedBy = updatedBy;
        
        syncFwdAndSapDates();
        updateOrderList();
        if (mainMode === 'sap') {
            render();
        }
    }, err => {
        console.error("Error escuchando datos del histórico de SAP: ", err);
        showModal('Error de Conexión', `No se pudo conectar al histórico de SAP para el área ${area}.`, 'error');
    });
}

// --- ¡AQUÍ ESTÁ EL CÓDIGO RESTAURADO! ---
let isMobile = window.innerWidth <= 992;
const mobileCollapsibleCardIds = ['uploadCard', 'orderListCard', 'filtersCard', 'actionsCard', 'sap-uploadCard', 'sap-orderListCard'];
function setupMobileMode() {
    mobileCollapsibleCardIds.forEach(id => {
        const cardElement = doc(id);
        if (!cardElement) return;
        cardElement.classList.add('mobile-collapsible');
        const trigger = cardElement.querySelector('h3');
        if (trigger) {
            trigger.classList.add('mobile-trigger');
            if (!trigger.dataset.mobileListener) {
                trigger.addEventListener('click', (e) => {
                    if(window.innerWidth <= 992) {
                        e.currentTarget.closest('.card').classList.toggle('expanded');
                    }
                });
                trigger.dataset.mobileListener = 'true';
            }
        }
    });
}

function teardownMobileMode() {
    mobileCollapsibleCardIds.forEach(id => {
        const cardElement = doc(id);
        if (!cardElement) return;
        cardElement.classList.remove('mobile-collapsible', 'expanded');
        const trigger = cardElement.querySelector('h3');
        if(trigger) trigger.classList.remove('mobile-trigger');
    });
}
            let resizeTimeout;

window.addEventListener('resize', () => {
    // Limpiamos el timeout anterior si el evento se dispara rápido
    clearTimeout(resizeTimeout);
    
    // Esperamos 200ms a que termine el movimiento
    resizeTimeout = setTimeout(() => {
        const newIsMobile = window.innerWidth <= 992;
        
        // Solo renderizamos si CAMBIÓ el modo (de escritorio a móvil o viceversa)
        if (newIsMobile !== isMobile) {
            isMobile = newIsMobile;
            if (isMobile) setupMobileMode(); else teardownMobileMode();
            render();
        }
        
        adjustStickyTops();
    }, 200);
});

            window.copySerialNumber = function(element, serial) {
                if (!serial) return;
                const serialToCopy = serial.startsWith('S#') ? serial.substring(2) : serial;
                
                copyTextToClipboard(serialToCopy,
                    () => { // Success
                        const originalText = element.textContent;
                        element.textContent = '¡Copiado!';
                        element.style.fontWeight = 'bold';
                        element.style.color = 'var(--success-color)';
                        setTimeout(() => {
                            element.textContent = originalText;
                            element.style.fontWeight = '';
                            element.style.color = '';
                        }, 1500);
                    },
                    (err) => { // Error
                        console.error('Error al copiar el número de serie: ', err);
                        const originalText = element.textContent;
                        element.textContent = 'Error';
                        setTimeout(() => {
                            element.textContent = originalText;
                        }, 1500);
                    }
                );
            }

            async function initializeApp() {
                await loadWorkshopConfig();

                const masterUserRef = db.collection('users').doc('MULTIPORT');
                const masterUserDoc = await masterUserRef.get();
                if (!masterUserDoc.exists) {
                    await masterUserRef.set({
                        username: 'MULTIPORT',
                        password: 'CORNING25',
                        isMaster: true,
                        permissions: []
                    });
                    console.log("Usuario maestro 'MULTIPORT' creado.");
                }
                const masterAreaRef = db.collection('areas').doc('MULTIPORT');
                const masterAreaDoc = await masterAreaRef.get();
                if (!masterAreaDoc.exists) {
                    await masterAreaRef.set({
                        name: 'MULTIPORT',
                        password: 'CORNING25',
                        isMaster: true
                    }, { merge: true });
                    console.log("Área maestra 'MULTIPORT' verificada y asegurada.");
                }


                mainMode = localStorage.getItem('mainMode') || 'fwd';
                currentArea = localStorage.getItem('currentArea') || 'MULTIPORT';
                applyTheme(currentTheme);
                
                modeFwd.classList.toggle('active', mainMode === 'fwd');
                modeSap.classList.toggle('active', mainMode === 'sap');

                doc('fwdView').style.display = mainMode === 'fwd' ? 'block' : 'none';
                doc('sapView').style.display = mainMode === 'sap' ? 'block' : 'none';
                doc('fwdView').style.opacity = mainMode === 'fwd' ? '1' : '0';
                doc('sapView').style.opacity = mainMode === 'sap' ? '1' : '0';

                if (isMobile) setupMobileMode();
                
                const savedSession = sessionStorage.getItem('appSession');
                if (savedSession) {
                    session = JSON.parse(savedSession);
                }

                updateUIAfterAuth();
                setupListenersForArea(currentArea);

                setTimeout(adjustStickyTops, 500);
            }
                    
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registrado con éxito. Alcance:', registration.scope);
                })
                .catch(error => {
                    console.log('❌ Error al registrar el Service Worker:', error);
                });
            });
        }

                    
            // === INICIO DE LA APP ===
            initializeApp();
        });
 
        
