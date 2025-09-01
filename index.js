// Global variables
let currentDate = new Date();
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
    const dot = statusElement.querySelector('.status-dot');
    const text = statusElement.querySelector('span');

    isFirebaseConnected = connected;

    if (connected) {
        statusElement.className = 'connection-status';
        dot.className = 'status-dot';
        text.textContent = message || 'Conectado a Firebase ✅';
    } else {
        statusElement.className = 'connection-status offline';
        dot.className = 'status-dot offline';
        text.textContent = message || 'Sin conexión - Modo Local ⚠️';
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

function updateAllDisplays() {
    updateDashboard();
    generateCalendar();
    populateSelects();
    displayEvents();
    displayChecklists();
    displayConfiguration();
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
function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const navTabs = document.querySelectorAll('.nav-tab');

    tabs.forEach(tab => tab.classList.remove('active'));
    navTabs.forEach(nav => nav.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'calendar') {
        generateCalendar();
    } else if (tabName === 'dashboard') {
        updateDashboard();
    }
}

// Dashboard functions
function updateDashboard() {
    const today = new Date();
    const weekFromToday = new Date(today);
    weekFromToday.setDate(today.getDate() + 7);

    const todaySessions = data.sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate.toDateString() === today.toDateString();
    }).length;

    const weekSessions = data.sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= today && sessionDate <= weekFromToday;
    }).length;

    const activeEvents = data.events.filter(event => {
        return event.status !== 'completed';
    }).length;

    const pendingDeliveries = data.checklists.filter(checklist => {
        return checklist.items.some(item => !item.completed);
    }).length;

    document.getElementById('todaySessions').textContent = todaySessions;
    document.getElementById('weekSessions').textContent = weekSessions;
    document.getElementById('activeEvents').textContent = activeEvents;
    document.getElementById('pendingDeliveries').textContent = pendingDeliveries;

    displayUpcomingSessions();
}

function displayUpcomingSessions() {
    const container = document.getElementById('upcomingSessions');
    const upcoming = data.sessions
        .filter(session => new Date(session.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    container.innerHTML = upcoming.map(session => {
        const event = data.events.find(e => e.id === session.eventId);
        return `
                    <div class="session-item">
                        <strong>${event ? event.client : 'Cliente'}</strong> - ${session.date} ${session.time}
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
        currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    // Add day headers
    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.style.cssText = 'background: #4a5568; color: white; padding: 10px; font-weight: bold; text-align: center;';
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

        // Add sessions for this day
        const daySessions = data.sessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate.toDateString() === cellDate.toDateString();
        });

        const sessionsContainer = dayElement.querySelector('.day-sessions');
        daySessions.forEach(session => {
            const event = data.events.find(e => e.id === session.eventId);
            const sessionElement = document.createElement('div');
            sessionElement.className = 'session-event';
            sessionElement.textContent = `${session.time} ${event ? event.client : 'Cliente'}`;
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

    // Pre-fill session date
    document.getElementById('sessionDate').value = date.toISOString().split('T')[0];
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
    // Populate photographers
    const photographerSelects = document.querySelectorAll('#sessionPhotographer');
    photographerSelects.forEach(select => {
        select.innerHTML = data.photographers.map(photographer =>
            `<option value="${photographer}">${photographer}</option>`
        ).join('');
    });

    // Populate services
    const serviceSelects = document.querySelectorAll('#eventService');
    serviceSelects.forEach(select => {
        select.innerHTML = data.services.map(service =>
            `<option value="${service.name}">${service.name} - ${service.price}</option>`
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

    const session = {
        id: Date.now(),
        eventId: document.getElementById('sessionEvent').value,
        date: document.getElementById('sessionDate').value,
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

    const event = {
        id: Date.now(),
        client: document.getElementById('eventClient').value,
        phone: document.getElementById('eventPhone').value,
        type: document.getElementById('eventType').value,
        service: document.getElementById('eventService').value,
        date: document.getElementById('eventDate').value,
        location: document.getElementById('eventLocation').value,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    data.events.push(event);
    saveData();

    // Save to Firebase
    if (isFirebaseConnected) {
        const { id, ...eventData } = event;
        await saveToFirebase('events', eventData, id);
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
            { name: 'Fotos editadas enviadas', completed: false },
            { name: 'Videos editados enviados', completed: false },
            { name: 'Fotos sin editar enviadas', completed: false },
            { name: 'Link de descarga compartido', completed: false },
            { name: 'Cliente confirmó recepción', completed: false }
        ],
        createdAt: new Date().toISOString()
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

// Display functions
function displayEvents() {
    const container = document.getElementById('eventsList');

    if (data.events.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No hay eventos creados aún</p>';
        return;
    }

    container.innerHTML = data.events.map(event => {
        const sessions = data.sessions.filter(s => s.eventId == event.id);
        const completedSessions = sessions.filter(s => s.status === 'completed').length;

        return `
                    <div class="event-card">
                        <div class="event-header">
                            <div>
                                <div class="event-title">${event.client}</div>
                                <small>${event.type} - ${event.date} - ${event.location}</small>
                            </div>
                            <div>
                                <span class="status-badge status-${event.status}">${event.status}</span>
                                <button class="btn btn-danger" onclick="deleteEvent(${event.id})" style="margin-left: 10px; padding: 5px 10px;">🗑️</button>
                            </div>
                        </div>
                        <div><strong>Teléfono:</strong> ${event.phone}</div>
                        <div><strong>Servicio:</strong> ${event.service}</div>
                        <div class="sessions-grid">
                            <div><strong>Sesiones:</strong> ${completedSessions}/${sessions.length} completadas</div>
                            ${sessions.map(session => `
                                <div class="session-item">
                                    📅 ${session.date} ${session.time} - ${session.photographer}
                                    <br>📍 ${session.location}
                                    <span class="status-badge status-${session.status}">${session.status}</span>
                                    <button onclick="toggleSessionStatus(${session.id})" class="btn" style="padding: 2px 8px; margin-left: 10px;">
                                        ${session.status === 'pending' ? '✅' : '🔄'}
                                    </button>
                                    <button onclick="deleteSession(${session.id})" class="btn btn-danger" style="padding: 2px 8px;">🗑️</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
    }).join('');
}

function displayChecklists() {
    const container = document.getElementById('checklistContainer');

    if (data.checklists.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No hay checklists creadas aún</p>';
        return;
    }

    container.innerHTML = data.checklists.map(checklist => {
        const completedItems = checklist.items.filter(item => item.completed).length;
        const progress = (completedItems / checklist.items.length) * 100;

        return `
                    <div class="client-checklist">
                        <div class="checklist-header">
                            <div>
                                <h3>${checklist.clientName}</h3>
                                <div style="background: #e2e8f0; height: 8px; border-radius: 4px; margin-top: 8px;">
                                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); height: 100%; width: ${progress}%; border-radius: 4px; transition: width 0.3s ease;"></div>
                                </div>
                                <small>${completedItems}/${checklist.items.length} completados (${Math.round(progress)}%)</small>
                            </div>
                            <button class="btn btn-danger" onclick="deleteChecklist(${checklist.id})">🗑️</button>
                        </div>
                        <div class="checklist-items">
                            ${checklist.items.map((item, index) => `
                                <div class="checklist-item">
                                    <input type="checkbox" ${item.completed ? 'checked' : ''} 
                                           onchange="toggleChecklistItem(${checklist.id}, ${index})">
                                    <span style="${item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${item.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
    }).join('');
}

function displayConfiguration() {
    // Display photographers
    const photographersContainer = document.getElementById('photographersList');
    photographersContainer.innerHTML = data.photographers.map((photographer, index) => `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span>${photographer}</span>
                    <button class="btn btn-danger" onclick="removePhotographer(${index})" style="padding: 4px 8px;">🗑️</button>
                </div>
            `).join('');

    // Display services
    const servicesContainer = document.getElementById('servicesList');
    servicesContainer.innerHTML = data.services.map((service, index) => `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span>${service.name} - ${service.price}</span>
                    <button class="btn btn-danger" onclick="removeService(${index})" style="padding: 4px 8px;">🗑️</button>
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
    const price = parseInt(document.getElementById('newServicePrice').value);

    if (name && price) {
        const service = { name, price };
        data.services.push(service);
        saveData();

        // Save to Firebase
        if (isFirebaseConnected) {
            await saveToFirebase('services', service);
        }

        displayConfiguration();
        document.getElementById('newService').value = '';
        document.getElementById('newServicePrice').value = '';
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
            saveData();

            // Clear Firebase data too
            if (isFirebaseConnected) {
                syncWithFirebase();
            }

            location.reload();
        }
    }
}