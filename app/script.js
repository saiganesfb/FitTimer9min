// ============================================
// FitTimer — App Logic (v2)
// ============================================

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
let viewingMonth = new Date(); // for calendar navigation

// --- DOM Elements ---
const $ = (id) => document.getElementById(id);

const profileSelector = $('profileSelector');
const profileSetup = $('profileSetup');
const mainApp = $('mainApp');
const profileForm = $('profileForm');
const profileList = $('profileList');
const newProfileBtn = $('newProfileBtn');
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

const historyMonth = $('historyMonth');
const calendarGrid = $('calendarGrid');

const durationBtns = document.querySelectorAll('.duration-btn');
const tabBtns = document.querySelectorAll('.tab-btn');

// --- Initialize ---
async function init() {
    await openDB();
    const users = await getAllUsers();
    const lastUserId = localStorage.getItem('fitTimer_lastUser');

    if (users.length === 0) {
        showProfileSetup();
    } else if (users.length === 1) {
        await loginUser(users[0].id);
    } else if (lastUserId && users.find(u => u.id === Number(lastUserId))) {
        await loginUser(Number(lastUserId));
    } else {
        showProfileSelector(users);
    }

    bindEvents();
}

// --- Profile Management ---

function showProfileSelector(users) {
    profileSelector.classList.remove('hidden');
    profileSetup.classList.add('hidden');
    mainApp.classList.add('hidden');

    profileList.innerHTML = users.map(u => `
        <div class="profile-card" data-user-id="${u.id}">
            <div class="avatar">${u.name.charAt(0).toUpperCase()}</div>
            <div class="info">
                <div class="name">${u.name}</div>
                <div class="meta">${u.goal || 15} min goal</div>
            </div>
        </div>
    `).join('');

    profileList.querySelectorAll('.profile-card').forEach(card => {
        card.addEventListener('click', () => loginUser(Number(card.dataset.userId)));
    });
}

function showProfileSetup() {
    profileSelector.classList.add('hidden');
    profileSetup.classList.remove('hidden');
    mainApp.classList.add('hidden');
}

async function loginUser(userId) {
    currentUserId = userId;
    currentUser = await getUser(userId);
    sessions = await getSessionsByUser(userId);
    localStorage.setItem('fitTimer_lastUser', userId);

    selectedDuration = currentUser.goal || 15;
    remainingSeconds = selectedDuration * 60;
    totalSeconds = selectedDuration * 60;

    profileSelector.classList.add('hidden');
    profileSetup.classList.add('hidden');
    mainApp.classList.remove('hidden');

    currentUserEl.textContent = currentUser.name;
    durationBtns.forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.minutes) === selectedDuration));

    updateTimerDisplay();
    updateRingProgress();
    updateStats();
    renderCalendar();
    renderHistory();
    renderProfile();
}

// --- Event Binding ---

function bindEvents() {
    // Profile form
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('userName').value.trim();
        if (!name) return;

        const user = {
            name: name,
            height: $('userHeight').value ? Number($('userHeight').value) : null,
            weight: $('userWeight').value ? Number($('userWeight').value) : null,
            goal: Number($('userGoal').value),
            createdAt: new Date().toISOString()
        };

        const userId = await addUser(user);
        await loginUser(userId);
    });

    newProfileBtn.addEventListener('click', showProfileSetup);
    switchUserBtn.addEventListener('click', async () => {
        const users = await getAllUsers();
        showProfileSelector(users);
    });

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            $('tab' + capitalize(btn.dataset.tab)).classList.add('active');
            if (btn.dataset.tab === 'history') { renderCalendar(); renderHistory(); }
            if (btn.dataset.tab === 'profile') renderProfile();
        });
    });

    // Duration buttons
    durationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isRunning) return;
            durationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDuration = parseInt(btn.dataset.minutes);
            remainingSeconds = selectedDuration * 60;
            totalSeconds = selectedDuration * 60;
            updateTimerDisplay();
            updateRingProgress();
        });
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

    // Calendar navigation
    $('prevMonth').addEventListener('click', () => { viewingMonth.setMonth(viewingMonth.getMonth() - 1); renderCalendar(); });
    $('nextMonth').addEventListener('click', () => { viewingMonth.setMonth(viewingMonth.getMonth() + 1); renderCalendar(); });

    // Profile actions
    $('editProfileBtn').addEventListener('click', editProfile);
    $('exportDataBtn').addEventListener('click', exportData);

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

    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerDisplay();
        updateRingProgress();
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
}

function showStopDialog() {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    timerRing.classList.remove('running');

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

    // Show celebration
    showCelebration(actualMinutes, isPartial);

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

    streakCount.textContent = calculateStreak();
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

function renderCalendar() {
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();
    historyMonth.textContent = viewingMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Get session dates for this month
    const sessionDates = new Set(
        sessions
            .filter(s => { const d = new Date(s.date); return d.getFullYear() === year && d.getMonth() === month; })
            .map(s => new Date(s.date).getDate())
    );

    let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(d => `<div class="cal-header">${d}</div>`).join('');

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const hasSession = sessionDates.has(day);
        const classes = ['cal-day', isToday ? 'today' : '', hasSession ? 'has-session' : ''].filter(Boolean).join(' ');
        html += `<div class="${classes}">${day}</div>`;
    }

    calendarGrid.innerHTML = html;

    // Month/year stats
    const monthSess = sessions.filter(s => { const d = new Date(s.date); return d.getFullYear() === year && d.getMonth() === month; });
    $('monthSessions').textContent = monthSess.length;
    $('monthMinutes').textContent = monthSess.reduce((sum, s) => sum + s.duration, 0);

    const yearSess = sessions.filter(s => new Date(s.date).getFullYear() === year);
    $('yearSessions').textContent = yearSess.length;
    $('yearMinutes').textContent = yearSess.reduce((sum, s) => sum + s.duration, 0);
}

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
    // Simple prompt-based edit (could be a modal later)
    const newName = prompt('Name:', currentUser.name);
    if (newName === null) return;
    const newHeight = prompt('Height (cm):', currentUser.height || '');
    const newWeight = prompt('Weight (kg):', currentUser.weight || '');
    const newGoal = prompt('Daily goal (minutes: 9, 15, 30, or 45):', currentUser.goal || 15);

    currentUser.name = newName || currentUser.name;
    currentUser.height = newHeight ? Number(newHeight) : currentUser.height;
    currentUser.weight = newWeight ? Number(newWeight) : currentUser.weight;
    currentUser.goal = newGoal ? Number(newGoal) : currentUser.goal;

    updateUser(currentUser);
    currentUserEl.textContent = currentUser.name;
    renderProfile();
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

// --- Celebration ---

function showCelebration(minutes, isPartial) {
    const messages = [
        "You showed up. That's what matters!",
        "Another one in the bank!",
        "Consistency beats intensity!",
        "Your future self thanks you!",
        "Small steps, big results!",
        "That's the compound effect!",
        "Discipline > Motivation!"
    ];

    celebrationMsg.textContent = isPartial
        ? `${minutes} minutes still counts!`
        : messages[Math.floor(Math.random() * messages.length)];

    const streak = calculateStreak();
    celebrationStats.textContent = streak > 1
        ? `${streak} day streak! Keep it going!`
        : 'First step done. Come back tomorrow!';

    celebration.classList.remove('hidden');
}

// --- Utilities ---

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

// --- Start ---
init();
