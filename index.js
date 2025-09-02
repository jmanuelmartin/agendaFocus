// Obtiene la fecha actual en Argentina (UTC-3)
function getArgentinaDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const argTime = new Date(utc + (-3 * 3600000)); // UTC-3
    return argTime;
}

// Convierte una fecha a string en formato YYYY-MM-DD en zona horaria Argentina
function getArgentinaDateString(dateObj = null) {
    const date = dateObj || getArgentinaDate();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const argTime = new Date(utc + (-3 * 3600000)); // UTC-3
    
    const year = argTime.getFullYear();
    const month = String(argTime.getMonth() + 1).padStart(2, '0');
    const day = String(argTime.getDate()).padStart(2, '0');
    
    return `${day}/${month}/${year}`; // Cambiado de YYYY-MM-DD a DD/MM/YYYY
}

// Convierte una fecha string (YYYY-MM-DD) a objeto Date en zona Argentina
function parseArgentinaDate(dateString) {
    // Manejar tanto formato DD/MM/YYYY como YYYY-MM-DD para compatibilidad
    let day, month, year;
    
    if (dateString.includes('/')) {
        // Formato DD/MM/YYYY
        [day, month, year] = dateString.split('/').map(Number);
    } else if (dateString.includes('-')) {
        // Formato YYYY-MM-DD (para compatibilidad con inputs de fecha)
        [year, month, day] = dateString.split('-').map(Number);
    }
    
    return new Date(year, month - 1, day);
}

// Obtiene hora actual en formato HH:MM para Argentina
function getArgentinaTimeString() {
    const date = getArgentinaDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Compara si dos fechas son el mismo día en Argentina
function isSameDayArgentina(date1, date2) {
    return getArgentinaDateString(date1) === getArgentinaDateString(date2);
}

// Agregar esta función junto con las otras utilidades al inicio del archivo
function formatDisplayDate(dateString) {
    if (!dateString) return '—';
    
    if (dateString.includes('-')) {
        // Si viene en formato YYYY-MM-DD, convertir a DD/MM/YYYY
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
    return dateString; // Si ya está en formato DD/MM/YYYY
}

// Global variables
let currentDate = getArgentinaDate();
let db = null;
let isFirebaseConnected = false;
let data = {
    photographers: ['Fotógrafo Principal'],
    services: [
        { name: 'Boda Completa', price: 50000 },
        { name: 'Quinceañera', price: 30000 },
        { name: 'Evento Corporativo', price: 25000 },
        { name: 'Sesión de Retratos', price: 15000 }
    ],
    events: [],
    sessions: [],
    checklists: []
};

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    checkFirebaseConfig();
    loadLocalData();
    updateDashboard();
    generateCalendar();
    populateSelects();
    displayEvents();
    displayChecklists();
    displayConfiguration();
    displayPlanilla();
    
    // Establecer fecha actual argentina por defecto en formularios
    const sessionDateInput = document.getElementById('sessionDate');
    const eventDateInput = document.getElementById('eventDate');

    // Los inputs HTML date necesitan formato YYYY-MM-DD
    const today = getArgentinaDate();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const htmlDateFormat = `${year}-${month}-${day}`;

    if (sessionDateInput) {
        sessionDateInput.value = htmlDateFormat;
    }
    if (eventDateInput) {
        eventDateInput.value = htmlDateFormat;
    }
});

// Firebase functions
function checkFirebaseConfig() {
    const apiKey = localStorage.getItem('firebase-api-key');
    const projectId = localStorage.getItem('firebase-project-id');
    const appId = localStorage.getItem('firebase-app-id');

    if (apiKey && projectId && appId) {
        connectToFirebase(apiKey, projectId, appId);
        document.getElementById('firebaseSetup').style.display = 'none';
    }
}

function initializeFirebase() {
    const apiKey = document.getElementById('firebaseApiKey').value.trim();
    const projectId = document.getElementById('firebaseProjectId').value.trim();
    const appId = document.getElementById('firebaseAppId').value.trim();

    if (!apiKey || !projectId || !appId) {
        alert('Por favor completa todos los campos de configuración');
        return;
    }

    localStorage.setItem('firebase-api-key', apiKey);
    localStorage.setItem('firebase-project-id', projectId);
    localStorage.setItem('firebase-app-id', appId);

    connectToFirebase(apiKey, projectId, appId);
}

function connectToFirebase(apiKey, projectId, appId) {
    try {
        const firebaseConfig = {
            apiKey: apiKey,
            authDomain: `${projectId}.firebaseapp.com`,
            projectId: projectId,
            storageBucket: `${projectId}.appspot.com`,
            messagingSenderId: '123456789',
            appId: appId
        };

        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();

        updateConnectionStatus(true);
        document.getElementById('firebaseSetup').style.display = 'none';

        // Load data from Firebase
        loadFromFirebase();

        console.log('Firebase conectado exitosamente');
    } catch (error) {
        console.error('Error conectando Firebase:', error);
        alert('Error al conectar Firebase. Verifica la configuración.');
        updateConnectionStatus(false);
    }
}

function skipFirebase() {
    document.getElementById('firebaseSetup').style.display = 'none';
    updateConnectionStatus(false, 'Modo sin conexión');
}

function updateConnectionStatus(connected, message = null) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return; // Evita error si el elemento no existe aún

    const dot = statusElement.querySelector('.status-dot');
    const text = statusElement.querySelector('span');

    isFirebaseConnected = connected;

    if (connected) {
        statusElement.className = 'connection-status';
        if (dot) dot.className = 'status-dot';
        if (text) text.textContent = message || 'Conectado a Firebase ✅';
    } else {
        statusElement.className = 'connection-status offline';
        if (dot) dot.className = 'status-dot offline';
        if (text) text.textContent = message || 'Sin conexión - Modo Local ⚠️';
    }
}

async function loadFromFirebase() {
    if (!db) return;

    try {
        showLoading(true);

        // Load all collections
        const collections = ['photographers', 'services', 'events', 'sessions', 'checklists'];

        for (const collection of collections) {
            const snapshot = await db.collection(collection).get();
            if (!snapshot.empty) {
                if (collection === 'photographers' || collection === 'services') {
                    data[collection] = [];
                    snapshot.forEach(doc => {
                        data[collection].push(doc.data());
                    });
                } else {
                    data[collection] = [];
                    snapshot.forEach(doc => {
                        data[collection].push({ id: doc.id, ...doc.data() });
                    });
                }
            }
        }

        updateAllDisplays();
        showLoading(false);
        console.log('Datos cargados desde Firebase');
    } catch (error) {
        console.error('Error cargando datos de Firebase:', error);
        showLoading(false);
        updateConnectionStatus(false, 'Error de conexión');
    }
}

async function saveToFirebase(collection, data, docId = null) {
    if (!db) return;

    try {
        if (docId) {
            await db.collection(collection).doc(docId.toString()).set(data);
        } else {
            await db.collection(collection).add(data);
        }
        console.log(`Guardado en Firebase: ${collection}`);
    } catch (error) {
        console.error('Error guardando en Firebase:', error);
        alert('Error al guardar en Firebase. Los datos se mantienen localmente.');
    }
}

async function deleteFromFirebase(collection, docId) {
    if (!db) return;

    try {
        await db.collection(collection).doc(docId.toString()).delete();
        console.log(`Eliminado de Firebase: ${collection}/${docId}`);
    } catch (error) {
        console.error('Error eliminando de Firebase:', error);
    }
}

async function syncWithFirebase() {
    if (!isFirebaseConnected) {
        alert('Firebase no está conectado');
        return;
    }

    if (confirm('¿Sincronizar todos los datos con Firebase? Esto sobrescribirá los datos en la nube.')) {
        try {
            showLoading(true);

            // Clear Firebase collections
            const collections = ['photographers', 'services', 'events', 'sessions', 'checklists'];
            for (const collection of collections) {
                const snapshot = await db.collection(collection).get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            // Upload current data
            for (const photographer of data.photographers) {
                await db.collection('photographers').add({ name: photographer });
            }

            for (const service of data.services) {
                await db.collection('services').add(service);
            }

            for (const event of data.events) {
                const { id, ...eventData } = event;
                await db.collection('events').doc(id.toString()).set(eventData);
            }

            for (const session of data.sessions) {
                const { id, ...sessionData } = session;
                await db.collection('sessions').doc(id.toString()).set(sessionData);
            }

            for (const checklist of data.checklists) {
                const { id, ...checklistData } = checklist;
                await db.collection('checklists').doc(id.toString()).set(checklistData);
            }

            showLoading(false);
            alert('¡Sincronización completada exitosamente!');
        } catch (error) {
            console.error('Error sincronizando:', error);
            showLoading(false);
            alert('Error durante la sincronización');
        }
    }
}

function showLoading(show) {
    // You can implement a loading indicator here if needed
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.disabled = show;
        if (show) {
            btn.innerHTML = '<div class="spinner"></div>' + btn.textContent;
        }
    });
}

// Local storage functions (fallback)
function saveLocalData() {
    try {
        localStorage.setItem('photoBusinessData', JSON.stringify(data));
    } catch (e) {
        console.log('Guardando datos en memoria');
    }
}

function loadLocalData() {
    try {
        const saved = localStorage.getItem('photoBusinessData');
        if (saved) {
            data = { ...data, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.log('Datos cargados por defecto');
    }
}

function saveData() {
    saveLocalData(); // Always save locally as backup
    // Firebase saves are handled individually per action
}

// Tab management
function showTab(tabName, el) {
    const tabs = document.querySelectorAll('.tab-content');
    const navTabs = document.querySelectorAll('.nav-tab');

    // ocultar todos
    tabs.forEach(tab => tab.classList.remove('active'));
    navTabs.forEach(nav => nav.classList.remove('active'));

    // mostrar el tab seleccionado
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    if (el) {
        el.classList.add('active');
    }

    // refrescar si es necesario
    if (tabName === 'calendar') {
        generateCalendar();
    } else if (tabName === 'dashboard') {
        updateDashboard();
    } else if (tabName === 'planilla') {
        displayPlanilla();
    }
}

// Dashboard functions
function updateDashboard() {
    const today = getArgentinaDate();
    const todayString = getArgentinaDateString(today);
    const weekFromToday = new Date(today);
    weekFromToday.setDate(today.getDate() + 7);

    const todaySessions = data.sessions.filter(session => {
        return session.date === todayString;
    }).length;

    const weekEvents = data.sessions.filter(session => {
        const sessionDate = parseArgentinaDate(session.date);
        return sessionDate >= today && sessionDate <= weekFromToday;
    }).length;

    const activeEvents = data.events.filter(event => {
        return event.status !== 'completed';
    }).length;

    document.getElementById('todaySessions').textContent = todaySessions;
    document.getElementById('weekEvents').textContent = weekEvents;
    document.getElementById('activeEvents').textContent = activeEvents;

    displayUpcomingSessions();
}

function displayUpcomingSessions() {
    const container = document.getElementById('upcomingSessions');
    const today = getArgentinaDate();
    
    const upcoming = data.sessions
        .filter(session => {
            const sessionDate = parseArgentinaDate(session.date);
            return sessionDate >= today;
        })
        .sort((a, b) => parseArgentinaDate(a.date) - parseArgentinaDate(b.date))
        .slice(0, 5);

    container.innerHTML = upcoming.map(session => {
        const event = data.events.find(e => e.id === session.eventId);
        return `
            <div class="session-item">
                <strong>${event ? event.client : 'Cliente'}</strong> - ${formatDisplayDate(session.date)} ${session.time}
                <br><small>${session.location} | ${session.photographer}</small>
            </div>
        `;
    }).join('') || '<p>No hay sesiones próximas</p>';
}

// Calendar functions
function generateCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    document.getElementById('currentMonth').textContent =
        currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    // Add day headers
    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.style.cssText = 'background: #333; color: white; padding: 10px; font-weight: bold; text-align: center;';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });

    // Add calendar days
    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);

        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.onclick = () => selectDate(cellDate);

        if (cellDate.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }

        dayElement.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${cellDate.getDate()}</div>
            <div class="day-sessions"></div>
        `;

        // Add sessions for this day - CORREGIDO: convertir todas las fechas al mismo formato
        const cellDateString = getArgentinaDateString(cellDate);
        const daySessions = data.sessions.filter(session => {
            // Normalizar la fecha de la sesión al formato DD/MM/YYYY
            let sessionDate = session.date;
            if (sessionDate.includes('-')) {
                // Si viene en formato YYYY-MM-DD, convertir a DD/MM/YYYY
                const [year, month, day] = sessionDate.split('-');
                sessionDate = `${day}/${month}/${year}`;
            }
            return sessionDate === cellDateString;
        });

        const sessionsContainer = dayElement.querySelector('.day-sessions');
        daySessions.forEach(session => {
            const event = data.events.find(e => e.id == session.eventId); // Usar == para comparar número con string
            const sessionElement = document.createElement('div');
            sessionElement.className = 'session-event';
            sessionElement.textContent = `${session.time} ${event ? event.client : 'Cliente'}`;
            if (event) {
                sessionElement.style.cursor = "pointer";
                sessionElement.onclick = (e) => {
                    e.stopPropagation();
                    showEventInfoModal(event.id);
                };
            }
            sessionsContainer.appendChild(sessionElement);
        });

        calendarGrid.appendChild(dayElement);
    }
}

function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    generateCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    generateCalendar();
}

function selectDate(date) {
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');

    // Los inputs HTML date requieren formato YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    document.getElementById('sessionDate').value = `${year}-${month}-${day}`;
}

// Modal functions
function openSessionModal() {
    populateSelects();
    document.getElementById('sessionModal').style.display = 'block';
}

function openEventModal() {
    populateSelects();
    document.getElementById('eventModal').style.display = 'block';
}

function openChecklistModal() {
    populateChecklistClients();
    document.getElementById('checklistModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Populate select elements
function populateSelects() {
    // Populate photographers - CORREGIDO: manejar tanto strings como objetos
    const photographerSelects = document.querySelectorAll('#sessionPhotographer');
    photographerSelects.forEach(select => {
        select.innerHTML = data.photographers.map(photographer => {
            // Manejar tanto formato string como objeto
            const name = typeof photographer === 'string' ? photographer : photographer.name;
            return `<option value="${name}">${name}</option>`;
        }).join('');
    });

    // Populate services
    const serviceSelects = document.querySelectorAll('#eventService');
    serviceSelects.forEach(select => {
        select.innerHTML = data.services.map(service =>
            `<option value="${service.name}">${service.name}</option>`
        ).join('');
    });

    // Populate events for sessions
    const eventSelects = document.querySelectorAll('#sessionEvent');
    eventSelects.forEach(select => {
        select.innerHTML = '<option value="">Seleccionar evento...</option>' +
            data.events.map(event =>
                `<option value="${event.id}">${event.client} - ${event.type}</option>`
            ).join('');
    });
}

function populateChecklistClients() {
    const clientSelect = document.getElementById('checklistClient');
    clientSelect.innerHTML = data.events.map(event =>
        `<option value="${event.id}">${event.client}</option>`
    ).join('');
}

// Form handlers
document.getElementById('sessionForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    // CORREGIDO: convertir fecha de input HTML (YYYY-MM-DD) a formato DD/MM/YYYY
    const inputDate = document.getElementById('sessionDate').value;
    let formattedDate = inputDate;
    if (inputDate.includes('-')) {
        const [year, month, day] = inputDate.split('-');
        formattedDate = `${day}/${month}/${year}`;
    }

    const session = {
        id: Date.now(),
        eventId: parseInt(document.getElementById('sessionEvent').value), // Asegurar que sea número
        date: formattedDate, // Usar fecha formateada
        time: document.getElementById('sessionTime').value,
        photographer: document.getElementById('sessionPhotographer').value,
        location: document.getElementById('sessionLocation').value,
        notes: document.getElementById('sessionNotes').value,
        status: 'pending'
    };

    data.sessions.push(session);
    saveData();

    // Save to Firebase
    if (isFirebaseConnected) {
        const { id, ...sessionData } = session;
        await saveToFirebase('sessions', sessionData, id);
    }

    closeModal('sessionModal');
    generateCalendar();
    updateDashboard();
    this.reset();
});

document.getElementById('eventForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    // CORREGIDO: convertir fecha de input HTML (YYYY-MM-DD) a formato DD/MM/YYYY
    const inputDate = document.getElementById('eventDate').value;
    let formattedDate = inputDate;
    if (inputDate.includes('-')) {
        const [year, month, day] = inputDate.split('-');
        formattedDate = `${day}/${month}/${year}`;
    }

    const event = {
        id: Date.now(),
        client: document.getElementById('eventClient').value,
        phone: document.getElementById('eventPhone').value,
        type: document.getElementById('eventType').value,
        service: document.getElementById('eventService').value,
        date: formattedDate, // Usar fecha formateada
        location: document.getElementById('eventLocation').value,
        status: 'Activo',
        createdAt: new Date().toISOString(),
        archived: false
    };

    data.events.push(event);

    // Crear sesión automática para el evento en la fecha del evento
    const session = {
        id: Date.now() + 1,
        eventId: event.id,
        date: formattedDate, // Usar misma fecha formateada
        time: "00:00",
        photographer: data.photographers[0] ? (typeof data.photographers[0] === 'string' ? data.photographers[0] : data.photographers[0].name) : "",
        location: event.location,
        notes: "Sesión principal del evento",
        status: 'pending'
    };
    data.sessions.push(session);

    saveData();

    // Save to Firebase
    if (isFirebaseConnected) {
        const { id, ...eventData } = event;
        await saveToFirebase('events', eventData, id);

        const { id: sessionId, ...sessionData } = session;
        await saveToFirebase('sessions', sessionData, sessionId);
    }

    closeModal('eventModal');
    displayEvents();
    updateDashboard();
    this.reset();
});

document.getElementById('checklistForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const clientId = document.getElementById('checklistClient').value;
    const event = data.events.find(e => e.id == clientId);

    const checklist = {
        id: Date.now(),
        clientId: clientId,
        clientName: event.client,
        items: [
            { name: 'Entrega de fotos [Sesión de día]', completed: false },
            { name: 'Entrega de fotos [Sesión de noche]', completed: false },
            { name: 'Entrega de fotos [Sesión de amigos]', completed: false },
            { name: 'Entrega de fotos [Fiesta]', completed: false },
            { name: 'Elección de fotos para publicación', completed: false }
        ],
        createdAt: new Date().toISOString(),
        archived: false
    };

    data.checklists.push(checklist);
    saveData();

    // Save to Firebase
    if (isFirebaseConnected) {
        const { id, ...checklistData } = checklist;
        await saveToFirebase('checklists', checklistData, id);
    }

    closeModal('checklistModal');
    displayChecklists();
    updateDashboard();
    this.reset();
});

function displayEvents() {
    const container = document.getElementById('eventsList');
    if (!container) return;

    if (!window.collapsedEvents) window.collapsedEvents = {};

    const activeEvents = data.events.filter(e => !e.archived);
    const archivedEvents = data.events.filter(e => e.archived);

    let html = '';

    // Activos
    if (activeEvents.length === 0) {
        html += '<p style="text-align: center; color: #666;">No hay eventos activos</p>';
    } else {
        html += activeEvents.map(event => {
            const sessions = data.sessions.filter(s => s.eventId == event.id);
            const completedSessions = sessions.filter(s => s.status === 'completed').length;
            const allSessionsCompleted = sessions.length > 0 && completedSessions === sessions.length;
            const isCollapsed = !!window.collapsedEvents[event.id];

            return `
                <div class="event-card" data-event="${event.id}">
                    <div class="event-header">
                        <div>
                            <div class="event-title">${event.client}</div>
                            <small>${event.type} - ${formatDisplayDate(event.date)} - ${event.location}</small>
                        </div>
                        <div>
                            <button class="btn btn-secondary" onclick="toggleCollapseEvent('${event.id}')" style="margin-right:8px;">
                                <span class="collapse-icon ${isCollapsed ? 'collapsed' : 'expanded'}">⮟</span>
                            </button>
                            <span class="status-badge status-${event.status}">${event.status}</span>
                            ${allSessionsCompleted && !event.archived ? `<button class="btn btn-primary" onclick="archiveEvent('${event.id}')" style="margin-left: 10px;">Archivar</button>` : ''}
                            <button class="btn btn-danger" onclick="deleteEvent('${event.id}')" style="margin-left: 10px; padding: 5px 10px;">🗑️</button>
                        </div>
                    </div>
                    <div class="event-details" id="event-details-${event.id}" style="display:${isCollapsed ? 'none' : 'block'};">
                        <div><strong>Teléfono:</strong> ${event.phone}</div>
                        <div><strong>Servicio:</strong> ${event.service}</div>
                        <div class="sessions-grid">
                            <div><strong>Sesiones:</strong> ${completedSessions}/${sessions.length} completadas</div>
                            ${sessions.map(session => `
                                <div class="session-item">
                                    📅 ${session.date} ${session.time} - ${session.photographer}
                                    <br>📍 ${session.location}
                                    <span class="status-badge status-${session.status}">${session.status}</span>
                                    <button onclick="toggleSessionStatus('${session.id}')" class="btn" style="padding: 2px 8px; margin-left: 10px;">
                                        ${session.status === 'pending' ? '✅' : '🔄'}
                                    </button>
                                    <button onclick="deleteSession(${session.id})" class="btn btn-danger" style="padding: 2px 8px;">🗑️</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Archivados
    html += `
        <div style="margin-top:32px;">
            <h4>Archivados</h4>
            <div id="archivedEvents">
                ${archivedEvents.length === 0 ? '<p style="color:#888;">No hay eventos archivados</p>' :
                    archivedEvents.map(event => {
                        const sessions = data.sessions.filter(s => s.eventId == event.id);
                        const completedSessions = sessions.filter(s => s.status === 'completed').length;
                        const isCollapsed = !!window.collapsedEvents[event.id];
                        return `
                        <div class="event-card archived" data-event="${event.id}">
                            <div class="event-header">
                                <div>
                                    <div class="event-title">${event.client}</div>
                                    <small>${event.type} - ${event.date} - ${event.location}</small>
                                </div>
                                <div>
                                    <button class="btn btn-secondary" onclick="toggleCollapseEvent('${event.id}')" style="margin-right:8px;">
                                    <span class="collapse-icon ${isCollapsed ? 'collapsed' : 'expanded'}">⮟</span>
                                    </button>
                                    <span class="status-badge status-${event.status}">${event.status}</span>
                                    <button class="btn btn-primary" onclick="unarchiveEvent('${event.id}')" style="margin-right:8px;">Desarchivar</button>
                                    <button class="btn btn-danger" onclick="deleteEvent('${event.id}')" style="margin-left: 10px; padding: 5px 10px;">🗑️</button>
                                </div>
                            </div>
                            <div class="event-details" id="event-details-${event.id}" style="display:${isCollapsed ? 'none' : 'block'};">
                                <div><strong>Teléfono:</strong> ${event.phone}</div>
                                <div><strong>Servicio:</strong> ${event.service}</div>
                                <div class="sessions-grid">
                                    <div><strong>Sesiones:</strong> ${completedSessions}/${sessions.length} completadas</div>
                                    ${sessions.map(session => `
                                        <div class="session-item">
                                            📅 ${session.date} ${session.time} - ${session.photographer}
                                            <br>📍 ${session.location}
                                            <span class="status-badge status-${session.status}">${session.status}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')
                }
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function displayConfiguration() {
    // Display photographers
    const photographersContainer = document.getElementById('photographersList');
    photographersContainer.innerHTML = data.photographers.map((photographer, index) => `
        <div class="config-item">
            <span>${typeof photographer === 'string' ? photographer : photographer.name}</span>
            <button class="btn btn-danger" onclick="removePhotographer(${index})" title="Eliminar fotógrafo">🗑️</button>
        </div>
    `).join('');

    // Display services
    const servicesContainer = document.getElementById('servicesList');
    servicesContainer.innerHTML = data.services.map((service, index) => `
        <div class="config-item">
            <span>${service.name}</span>
            <button class="btn btn-danger" onclick="removeService(${index})" title="Eliminar servicio">🗑️</button>
        </div>
    `).join('');
}

// Configuration functions
async function addPhotographer() {
    const name = document.getElementById('newPhotographer').value.trim();
    if (name && !data.photographers.includes(name)) {
        data.photographers.push(name);
        saveData();

        // Save to Firebase
        if (isFirebaseConnected) {
            await saveToFirebase('photographers', { name: name });
        }

        displayConfiguration();
        document.getElementById('newPhotographer').value = '';
    }
}

async function removePhotographer(index) {
    if (confirm('¿Estás seguro de eliminar este fotógrafo?')) {
        const photographer = data.photographers[index];
        data.photographers.splice(index, 1);
        saveData();

        // Remove from Firebase (would need to find by name)
        if (isFirebaseConnected) {
            const snapshot = await db.collection('photographers').where('name', '==', photographer).get();
            snapshot.forEach(doc => doc.ref.delete());
        }

        displayConfiguration();
    }
}

async function addService() {
    const name = document.getElementById('newService').value.trim();

    if (name && !data.services.some(s => s.name === name)) {
        const service = { name };
        data.services.push(service);
        saveData();

        // Save to Firebase
        if (isFirebaseConnected) {
            await saveToFirebase('services', service);
        }

        displayConfiguration();
        document.getElementById('newService').value = '';
    }
}

async function removeService(index) {
    if (confirm('¿Estás seguro de eliminar este servicio?')) {
        const service = data.services[index];
        data.services.splice(index, 1);
        saveData();

        // Remove from Firebase
        if (isFirebaseConnected) {
            const snapshot = await db.collection('services').where('name', '==', service.name).get();
            snapshot.forEach(doc => doc.ref.delete());
        }

        displayConfiguration();
    }
}

// Action functions
async function deleteEvent(eventId) {
    if (confirm('¿Estás seguro de eliminar este evento? Se eliminarán también todas sus sesiones.')) {
        data.events = data.events.filter(e => e.id !== eventId);
        data.sessions = data.sessions.filter(s => s.eventId !== eventId);
        data.checklists = data.checklists.filter(c => c.clientId !== eventId);
        saveData();

        // Delete from Firebase
        if (isFirebaseConnected) {
            await deleteFromFirebase('events', eventId);
            const sessions = data.sessions.filter(s => s.eventId === eventId);
            for (const session of sessions) {
                await deleteFromFirebase('sessions', session.id);
            }
            const checklists = data.checklists.filter(c => c.clientId === eventId);
            for (const checklist of checklists) {
                await deleteFromFirebase('checklists', checklist.id);
            }
        }

        displayEvents();
        updateDashboard();
    }
}

async function deleteSession(sessionId) {
    if (confirm('¿Estás seguro de eliminar esta sesión?')) {
        data.sessions = data.sessions.filter(s => s.id !== sessionId);
        saveData();

        // Delete from Firebase
        if (isFirebaseConnected) {
            await deleteFromFirebase('sessions', sessionId);
        }

        displayEvents();
        generateCalendar();
        updateDashboard();
    }
}

async function toggleSessionStatus(sessionId) {
    const session = data.sessions.find(s => s.id === sessionId);
    if (session) {
        session.status = session.status === 'pending' ? 'completed' : 'pending';
        saveData();

        // Update in Firebase
        if (isFirebaseConnected) {
            const { id, ...sessionData } = session;
            await saveToFirebase('sessions', sessionData, id);
        }

        displayEvents();
        updateDashboard();
    }
}

async function deleteChecklist(checklistId) {
    if (confirm('¿Estás seguro de eliminar esta checklist?')) {
        data.checklists = data.checklists.filter(c => c.id !== checklistId);
        saveData();

        // Delete from Firebase
        if (isFirebaseConnected) {
            await deleteFromFirebase('checklists', checklistId);
        }

        displayChecklists();
        updateDashboard();
    }
}

async function toggleChecklistItem(checklistId, itemIndex) {
    const checklist = data.checklists.find(c => c.id === checklistId);
    if (checklist) {
        checklist.items[itemIndex].completed = !checklist.items[itemIndex].completed;
        saveData();

        // Update in Firebase
        if (isFirebaseConnected) {
            const { id, ...checklistData } = checklist;
            await saveToFirebase('checklists', checklistData, id);
        }

        displayChecklists();
        updateDashboard();
    }
}

// Data import/export
function exportData() {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'photo-business-data.json';
    link.click();
    URL.revokeObjectURL(url);
}

function importData() {
    const file = document.getElementById('importFile').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (confirm('¿Estás seguro de importar estos datos? Se sobrescribirán los datos actuales.')) {
                    data = { ...data, ...importedData };
                    saveData();

                    // If Firebase is connected, sync the imported data
                    if (isFirebaseConnected) {
                        syncWithFirebase();
                    }

                    location.reload();
                }
            } catch (error) {
                alert('Error al importar el archivo. Verifica que sea un archivo JSON válido.');
            }
        };
        reader.readAsText(file);
    }
}

function clearAllData() {
    if (confirm('¿Estás seguro de eliminar TODOS los datos? Esta acción no se puede deshacer.')) {
        if (confirm('Última confirmación: ¿Realmente quieres eliminar todo?')) {
            data = {
                photographers: ['Fotógrafo Principal'],
                services: [
                    { name: 'Boda Completa', price: 50000 },
                    { name: 'Quinceañera', price: 30000 },
                    { name: 'Evento Corporativo', price: 25000 },
                    { name: 'Sesión de Retratos', price: 15000 }
                ],
                events: [],
                sessions: [],
                checklists: []
            };
            localStorage.removeItem('photoBusinessData'); // Limpia el storage
            saveData();

            // Clear Firebase data too
            if (isFirebaseConnected) {
                syncWithFirebase();
            }

            location.reload();
        }
    }
}

document.querySelector('.loading').style.display = 'flex'; // Mostrar
// ...cuando termina la carga:
document.querySelector('.loading').style.display = 'none'; // Ocultar

function displayPlanilla() {
    const tbody = document.querySelector('#planillaTable tbody');
    if (!tbody) return;

    tbody.innerHTML = data.events.map(event => {
        // Buscar sesiones relacionadas
        const sesiones = data.sessions
            .filter(s => s.eventId == event.id)
            .map(s => `${s.date} ${s.time} (${s.photographer})`)
            .join('<br>') || '—';

        // Buscar servicios contratados
        const servicio = event.service || '—';

        // Otros: puedes agregar aquí cualquier otro dato extra si lo necesitas
        const otros = event.otros || '—';

        return `
            <tr>
                <td>${event.client}</td>
                <td>${event.date}</td>
                <td>${event.location}</td>
                <td>${servicio}</td>
                <td>${otros}</td>
                <td>${sesiones}</td>
            </tr>
        `;
    }).join('');
}

// Llama a displayPlanilla cuando se actualicen los datos
function updateAllDisplays() {
    updateDashboard();
    generateCalendar();
    populateSelects();
    displayEvents();
    displayChecklists();
    displayConfiguration();
    displayPlanilla(); // <-- Agregado aquí
}

function showEventInfoModal(eventId) {
    const event = data.events.find(e => e.id == eventId);
    if (!event) return;

    // Busca sesiones relacionadas
    const sessions = data.sessions.filter(s => s.eventId == event.id);

    // Construye el HTML de la info
    const html = `
        <h2>🎉 ${event.client}</h2>
        <p><span class="event-info-label">📅 Tipo:</span> ${event.type}</p>
        <p><span class="event-info-label">🛎️ Servicio:</span> ${event.service}</p>
        <p><span class="event-info-label">🗓️ Fecha:</span> ${event.date}</p>
        <p><span class="event-info-label">📍 Lugar:</span> ${event.location}</p>
        <p><span class="event-info-label">📞 Teléfono:</span> ${event.phone}</p>
        <hr>
        <h3>Sesiones</h3>
        ${sessions.length === 0 ? '<p style="color:#bbb;">No hay sesiones asociadas.</p>' : `
            <ul>
                ${sessions.map(s => `<li>🕒 ${s.date} ${s.time} — ${s.photographer} <span style="color:#bbb;">(${s.location})</span></li>`).join('')}
            </ul>
        `}
    `;

    document.getElementById('eventInfoContent').innerHTML = `
        <span class="close" onclick="closeModal('eventInfoModal')">&times;</span>
        ${html}
    `;
    document.getElementById('eventInfoModal').style.display = 'block';
}

function archiveChecklist(checklistId) {
    const checklist = data.checklists.find(c => c.id === checklistId);
    if (checklist) {
        checklist.archived = true;
        saveData();
        displayChecklists();
        updateDashboard();
    }
}

function toggleCollapseChecklist(checklistId) {
    if (!window.collapsedChecklists) window.collapsedChecklists = {};
    window.collapsedChecklists[checklistId] = !window.collapsedChecklists[checklistId];
    displayChecklists();
}

function archiveEvent(eventId) {
    const event = data.events.find(e => e.id === eventId);
    if (event) {
        event.archived = true;
        event.status = 'Archivado'; // Cambia el estado
        saveData();

        // Actualiza en Firebase si corresponde
        if (isFirebaseConnected) {
            const { id, ...eventData } = event;
            saveToFirebase('events', eventData, id);
        }

        displayEvents();
        updateDashboard();
    }
}

function toggleCollapseEvent(eventId) {
    if (!window.collapsedEvents) window.collapsedEvents = {};
    window.collapsedEvents[eventId] = !window.collapsedEvents[eventId];
    displayEvents();
}

function displayChecklists() {
    const container = document.getElementById('checklistContainer');
    if (!container) return;

    // Estado de colapso por checklist (en memoria)
    if (!window.collapsedChecklists) window.collapsedChecklists = {};

    // Separar activas y archivadas
    const active = data.checklists.filter(c => !c.archived);
    const archived = data.checklists.filter(c => c.archived);

    // Renderizar activas
    let html = '';
    if (active.length === 0) {
        html += '<p style="text-align: center; color: #666;">No hay checklists activas</p>';
    } else {
        html += active.map((checklist) => {
            const completedItems = checklist.items.filter(item => item.completed).length;
            const progress = (completedItems / checklist.items.length) * 100;
            const allCompleted = completedItems === checklist.items.length;
            const isCollapsed = !!window.collapsedChecklists[checklist.id];

            return `
                <div class="client-checklist" data-checklist="${checklist.id}">
                    <div class="checklist-header">
                        <div>
                            <h3>${checklist.clientName}</h3>
                            <div style="background: #e2e8f0; height: 8px; border-radius: 4px; margin-top: 8px;">
                                <div style="background: linear-gradient(135deg, #667eea, #764ba2); height: 100%; width: ${progress}%; border-radius: 4px; transition: width 0.3s ease;"></div>
                            </div>
                            <small>${completedItems}/${checklist.items.length} completados (${Math.round(progress)}%)</small>
                        </div>
                        <div>
                            <button class="btn btn-secondary" onclick="toggleCollapseChecklist(${checklist.id})" style="margin-right:8px;">
                                <span class="collapse-icon ${isCollapsed ? 'collapsed' : 'expanded'}">⮟</span>
                            </button>
                            ${allCompleted && !checklist.archived ? `<button class="btn btn-primary" onclick="archiveChecklist(${checklist.id})">Archivar</button>` : ''}
                            <button class="btn btn-danger" onclick="deleteChecklist(${checklist.id})">🗑️</button>
                        </div>
                    </div>
                    <div class="checklist-items" id="checklist-items-${checklist.id}" style="display:${isCollapsed ? 'none' : 'block'};">
                        ${checklist.items.map((item, index) => `
                            <div class="checklist-item">
                                <input type="checkbox" ${item.completed ? 'checked' : ''} ${checklist.archived ? 'disabled' : ''}
                                       onchange="toggleChecklistItem(${checklist.id}, ${index})">
                                <span style="${item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${item.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Renderizar archivadas
    html += `
        <div style="margin-top:32px;">
            <h4>Archivadas</h4>
            <div id="archivedChecklists">
                ${archived.length === 0 ? '<p style="color:#888;">No hay checklists archivadas</p>' :
                    archived.map(checklist => {
                        const isCollapsed = !!window.collapsedChecklists[checklist.id];
                        return `
                        <div class="client-checklist archived" data-checklist="${checklist.id}">
                            <div class="checklist-header">
                                <div>
                                    <h3>${checklist.clientName}</h3>
                                    <small>Archivada el ${new Date(checklist.createdAt).toLocaleDateString()}</small>
                                </div>
                                <div>
                                    <button class="btn btn-secondary" onclick="toggleCollapseChecklist(${checklist.id})" style="margin-right:8px;">
                                        <span class="collapse-icon ${isCollapsed ? 'collapsed' : 'expanded'}">⮟</span>
                                    </button>
                                    <button class="btn btn-primary" onclick="unarchiveChecklist(${checklist.id})" style="margin-right:8px;">Desarchivar</button>
                                    <button class="btn btn-danger" onclick="deleteChecklist(${checklist.id})">🗑️</button>
                                </div>
                            </div>
                            <div class="checklist-items" id="checklist-items-${checklist.id}" style="display:${isCollapsed ? 'none' : 'block'};">
                                ${checklist.items.map((item, index) => `
                                    <div class="checklist-item">
                                        <input type="checkbox" ${item.completed ? 'checked' : ''} disabled>
                                        <span style="${item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${item.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                    }).join('')
                }
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function unarchiveChecklist(checklistId) {
    const checklist = data.checklists.find(c => c.id === checklistId);
    if (checklist) {
        checklist.archived = false;
        saveData();

        // Actualiza en Firebase si corresponde
        if (isFirebaseConnected) {
            const { id, ...checklistData } = checklist;
            saveToFirebase('checklists', checklistData, id);
        }

        displayChecklists();
        updateDashboard();
    }
}

function unarchiveEvent(eventId) {
    const event = data.events.find(e => e.id === eventId);
    if (event) {
        event.archived = false;
        event.status = 'Activo'; // <-- Cambia el estado a activo
        saveData();

        // Actualiza en Firebase si corresponde
        if (isFirebaseConnected) {
            const { id, ...eventData } = event;
            saveToFirebase('events', eventData, id);
        }

        displayEvents();
        updateDashboard();
    }
}