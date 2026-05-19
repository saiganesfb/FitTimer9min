// ============================================
// FitTimer — App Logic (v3 — Gamified)
// ============================================

// Mindset sub-tab panel switcher (global for inline onclick)
function switchAhPanel(panel) {
    document.querySelectorAll('.ah-subtab').forEach(b => b.classList.remove('active'));
    document.querySelector('[onclick*="' + panel + '"]').classList.add('active');
    document.querySelectorAll('.ah-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('ah' + panel.charAt(0).toUpperCase() + panel.slice(1)).classList.add('active');
}

// --- State ---
let timerInterval = null;
let remainingSeconds = 15 * 60;
let totalSeconds = 15 * 60;
let selectedDuration = 15;
let isRunning = false;
let isPaused = false;
let currentUserId = null;
let currentUser = null;
let sessions = [];
let dailyLogs = [];
let logViewingDate = new Date();
let previousXP = 0;
let previousLevel = 1;
let previousAchievements = [];

const WORKOUT_ICONS = { walked: '🚶', strength: '🏋️', cardio: '🏃', stretch: '🧘', rest: '😴' };

// --- DOM Elements ---
const $ = (id) => document.getElementById(id);

const authLogin = $('authLogin');
const authRegister = $('authRegister');
const mainApp = $('mainApp');
const switchUserBtn = $('switchUserBtn');
const currentUserEl = $('currentUser');

const timerDisplay = $('timerDisplay');
const timerLabel = $('timerLabel');
const timerRing = $('timerRing');
const startBtn = $('startBtn');
const pauseBtn = $('pauseBtn');
const stopBtn = $('stopBtn');
const resetBtn = $('resetBtn');

const streakCount = $('streakCount');
const weekCount = $('weekCount');
const totalCount = $('totalCount');
const totalMinutes = $('totalMinutes');

const stopDialog = $('stopDialog');
const stopDoneTime = $('stopDoneTime');
const stopTotalTime = $('stopTotalTime');
const stopPartialMin = $('stopPartialMin');

const celebration = $('celebration');
const celebrationMsg = $('celebrationMsg');
const celebrationStats = $('celebrationStats');

const durationBtns = document.querySelectorAll('.duration-btn');
const tabBtns = document.querySelectorAll('.tab-btn');

// --- Theme Toggle ---
(function initTheme() {
    const saved = localStorage.getItem('ft-theme') || 'dark';
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
    const btn = $('themeToggleBtn');
    if (btn) {
        btn.textContent = saved === 'light' ? '☀️' : '🌙';
        btn.addEventListener('click', () => {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            if (isLight) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('ft-theme', 'dark');
                btn.textContent = '🌙';
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('ft-theme', 'light');
                btn.textContent = '☀️';
            }
        });
    }
})();

// --- Initialize ---
async function init() {
    await openDB();
    const lastUserId = localStorage.getItem('fitTimer_lastUser');

    if (lastUserId) {
        const user = await getUser(Number(lastUserId));
        if (user) {
            // If old user without username, auto-login (migration)
            if (!user.username) {
                await loginUser(user.id);
                bindEvents();
                return;
            }
            await loginUser(user.id);
            bindEvents();
            return;
        }
    }

    // No remembered user — show login (or register if no users exist)
    const users = await getAllUsers();
    if (users.length === 0) {
        showRegisterScreen();
    } else {
        showLoginScreen();
    }
    bindEvents();
}

// --- Auth Screens ---

function showLoginScreen() {
    authLogin.classList.remove('hidden');
    authRegister.classList.add('hidden');
    mainApp.classList.add('hidden');
    $('loginError').classList.add('hidden');
}

function showRegisterScreen() {
    authLogin.classList.add('hidden');
    authRegister.classList.remove('hidden');
    mainApp.classList.add('hidden');
    $('registerError').classList.add('hidden');
}

async function loginUser(userId) {
    currentUserId = userId;
    currentUser = await getUser(userId);
    sessions = await getSessionsByUser(userId);
    dailyLogs = await getDailyLogsByUser(userId);
    localStorage.setItem('fitTimer_lastUser', userId);

    selectedDuration = currentUser.goal || 15;
    remainingSeconds = selectedDuration * 60;
    totalSeconds = selectedDuration * 60;

    // Initialize gamification state
    previousXP = calculateXP(sessions);
    previousLevel = getLevel(previousXP).level;
    previousAchievements = getUnlockedAchievements(sessions).map(a => a.id);

    authLogin.classList.add('hidden');
    authRegister.classList.add('hidden');
    mainApp.classList.remove('hidden');

    currentUserEl.textContent = currentUser.name;
    durationBtns.forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.minutes) === selectedDuration));

    updateTimerDisplay();
    updateRingProgress();
    updateStats();
    updateXPBar();
    updateDailyChallenge();
    renderHistory();
    renderProfile();
    renderProgress();
    initRoutineTab();
    initWorkoutLogger();
    initWlogDatePicker();
    initFullVolumeTab();
    initMeasurements();
    initComposition();
}

// --- Event Binding ---

function bindEvents() {
    // Login form
    $('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = $('loginUsername').value.trim().toLowerCase();
        const password = $('loginPassword').value;
        if (!username || !password) return;

        const user = await getUserByUsername(username);
        const hash = await hashPassword(password);

        if (!user || user.passwordHash !== hash) {
            $('loginError').classList.remove('hidden');
            return;
        }

        $('loginError').classList.add('hidden');
        await loginUser(user.id);
    });

    // Register form
    $('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = $('regUsername').value.trim().toLowerCase();
        const password = $('regPassword').value;
        const name = $('regName').value.trim();
        if (!username || !password || !name) return;

        // Check if username taken
        const existing = await getUserByUsername(username);
        if (existing) {
            $('registerError').classList.remove('hidden');
            return;
        }

        const hash = await hashPassword(password);
        const user = {
            username: username,
            passwordHash: hash,
            name: name,
            height: $('regHeight').value ? Number($('regHeight').value) : null,
            weight: $('regWeight').value ? Number($('regWeight').value) : null,
            goal: Number($('regGoal').value),
            createdAt: new Date().toISOString()
        };

        const userId = await addUser(user);
        $('registerError').classList.add('hidden');
        await loginUser(userId);
    });

    // Auth screen toggles
    $('showRegister').addEventListener('click', (e) => { e.preventDefault(); showRegisterScreen(); });
    $('showLogin').addEventListener('click', (e) => { e.preventDefault(); showLoginScreen(); });

    // Navigate to Profile tab
    switchUserBtn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const profileBtn = document.querySelector('[data-tab="profile"]');
        profileBtn.classList.add('active');
        $('tabProfile').classList.add('active');
    });

    // Logout button in Profile tab
    $('logoutBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('fitTimer_lastUser');
            showLoginScreen();
        }
    });

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            $('tab' + capitalize(btn.dataset.tab)).classList.add('active');
            if (btn.dataset.tab === 'history') { renderHistory(); initFullVolumeTab(); }
            if (btn.dataset.tab === 'profile') renderProfile();
            if (btn.dataset.tab === 'progress') renderProgress();
            if (btn.dataset.tab === 'log') renderLogTab();
        });
    });

    // Mindset sub-tab switching (event delegation for hidden elements)
    // (handled via inline onclick + global switchAhPanel function)

    // Duration buttons
    durationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isRunning) return;
            durationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $('customMinutes').value = '';
            selectedDuration = parseInt(btn.dataset.minutes);
            remainingSeconds = selectedDuration * 60;
            totalSeconds = selectedDuration * 60;
            updateTimerDisplay();
            updateRingProgress();
        });
    });

    // Custom minutes input
    $('customMinutes').addEventListener('change', () => {
        if (isRunning) return;
        const val = parseInt($('customMinutes').value);
        if (val && val >= 1 && val <= 120) {
            durationBtns.forEach(b => b.classList.remove('active'));
            selectedDuration = val;
            remainingSeconds = val * 60;
            totalSeconds = val * 60;
            updateTimerDisplay();
            updateRingProgress();
        }
    });

    // Timer controls
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    stopBtn.addEventListener('click', showStopDialog);
    resetBtn.addEventListener('click', resetTimer);

    // Stop dialog
    $('stopRecordBtn').addEventListener('click', () => { stopDialog.classList.add('hidden'); completeSession(true); });
    $('stopDiscardBtn').addEventListener('click', () => { stopDialog.classList.add('hidden'); resetTimer(); });
    $('stopCancelBtn').addEventListener('click', () => { stopDialog.classList.add('hidden'); startTimer(); });

    // Celebration
    $('celebrationClose').addEventListener('click', () => celebration.classList.add('hidden'));

    // Profile actions
    $('editProfileBtn').addEventListener('click', editProfile);
    $('saveProfileBtn').addEventListener('click', saveProfile);
    $('cancelEditBtn').addEventListener('click', cancelEdit);
    $('exportDataBtn').addEventListener('click', exportData);
    $('importDataBtn').addEventListener('click', () => $('importFileInput').click());
    $('importFileInput').addEventListener('change', importData);

    // Settings toggles
    const soundToggle = $('soundToggle');
    const notifToggle = $('notifToggle');
    soundToggle.checked = localStorage.getItem('fitTimer_soundOff') !== 'true';
    notifToggle.checked = localStorage.getItem('fitTimer_notifOff') !== 'true';
    soundToggle.addEventListener('change', () => {
        localStorage.setItem('fitTimer_soundOff', !soundToggle.checked);
    });
    notifToggle.addEventListener('change', () => {
        localStorage.setItem('fitTimer_notifOff', !notifToggle.checked);
        if (notifToggle.checked && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    });

    // Log tab interactions
    $('logPrevDay').addEventListener('click', () => { logViewingDate.setDate(logViewingDate.getDate() - 1); renderLogTab(); });
    $('logNextDay').addEventListener('click', () => { logViewingDate.setDate(logViewingDate.getDate() + 1); renderLogTab(); });

    // Log buttons (workout, food, sleep) — each with its own sound
    const logSoundMap = { logWorkout: playWorkoutSelect, logFood: playFoodSelect, logSleep: playSleepSelect };
    ['logWorkout', 'logFood', 'logSleep'].forEach(groupId => {
        $(groupId).addEventListener('click', (e) => {
            const btn = e.target.closest('.log-btn');
            if (!btn) return;
            // Toggle selection within group
            $(groupId).querySelectorAll('.log-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            logSoundMap[groupId]();
            vibrateShort();
            autoSaveLog();
        });
    });

    // Health check (multi-select: tap to toggle each independently)
    $('logHealth').addEventListener('click', (e) => {
        const btn = e.target.closest('.log-btn');
        if (!btn) return;
        // "All Good" clears others; others clear "All Good"
        if (btn.dataset.value === 'allgood') {
            $('logHealth').querySelectorAll('.log-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        } else {
            const allGoodBtn = $('logHealth').querySelector('[data-value="allgood"]');
            if (allGoodBtn) allGoodBtn.classList.remove('active');
            btn.classList.toggle('active');
        }
        playHealthTick();
        vibrateShort();
        autoSaveLog();
    });

    // Water glasses
    $('logWater').addEventListener('click', (e) => {
        const glass = e.target.closest('.water-glass');
        if (!glass) return;
        const num = parseInt(glass.dataset.glass);
        // Fill up to this glass, or unfill if already the last filled
        const glasses = $('logWater').querySelectorAll('.water-glass');
        const currentFilled = $('logWater').querySelectorAll('.water-glass.filled').length;
        const newCount = (num === currentFilled) ? num - 1 : num;
        glasses.forEach((g, i) => g.classList.toggle('filled', i < newCount));
        $('waterCount').textContent = `${newCount} / 8 glasses`;
        playWaterDrop(newCount === 8);
        autoSaveLog();
    });

    // Note auto-save on blur
    $('logNote').addEventListener('blur', () => autoSaveLog());

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (!celebration.classList.contains('hidden')) { if (e.code === 'Space') celebration.classList.add('hidden'); return; }
        if (!stopDialog.classList.contains('hidden')) return;
        if (e.code === 'Space' && mainApp.classList.contains('hidden') === false) {
            e.preventDefault();
            if (isRunning) pauseTimer(); else startTimer();
        }
    });
}

// --- Timer ---

function startTimer() {
    if (!isPaused) {
        remainingSeconds = isPaused ? remainingSeconds : (isRunning ? remainingSeconds : selectedDuration * 60);
        totalSeconds = selectedDuration * 60;
    }
    isPaused = false;
    isRunning = true;

    timerLabel.textContent = 'WORKING OUT';
    timerRing.classList.add('running');
    startBtn.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    resetBtn.classList.add('hidden');

    playStartTimer();
    vibrateShort();
    startQuoteCarousel();

    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerDisplay();
        updateRingProgress();
        // Subtle tick every 30 seconds
        if (remainingSeconds > 0 && remainingSeconds % 30 === 0) playTick();
        // Countdown beeps for final 3 seconds
        if (remainingSeconds > 0 && remainingSeconds <= 3) playCountdown();
        // Halfway encouragement
        if (remainingSeconds === Math.floor(totalSeconds / 2)) playHalfway();
        if (remainingSeconds <= 0) completeSession(false);
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    isPaused = true;
    isRunning = false;
    timerLabel.textContent = 'PAUSED';
    timerRing.classList.remove('running');
    pauseBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
    startBtn.innerHTML = '&#9654; RESUME';
    stopBtn.classList.remove('hidden');
    resetBtn.classList.remove('hidden');

    stopQuoteCarousel();
}

function showStopDialog() {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    timerRing.classList.remove('running');
    stopQuoteCarousel();

    const doneSec = totalSeconds - remainingSeconds;
    const doneMin = Math.ceil(doneSec / 60);
    stopDoneTime.textContent = doneMin;
    stopTotalTime.textContent = selectedDuration;
    stopPartialMin.textContent = doneMin;

    stopDialog.classList.remove('hidden');
}

function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    isPaused = false;
    remainingSeconds = selectedDuration * 60;
    totalSeconds = selectedDuration * 60;

    timerLabel.textContent = 'READY';
    timerRing.classList.remove('running');
    startBtn.classList.remove('hidden');
    startBtn.innerHTML = '&#9654; START';
    pauseBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');

    updateTimerDisplay();
    updateRingProgress();
}

async function completeSession(isPartial) {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    isPaused = false;
    stopQuoteCarousel();

    const actualMinutes = isPartial
        ? Math.ceil((totalSeconds - remainingSeconds) / 60)
        : selectedDuration;

    // Record session
    const session = {
        userId: currentUserId,
        date: new Date().toISOString(),
        duration: actualMinutes,
        targetDuration: selectedDuration,
        completed: !isPartial
    };

    await addSession(session);
    sessions.push(session);

    // Calculate XP gained
    const newXP = calculateXP(sessions);
    const xpGained = newXP - previousXP;
    const newLevel = getLevel(newXP);

    // Play sounds & haptics
    playComplete();
    vibrateDone();
    // Notification
    if (localStorage.getItem('fitTimer_notifOff') !== 'true' && Notification.permission === 'granted') {
        new Notification('FitTimer', { body: `${actualMinutes} min workout done! 🎉`, icon: 'icons/icon-192.png' });
    }
    // XP sparkle after completion fanfare
    if (xpGained > 0) setTimeout(() => playXPGain(), 1200);

    // Show celebration
    showCelebration(actualMinutes, isPartial, xpGained);

    // Check for level up
    if (newLevel.level > previousLevel) {
        setTimeout(() => showLevelUp(newLevel), 1500);
    }

    // Check for new achievements
    const newAchievements = getNewAchievements(sessions, previousAchievements);
    if (newAchievements.length > 0) {
        const delay = newLevel.level > previousLevel ? 3500 : 1500;
        newAchievements.forEach((ach, i) => {
            setTimeout(() => showAchievementPopup(ach), delay + i * 2000);
        });
    }

    // Update state
    previousXP = newXP;
    previousLevel = newLevel.level;
    previousAchievements = getUnlockedAchievements(sessions).map(a => a.id);

    // Reset UI
    timerLabel.textContent = 'DONE!';
    timerRing.classList.remove('running');
    startBtn.classList.remove('hidden');
    startBtn.innerHTML = '&#9654; START';
    pauseBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');

    remainingSeconds = selectedDuration * 60;
    totalSeconds = selectedDuration * 60;
    updateTimerDisplay();
    updateRingProgress();
    updateStats();
    updateXPBar();
}

// --- Display ---

function updateTimerDisplay() {
    const min = Math.floor(remainingSeconds / 60);
    const sec = remainingSeconds % 60;
    timerDisplay.textContent = String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function updateRingProgress() {
    const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 360;
    timerRing.style.background = `conic-gradient(var(--ring-progress) ${progress}deg, var(--ring-bg) ${progress}deg)`;
}

// --- Stats ---

function updateStats() {
    totalCount.textContent = sessions.length;
    totalMinutes.textContent = sessions.reduce((sum, s) => sum + s.duration, 0);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    weekCount.textContent = sessions.filter(s => new Date(s.date) >= weekStart).length;

    const streak = calculateStreak();
    streakCount.textContent = streak;
    $('streakFlame').innerHTML = getStreakFlame(streak);
}

function calculateStreak() {
    if (sessions.length === 0) return 0;
    const uniqueDates = [...new Set(sessions.map(s => new Date(s.date).toDateString()))]
        .sort((a, b) => new Date(b) - new Date(a));

    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);

    if (uniqueDates[0] !== today.toDateString()) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (uniqueDates[0] !== yesterday.toDateString()) return 0;
        checkDate = yesterday;
    }

    for (const dateStr of uniqueDates) {
        if (dateStr === checkDate.toDateString()) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
        else break;
    }
    return streak;
}

// --- Calendar ---

// --- History List ---

function renderHistory() {
    if (sessions.length === 0) {
        $('historyList').innerHTML = '<p class="empty-state">No sessions yet. Start your first workout!</p>';
        return;
    }

    const recent = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
    $('historyList').innerHTML = recent.map(s => {
        const d = new Date(s.date);
        const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const icon = s.completed ? '&#10003;' : '&#9679;';
        const iconClass = s.completed ? 'history-check' : 'history-partial';
        return `<div class="history-item">
            <span class="history-date">${dateStr} ${timeStr}</span>
            <span class="history-duration">${s.duration} min</span>
            <span class="${iconClass}">${icon}</span>
        </div>`;
    }).join('');
}

// --- Profile Tab ---

function renderProfile() {
    if (!currentUser) return;
    $('profileAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    $('profileDisplayName').textContent = currentUser.name;
    $('profileHeight').textContent = currentUser.height ? currentUser.height + ' cm' : '—';
    $('profileWeight').textContent = currentUser.weight ? currentUser.weight + ' kg' : '—';
    $('profileGoal').textContent = (currentUser.goal || 15) + ' min/day';
    $('profileSince').textContent = currentUser.createdAt
        ? new Date(currentUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : '—';

    // Best streak calculation
    const allStreaks = calculateAllStreaks();
    $('profileBestStreak').textContent = allStreaks + ' days';
}

function calculateAllStreaks() {
    if (sessions.length === 0) return 0;
    const uniqueDates = [...new Set(sessions.map(s => new Date(s.date).toDateString()))]
        .sort((a, b) => new Date(a) - new Date(b));

    let maxStreak = 1, current = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(uniqueDates[i - 1]);
        const curr = new Date(uniqueDates[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) { current++; maxStreak = Math.max(maxStreak, current); }
        else current = 1;
    }
    return maxStreak;
}

function editProfile() {
    const form = $('editProfileForm');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
        $('editName').value = currentUser.name || '';
        $('editHeight').value = currentUser.height || '';
        $('editWeight').value = currentUser.weight || '';
        $('editGoal').value = currentUser.goal || 15;
        $('editName').focus();
    }
}

function saveProfile() {
    const name = $('editName').value.trim();
    const height = $('editHeight').value;
    const weight = $('editWeight').value;
    const goal = $('editGoal').value;

    if (name) currentUser.name = name;
    if (height) currentUser.height = Number(height);
    if (weight) currentUser.weight = Number(weight);
    if (goal) currentUser.goal = Number(goal);

    updateUser(currentUser);
    currentUserEl.textContent = currentUser.name;
    renderProfile();
    $('editProfileForm').classList.add('hidden');
}

function cancelEdit() {
    $('editProfileForm').classList.add('hidden');
}

async function exportData() {
    const data = await exportUserData(currentUserId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FitTimer_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { alert('Invalid JSON file.'); return; }

    const counts = {
        dailyLogs: data.dailyLogs?.length || 0,
        measurements: data.measurements?.length || 0,
        compositions: data.compositions?.length || 0,
        sessions: data.sessions?.length || 0
    };
    const msg = `Import data from ${data.exportedAt?.slice(0,10) || 'unknown date'}?\n\n` +
        `• ${counts.dailyLogs} workout logs\n• ${counts.measurements} measurements\n• ${counts.compositions} compositions\n• ${counts.sessions} sessions\n\n` +
        `This will ADD to your existing data (not replace).`;
    if (!confirm(msg)) return;

    let imported = 0;
    if (data.dailyLogs) {
        for (const log of data.dailyLogs) {
            log.userId = currentUserId;
            try { await saveDailyLog(log); imported++; } catch {}
        }
    }
    if (data.measurements) {
        for (const m of data.measurements) {
            m.userId = currentUserId;
            delete m.id;
            try { await addMeasurement(m); imported++; } catch {}
        }
    }
    if (data.compositions) {
        for (const c of data.compositions) {
            c.userId = currentUserId;
            delete c.id;
            try { await addComposition(c); imported++; } catch {}
        }
    }
    alert(`Imported ${imported} records successfully!`);
    location.reload();
}

// --- Celebration ---

function showCelebration(minutes, isPartial, xpGained) {
    const messages = [
        "You showed up. That's what matters!",
        "Another one in the bank!",
        "Consistency beats intensity!",
        "Your future self thanks you!",
        "Small steps, big results!",
        "That's the compound effect!",
        "Discipline > Motivation!",
        "Atomic habit deposited!",
        "1% better today!",
        "The streak lives on!"
    ];

    celebrationMsg.textContent = isPartial
        ? `${minutes} minutes still counts!`
        : messages[Math.floor(Math.random() * messages.length)];

    const streak = calculateStreak();
    celebrationStats.textContent = streak > 1
        ? `${streak} day streak! Keep it going!`
        : 'First step done. Come back tomorrow!';

    $('celebrationXp').textContent = xpGained > 0 ? `+${xpGained} XP earned!` : '';

    celebration.classList.remove('hidden');
}

// --- Utilities ---

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function getDateKey(date) {
    return date.toISOString().slice(0, 10); // "2026-05-17"
}

// --- Log Tab ---

function renderLogTab() {
    // Date header
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const viewing = new Date(logViewingDate); viewing.setHours(0, 0, 0, 0);
    const isToday = viewing.getTime() === today.getTime();
    const isYesterday = viewing.getTime() === today.getTime() - 86400000;

    let dateLabel;
    if (isToday) dateLabel = 'Today';
    else if (isYesterday) dateLabel = 'Yesterday';
    else dateLabel = viewing.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    $('logDateTitle').textContent = dateLabel;

    // Load existing log for this date
    const dateKey = getDateKey(logViewingDate);
    const log = dailyLogs.find(l => l.dateKey === dateKey);

    // Reset all selections
    document.querySelectorAll('#tabLog .log-btn').forEach(b => b.classList.remove('active'));
    $('logWater').querySelectorAll('.water-glass').forEach(g => g.classList.remove('filled'));
    $('logNote').value = '';

    if (log) {
        // Restore workout
        if (log.workout) {
            const btn = $('logWorkout').querySelector(`[data-value="${log.workout}"]`);
            if (btn) btn.classList.add('active');
        }
        // Restore food
        if (log.food) {
            const btn = $('logFood').querySelector(`[data-value="${log.food}"]`);
            if (btn) btn.classList.add('active');
        }
        // Restore sleep
        if (log.sleep) {
            const btn = $('logSleep').querySelector(`[data-value="${log.sleep}"]`);
            if (btn) btn.classList.add('active');
        }
        // Restore water
        if (log.water) {
            $('logWater').querySelectorAll('.water-glass').forEach((g, i) => {
                if (i < log.water) g.classList.add('filled');
            });
            $('waterCount').textContent = `${log.water} / 8 glasses`;
        } else {
            $('waterCount').textContent = '0 / 8 glasses';
        }
        // Restore note
        if (log.note) $('logNote').value = log.note;
        // Restore health tags
        if (log.health && Array.isArray(log.health)) {
            log.health.forEach(val => {
                const btn = $('logHealth').querySelector(`[data-value="${val}"]`);
                if (btn) btn.classList.add('active');
            });
        }
    } else {
        $('waterCount').textContent = '0 / 8 glasses';
    }

    $('logSaved').classList.add('hidden');
}

async function autoSaveLog() {
    const dateKey = getDateKey(logViewingDate);

    // Gather current selections
    const workoutBtn = $('logWorkout').querySelector('.log-btn.active');
    const foodBtn = $('logFood').querySelector('.log-btn.active');
    const sleepBtn = $('logSleep').querySelector('.log-btn.active');
    const waterCount = $('logWater').querySelectorAll('.water-glass.filled').length;
    const note = $('logNote').value.trim();

    // Find existing log or create new
    let log = dailyLogs.find(l => l.dateKey === dateKey);
    if (!log) {
        log = { userId: currentUserId, dateKey: dateKey };
    }

    log.workout = workoutBtn ? workoutBtn.dataset.value : null;
    log.food = foodBtn ? foodBtn.dataset.value : null;
    log.sleep = sleepBtn ? sleepBtn.dataset.value : null;
    log.water = waterCount;
    log.note = note || null;
    log.health = Array.from($('logHealth').querySelectorAll('.log-btn.active')).map(b => b.dataset.value);
    log.exercises = getWorkoutLoggerData();
    log.updatedAt = new Date().toISOString();

    const id = await saveDailyLog(log);
    if (!log.id) log.id = id;

    // Update local cache
    const idx = dailyLogs.findIndex(l => l.dateKey === dateKey);
    if (idx >= 0) dailyLogs[idx] = log;
    else dailyLogs.push(log);

    // Show saved indicator
    $('logSaved').classList.remove('hidden');
    setTimeout(() => $('logSaved').classList.add('hidden'), 1500);
}

// --- Gamification UI ---

function updateXPBar() {
    const xp = calculateXP(sessions);
    const level = getLevel(xp);
    const next = getNextLevel(xp);
    const progress = getLevelProgress(xp);

    $('xpLevelBadge').textContent = `Lvl ${level.level}`;
    $('xpBarFill').style.width = progress + '%';

    if (next) {
        $('xpText').textContent = `${xp} / ${next.xp} XP`;
    } else {
        $('xpText').textContent = `${xp} XP — MAX LEVEL!`;
    }
}

function updateDailyChallenge() {
    const challenge = getDailyChallenge();
    const el = $('dailyChallenge');
    el.innerHTML = challenge.replace('\n', '<br>');
}

function renderProgress() {
    const xp = calculateXP(sessions);
    const level = getLevel(xp);
    const next = getNextLevel(xp);
    const progress = getLevelProgress(xp);

    // Character
    $('characterDisplay').innerHTML = getCharacterSVG(level.level);

    // Level badge
    $('levelBadge').textContent = `Lvl ${level.level} — ${level.name} ${level.emoji}`;
    $('progressXpFill').style.width = progress + '%';
    $('progressXpDetail').textContent = next
        ? `${xp} XP total • ${next.xp - xp} XP to next level`
        : `${xp} XP total • MAX LEVEL REACHED!`;

    // Weekly ring
    const weekData = getWeeklyProgress(sessions, currentUser.goal || 15);
    const circumference = 2 * Math.PI * 52; // 326.73
    const offset = circumference - (weekData.percent / 100) * circumference;
    $('weeklyRingProgress').style.strokeDashoffset = offset;
    $('weeklyPercent').textContent = weekData.percent + '%';
    $('weeklyDetail').textContent = `${weekData.totalMin} / ${weekData.weeklyTarget} min`;

    // Weekly days dots
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekSessions = sessions.filter(s => new Date(s.date) >= weekStart);
    const daysWorkedOut = new Set(weekSessions.map(s => new Date(s.date).getDay()));

    document.querySelectorAll('.week-dot').forEach(dot => {
        const day = parseInt(dot.dataset.day);
        dot.classList.toggle('active', daysWorkedOut.has(day));
        dot.classList.toggle('today', day === now.getDay());
    });

    // Achievements grid
    const unlocked = getUnlockedAchievements(sessions);
    const unlockedIds = unlocked.map(a => a.id);
    $('achievementsGrid').innerHTML = ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlockedIds.includes(ach.id);
        return `<div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
            <span class="achievement-emoji">${isUnlocked ? ach.emoji : '🔒'}</span>
            <span class="achievement-name">${ach.name}</span>
            <span class="achievement-desc">${ach.desc}</span>
        </div>`;
    }).join('');

    // Habit Garden
    renderHabitGarden();
}

function renderHabitGarden() {
    const gardenRow = $('habitGardenRow');
    const gardenMsg = $('gardenMessage');
    if (!gardenRow) return;

    // Calculate last 8 weeks: how many workouts per week
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - dayOfWeek);

    const weeks = [];
    for (let w = 7; w >= 0; w--) {
        const weekStart = new Date(thisMonday);
        weekStart.setDate(thisMonday.getDate() - (w * 7));
        let count = 0;
        for (let d = 0; d < 7; d++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + d);
            const dk = day.toISOString().slice(0, 10);
            if (dailyLogs.find(l => l.dateKey === dk && l.exercises && l.exercises.routineDay)) count++;
        }
        weeks.push(count);
    }

    // Plant stages based on cumulative consistency
    // 0 workouts = dead, 1-2 = wilting, 3-4 = sprout, 5+ = thriving
    const plantStages = [
        { icon: '💀', label: 'dead' },    // 0
        { icon: '🥀', label: 'wilting' },  // 1-2
        { icon: '🫘', label: 'seed' },     // 3 (just met goal)
        { icon: '🌱', label: 'sprout' },   // 3+
        { icon: '🌿', label: 'growing' },  // 4
        { icon: '🌲', label: 'tree' },     // 5
        { icon: '🌳', label: 'oak' },      // 6+
    ];

    function getPlant(count) {
        if (count === 0) return plantStages[0];
        if (count <= 2) return plantStages[1];
        if (count === 3) return plantStages[3];
        if (count === 4) return plantStages[4];
        if (count === 5) return plantStages[5];
        return plantStages[6];
    }

    let html = '';
    weeks.forEach((count, i) => {
        const plant = getPlant(count);
        const isCurrent = i === weeks.length - 1;
        const weekLabel = isCurrent ? 'Now' : `W${i + 1}`;
        const cls = isCurrent ? 'garden-plant garden-current' : count >= 3 ? 'garden-plant garden-healthy' : 'garden-plant garden-wilted';
        html += `<div class="${cls}"><span class="garden-icon">${plant.icon}</span><span class="garden-label">${weekLabel}</span></div>`;
    });
    gardenRow.innerHTML = html;

    // Count healthy streak
    let healthyStreak = 0;
    for (let i = weeks.length - 2; i >= 0; i--) {
        if (weeks[i] >= 3) healthyStreak++;
        else break;
    }

    const currentCount = weeks[weeks.length - 1];
    if (healthyStreak >= 4) {
        gardenMsg.innerHTML = `🌳 <strong>${healthyStreak}-week forest!</strong> Your garden is thriving!`;
        gardenMsg.className = 'garden-message garden-msg-great';
    } else if (healthyStreak >= 2) {
        gardenMsg.innerHTML = `🌿 ${healthyStreak} weeks growing! Keep watering your habits`;
        gardenMsg.className = 'garden-message garden-msg-good';
    } else if (currentCount >= 3) {
        gardenMsg.innerHTML = `🌱 This week's plant is healthy! Water it again next week`;
        gardenMsg.className = 'garden-message garden-msg-good';
    } else if (currentCount > 0) {
        gardenMsg.innerHTML = `🫘 ${3 - currentCount} more workouts to keep your plant alive!`;
        gardenMsg.className = 'garden-message garden-msg-warn';
    } else {
        gardenMsg.innerHTML = `🥀 Your plant needs water — do a workout today!`;
        gardenMsg.className = 'garden-message garden-msg-bad';
    }
}

function showLevelUp(level) {
    playLevelUp();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
    $('levelUpEmoji').textContent = level.emoji;
    $('levelUpText').textContent = `You are now Level ${level.level} — ${level.name} ${level.emoji}`;
    $('levelUpPopup').classList.remove('hidden');
    setTimeout(() => $('levelUpPopup').classList.add('hidden'), 3000);
}

function showAchievementPopup(achievement) {
    playAchievement();
    vibrateShort();
    $('achievementPopupEmoji').textContent = achievement.emoji;
    $('achievementPopupName').textContent = achievement.name;
    $('achievementPopup').classList.remove('hidden');
    setTimeout(() => $('achievementPopup').classList.add('hidden'), 2500);
}

// --- Routine Tab Data & Logic ---

const EXERCISE_IMAGES = {
    'Push-ups (Warm-up)': 'https://wger.de/media/exercise-images/1551/a6a9e561-3965-45c6-9f2b-ee671e1a3a45.png',
    'DB Chest Press (Flat)': 'https://wger.de/media/exercise-images/97/Dumbbell-bench-press-1.png',
    'Incline DB Press': 'https://wger.de/media/exercise-images/97/Dumbbell-bench-press-1.png',
    'Dumbbell Fly': 'https://wger.de/media/exercise-images/238/2fc242d3-5bdd-4f97-99bd-678adb8c96fc.png',
    'Overhead DB Press': 'https://wger.de/media/exercise-images/1893/7dbad19e-0616-41fd-9d7d-3e21649c0eea.png',
    'Lateral Raises': 'https://wger.de/media/exercise-images/1744/cb9263c4-39fc-4261-8d30-a5d6d57841c1.jpg',
    'Tricep Pushdown (Band)': 'https://wger.de/media/exercise-images/805/7a437824-e2cc-46e1-804a-674f0ea31d25.png',
    'Overhead Tricep Ext (Band)': 'https://wger.de/media/exercise-images/1519/fab7f641-27d4-40b5-8edd-1a0a137bfd94.gif',
    'Overhead Tricep Ext (DB)': 'https://wger.de/media/exercise-images/1519/fab7f641-27d4-40b5-8edd-1a0a137bfd94.gif',
    'Bent-Over DB Row': 'https://wger.de/media/exercise-images/110/Reverse-grip-bent-over-rows-1.png',
    'Single-Arm DB Row': 'https://wger.de/media/exercise-images/1283/e7262f70-7512-408a-8d00-4c499ef632fc.jpg',
    'Band Lat Pulldown': 'https://wger.de/media/exercise-images/158/02e8a7c3-dc67-434e-a4bc-77fdecf84b49.webp',
    'Face Pulls (Band)': 'https://wger.de/media/exercise-images/1639/8927346e-f5ca-4795-bdf1-5ac9309401e7.webp',
    'Band Seated Rows': 'https://wger.de/media/exercise-images/1725/f0ebd44e-b8e1-400c-b598-ca371f3a07af.png',
    'Dumbbell Shrugs': 'https://wger.de/media/exercise-images/1645/9e730259-1dcd-4b5e-b4cc-9ebc0cfda75c.webp',
    'Z-Bar Bicep Curls': 'https://wger.de/media/exercise-images/94/6dee2f60-aea2-4f2d-9bf6-aef50c4f9483.png',
    'Hammer Curls': 'https://wger.de/media/exercise-images/1567/0a8c155c-a48e-47e8-9df3-e39f025c6cad.png',
    'Barbell Deadlift': 'https://wger.de/media/exercise-images/630/b0f0c7d8-5878-4d9e-b820-21acc013741d.webp',
    'Goblet Squats': 'https://wger.de/media/exercise-images/203/300a44ac-4368-48e2-8b18-beea32ab915d.gif',
    'Lunges': 'https://wger.de/media/exercise-images/1903/6ec66efd-e74f-4142-bed1-0a0ac74e3294.png',
    'Hip Thrust (Bench)': 'https://wger.de/media/exercise-images/1642/a81ad922-caf5-47f8-99b4-640cb0717436.webp',
    'Romanian Deadlift (DB)': 'https://wger.de/media/exercise-images/1652/0306c8c0-70cc-45d4-92de-6fa72ceaa834.webp',
    'Bulgarian Split Squat': 'https://wger.de/media/exercise-images/1593/9815fcd6-cf40-4ddd-9b38-2eac25973de1.gif',
    'Calf Raises (Step)': 'https://wger.de/media/exercise-images/622/9a429bd0-afd3-4ad0-8043-e9beec901c81.jpeg',
    'Incline DB Curl': 'https://wger.de/media/exercise-images/1225/39a0b7e7-9780-425d-84f5-56d10d1690ac.gif',
    'Preacher Curl (Bench)': 'https://wger.de/media/exercise-images/1109/00b0a0bf-c14a-4f13-bb14-62c09030a1aa.png',
    'Diamond Push-ups': 'https://wger.de/media/exercise-images/1551/a6a9e561-3965-45c6-9f2b-ee671e1a3a45.png',
    'Crunches': ['https://wger.de/media/exercise-images/1648/63ae02d6-6dd9-4e9e-84da-d4905e78a33c.jpg', 'https://wger.de/media/exercise-images/1479/0305d98e-0887-4c0c-8992-7c220814efc2.webp'],
    'Leg Raises': 'https://wger.de/media/exercise-images/851/4d621b17-f6cb-4107-97c0-9f44e9a2dbc6.webp',
    'Plank': 'https://wger.de/media/exercise-images/1091/50c8912d-54ef-46c9-99d1-633b6196aa1e.jpg',
    'Hip Flexor Stretch': 'https://wger.de/media/exercise-images/1867/767631e5-10d2-46b8-b03f-cc298f96963b.png',
    'Pelvic Tilt Practice': 'https://wger.de/media/exercise-images/1871/85a6b9de-4eec-445b-8ebb-f1950b076aba.png',
    'Donkey Kicks': 'https://wger.de/media/exercise-images/1613/a851fe9d-771f-44da-82f0-799e02ae3fd1.jpg',
    'Lying Hamstring Curls': 'https://wger.de/media/exercise-images/154/lying-leg-curl-machine-large-1.png',
    'Dead Bug': 'https://wger.de/media/exercise-images/1105/36776818-799a-40bf-9eca-aebb3aa5008f.png',
};

const DARK_IMAGES = new Set(['Preacher Curl (Bench)', 'Lying Hamstring Curls', 'Dead Bug', 'Leg Raises']);

const ROUTINE_DATA = {
    push: {
        title: 'PUSH Day',
        subtitle: 'Chest, Shoulders, Triceps',
        groups: [
            { name: '� Chest', badge: 'primary', exercises: [
                { name: 'Push-ups (Warm-up)', sets: '2×15', equip: 'Push-up Board · Bodyweight', tip: '<strong>Form:</strong> Hands shoulder-width, body in plank. Lower until chest nearly touches floor. Elbows at 45° — not flared. Exhale pushing up.' },
                { name: 'DB Chest Press (Flat)', sets: '3×12', equip: 'Bench flat · 10–12.5 kg', tip: '<strong>Form:</strong> Lie flat, feet on floor. Press dumbbells straight up from chest. Squeeze chest at top. Shoulder blades pinched together throughout. Lower slowly.' },
                { name: 'Incline DB Press', sets: '3×10', equip: 'Bench 30-45° · 7.5–10 kg', tip: '<strong>Form:</strong> Bench at 30-45°. Press straight UP (not towards face). Targets upper chest. Don\'t let elbows drop below shoulder line. Control the negative.' },
                { name: 'Dumbbell Fly', sets: '3×12', equip: 'Bench flat · 5–7.5 kg', tip: '<strong>Form:</strong> Arms above chest, slight elbow bend (locked). Open wide in arc until chest stretch. Squeeze to bring back. Think "hugging a tree." Use lighter weight.' },
            ]},
            { name: '🦍 Shoulders', badge: 'secondary', exercises: [
                { name: 'Overhead DB Press', sets: '3×10', equip: 'Bench 75-80° · 7.5–10 kg', tip: '<strong>Form:</strong> Sit upright. Start at ear level, palms forward. Press straight up. Don\'t arch lower back. Can do standing too.' },
                { name: 'Lateral Raises', sets: '3×15', equip: 'Standing · 2.5–5 kg', tip: '<strong>Form:</strong> Slight elbow bend. Raise arms to sides until parallel (T-shape). Lead with elbows, not wrists. Light weight — shoulders fatigue fast.' },
            ]},
            { name: '� Triceps', badge: 'finisher', exercises: [
                { name: 'Tricep Pushdown (Band)', sets: '3×15', equip: 'Pull-up Bar + Resistance Band', tip: '<strong>Form:</strong> Band over bar. Elbows tight to body. Push down until arms extended. Squeeze triceps. Only forearms move — upper arms locked.' },
                { name: 'Overhead Tricep Ext (Band)', sets: '3×12', equip: 'Resistance Band (step on it)', tip: '<strong>Form:</strong> Step on band, hold behind head. Extend arms up, elbows pointing forward near ears. Full range of motion is key.' },
            ]},
        ]
    },
    pull: {
        title: 'PULL Day',
        subtitle: 'Back, Traps, Rear Delts, Biceps',
        groups: [
            { name: '🪽 Back', badge: 'primary', exercises: [
                { name: 'Bent-Over DB Row', sets: '3×10', equip: 'Standing bent · 10–12.5 kg', tip: '<strong>Form:</strong> Bend 45° at hips, knees bent, back FLAT. Pull to lower chest. Squeeze shoulder blades at top. Don\'t round back — critical.' },
                { name: 'Single-Arm DB Row', sets: '3×10/side', equip: 'Bench + 10–12.5 kg', tip: '<strong>Form:</strong> Knee+hand on bench. Pull dumbbell to hip, elbow past back. Feel lat squeeze. Keep torso parallel, don\'t twist.' },
                { name: 'Band Lat Pulldown', sets: '3×12', equip: 'Pull-up Bar + Band', tip: '<strong>Form:</strong> Kneel/sit. Pull band to chest, wide grip. Squeeze lats at bottom. Think "elbows into back pockets." Single-arm version is great for isolation.' },
                { name: 'Face Pulls (Band)', sets: '3×15', equip: 'Band at face height', tip: '<strong>Form:</strong> Pull towards face, elbows high. Externally rotate (hands beside ears). <strong>Critical for posture</strong> — fixes rounded shoulders. NEVER skip this.' },
                { name: 'Band Seated Rows', sets: '3×12', equip: 'Band around feet · seated', tip: '<strong>Form:</strong> Sit, legs extended, band around feet. Pull to lower chest, squeezing shoulder blades. Back upright, don\'t lean back too much.' },
            ]},
            { name: '🦬 Traps', badge: 'secondary', exercises: [
                { name: 'Dumbbell Shrugs', sets: '3×15', equip: 'Standing · 10–12.5 kg', tip: '<strong>Form:</strong> Shrug shoulders straight UP to ears. Hold 1 sec. Lower slowly. Don\'t roll shoulders — straight up/down only. Arms stay straight.' },
            ]},
            { name: '💪 Biceps', badge: 'finisher', exercises: [
                { name: 'Z-Bar Bicep Curls', sets: '3×12', equip: 'Curl Bar + plates', tip: '<strong>Form:</strong> Grip at angled grips. Curl by bending elbows only — upper arms don\'t move. Squeeze at top. No swinging. Z-bar reduces wrist strain.' },
                { name: 'Hammer Curls', sets: '3×10', equip: 'Standing · 7.5–10 kg', tip: '<strong>Form:</strong> Palms facing each other (neutral grip). Hits brachialis (outer arm thickness) + forearms. No swinging. Can alternate arms.' },
            ]},
        ]
    },
    legs: {
        title: 'LEGS Day',
        subtitle: 'Quads, Hamstrings, Glutes, Calves + APT Fixes',
        groups: [
            { name: '🦵 Quads & Glutes', badge: 'primary', exercises: [
                { name: 'Barbell Deadlift', sets: '3×8', equip: 'Deadlift Barbell + plates', tip: '<strong>Form:</strong> Feet hip-width, bar over mid-foot. Back FLAT, chest up. Drive through heels. Bar close to body. <strong>Slow and controlled — no ego lifting.</strong>' },
                { name: 'Goblet Squats', sets: '3×12', equip: '1 heavy DB at chest · 10–12.5 kg', tip: '<strong>Form:</strong> Hold DB at chest. Feet shoulder-width, toes slightly out. Squat until thighs parallel. Knees track over toes. Push through heels.' },
                { name: 'Lunges', sets: '3×10/leg', equip: 'DBs at sides · 5–7.5 kg', tip: '<strong>Form:</strong> Step forward, both knees 90°. Front knee over ankle — never past toes. Push back through front heel. <strong>VVIP exercise.</strong>' },
            ]},
            { name: '🍑 Glutes & Hamstrings', badge: 'apt', exercises: [
                { name: 'Hip Thrust (Bench)', sets: '3×12', equip: 'Bench + barbell/heavy DB', tip: '<strong>Form:</strong> Upper back on bench. Drive hips UP squeezing glutes. Full extension (straight line shoulders→knees). <strong>Key APT fix.</strong>' },
                { name: 'Romanian Deadlift (DB)', sets: '3×10', equip: '7.5–10 kg DBs', tip: '<strong>Form:</strong> Slight knee bend (locked). Hinge at hips, lower DBs along legs. Feel hamstring stretch. Drive hips forward to return. <strong>Critical for APT.</strong>' },
                { name: 'Bulgarian Split Squat', sets: '3×8/leg', equip: 'Bench + 5–7.5 kg DBs', tip: '<strong>Form:</strong> Back foot on bench. Lower until front thigh parallel. Stay upright. Start bodyweight if too hard.' },
            ]},
            { name: '� Calves', badge: 'secondary', exercises: [
                { name: 'Calf Raises (Step)', sets: '3×20', equip: 'Stepping Block + 10 kg DBs', tip: '<strong>Form:</strong> Stand on step edge, heels hanging off. Rise high on toes, squeeze 1 sec. Lower below step for stretch. High reps — calves are stubborn.' },
            ]},
            { name: '� Mobility', badge: 'apt', exercises: [
                { name: 'Hip Flexor Stretch', sets: '2×30s/side', equip: 'Gym Mat', tip: '<strong>Form:</strong> Kneel, push hips forward. Feel deep stretch in front hip of back leg. Hold 30s. <strong>Do every leg day — loosens tight hip flexors.</strong>' },
                { name: 'Pelvic Tilt Practice', sets: '2×15', equip: 'Gym Mat', tip: '<strong>Form:</strong> Lie on back, knees bent. Flatten lower back to floor by tilting pelvis up. Hold 3s. <strong>Mind-muscle APT correction.</strong>' },
            ]},
        ]
    },
    arms: {
        title: 'ARMS + ABS Day',
        subtitle: 'Biceps, Triceps, Core + Catchup',
        groups: [
            { name: '💪 Biceps', badge: 'primary', exercises: [
                { name: 'Incline DB Curl', sets: '3×10', equip: 'Bench 45° · 5–7.5 kg', tip: '<strong>Form:</strong> Lie on incline, arms hanging. Curl without moving upper arms. Incline pre-stretches bicep for more activation. Slow 3-sec negatives.' },
                { name: 'Preacher Curl (Bench)', sets: '3×10', equip: 'Bench as arm pad · 5–7.5 kg', tip: '<strong>Form:</strong> Use incline bench as preacher pad. Arm rests, curl up. Complete isolation — no cheating. Full range.' },
                { name: 'Hammer Curls', sets: '3×12', equip: 'Standing · 7.5 kg', tip: '<strong>Form:</strong> Neutral grip (palms facing). Builds arm thickness. Try cross-body hammers for extra squeeze.' },
            ]},
            { name: '� Triceps', badge: 'secondary', exercises: [
                { name: 'Tricep Pushdown (Band)', sets: '3×15', equip: 'Pull-up Bar + Band', tip: '<strong>Form:</strong> Band over bar. Push down, elbows pinned. Squeeze at full extension. Bread-and-butter tricep move.' },
                { name: 'Overhead Tricep Ext (DB)', sets: '3×10', equip: 'Seated · 1×10 kg DB both hands', tip: '<strong>Form:</strong> One DB, both hands behind head. Extend straight up. Elbows forward, don\'t flare. If wrist pain, use band version.' },
                { name: 'Diamond Push-ups', sets: '2×12', equip: 'Bodyweight · Gym Mat', tip: '<strong>Form:</strong> Hands together (diamond shape) under chest. Lower to hands. Shifts all load to triceps. From knees if too hard.' },
            ]},
            { name: '🏆 Abs & Core', badge: 'apt', exercises: [
                { name: 'Crunches', sets: '3×20', equip: 'Gym Mat', tip: '<strong>Form:</strong> Knees bent, hands behind head (don\'t pull neck). Curl upper body — lift shoulder blades off mat. Feel it in abs, not neck.' },
                { name: 'Leg Raises', sets: '3×12', equip: 'Gym Mat', tip: '<strong>Form:</strong> Lie flat, hands under hips. Raise straight legs to 90°, lower slowly without touching floor. Lower back pressed to mat.' },
                { name: 'Plank', sets: '3×30-60s', equip: 'Gym Mat', tip: '<strong>Form:</strong> Forearms on mat, body straight. Squeeze abs+glutes. Don\'t sag or pike. Start 30s, build to 60s.' },
                { name: 'Dead Bug', sets: '3×10/side', equip: 'Gym Mat', tip: '<strong>Form:</strong> On back, arms up, knees 90°. Extend opposite arm+leg. Keep lower back flat. <strong>Excellent for APT correction.</strong>' },
            ]},
            { name: '🦵 Ankle Weight Finishers', badge: 'finisher', exercises: [
                { name: 'Lying Hamstring Curls', sets: '3×15', equip: 'Mat + 2 kg Ankle Weights', tip: '<strong>Form:</strong> Face down, ankle weights on. Curl heels to glutes. Squeeze hamstrings at top. Great isolation without machines.' },
                { name: 'Donkey Kicks', sets: '3×12/side', equip: 'Mat + 2 kg Ankle Weights', tip: '<strong>Form:</strong> All fours, kick leg up+back at 90° knee. Squeeze glute at top. Don\'t arch back. Targets glutes specifically.' },
            ]},
        ]
    }
};

const DAY_SCHEDULE = ['rest', 'push', 'pull', 'rest', 'legs', 'arms', 'rest'];

function initRoutineTab() {
    const todayDay = new Date().getDay();
    const todayRoutine = DAY_SCHEDULE[todayDay];
    const label = $('routineTodayLabel');

    function updateLabel(viewingDay) {
        const viewing = ROUTINE_DATA[viewingDay];
        if (viewingDay === todayRoutine && todayRoutine !== 'rest') {
            label.textContent = '📅 Today\'s plan: ' + viewing.title;
        } else if (todayRoutine === 'rest') {
            label.textContent = '🚶 Today is rest day — Viewing: ' + (viewing ? viewing.title : 'Push Day');
        } else {
            label.textContent = '👀 Viewing: ' + (viewing ? viewing.title : '') + ' (Today: ' + ROUTINE_DATA[todayRoutine].title + ')';
        }
    }

    document.querySelectorAll('.day-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.day-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderRoutine(pill.dataset.rday);
            updateLabel(pill.dataset.rday);
        });
    });

    const startDay = todayRoutine === 'rest' ? 'push' : todayRoutine;
    document.querySelectorAll('.day-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.rday === startDay);
    });
    updateLabel(startDay);
    renderRoutine(startDay);

    // Expand All toggle
    const expandBtn = $('expandAllRoutine');
    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            const cards = document.querySelectorAll('#routineContent .r-ex-card');
            const allOpen = [...cards].every(c => c.classList.contains('open'));
            cards.forEach(c => c.classList.toggle('open', !allOpen));
            expandBtn.textContent = allOpen ? 'Expand All' : 'Collapse All';
        });
    }
}

function renderRoutine(day) {
    const data = ROUTINE_DATA[day];
    const container = $('routineContent');
    if (!data) { container.innerHTML = ''; return; }

    const DB_WEIGHTS = [2.5,5,7.5,10,12.5,15,17.5,20,22.5,25];
    const BAR_WEIGHTS = [5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,35,40,45,50];

    function getExWeights(equip) {
        const e = (equip || '').toLowerCase();
        if (e.includes('barbell') || e.includes('bar + plate') || e.includes('curl bar')) return BAR_WEIGHTS;
        if (e.includes('band')) return ['Yellow','Red','Black'];
        if ((e.includes('bodyweight') || e.includes('mat')) && !e.includes('kg')) return ['BW'];
        return DB_WEIGHTS;
    }

    let html = '';
    data.groups.forEach(group => {
        html += `<div class="routine-muscle-group">`;
        html += `<div class="routine-muscle-header">${group.name} <span class="r-badge ${group.badge}">${group.badge}</span></div>`;
        group.exercises.forEach(ex => {
            const imgEntry = EXERCISE_IMAGES[ex.name] || '';
            const darkClass = DARK_IMAGES.has(ex.name) ? ' r-ex-img-dark' : '';
            let imgHtml = '';
            if (Array.isArray(imgEntry)) {
                imgHtml = imgEntry.map(u => `<img class="r-ex-img${darkClass}" src="${u}" alt="${ex.name}" onerror="this.style.display='none'">`).join('');
            } else if (imgEntry) {
                imgHtml = `<img class="r-ex-img${darkClass}" src="${imgEntry}" alt="${ex.name}" onerror="this.style.display='none'">`;
            }
            const totalSets = parseInt(ex.sets) || 3;
            const exWeights = getExWeights(ex.equip);
            const weightOpts = exWeights.map(w => {
                const val = w;
                const label = w;
                return `<option value="${val}">${label}</option>`;
            }).join('');
            html += `<div class="r-ex-card" onclick="handleExCardClick(event, this)">
                <div class="r-ex-summary">
                    <span class="r-ex-name">${ex.name}</span>
                    <div class="r-ex-meta">
                        <span class="r-ex-sets">${ex.sets}</span>
                        <span class="r-ex-chevron">▶</span>
                    </div>
                </div>
                <div class="r-ex-details">
                    ${imgHtml}
                    <div class="r-ex-equip">🔧 ${ex.equip}</div>
                    <div class="r-ex-tip">${ex.tip.replace(/\.\s+/g, '.<br>')}</div>
                    <div class="r-set-logger" data-exname="${ex.name}">
                        <div class="r-set-row">
                            <span class="r-set-label">Set <span class="r-set-num">1</span></span>
                            <div class="r-set-inputs">
                                <input type="number" class="r-set-reps" placeholder="Reps" min="1" max="99">
                                <select class="r-set-weight">${weightOpts}</select>
                                <button class="r-set-save-btn">✓</button>
                            </div>
                        </div>
                        <div class="r-set-history"></div>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
}

// Handle card click — toggle open but ignore clicks on logger inputs
function handleExCardClick(e, card) {
    if (e.target.closest('.r-set-logger')) return; // don't toggle when interacting with logger
    card.classList.toggle('open');
}

// Inline Set Logger — save sets directly from Routine tab
const routineSetLog = {}; // { exerciseName: [{reps, weight}, ...] }

function formatSetLabel(setNum, reps, weight) {
    if (weight === 'BW' || weight === 0 || weight === '0') return `S${setNum}: ${reps}r`;
    if (typeof weight === 'string' && isNaN(weight)) return `S${setNum}: ${reps}r×${weight}`;
    return `S${setNum}: ${reps}r×${weight}kg`;
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.r-set-save-btn');
    if (!btn) return;

    const logger = btn.closest('.r-set-logger');
    const exName = logger.dataset.exname;
    const repsInput = logger.querySelector('.r-set-reps');
    const weightSelect = logger.querySelector('.r-set-weight');
    const reps = parseInt(repsInput.value);
    const rawWeight = weightSelect.value;
    const weight = isNaN(rawWeight) ? rawWeight : parseFloat(rawWeight) || 0;

    if (!reps || reps < 1) { repsInput.focus(); return; }

    // Store the set
    if (!routineSetLog[exName]) routineSetLog[exName] = [];
    routineSetLog[exName].push({ reps, weight });

    const currentSet = routineSetLog[exName].length;
    const historyEl = logger.querySelector('.r-set-history');
    const numEl = logger.querySelector('.r-set-num');

    // Show saved set in history
    const tag = document.createElement('span');
    tag.className = 'r-set-tag';
    tag.dataset.setIndex = currentSet - 1;
    tag.innerHTML = formatSetLabel(currentSet, reps, weight) + `<span class="r-set-x" data-exname="${exName}" data-idx="${currentSet - 1}">×</span>`;
    historyEl.appendChild(tag);

    // Clear reps, advance set number
    repsInput.value = '';
    numEl.textContent = currentSet + 1;
    repsInput.focus();

    // Save after each set
    saveRoutineSetLog();
    playLogSaved();
});

// Remove a set via X button (with undo)
let undoTimeout = null;
document.addEventListener('click', (e) => {
    const x = e.target.closest('.r-set-x');
    if (!x) return;
    const exName = x.dataset.exname;
    const idx = parseInt(x.dataset.idx);
    if (!routineSetLog[exName]) return;

    const removed = routineSetLog[exName].splice(idx, 1)[0];
    const logger = document.querySelector(`.r-set-logger[data-exname="${exName}"]`);
    if (!logger) return;

    rerenderSetTags(exName, logger);
    showSetUndo(exName, idx, removed, logger);
    saveRoutineSetLog();
});

function showSetUndo(exName, idx, removed, logger) {
    // Remove any existing undo bar
    const existing = logger.querySelector('.r-set-undo');
    if (existing) existing.remove();
    if (undoTimeout) clearTimeout(undoTimeout);

    const bar = document.createElement('div');
    bar.className = 'r-set-undo';
    const label = formatSetLabel(idx + 1, removed.reps, removed.weight);
    bar.innerHTML = `Removed ${label} <button class="r-set-undo-btn">Undo</button>`;
    logger.appendChild(bar);

    bar.querySelector('.r-set-undo-btn').addEventListener('click', () => {
        routineSetLog[exName].splice(idx, 0, removed);
        rerenderSetTags(exName, logger);
        bar.remove();
        if (undoTimeout) clearTimeout(undoTimeout);
        saveRoutineSetLog();
    });

    undoTimeout = setTimeout(() => bar.remove(), 4000);
}

function rerenderSetTags(exName, logger) {
    const historyEl = logger.querySelector('.r-set-history');
    const numEl = logger.querySelector('.r-set-num');
    historyEl.innerHTML = '';
    (routineSetLog[exName] || []).forEach((s, i) => {
        const t = document.createElement('span');
        t.className = 'r-set-tag';
        t.dataset.setIndex = i;
        const label = formatSetLabel(i + 1, s.reps, s.weight);
        t.innerHTML = `${label}<span class="r-set-x" data-exname="${exName}" data-idx="${i}">×</span>`;
        historyEl.appendChild(t);
    });
    numEl.textContent = (routineSetLog[exName] || []).length + 1;
}

async function saveRoutineSetLog() {
    const dateKey = getDateKey(new Date());
    let log = dailyLogs.find(l => l.dateKey === dateKey);
    if (!log) {
        log = { userId: currentUserId, dateKey: dateKey };
    }

    // Merge into exercises data
    const exercises = Object.entries(routineSetLog).map(([name, sets]) => ({ name, sets }));
    const currentDay = document.querySelector('.day-pill.active')?.dataset.rday || 'unknown';
    log.exercises = { routineDay: currentDay, exercises };
    log.updatedAt = new Date().toISOString();

    const id = await saveDailyLog(log);
    if (!log.id) log.id = id;
    const idx = dailyLogs.findIndex(l => l.dateKey === dateKey);
    if (idx >= 0) dailyLogs[idx] = log;
    else dailyLogs.push(log);

    // Refresh workout tab summary if viewing today
    const picker = $('wlogDatePicker');
    if (picker && picker.value === dateKey) renderWlogDaySummary(dateKey);
}

// --- Workout Logger ---

let workoutExercises = [];

function initWorkoutLogger() {
    // Day pill selection (in Routine tab)
    document.querySelectorAll('#routineDayPills .qlog-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('#routineDayPills .qlog-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderQuickLogExercises(pill.dataset.qday);
        });
    });

    // Save button
    const saveBtn = $('saveQuickLogBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            autoSaveLog();
            showQuickLogSaved();
        });
    }

    // Auto-select today's routine day
    const todayDay = new Date().getDay();
    const todayRoutine = DAY_SCHEDULE[todayDay];
    if (todayRoutine !== 'rest') {
        const pill = document.querySelector(`#routineDayPills .qlog-pill[data-qday="${todayRoutine}"]`);
        if (pill) { pill.classList.add('active'); renderQuickLogExercises(todayRoutine); }
    } else {
        const pill = document.querySelector('#routineDayPills .qlog-pill[data-qday="push"]');
        if (pill) { pill.classList.add('active'); renderQuickLogExercises('push'); }
    }

    loadQuickLogHistory();
    initVolumeTracker();
}

function renderQuickLogExercises(day) {
    const container = $('quickLogExercises');
    const data = ROUTINE_DATA[day];
    if (!data || !container) return;

    const DB_WEIGHTS = [0,2.5,5,7.5,10,12.5,15,17.5,20,22.5,25];
    const BAR_WEIGHTS = [0,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,35,40,45,50];
    const REPS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,25,30];

    function getWeights(equip) {
        const e = (equip || '').toLowerCase();
        if (e.includes('barbell') || e.includes('bar + plate') || e.includes('curl bar')) return BAR_WEIGHTS;
        if (e.includes('band')) return ['Yellow','Red','Black'];
        if ((e.includes('bodyweight') || e.includes('mat')) && !e.includes('kg')) return ['BW'];
        return DB_WEIGHTS;
    }

    function buildSetCell(weights, targetReps, setNum) {
        const weightOpts = `<option value="-">-</option>` + weights.map(w => `<option value="${w}">${typeof w === 'number' ? w : w}</option>`).join('');
        const repOpts = `<option value="0" selected>-</option>` + REPS.filter(r => r > 0).map(r => `<option value="${r}">${r}</option>`).join('');
        return `<td class="qlog-td-set">` +
            `<div class="qlog-set-row"><button class="qlog-adj" data-target="reps" data-dir="-1">−</button><select class="qlog-reps" data-set="${setNum}">${repOpts}</select><button class="qlog-adj" data-target="reps" data-dir="1">+</button></div>` +
            `<div class="qlog-set-row"><button class="qlog-adj" data-target="weight" data-dir="-1">−</button><select class="qlog-weight" data-set="${setNum}">${weightOpts}</select><button class="qlog-adj" data-target="weight" data-dir="1">+</button></div>` +
            `</td>`;
    }

    // Quick defaults bar
    let html = `<div class="qlog-defaults-bar">
        <span class="qlog-defaults-label">Quick fill:</span>
        <label><input type="checkbox" class="qlog-def-chk" data-def="band" checked> 🟡 Yellow (bands)</label>
        <label><input type="checkbox" class="qlog-def-chk" data-def="bw" checked> BW (bodyweight)</label>
        <label><input type="checkbox" class="qlog-def-chk" data-def="weight" checked> <select class="qlog-def-weight">${DB_WEIGHTS.filter(w=>w>0).map(w=>`<option value="${w}"${w===5?' selected':''}>${w}kg</option>`).join('')}</select> (DB)</label>
        <label><input type="checkbox" class="qlog-def-chk" data-def="reps" checked> <select class="qlog-def-reps">${REPS.filter(r=>r>0).map(r=>`<option value="${r}"${r===8?' selected':''}>${r}</option>`).join('')}</select> reps</label>
        <button class="qlog-def-apply">✔ Apply</button>
    </div>`;
    // "Copy last" + "Clear all" buttons
    html += `<div class="qlog-copy-bar"><button class="qlog-copy-last" data-day="${day}">📋 Copy last ${data.title}</button><button class="qlog-clear-all">🗑️ Clear all</button></div>`;
    html += '<div class="qlog-table-wrap"><table class="qlog-table"><thead><tr><th class="qlog-th-ex">Exercise</th><th>Set 1</th><th>Set 2</th><th>Set 3</th><th></th></tr></thead><tbody>';

    data.groups.forEach(group => {
        group.exercises.forEach(ex => {
            const weights = getWeights(ex.equip);
            const repsMatch = ex.sets.match(/[×x](\d+)/i);
            const targetReps = repsMatch ? parseInt(repsMatch[1]) : 0;
            const setsMatch = ex.sets.match(/(\d+)/);
            const numSets = setsMatch ? parseInt(setsMatch[1]) : 3;

            html += `<tr class="qlog-row" data-exname="${ex.name}" data-equip="${ex.equip || ''}" data-reps="${targetReps}"><td class="qlog-td-name">${ex.name}</td>`;
            for (let s = 1; s <= Math.min(numSets, 3); s++) {
                html += buildSetCell(weights, targetReps, s);
            }
            for (let s = numSets + 1; s <= 3; s++) {
                html += '<td class="qlog-td-set qlog-empty">—</td>';
            }
            html += `<td class="qlog-td-add"><button class="qlog-add-set" title="Add set">+Set</button><select class="qlog-clear-ex" title="Clear"><option value="">🧹</option><option value="1">Set 1</option><option value="2">Set 2</option><option value="3">Set 3</option><option value="all">All sets</option></select></td></tr>`;
        });
    });

    html += '</tbody></table></div>';

    // Add exercise from other routines
    const otherDays = Object.keys(ROUTINE_DATA).filter(d => d !== day);
    let addOpts = '<option value="">+ Add exercise from another routine...</option>';
    otherDays.forEach(d => {
        ROUTINE_DATA[d].groups.forEach(g => {
            g.exercises.forEach(ex => {
                addOpts += `<option value="${d}|${ex.name}" data-equip="${ex.equip || ''}" data-sets="${ex.sets}">${ex.name} (${ROUTINE_DATA[d].title})</option>`;
            });
        });
    });
    html += `<div class="qlog-add-exercise"><select class="qlog-add-ex-select">${addOpts}</select><button class="qlog-add-ex-btn">Add</button></div>`;

    container.innerHTML = html;

    // Pre-fill from today's log — mark saved cells as green
    const todayKey = getDateKey(new Date());
    const todayLog = dailyLogs.find(l => l.dateKey === todayKey);
    if (todayLog && todayLog.exercises && todayLog.exercises.exercises) {
        todayLog.exercises.exercises.forEach(loggedEx => {
            const row = container.querySelector(`.qlog-row[data-exname="${loggedEx.name}"]`);
            if (!row) return;
            loggedEx.sets.forEach((s, i) => {
                const setNum = i + 1;
                const repsSelect = row.querySelector(`.qlog-reps[data-set="${setNum}"]`);
                const weightSelect = row.querySelector(`.qlog-weight[data-set="${setNum}"]`);
                if (repsSelect && s.reps) {
                    repsSelect.value = s.reps;
                    const cell = repsSelect.closest('.qlog-td-set');
                    if (cell) cell.classList.add('qlog-td-logged');
                }
                if (weightSelect && s.weight !== undefined) {
                    const wVal = (s.weight === 0 || s.weight === '0') ? 'BW' : String(s.weight);
                    weightSelect.value = wVal;
                    if (weightSelect.value !== wVal) weightSelect.value = s.weight;
                }
            });
        });
    }

    // Mark cell as logged when user changes any select (only if reps > 0)
    container.addEventListener('change', (e) => {
        if (e.target.matches('.qlog-reps, .qlog-weight')) {
            const cell = e.target.closest('.qlog-td-set');
            if (cell) {
                const repsEl = cell.querySelector('.qlog-reps');
                const reps = parseInt(repsEl?.value) || 0;
                if (reps > 0) {
                    cell.classList.add('qlog-td-logged');
                } else {
                    cell.classList.remove('qlog-td-logged');
                }
            }
            autoSaveWorkoutTable();
        }
    });

    // +/- adjustment buttons
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.qlog-adj');
        if (!btn) return;
        const cell = btn.closest('.qlog-td-set');
        const target = btn.dataset.target; // 'reps' or 'weight'
        const dir = parseInt(btn.dataset.dir); // 1 or -1
        const sel = cell.querySelector(target === 'reps' ? '.qlog-reps' : '.qlog-weight');
        if (!sel) return;

        const opts = [...sel.options].filter(o => o.value !== '0' && o.value !== '-');
        const curIdx = opts.findIndex(o => o.value === sel.value);

        if (curIdx === -1) {
            // Currently empty — go to first real option
            if (dir > 0 && opts.length) sel.value = opts[0].value;
        } else {
            const newIdx = curIdx + dir;
            if (newIdx >= 0 && newIdx < opts.length) sel.value = opts[newIdx].value;
        }

        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // "Copy last" button
    const copyBtn = container.querySelector('.qlog-copy-last');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const targetDay = copyBtn.dataset.day;
            const todayKey = getDateKey(new Date());
            // Find most recent log for this routine day (not today)
            const lastLog = dailyLogs
                .filter(l => l.exercises && l.exercises.routineDay === targetDay && l.dateKey < todayKey)
                .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];

            if (!lastLog || !lastLog.exercises.exercises.length) {
                copyBtn.textContent = '❌ No previous data';
                setTimeout(() => { copyBtn.textContent = `📋 Copy last ${ROUTINE_DATA[targetDay].title}`; }, 2000);
                return;
            }

            // Fill table with last log data
            lastLog.exercises.exercises.forEach(loggedEx => {
                const row = container.querySelector(`.qlog-row[data-exname="${loggedEx.name}"]`);
                if (!row) return;
                loggedEx.sets.forEach((s, i) => {
                    const setNum = i + 1;
                    const repsEl = row.querySelector(`.qlog-reps[data-set="${setNum}"]`);
                    const weightEl = row.querySelector(`.qlog-weight[data-set="${setNum}"]`);
                    if (repsEl && s.reps) {
                        repsEl.value = s.reps;
                        const cell = repsEl.closest('.qlog-td-set');
                        if (cell) cell.classList.add('qlog-td-logged');
                    }
                    if (weightEl && s.weight !== undefined) {
                        const wVal = (s.weight === 0 || s.weight === '0') ? 'BW' : String(s.weight);
                        weightEl.value = wVal;
                        if (weightEl.value !== wVal) weightEl.value = s.weight;
                    }
                });
            });

            autoSaveWorkoutTable();
            copyBtn.textContent = '✅ Copied from ' + lastLog.dateKey;
            setTimeout(() => { copyBtn.textContent = `📋 Copy last ${ROUTINE_DATA[targetDay].title}`; }, 3000);
        });
    }

    // "Clear all" button (with confirmation)
    const clearAllBtn = container.querySelector('.qlog-clear-all');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            const loggedCount = container.querySelectorAll('.qlog-td-logged').length;
            if (loggedCount === 0) return;
            if (!confirm(`Clear ALL logged sets (${loggedCount} sets)? This cannot be undone.`)) return;
            container.querySelectorAll('.qlog-td-set').forEach(cell => {
                const reps = cell.querySelector('.qlog-reps');
                const weight = cell.querySelector('.qlog-weight');
                if (reps) reps.value = '0';
                if (weight) weight.value = '-';
                cell.classList.remove('qlog-td-logged');
            });
            autoSaveWorkoutTable();
        });
    }

    // Per-exercise clear dropdown
    container.querySelectorAll('.qlog-clear-ex').forEach(sel => {
        sel.addEventListener('change', function() {
            const val = this.value;
            if (!val) return;
            const row = this.closest('.qlog-row');
            const cells = row.querySelectorAll('.qlog-td-set:not(.qlog-empty)');
            const toClear = val === 'all' ? [...cells] : [cells[parseInt(val) - 1]].filter(Boolean);
            if (toClear.length === 0) { this.value = ''; return; }
            toClear.forEach(cell => {
                const reps = cell.querySelector('.qlog-reps');
                const weight = cell.querySelector('.qlog-weight');
                if (reps) reps.value = '0';
                if (weight) weight.value = '-';
                cell.classList.remove('qlog-td-logged');
            });
            autoSaveWorkoutTable();
            this.value = '';
        });
    });

    // Quick defaults Apply button
    const defApplyBtn = container.querySelector('.qlog-def-apply');
    if (defApplyBtn) {
        defApplyBtn.addEventListener('click', () => {
            const checks = container.querySelectorAll('.qlog-def-chk');
            const defs = {};
            checks.forEach(chk => { if (chk.checked) defs[chk.dataset.def] = true; });
            const defWeight = container.querySelector('.qlog-def-weight')?.value || '5';
            const defReps = container.querySelector('.qlog-def-reps')?.value || '8';

            container.querySelectorAll('.qlog-row').forEach(row => {
                const equip = (row.dataset.equip || '').toLowerCase();
                const isBand = equip.includes('band');
                const isBW = (equip.includes('bodyweight') || equip.includes('mat')) && !equip.includes('kg');
                const cells = row.querySelectorAll('.qlog-td-set:not(.qlog-empty)');
                cells.forEach(cell => {
                    const repsEl = cell.querySelector('.qlog-reps');
                    const weightEl = cell.querySelector('.qlog-weight');

                    // Apply reps if checked
                    if (defs.reps && repsEl) {
                        repsEl.value = defReps;
                        if (repsEl.value !== defReps) {
                            // Find closest option
                            const opts = [...repsEl.options].filter(o => o.value !== '0');
                            const closest = opts.reduce((a, b) => Math.abs(+b.value - +defReps) < Math.abs(+a.value - +defReps) ? b : a);
                            repsEl.value = closest.value;
                        }
                    }

                    // Apply weight based on equipment
                    if (weightEl) {
                        if (isBand && defs.band) {
                            weightEl.value = 'Yellow';
                        } else if (isBW && defs.bw) {
                            weightEl.value = 'BW';
                        } else if (!isBand && !isBW && defs.weight) {
                            weightEl.value = defWeight;
                            if (weightEl.value !== defWeight) {
                                // Find closest available weight
                                const opts = [...weightEl.options].filter(o => o.value !== '-' && !isNaN(+o.value));
                                if (opts.length) {
                                    const closest = opts.reduce((a, b) => Math.abs(+b.value - +defWeight) < Math.abs(+a.value - +defWeight) ? b : a);
                                    weightEl.value = closest.value;
                                }
                            }
                        }
                    }

                    // Mark as logged if reps > 0
                    if (repsEl && +repsEl.value > 0) {
                        cell.classList.add('qlog-td-logged');
                    }
                });
            });
            autoSaveWorkoutTable();
        });
    }

    // +Set click handler
    container.querySelectorAll('.qlog-add-set').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('.qlog-row');
            const equip = row.dataset.equip;
            const targetReps = parseInt(row.dataset.reps) || 12;
            const weights = getWeights(equip);
            // Find last empty cell or add after last set cell
            const emptyCells = row.querySelectorAll('.qlog-empty');
            if (emptyCells.length > 0) {
                const cell = emptyCells[0];
                const setNum = [...row.querySelectorAll('.qlog-td-set')].indexOf(cell) + 1;
                const weightOpts = weights.map(w => `<option value="${w}">${typeof w === 'number' ? w : w}</option>`).join('');
                const repOpts = REPS.map(r => `<option value="${r}" ${r === targetReps ? 'selected' : ''}>${r}</option>`).join('');
                cell.classList.remove('qlog-empty');
                cell.innerHTML = `<select class="qlog-reps" data-set="${setNum}">${repOpts}</select><select class="qlog-weight" data-set="${setNum}">${weightOpts}</select>`;
            } else {
                // Already 3 sets filled — add a 4th column
                const setNum = row.querySelectorAll('.qlog-reps').length + 1;
                const weightOpts = weights.map(w => `<option value="${w}">${typeof w === 'number' ? w : w}</option>`).join('');
                const repOpts = REPS.map(r => `<option value="${r}" ${r === targetReps ? 'selected' : ''}>${r}</option>`).join('');
                const newCell = document.createElement('td');
                newCell.className = 'qlog-td-set';
                newCell.innerHTML = `<select class="qlog-reps" data-set="${setNum}">${repOpts}</select><select class="qlog-weight" data-set="${setNum}">${weightOpts}</select>`;
                row.insertBefore(newCell, this.closest('.qlog-td-add'));
            }
        });
    });

    // Add exercise button handler
    const addExBtn = container.querySelector('.qlog-add-ex-btn');
    if (addExBtn) {
        addExBtn.addEventListener('click', function() {
            const sel = container.querySelector('.qlog-add-ex-select');
            if (!sel.value) return;
            const [srcDay, exName] = sel.value.split('|');
            let foundEx = null;
            ROUTINE_DATA[srcDay].groups.forEach(g => {
                g.exercises.forEach(ex => { if (ex.name === exName) foundEx = ex; });
            });
            if (!foundEx) return;

            const weights = getWeights(foundEx.equip);
            const repsMatch = foundEx.sets.match(/[×x](\d+)/i);
            const targetReps = repsMatch ? parseInt(repsMatch[1]) : 12;
            const setsMatch = foundEx.sets.match(/(\d+)/);
            const numSets = setsMatch ? parseInt(setsMatch[1]) : 3;

            const tbody = container.querySelector('tbody');
            const newRow = document.createElement('tr');
            newRow.className = 'qlog-row';
            newRow.dataset.exname = foundEx.name;
            newRow.dataset.equip = foundEx.equip || '';
            newRow.dataset.reps = targetReps;

            let cells = `<td class="qlog-td-name">${foundEx.name}</td>`;
            for (let s = 1; s <= Math.min(numSets, 3); s++) {
                cells += buildSetCell(weights, targetReps, s);
            }
            for (let s = numSets + 1; s <= 3; s++) {
                cells += '<td class="qlog-td-set qlog-empty">—</td>';
            }
            cells += `<td class="qlog-td-add"><button class="qlog-add-set" title="Add set">+Set</button></td>`;
            newRow.innerHTML = cells;
            tbody.appendChild(newRow);

            // Attach +Set handler to new row
            newRow.querySelector('.qlog-add-set').addEventListener('click', function() {
                const row = this.closest('.qlog-row');
                const equip = row.dataset.equip;
                const tReps = parseInt(row.dataset.reps) || 12;
                const w = getWeights(equip);
                const emptyCells = row.querySelectorAll('.qlog-empty');
                if (emptyCells.length > 0) {
                    const cell = emptyCells[0];
                    const setNum = [...row.querySelectorAll('.qlog-td-set')].indexOf(cell) + 1;
                    const wOpts = w.map(v => `<option value="${v}">${typeof v === 'number' ? v : v}</option>`).join('');
                    const rOpts = REPS.map(r => `<option value="${r}" ${r === tReps ? 'selected' : ''}>${r}</option>`).join('');
                    cell.classList.remove('qlog-empty');
                    cell.innerHTML = `<select class="qlog-reps" data-set="${setNum}">${rOpts}</select><select class="qlog-weight" data-set="${setNum}">${wOpts}</select>`;
                }
            });

            sel.value = '';
        });
    }
}

function showQuickLogSaved() {
    playLogSaved();
    const btn = $('saveQuickLogBtn');
    const orig = btn.textContent;
    btn.textContent = '✓ Saved!';
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1500);
}

function getWorkoutLoggerData() {
    const activePill = document.querySelector('.qlog-pill.active');
    const routineDay = activePill ? activePill.dataset.qday : null;
    const rows = document.querySelectorAll('.qlog-row');
    const exercises = [...rows].map(row => {
        const name = row.dataset.exname;
        const sets = [...row.querySelectorAll('.qlog-td-set')].map(td => {
            if (!td.classList.contains('qlog-td-logged')) return null;
            const repsEl = td.querySelector('.qlog-reps');
            const weightEl = td.querySelector('.qlog-weight');
            if (!repsEl) return null;
            const reps = parseInt(repsEl.value) || 0;
            if (reps === 0) return null; // 0 reps = not done
            return {
                reps,
                weight: weightEl ? weightEl.value : 'BW'
            };
        }).filter(Boolean);
        return { name, sets };
    }).filter(ex => ex.sets.length > 0);
    return { routineDay, exercises };
}

async function autoSaveWorkoutTable() {
    const data = getWorkoutLoggerData();
    const dateKey = getDateKey(new Date());
    let log = dailyLogs.find(l => l.dateKey === dateKey);

    if (!data.exercises.length) {
        // Nothing logged — clear exercises from stored log
        if (log && log.exercises) {
            delete log.exercises;
            log.updatedAt = new Date().toISOString();
            await saveDailyLog(log);
        }
        // Update UI
        const picker = $('wlogDatePicker');
        if (picker) {
            renderWlogDaySummary(picker.value);
            highlightWorkedPills(picker.value);
        }
        return;
    }

    if (!log) {
        log = { userId: currentUserId, dateKey: dateKey };
    }
    log.exercises = data;
    log.updatedAt = new Date().toISOString();

    const id = await saveDailyLog(log);
    if (!log.id) log.id = id;
    const idx = dailyLogs.findIndex(l => l.dateKey === dateKey);
    if (idx >= 0) dailyLogs[idx] = log;
    else dailyLogs.push(log);

    // Update summary and progress pill
    const picker = $('wlogDatePicker');
    if (picker) {
        renderWlogDaySummary(picker.value);
        highlightWorkedPills(picker.value);
    }
}

function loadQuickLogHistory() {
    const container = $('quickLogHistory');
    if (!container) return;
    const logs = dailyLogs
        .filter(l => l.exercises && l.exercises.exercises && l.exercises.exercises.length > 0)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
        .slice(0, 5);

    if (logs.length === 0) {
        container.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:12px;">No workout logs yet. Complete a workout and save!</p>';
        return;
    }

    container.innerHTML = logs.map(log => {
        const d = log.dateKey; // YYYY-MM-DD
        const dayLabel = log.exercises.routineDay ? log.exercises.routineDay.toUpperCase() : '';
        const exList = log.exercises.exercises.map(ex => {
            const setsStr = ex.sets.map(s => {
                let w;
                if (s.weight === 'BW' || s.weight === 0 || s.weight === '0') w = 'BW';
                else if (typeof s.weight === 'string' && isNaN(s.weight)) w = s.weight;
                else w = s.weight + 'kg';
                return `${s.reps}r×${w}`;
            }).join(', ');
            return `<div class="qlog-history-ex"><strong>${ex.name}</strong>: ${setsStr}</div>`;
        }).join('');
        return `<div class="qlog-history-entry"><div class="qlog-history-date">${d} ${dayLabel ? '— ' + dayLabel : ''}</div>${exList}</div>`;
    }).join('');
}

// --- Workout Day Summary (date picker) ---
function initWlogDatePicker() {
    const picker = $('wlogDatePicker');
    if (!picker) return;
    picker.value = getDateKey(new Date());
    picker.addEventListener('change', () => renderWlogDaySummary(picker.value));
    renderWlogDaySummary(picker.value);
    highlightWorkedPills(picker.value);
}

function highlightWorkedPills(dateKey) {
    const pills = document.querySelectorAll('#routineDayPills .qlog-pill');
    pills.forEach(p => { p.classList.remove('qlog-pill-done'); p.style.removeProperty('--fill'); });
    const log = dailyLogs.find(l => l.dateKey === dateKey);
    if (log && log.exercises && log.exercises.routineDay && log.exercises.exercises) {
        const day = log.exercises.routineDay;
        const pill = document.querySelector(`#routineDayPills .qlog-pill[data-qday="${day}"]`);
        if (pill) {
            // Calculate progress: exercises logged / total exercises in routine
            const loggedCount = log.exercises.exercises.length;
            const routineData = ROUTINE_DATA[day];
            let totalEx = 0;
            if (routineData) routineData.groups.forEach(g => { totalEx += g.exercises.length; });
            const pct = totalEx > 0 ? Math.min(100, Math.round((loggedCount / totalEx) * 100)) : 100;
            pill.classList.add('qlog-pill-done');
            pill.style.setProperty('--fill', pct + '%');
        }
    }
}

function renderWlogDaySummary(dateKey) {
    const container = $('wlogDaySummary');
    if (!container) return;
    highlightWorkedPills(dateKey);
    const log = dailyLogs.find(l => l.dateKey === dateKey);

    if (!log || !log.exercises || !log.exercises.exercises || log.exercises.exercises.length === 0) {
        container.innerHTML = `<div class="wlog-empty">No workout logged for ${dateKey}</div>`;
        return;
    }

    const dayLabel = log.exercises.routineDay ? log.exercises.routineDay.toUpperCase() + ' Day' : '';
    let html = `<div class="wlog-summary"><div class="wlog-summary-header">${dayLabel}</div>`;
    log.exercises.exercises.forEach(ex => {
        const setsHtml = ex.sets.map((s, i) => {
            let w;
            if (s.weight === 'BW' || s.weight === 0 || s.weight === '0') w = 'BW';
            else if (typeof s.weight === 'string' && isNaN(s.weight)) w = s.weight;
            else w = s.weight + 'kg';
            return `<span class="wlog-set-chip">S${i + 1}: ${s.reps}r × ${w}</span>`;
        }).join('');
        html += `<div class="wlog-ex-row"><div class="wlog-ex-name">${ex.name}</div><div class="wlog-ex-sets">${setsHtml}</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// --- Progressive Overload Volume Tracker ---

function initVolumeTracker() {
    document.querySelectorAll('#volumeDayPills .qlog-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('#volumeDayPills .qlog-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderVolumeTable(pill.dataset.vday);
        });
    });
    // Default render
    renderVolumeTable('push');
}

function renderVolumeTable(day) {
    const container = $('volumeContent');
    if (!container) return;

    const routineExercises = [];
    ROUTINE_DATA[day].groups.forEach(g => {
        g.exercises.forEach(ex => routineExercises.push(ex.name));
    });

    // Get all logs for this routine day (last 8 weeks)
    const now = new Date();
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const cutoff = eightWeeksAgo.toISOString().slice(0, 10);

    const relevantLogs = dailyLogs
        .filter(l => l.exercises && l.exercises.routineDay === day && l.dateKey >= cutoff)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    if (relevantLogs.length === 0) {
        container.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">No workout data yet for ' + day.toUpperCase() + '. Save a workout to start tracking!</p>';
        return;
    }

    // Group logs into weeks (Mon-Sun)
    function getWeekKey(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const dayOfWk = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (dayOfWk === 0 ? 6 : dayOfWk - 1));
        return mon.toISOString().slice(0, 10);
    }

    // Build weekly volume: max weight × reps at max weight, per exercise per week
    const weekData = {}; // { weekKey: { exName: { maxWt, repsAtMax, totalVol } } }
    relevantLogs.forEach(log => {
        const wk = getWeekKey(log.dateKey);
        if (!weekData[wk]) weekData[wk] = {};
        log.exercises.exercises.forEach(ex => {
            if (!weekData[wk][ex.name]) weekData[wk][ex.name] = { maxWt: 0, repsAtMax: 0, totalVol: 0 };
            ex.sets.forEach(s => {
                const reps = parseInt(s.reps) || 0;
                const w = parseFloat(s.weight) || 0;
                weekData[wk][ex.name].totalVol += reps * (w > 0 ? w : 1);
                if (w > weekData[wk][ex.name].maxWt) {
                    weekData[wk][ex.name].maxWt = w;
                    weekData[wk][ex.name].repsAtMax = reps;
                } else if (w === weekData[wk][ex.name].maxWt) {
                    weekData[wk][ex.name].repsAtMax += reps;
                }
            });
        });
    });

    const weekKeys = Object.keys(weekData).sort();

    // Build table: Exercise | Wk1 | Wk2 | ...
    let html = '<div class="volume-table-wrap"><table class="volume-table"><thead><tr><th>Exercise</th>';
    weekKeys.forEach(wk => {
        html += `<th class="vol-week">Wk ${fmtDate(wk)}</th>`;
    });
    html += '</tr></thead><tbody>';

    let totalByWeek = {};
    weekKeys.forEach(wk => { totalByWeek[wk] = 0; });

    routineExercises.forEach(exName => {
        html += `<tr><td class="vol-ex-name">${exName}</td>`;
        let prevVol = null;
        weekKeys.forEach(wk => {
            const d = weekData[wk][exName];
            const vol = d ? d.totalVol : 0;
            let cls = 'vol-cell';
            if (prevVol !== null && vol > 0) {
                cls += vol > prevVol ? ' vol-up' : vol < prevVol ? ' vol-down' : '';
            }
            if (vol > 0) {
                const label = d.maxWt > 0 ? `${d.repsAtMax}×${d.maxWt}kg` : `${vol}`;
                html += `<td class="${cls} vol-clickable" data-ex="${exName}" data-wk="${wk}"><div>${vol}</div><div class="vol-detail">${label}</div></td>`;
                totalByWeek[wk] += vol;
                prevVol = vol;
            } else {
                html += `<td class="${cls}">—</td>`;
            }
        });
        html += '</tr>';
    });

    // Total row
    html += '<tr class="vol-total-row"><td class="vol-ex-name"><strong>TOTAL</strong></td>';
    weekKeys.forEach(wk => {
        html += `<td class="vol-cell vol-total">${totalByWeek[wk] || '—'}</td>`;
    });
    html += '</tr>';

    html += '</tbody></table></div>';
    html += '<div id="volDayDetail" class="vol-day-detail"></div>';
    container.innerHTML = html;

    // Click handler for volume cells → show daily breakdown
    container.querySelectorAll('.vol-clickable').forEach(cell => {
        cell.addEventListener('click', () => {
            const exName = cell.dataset.ex;
            const wk = cell.dataset.wk;
            const wkEnd = new Date(wk + 'T00:00:00');
            wkEnd.setDate(wkEnd.getDate() + 6);
            const wkEndStr = wkEnd.toISOString().slice(0, 10);

            const dayLogs = relevantLogs.filter(l => l.dateKey >= wk && l.dateKey <= wkEndStr);
            let detailHtml = `<div class="vol-detail-header">${exName} — Week of ${fmtDate(wk)}</div>`;
            let found = false;
            dayLogs.forEach(l => {
                const ex = l.exercises.exercises.find(e => e.name === exName);
                if (ex) {
                    found = true;
                    const dayName = new Date(l.dateKey + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
                    const setsStr = ex.sets.map((s, i) => {
                        let w;
                        if (s.weight === 'BW' || s.weight === 0 || s.weight === '0') w = 'BW';
                        else if (typeof s.weight === 'string' && isNaN(s.weight)) w = s.weight;
                        else w = s.weight + 'kg';
                        return `S${i + 1}: ${s.reps}r × ${w}`;
                    }).join(', ');
                    detailHtml += `<div class="vol-detail-row"><span class="vol-detail-date">${dayName} ${fmtDate(l.dateKey)}</span><span class="vol-detail-sets">${setsStr}</span></div>`;
                }
            });
            if (!found) detailHtml += '<div class="vol-detail-row">No data</div>';
            document.getElementById('volDayDetail').innerHTML = detailHtml;
        });
    });
}

// --- Full Volume Log Tab ---

// Muscle group → background color mapping
const MUSCLE_COLORS = {
    'Chest': 'rgba(239,83,80,0.12)',
    'Shoulders': 'rgba(255,152,0,0.12)',
    'Triceps': 'rgba(171,71,188,0.12)',
    'Back': 'rgba(66,165,245,0.12)',
    'Traps': 'rgba(38,198,218,0.12)',
    'Biceps': 'rgba(102,187,106,0.12)',
    'Quads & Glutes': 'rgba(255,167,38,0.12)',
    'Glutes & Hamstrings': 'rgba(236,64,122,0.12)',
    'Calves': 'rgba(120,144,156,0.15)',
    'Mobility': 'rgba(141,110,99,0.12)',
    'Abs & Core': 'rgba(255,202,40,0.12)',
    'Finishers': 'rgba(236,64,122,0.12)',
};

// Build exercise → muscle mapping from ROUTINE_DATA
function buildExerciseMuscleMap() {
    const map = {};
    const order = [];
    const groupNames = {
        '🫁 Chest': 'Chest', '🔴 Shoulders': 'Shoulders', '🔺 Triceps': 'Triceps',
        '🔙 Back': 'Back', '🔼 Traps': 'Traps', '💪 Biceps': 'Biceps',
        '🦵 Quads & Glutes': 'Quads & Glutes', '🍑 Glutes & Hamstrings': 'Glutes & Hamstrings',
        '🦶 Calves': 'Calves', '🔧 Mobility': 'Mobility',
        '🔥 Abs & Core': 'Abs & Core', '🦵 Ankle Weight Finishers': 'Finishers',
    };
    ['push','pull','legs','arms'].forEach(day => {
        ROUTINE_DATA[day].groups.forEach(g => {
            const muscle = groupNames[g.name] || g.name;
            g.exercises.forEach(ex => {
                if (!map[ex.name]) {
                    map[ex.name] = { muscle, day };
                    order.push(ex.name);
                }
            });
        });
    });
    return { map, order };
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(dateStr) {
    const parts = dateStr.split('-');
    return parseInt(parts[2]) + ' ' + SHORT_MONTHS[parseInt(parts[1]) - 1];
}

let _volumeTabInited = false;
function initFullVolumeTab() {
    if (_volumeTabInited) { renderFullVolumeTable(); return; }
    _volumeTabInited = true;
    const ROUTINE_COLORS = { push: '#e74c3c', pull: '#3498db', legs: '#27ae60', arms: '#9b59b6', rest: '#555' };
    let calMonth = new Date().getMonth();
    let calYear = new Date().getFullYear();

    const legend = $('calLegend');
    if (legend) {
        legend.innerHTML = Object.entries(ROUTINE_COLORS).filter(([k]) => k !== 'rest').map(([k, c]) =>
            `<span class="cal-legend-chip" style="background:${c}">${k.charAt(0).toUpperCase() + k.slice(1)}</span>`
        ).join('');
    }

    $('calPrev').addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); });
    $('calNext').addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); });

    function renderCalendar() {
        $('calMonthLabel').textContent = SHORT_MONTHS[calMonth] + ' ' + calYear;
        const grid = $('calGrid');
        const detail = $('calDetail');
        detail.innerHTML = '';

        // Build lookup: dateKey → log (all daily logs)
        const logMap = {}; // dateKey → log
        dailyLogs.forEach(l => {
            logMap[l.dateKey] = l;
        });

        // First day of month
        const firstDay = new Date(calYear, calMonth, 1);
        const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

        let html = '<div class="cal-header-row">';
        ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => html += `<div class="cal-hdr">${d}</div>`);
        html += '</div><div class="cal-body">';

        // Empty cells before first day
        for (let i = 0; i < startDow; i++) html += '<div class="cal-cell cal-empty"></div>';

        const today = new Date().toISOString().slice(0, 10);
        for (let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const log = logMap[dateKey];
            const routineDay = (log && log.exercises && log.exercises.routineDay) ? log.exercises.routineDay : null;
            const color = routineDay ? ROUTINE_COLORS[routineDay] : 'transparent';
            const isToday = dateKey === today ? ' cal-today' : '';
            const hasData = log ? ' cal-has-data' : '';
            html += `<div class="cal-cell${isToday}${hasData}" data-date="${dateKey}" style="background:${color}">${d}</div>`;
        }
        html += '</div>';
        grid.innerHTML = html;

        // Update stats
        const monthSess = sessions.filter(s => { const d = new Date(s.date); return d.getFullYear() === calYear && d.getMonth() === calMonth; });
        $('monthSessions').textContent = monthSess.length;
        $('monthMinutes').textContent = monthSess.reduce((sum, s) => sum + s.duration, 0);
        const yearSess = sessions.filter(s => new Date(s.date).getFullYear() === calYear);
        $('yearSessions').textContent = yearSess.length;
        $('yearMinutes').textContent = yearSess.reduce((sum, s) => sum + s.duration, 0);

        // Click handler
        grid.querySelectorAll('.cal-has-data').forEach(cell => {
            cell.addEventListener('click', () => {
                grid.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('cal-selected'));
                cell.classList.add('cal-selected');
                showDayDetail(cell.dataset.date, logMap[cell.dataset.date]);
            });
        });

        // Week Dots + Chain Links
        renderWeekDots(logMap);
        renderChainLinks(logMap);
    }

    function renderWeekDots(logMap) {
        const container = $('weekDotsRow');
        if (!container) return;
        const now = new Date();
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek);
        const days = ['M','T','W','T','F','S','S'];

        let count = 0;
        let html = '';
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dk = d.toISOString().slice(0, 10);
            const log = logMap[dk];
            const hasWorkout = !!(log && log.exercises && log.exercises.routineDay);
            if (hasWorkout) count++;
            const isToday = i === dayOfWeek;
            let cls = 'wdot';
            if (hasWorkout) cls += ' wdot-done';
            else if (isToday) cls += ' wdot-today';
            else if (i > dayOfWeek) cls += ' wdot-future';
            else cls += ' wdot-missed';
            html += `<div class="${cls}"><span class="wdot-letter">${days[i]}</span><span class="wdot-icon">${hasWorkout ? '✓' : isToday ? '💪' : ''}</span></div>`;
        }
        const remaining = Math.max(0, 3 - count);
        const msg = count >= 3
            ? `<span class="wdot-msg-done">🔥 ${count} workouts! Week goal smashed!</span>`
            : `<span class="wdot-msg-progress">🎯 ${remaining} more to close the week</span>`;
        container.innerHTML = `<div class="wdot-row">${html}</div><div class="wdot-msg">${msg}</div>`;
    }

    function renderChainLinks(logMap) {
        const container = $('chainLinksRow');
        if (!container) return;

        // Calculate last 8 weeks of workout counts
        const now = new Date();
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - dayOfWeek);

        const weeks = [];
        for (let w = 7; w >= 0; w--) {
            const weekStart = new Date(thisMonday);
            weekStart.setDate(thisMonday.getDate() - (w * 7));
            let count = 0;
            for (let d = 0; d < 7; d++) {
                const day = new Date(weekStart);
                day.setDate(weekStart.getDate() + d);
                const dk = day.toISOString().slice(0, 10);
                const log = logMap[dk];
                if (log && log.exercises && log.exercises.routineDay) count++;
            }
            weeks.push({ count, isCurrent: w === 0 });
        }

        // Count consecutive completed weeks (3+)
        let chainLength = 0;
        for (let i = weeks.length - 2; i >= 0; i--) { // exclude current week
            if (weeks[i].count >= 3) chainLength++;
            else break;
        }

        let html = '';
        weeks.forEach((wk, i) => {
            const isComplete = wk.count >= 3;
            const cls = wk.isCurrent ? 'chain-link chain-current' : isComplete ? 'chain-link chain-done' : 'chain-link chain-broken';
            html += `<div class="${cls}"><span class="chain-count">${wk.count}</span></div>`;
            if (i < weeks.length - 1) {
                const nextComplete = weeks[i + 1].isCurrent ? false : weeks[i + 1].count >= 3;
                html += `<div class="chain-conn${isComplete && nextComplete ? ' chain-conn-linked' : ''}"></div>`;
            }
        });

        const chainMsg = chainLength > 0
            ? `🔗 ${chainLength}-week chain! Don't break it!`
            : chainLength === 0 && weeks[weeks.length - 1].count > 0
            ? `⛓️ Start your chain — hit 3 this week!`
            : `⛓️ Build your chain — 3 workouts = 1 link`;
        container.innerHTML = `<div class="chain-row">${html}</div><div class="chain-msg">${chainMsg}</div>`;
    }

    function showDayDetail(dateKey, log) {
        const detail = $('calDetail');
        const routineDay = (log.exercises && log.exercises.routineDay) ? log.exercises.routineDay : null;
        const color = routineDay ? ROUTINE_COLORS[routineDay] : '#888';
        const dayLabel = routineDay ? `${routineDay.toUpperCase()} Day` : 'Rest / Log Only';

        let html = `<div class="cal-detail-card"><div class="cal-detail-header" style="border-left:4px solid ${color}"><strong>${fmtDate(dateKey)}</strong> — ${dayLabel}</div>`;

        // Daily log summary (food, sleep, water, health, note)
        const chips = [];
        if (log.workout) chips.push(`🏋️ ${log.workout}`);
        if (log.food) chips.push(`🍽️ ${log.food}`);
        if (log.sleep) chips.push(`😴 ${log.sleep}`);
        if (log.water) chips.push(`💧 ${log.water}/8`);
        if (log.health && log.health.length) chips.push(`🩺 ${log.health.join(', ')}`);
        if (chips.length) {
            html += `<div class="cal-detail-chips">${chips.map(c => `<span class="cal-chip">${c}</span>`).join('')}</div>`;
        }
        if (log.note) {
            html += `<div class="cal-detail-note">📝 ${log.note}</div>`;
        }

        // Exercise table (if workout data exists)
        if (log.exercises && log.exercises.exercises && log.exercises.exercises.length) {
            html += '<table class="cal-detail-table"><thead><tr><th>Exercise</th><th>Sets</th><th>Total Vol</th></tr></thead><tbody>';
            log.exercises.exercises.forEach(ex => {
                const setsStr = ex.sets.map(s => `${s.reps}×${s.weight > 0 ? s.weight + 'kg' : 'BW'}`).join(', ');
                let vol = 0;
                ex.sets.forEach(s => { const r = parseInt(s.reps)||0; const w = parseFloat(s.weight)||0; vol += r * (w > 0 ? w : 1); });
                html += `<tr><td>${ex.name}</td><td>${setsStr}</td><td><strong>${vol}</strong></td></tr>`;
            });
            html += '</tbody></table>';
        }

        html += '</div>';
        detail.innerHTML = html;
    }

    renderCalendar();
    renderFullVolumeTable();
}

function renderFullVolumeTable() {
    const container = $('fullVolumeTable');
    if (!container) return;

    const { map: exMap, order: exOrder } = buildExerciseMuscleMap();

    const now = new Date();
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const cutoff = eightWeeksAgo.toISOString().slice(0, 10);

    const allLogs = dailyLogs
        .filter(l => l.exercises && l.exercises.exercises && l.exercises.exercises.length > 0 && l.dateKey >= cutoff)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    if (allLogs.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Build volume per exercise per date
    const volData = {};
    const allDates = [];
    allLogs.forEach(log => {
        const dk = log.dateKey;
        if (!allDates.includes(dk)) allDates.push(dk);
        log.exercises.exercises.forEach(ex => {
            if (!volData[ex.name]) volData[ex.name] = {};
            let vol = 0;
            ex.sets.forEach(s => {
                const reps = parseInt(s.reps) || 0;
                const w = parseFloat(s.weight) || 0;
                vol += reps * (w > 0 ? w : 1);
            });
            volData[ex.name][dk] = (volData[ex.name][dk] || 0) + vol;
        });
    });
    allDates.sort();

    // Group dates into weeks
    function getWeekKey(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const dow = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        return mon.toISOString().slice(0, 10);
    }

    const columns = [];
    const weekDates = {};
    allDates.forEach(d => {
        const wk = getWeekKey(d);
        if (!weekDates[wk]) weekDates[wk] = [];
        weekDates[wk].push(d);
    });
    const weekKeys = Object.keys(weekDates).sort();
    weekKeys.forEach(wk => {
        weekDates[wk].forEach(d => columns.push({ type: 'date', date: d }));
        columns.push({ type: 'week', weekKey: wk });
    });

    let html = '<div class="volume-table-wrap"><table class="volume-table fvol-full"><thead><tr><th class="fvol-ex-th">Exercise</th>';
    columns.forEach(col => {
        if (col.type === 'date') html += `<th class="vol-date">${fmtDate(col.date)}</th>`;
        else html += `<th class="vol-week fvol-wk-th">Σ Wk</th>`;
    });
    html += '</tr></thead><tbody>';

    let lastDay = null;
    exOrder.forEach(exName => {
        const info = exMap[exName];
        const dayLabel = ROUTINE_DATA[info.day].title;
        if (info.day !== lastDay) {
            lastDay = info.day;
            html += `<tr class="fvol-partition"><td colspan="${columns.length + 1}">${dayLabel}</td></tr>`;
        }
        const bgColor = MUSCLE_COLORS[info.muscle] || 'transparent';
        html += `<tr style="background:${bgColor}"><td class="vol-ex-name fvol-ex-cell">${exName}</td>`;
        columns.forEach(col => {
            if (col.type === 'date') {
                const vol = (volData[exName] && volData[exName][col.date]) || 0;
                html += `<td class="vol-cell">${vol > 0 ? vol : ''}</td>`;
            } else {
                const wkDates = weekDates[col.weekKey] || [];
                let sum = 0;
                wkDates.forEach(d => { sum += (volData[exName] && volData[exName][d]) || 0; });
                html += `<td class="vol-cell vol-wk-cell">${sum > 0 ? sum : ''}</td>`;
            }
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Legend
    html += '<div class="fvol-legend">';
    Object.keys(MUSCLE_COLORS).forEach(m => {
        html += `<span class="fvol-legend-chip" style="background:${MUSCLE_COLORS[m]}">${m}</span>`;
    });
    html += '</div>';

    container.innerHTML = html;
}

// --- Body Measurements ---

function initMeasurements() {
    const toggleBtn = $('toggleMeasurements');
    const form = $('measurementsForm');
    if (!toggleBtn || !form) return;

    toggleBtn.addEventListener('click', () => {
        form.classList.toggle('hidden');
        toggleBtn.classList.toggle('open');
    });

    // Pre-fill inputs with last saved values (so user can just adjust & save)
    getMeasurementsByUser(currentUserId).then(records => {
        if (records.length) {
            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            const last = records[0];
            const fields = ['weight','shoulders','chest','waist','hips','bicepl','bicepr','thighl','thighr','calfl','calfr'];
            const ids = ['mWeight','mShoulders','mChest','mWaist','mHips','mBicepL','mBicepR','mThighL','mThighR','mCalfL','mCalfR'];
            fields.forEach((f, i) => {
                if (last[f] !== undefined) $(ids[i]).value = last[f];
            });
        }
    });

    $('saveMeasurementsBtn').addEventListener('click', saveMeasurements);
    loadMeasurementHistory();
}

async function saveMeasurements() {
    const fields = ['Weight', 'Shoulders', 'Chest', 'Waist', 'Hips', 'BicepL', 'BicepR', 'ThighL', 'ThighR', 'CalfL', 'CalfR'];
    const data = {};
    let hasValue = false;
    fields.forEach(f => {
        const val = parseFloat($('m' + f).value);
        if (!isNaN(val)) { data[f.toLowerCase()] = val; hasValue = true; }
    });
    if (!hasValue) return;

    const entry = {
        userId: currentUserId,
        date: new Date().toISOString(),
        ...data
    };

    await addMeasurement(entry);
    // Clear inputs
    fields.forEach(f => $('m' + f).value = '');
    loadMeasurementHistory();
}

async function loadMeasurementHistory() {
    const container = $('measureHistory');
    if (!container) return;
    const records = await getMeasurementsByUser(currentUserId);
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = records.slice(0, 12);

    if (recent.length === 0) {
        container.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">No measurements yet. Log weekly to track progress!</p>';
        return;
    }

    const fields = [
        {key:'weight',label:'Wt(kg)',down:true},
        {key:'shoulders',label:'Shldr'},
        {key:'chest',label:'Chest'},
        {key:'waist',label:'Waist',down:true},
        {key:'hips',label:'Hips',down:true},
        {key:'bicepl',label:'Bi-L'},
        {key:'bicepr',label:'Bi-R'},
        {key:'thighl',label:'Th-L'},
        {key:'thighr',label:'Th-R'},
        {key:'calfl',label:'Cf-L'},
        {key:'calfr',label:'Cf-R'}
    ];

    let html = '<div class="measure-history-scroll"><table class="measure-table"><thead><tr><th>Date</th>';
    fields.forEach(f => { html += `<th>${f.label}</th>`; });
    html += '<th></th></tr></thead><tbody>';

    recent.forEach((row, i) => {
        const d = new Date(row.date).toLocaleDateString('en-GB', {day:'2-digit',month:'short'});
        const prev = recent[i + 1]; // older entry
        html += `<tr><td><strong>${d}</strong></td>`;
        fields.forEach(f => {
            const val = row[f.key];
            if (val === undefined) { html += '<td>-</td>'; return; }
            let cls = '';
            if (prev && prev[f.key] !== undefined) {
                const diff = val - prev[f.key];
                if (diff > 0) cls = f.down ? 'delta-bad' : 'delta-good';
                else if (diff < 0) cls = f.down ? 'delta-good' : 'delta-bad';
            }
            html += `<td class="${cls}">${val}</td>`;
        });
        html += `<td><button class="meas-del-btn" data-id="${row.id}" title="Delete">🗑</button></td>`;
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;

    // Delete row handler
    container.querySelectorAll('.meas-del-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (!confirm('Delete this measurement entry? This cannot be undone.')) return;
            const id = parseInt(this.dataset.id);
            const tx = db.transaction('measurements', 'readwrite');
            tx.objectStore('measurements').delete(id);
            tx.oncomplete = () => loadMeasurementHistory();
        });
    });
}

// --- Body Composition ---

function initComposition() {
    const toggleBtn = $('toggleComposition');
    const form = $('compositionForm');
    if (!toggleBtn || !form) return;

    toggleBtn.addEventListener('click', () => {
        form.classList.toggle('hidden');
        toggleBtn.classList.toggle('open');
    });

    $('saveCompositionBtn').addEventListener('click', saveComposition);
    loadCompositionHistory();
}

async function saveComposition() {
    const fields = ['BodyFat', 'MuscleRate', 'VisceralFat', 'BMI', 'BMR', 'BodyWater', 'BoneMass', 'MetabolicAge'];
    const data = {};
    let hasValue = false;
    fields.forEach(f => {
        const val = parseFloat($('c' + f).value);
        if (!isNaN(val)) { data[f] = val; hasValue = true; }
    });
    if (!hasValue) return;

    const entry = {
        userId: currentUserId,
        date: new Date().toISOString(),
        ...data
    };

    await addComposition(entry);
    fields.forEach(f => $('c' + f).value = '');
    loadCompositionHistory();
}

async function loadCompositionHistory() {
    const container = $('compositionHistory');
    if (!container) return;
    const records = await getCompositionsByUser(currentUserId);
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = records.slice(0, 12);

    if (recent.length === 0) {
        container.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">No composition data yet</p>';
        return;
    }

    const fields = [
        {key:'BodyFat',label:'BF%',down:true},
        {key:'MuscleRate',label:'Musc%',down:false},
        {key:'VisceralFat',label:'Visc%',down:true},
        {key:'BMI',label:'BMI',down:true},
        {key:'BMR',label:'BMR'},
        {key:'BodyWater',label:'Water%'},
        {key:'BoneMass',label:'Bone'},
        {key:'MetabolicAge',label:'MetAge',down:true}
    ];

    let html = '<div class="measure-history-scroll"><table class="measure-table"><thead><tr><th>Date</th>';
    fields.forEach(f => { html += `<th>${f.label}</th>`; });
    html += '</tr></thead><tbody>';

    recent.forEach((row, i) => {
        const d = new Date(row.date).toLocaleDateString('en-GB', {day:'2-digit',month:'short'});
        const prev = recent[i + 1];
        html += `<tr><td><strong>${d}</strong></td>`;
        fields.forEach(f => {
            const val = row[f.key];
            if (val === undefined) { html += '<td>-</td>'; return; }
            let cls = '';
            if (prev && prev[f.key] !== undefined) {
                const diff = val - prev[f.key];
                if (diff > 0) cls = f.down ? 'delta-bad' : 'delta-good';
                else if (diff < 0) cls = f.down ? 'delta-good' : 'delta-bad';
            }
            html += `<td class="${cls}">${val}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// --- Start ---
init();
