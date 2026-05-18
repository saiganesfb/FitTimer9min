// ============================================
// FitTimer — Database Layer (IndexedDB)
// ============================================
// IndexedDB is a real database built into every browser.
// It stores structured data (like SQL tables) with zero setup.

const DB_NAME = 'FitTimerDB';
const DB_VERSION = 4;

let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Users table
            if (!database.objectStoreNames.contains('users')) {
                const userStore = database.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                userStore.createIndex('name', 'name', { unique: false });
                userStore.createIndex('username', 'username', { unique: true });
            } else {
                // Migration from v1: add username index
                const tx = event.target.transaction;
                const userStore = tx.objectStore('users');
                if (!userStore.indexNames.contains('username')) {
                    userStore.createIndex('username', 'username', { unique: true });
                }
            }

            // Sessions table
            if (!database.objectStoreNames.contains('sessions')) {
                const sessionStore = database.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                sessionStore.createIndex('userId', 'userId', { unique: false });
                sessionStore.createIndex('date', 'date', { unique: false });
                sessionStore.createIndex('userId_date', ['userId', 'date'], { unique: false });
            }

            // Daily Logs table (habits + food + sleep tracking)
            if (!database.objectStoreNames.contains('dailyLogs')) {
                const logStore = database.createObjectStore('dailyLogs', { keyPath: 'id', autoIncrement: true });
                logStore.createIndex('userId', 'userId', { unique: false });
                logStore.createIndex('dateKey', 'dateKey', { unique: false });
                logStore.createIndex('userId_dateKey', ['userId', 'dateKey'], { unique: true });
            }

            // Body Measurements table
            if (!database.objectStoreNames.contains('measurements')) {
                const measStore = database.createObjectStore('measurements', { keyPath: 'id', autoIncrement: true });
                measStore.createIndex('userId', 'userId', { unique: false });
                measStore.createIndex('date', 'date', { unique: false });
            }

            // Body Composition table
            if (!database.objectStoreNames.contains('compositions')) {
                const compStore = database.createObjectStore('compositions', { keyPath: 'id', autoIncrement: true });
                compStore.createIndex('userId', 'userId', { unique: false });
                compStore.createIndex('date', 'date', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            reject('IndexedDB error: ' + event.target.error);
        };
    });
}

// --- User Operations ---

function addUser(user) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readwrite');
        const store = tx.objectStore('users');
        const request = store.add(user);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getUserByUsername(username) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const index = store.index('username');
        const request = index.get(username);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

// Simple hash for client-side password (not bank-level security, but UX of login)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'fittimer_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getAllUsers() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getUser(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function updateUser(user) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readwrite');
        const store = tx.objectStore('users');
        const request = store.put(user);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// --- Session Operations ---

function addSession(session) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite');
        const store = tx.objectStore('sessions');
        const request = store.add(session);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getSessionsByUser(userId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// --- Export ---

async function exportUserData(userId) {
    const user = await getUser(userId);
    const sessions = await getSessionsByUser(userId);
    const dailyLogs = await getDailyLogsByUser(userId);
    const measurements = await getMeasurementsByUser(userId);
    const compositions = await getCompositionsByUser(userId);
    return { user, sessions, dailyLogs, measurements, compositions, exportedAt: new Date().toISOString() };
}

// --- Daily Log Operations ---

function saveDailyLog(log) {
    // Uses put (upsert) — same userId+dateKey overwrites
    return new Promise((resolve, reject) => {
        const tx = db.transaction('dailyLogs', 'readwrite');
        const store = tx.objectStore('dailyLogs');
        const request = store.put(log);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getDailyLog(userId, dateKey) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('dailyLogs', 'readonly');
        const store = tx.objectStore('dailyLogs');
        const index = store.index('userId_dateKey');
        const request = index.get([userId, dateKey]);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

function getDailyLogsByUser(userId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('dailyLogs', 'readonly');
        const store = tx.objectStore('dailyLogs');
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// --- Measurements Operations ---

function addMeasurement(measurement) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('measurements', 'readwrite');
        const store = tx.objectStore('measurements');
        const request = store.add(measurement);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getMeasurementsByUser(userId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('measurements', 'readonly');
        const store = tx.objectStore('measurements');
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// --- Composition Operations ---

function addComposition(comp) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('compositions', 'readwrite');
        const store = tx.objectStore('compositions');
        const request = store.add(comp);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getCompositionsByUser(userId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('compositions', 'readonly');
        const store = tx.objectStore('compositions');
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
