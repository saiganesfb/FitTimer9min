// ============================================
// FitTimer — Gamification Engine
// ============================================

// --- XP & LEVELS ---

const LEVELS = [
    { level: 1, name: 'Couch Potato', xp: 0, emoji: '🥔' },
    { level: 2, name: 'Beginner', xp: 50, emoji: '🌱' },
    { level: 3, name: 'Getting Started', xp: 120, emoji: '🚶' },
    { level: 4, name: 'Warming Up', xp: 200, emoji: '🏃' },
    { level: 5, name: 'On Track', xp: 300, emoji: '⚡' },
    { level: 6, name: 'Consistent', xp: 450, emoji: '💪' },
    { level: 7, name: 'Dedicated', xp: 650, emoji: '🔥' },
    { level: 8, name: 'Strong', xp: 900, emoji: '🦾' },
    { level: 9, name: 'Unstoppable', xp: 1200, emoji: '⭐' },
    { level: 10, name: 'Beast Mode', xp: 1600, emoji: '👑' }
];

function calculateXP(sessions) {
    let xp = 0;
    sessions.forEach(s => {
        // Base XP: 1 per minute
        xp += s.duration;
        // Completion bonus: +50% if full session
        if (s.completed) xp += Math.floor(s.duration * 0.5);
    });
    // Streak bonus: +5 per current streak day
    const streak = calculateStreak();
    xp += streak * 5;
    return xp;
}

function getLevel(xp) {
    let current = LEVELS[0];
    for (const lvl of LEVELS) {
        if (xp >= lvl.xp) current = lvl;
        else break;
    }
    return current;
}

function getNextLevel(xp) {
    for (const lvl of LEVELS) {
        if (xp < lvl.xp) return lvl;
    }
    return null; // Max level
}

function getLevelProgress(xp) {
    const current = getLevel(xp);
    const next = getNextLevel(xp);
    if (!next) return 100; // Max level
    const range = next.xp - current.xp;
    const progress = xp - current.xp;
    return Math.min(100, Math.floor((progress / range) * 100));
}

// --- ACHIEVEMENTS ---

const ACHIEVEMENTS = [
    { id: 'first_blood', name: 'First Blood', desc: 'Complete your first session', emoji: '🎯', check: (s) => s.length >= 1 },
    { id: 'on_fire', name: 'On Fire', desc: '3-day streak', emoji: '🔥', check: (s, streak) => streak >= 3 },
    { id: 'week_warrior', name: 'Week Warrior', desc: '7-day streak', emoji: '⚡', check: (s, streak) => streak >= 7 },
    { id: 'fortnight', name: 'Fortnight Fighter', desc: '14-day streak', emoji: '💪', check: (s, streak) => streak >= 14 },
    { id: 'monthly', name: 'Monthly Monster', desc: '30-day streak', emoji: '🏆', check: (s, streak) => streak >= 30 },
    { id: 'century', name: 'Century', desc: '100 total sessions', emoji: '🌟', check: (s) => s.length >= 100 },
    { id: 'half_century', name: 'Half Century', desc: '50 total sessions', emoji: '🎖️', check: (s) => s.length >= 50 },
    { id: 'ten_sessions', name: 'Double Digits', desc: '10 total sessions', emoji: '🔟', check: (s) => s.length >= 10 },
    { id: 'night_owl', name: 'Night Owl', desc: 'Work out after 9 PM', emoji: '🦉', check: (s) => s.some(x => new Date(x.date).getHours() >= 21) },
    { id: 'early_bird', name: 'Early Bird', desc: 'Work out before 7 AM', emoji: '🌅', check: (s) => s.some(x => new Date(x.date).getHours() < 7) },
    { id: 'marathon', name: 'Marathon', desc: 'Complete a 45-min session', emoji: '⏰', check: (s) => s.some(x => x.duration >= 45 && x.completed) },
    { id: 'variety', name: 'Variety Pack', desc: 'Use all 4 durations', emoji: '🎪', check: (s) => { const d = new Set(s.map(x => x.targetDuration)); return d.has(9) && d.has(15) && d.has(30) && d.has(45); } },
    { id: 'full_week', name: 'Perfect Week', desc: 'Work out all 7 days in one week', emoji: '📅', check: (s) => hasFullWeek(s) },
    { id: 'hour_club', name: 'Hour Club', desc: '60+ minutes in one week', emoji: '💯', check: (s) => hasHourWeek(s) },
    { id: 'quick_draw', name: 'Quick Draw', desc: '3 sessions in one day', emoji: '🤠', check: (s) => hasTripleDay(s) },
];

function hasFullWeek(sessions) {
    const byWeek = {};
    sessions.forEach(s => {
        const d = new Date(s.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toDateString();
        if (!byWeek[key]) byWeek[key] = new Set();
        byWeek[key].add(new Date(s.date).getDay());
    });
    return Object.values(byWeek).some(days => days.size === 7);
}

function hasHourWeek(sessions) {
    const byWeek = {};
    sessions.forEach(s => {
        const d = new Date(s.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toDateString();
        byWeek[key] = (byWeek[key] || 0) + s.duration;
    });
    return Object.values(byWeek).some(min => min >= 60);
}

function hasTripleDay(sessions) {
    const byDay = {};
    sessions.forEach(s => {
        const key = new Date(s.date).toDateString();
        byDay[key] = (byDay[key] || 0) + 1;
    });
    return Object.values(byDay).some(count => count >= 3);
}

function getUnlockedAchievements(sessions) {
    const streak = calculateStreak();
    return ACHIEVEMENTS.filter(a => a.check(sessions, streak));
}

function getNewAchievements(sessions, previouslyUnlocked) {
    const current = getUnlockedAchievements(sessions);
    return current.filter(a => !previouslyUnlocked.includes(a.id));
}

// --- DAILY CHALLENGE ---

const DAILY_CHALLENGES = [
    "💡 Between sets: 10 pushups",
    "💡 Hold a plank for 30 seconds mid-session",
    "💡 Try working out without any music today",
    "💡 Do 20 jumping jacks before starting",
    "💡 Focus on breathing: 4 in, 4 hold, 4 out",
    "💡 Try a new exercise you've never done",
    "💡 Do 15 squats between every 5-minute mark",
    "💡 Keep your phone face-down during workout",
    "💡 Stretch for 2 minutes after you finish",
    "💡 Add 5 burpees at the halfway point",
    "💡 Try to beat yesterday's intensity",
    "💡 Workout with your eyes closed for 30 sec",
    "💡 Do 10 lunges for every pause you take",
    "💡 Smile while you exercise (it actually helps!)",
    "💡 Try a 1-minute wall sit at the end",
    "💡 Count your heartbeats after the session",
    "💡 Tell someone about your workout today",
    "💡 Dance for 30 seconds to celebrate finishing",
    "💡 Hold your water bottle as a weight",
    "💡 Take a before & after selfie 📸",
    "💡 Do the entire workout standing today",
    "💡 Challenge: Zero rest between exercises",
    "💡 Pick your least favorite exercise — do it first",
    "💡 Post-workout: Write one thing you're grateful for",
    "💡 Time yourself: How many pushups in 30 sec?",
    "💡 Bonus round: Add 1 extra minute today",
    "💡 Mindfulness: Name 5 things you see mid-workout",
    "💡 Try a slower pace — focus on form today",
    "💡 Reward: Pick a healthy snack post-workout",
    "💡 End goal: 1% better than yesterday"
];

function getDailyChallenge() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const index = seed % DAILY_CHALLENGES.length;
    return DAILY_CHALLENGES[index];
}

// --- MOTIVATIONAL QUOTES (shown during timer) ---

const WORKOUT_QUOTES = [
    "The body achieves what the mind believes.",
    "You're lapping everyone on the couch.",
    "Sweat is fat crying.",
    "9 minutes today > 0 minutes today.",
    "Discipline is choosing between what you want NOW and what you want MOST.",
    "You don't have to be extreme, just consistent.",
    "The hardest part is showing up. You did that.",
    "Fall in love with the process.",
    "Your only competition is yesterday's you.",
    "This is your time. Own it.",
    "Small daily improvements = stunning results.",
    "You're building a habit that will change your life.",
    "Motion beats meditation. Keep moving.",
    "The pain of discipline weighs ounces. Regret weighs tons.",
    "Every rep counts. Every second counts.",
    "You're not just working out. You're upgrading yourself.",
    "Imagine your future self thanking you right now.",
    "Winners show up. That's the secret.",
    "Comfort zone is a beautiful place, but nothing grows there."
];

let quoteInterval = null;
let currentQuoteIndex = 0;

function startQuoteCarousel() {
    currentQuoteIndex = Math.floor(Math.random() * WORKOUT_QUOTES.length);
    updateQuote();
    quoteInterval = setInterval(() => {
        currentQuoteIndex = (currentQuoteIndex + 1) % WORKOUT_QUOTES.length;
        updateQuote();
    }, 12000); // Change every 12 seconds
}

function stopQuoteCarousel() {
    if (quoteInterval) clearInterval(quoteInterval);
    quoteInterval = null;
    const el = document.getElementById('quoteCarousel');
    if (el) el.classList.add('hidden');
}

function updateQuote() {
    const el = document.getElementById('quoteCarousel');
    if (!el) return;
    el.classList.remove('hidden');
    el.style.opacity = '0';
    setTimeout(() => {
        el.textContent = `"${WORKOUT_QUOTES[currentQuoteIndex]}"`;
        el.style.opacity = '1';
    }, 300);
}

// --- SOUND EFFECTS (Web Audio API) ---

let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playTick() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
}

function playClick() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.03);
    } catch (e) {}
}

function playWaterDrop() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}

function playStartTimer() {
    try {
        const ctx = getAudioContext();
        // Two ascending beeps like a countdown go signal
        [440, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
            osc.start(ctx.currentTime + i * 0.12);
            osc.stop(ctx.currentTime + i * 0.12 + 0.25);
        });
    } catch (e) {}
}

function playCountdown() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1000;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
}

function playHalfway() {
    try {
        const ctx = getAudioContext();
        // Gentle two-tone nudge (lower volume, non-intrusive)
        [523, 659].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
    } catch (e) {}
}

function playLogSaved() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 700;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
}

function playComplete() {
    try {
        const ctx = getAudioContext();
        // Triumphant 3-note chord
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.8);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.8);
        });
    } catch (e) {}
}

function playLevelUp() {
    try {
        const ctx = getAudioContext();
        // Rising scale
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
            osc.start(ctx.currentTime + i * 0.12);
            osc.stop(ctx.currentTime + i * 0.12 + 0.4);
        });
    } catch (e) {}
}

function playAchievement() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.2);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
}

// --- HAPTICS (Vibration API) ---

function vibrateShort() {
    if (navigator.vibrate) navigator.vibrate(30);
}

function vibrateDone() {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
}

// --- WEEKLY GOAL RING ---

function getWeeklyProgress(sessions, goalMinPerDay) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekSessions = sessions.filter(s => new Date(s.date) >= weekStart);
    const totalMin = weekSessions.reduce((sum, s) => sum + s.duration, 0);
    const weeklyTarget = goalMinPerDay * 7;
    const daysWorkedOut = new Set(weekSessions.map(s => new Date(s.date).toDateString())).size;

    return { totalMin, weeklyTarget, daysWorkedOut, percent: Math.min(100, Math.round((totalMin / weeklyTarget) * 100)) };
}

// --- CHARACTER SYSTEM ---

function getCharacterSVG(level) {
    // Returns SVG string for the character at given level
    const colors = {
        skin: '#ffd4a3',
        outline: '#333',
    };

    if (level <= 2) {
        // Skinny stick figure
        return `<svg viewBox="0 0 100 160" class="character-svg">
            <circle cx="50" cy="25" r="18" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <text x="50" y="30" text-anchor="middle" font-size="14">😴</text>
            <line x1="50" y1="43" x2="50" y2="100" stroke="${colors.outline}" stroke-width="3" stroke-linecap="round"/>
            <line x1="50" y1="60" x2="30" y2="80" stroke="${colors.outline}" stroke-width="3" stroke-linecap="round"/>
            <line x1="50" y1="60" x2="70" y2="80" stroke="${colors.outline}" stroke-width="3" stroke-linecap="round"/>
            <line x1="50" y1="100" x2="35" y2="140" stroke="${colors.outline}" stroke-width="3" stroke-linecap="round"/>
            <line x1="50" y1="100" x2="65" y2="140" stroke="${colors.outline}" stroke-width="3" stroke-linecap="round"/>
        </svg>`;
    } else if (level <= 4) {
        // Slightly built
        return `<svg viewBox="0 0 100 160" class="character-svg">
            <circle cx="50" cy="25" r="18" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <text x="50" y="30" text-anchor="middle" font-size="14">🙂</text>
            <rect x="40" y="43" width="20" height="50" rx="8" fill="#6c63ff" stroke="${colors.outline}" stroke-width="2"/>
            <line x1="40" y1="55" x2="25" y2="80" stroke="${colors.outline}" stroke-width="4" stroke-linecap="round"/>
            <line x1="60" y1="55" x2="75" y2="80" stroke="${colors.outline}" stroke-width="4" stroke-linecap="round"/>
            <line x1="45" y1="93" x2="38" y2="140" stroke="${colors.outline}" stroke-width="4" stroke-linecap="round"/>
            <line x1="55" y1="93" x2="62" y2="140" stroke="${colors.outline}" stroke-width="4" stroke-linecap="round"/>
        </svg>`;
    } else if (level <= 6) {
        // Athletic build
        return `<svg viewBox="0 0 100 160" class="character-svg">
            <circle cx="50" cy="25" r="18" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <text x="50" y="30" text-anchor="middle" font-size="14">😤</text>
            <path d="M 35 43 Q 50 40 65 43 L 68 95 Q 50 98 32 95 Z" fill="#4ecdc4" stroke="${colors.outline}" stroke-width="2"/>
            <line x1="35" y1="50" x2="18" y2="75" stroke="${colors.outline}" stroke-width="6" stroke-linecap="round"/>
            <line x1="65" y1="50" x2="82" y2="75" stroke="${colors.outline}" stroke-width="6" stroke-linecap="round"/>
            <line x1="42" y1="95" x2="35" y2="140" stroke="${colors.outline}" stroke-width="6" stroke-linecap="round"/>
            <line x1="58" y1="95" x2="65" y2="140" stroke="${colors.outline}" stroke-width="6" stroke-linecap="round"/>
            <circle cx="18" cy="75" r="5" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="1"/>
            <circle cx="82" cy="75" r="5" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="1"/>
        </svg>`;
    } else if (level <= 8) {
        // Muscular
        return `<svg viewBox="0 0 100 160" class="character-svg">
            <circle cx="50" cy="22" r="18" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <text x="50" y="27" text-anchor="middle" font-size="14">💪</text>
            <path d="M 30 40 Q 50 36 70 40 L 72 95 Q 50 100 28 95 Z" fill="#ff6584" stroke="${colors.outline}" stroke-width="2"/>
            <path d="M 30 45 Q 22 50 15 65 Q 12 75 18 80" stroke="${colors.outline}" stroke-width="8" stroke-linecap="round" fill="none"/>
            <path d="M 70 45 Q 78 50 85 65 Q 88 75 82 80" stroke="${colors.outline}" stroke-width="8" stroke-linecap="round" fill="none"/>
            <circle cx="15" cy="80" r="7" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <circle cx="85" cy="80" r="7" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <line x1="40" y1="95" x2="32" y2="140" stroke="${colors.outline}" stroke-width="8" stroke-linecap="round"/>
            <line x1="60" y1="95" x2="68" y2="140" stroke="${colors.outline}" stroke-width="8" stroke-linecap="round"/>
        </svg>`;
    } else {
        // BEAST MODE — superhero
        return `<svg viewBox="0 0 100 160" class="character-svg">
            <defs>
                <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#6c63ff"/>
                    <stop offset="100%" style="stop-color:#ff6584"/>
                </linearGradient>
            </defs>
            <circle cx="50" cy="20" r="18" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <text x="50" y="25" text-anchor="middle" font-size="14">👑</text>
            <path d="M 25 38 Q 50 32 75 38 L 78 98 Q 50 104 22 98 Z" fill="url(#heroGrad)" stroke="${colors.outline}" stroke-width="2"/>
            <path d="M 25 42 Q 15 48 8 62 Q 5 72 12 78" stroke="${colors.outline}" stroke-width="10" stroke-linecap="round" fill="none"/>
            <path d="M 75 42 Q 85 48 92 62 Q 95 72 88 78" stroke="${colors.outline}" stroke-width="10" stroke-linecap="round" fill="none"/>
            <circle cx="10" cy="78" r="8" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <circle cx="90" cy="78" r="8" fill="${colors.skin}" stroke="${colors.outline}" stroke-width="2"/>
            <line x1="38" y1="98" x2="28" y2="145" stroke="${colors.outline}" stroke-width="10" stroke-linecap="round"/>
            <line x1="62" y1="98" x2="72" y2="145" stroke="${colors.outline}" stroke-width="10" stroke-linecap="round"/>
            <polygon points="50,38 45,48 55,48" fill="gold" stroke="${colors.outline}" stroke-width="1"/>
        </svg>`;
    }
}

// --- STREAK FIRE (returns HTML for flame animation) ---

function getStreakFlame(streak) {
    if (streak < 2) return '';
    const size = Math.min(streak, 10); // cap visual at 10
    const intensity = size <= 3 ? 'small' : size <= 6 ? 'medium' : 'large';
    return `<span class="streak-flame streak-flame-${intensity}" title="${streak} day streak!">🔥</span>`;
}
