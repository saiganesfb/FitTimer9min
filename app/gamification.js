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

// Exercise tips — PPL-aware, with context/reason
const EXERCISE_TIPS = [
    "🏋️ Squeeze at the top of every rep — holds peak contraction, recruits more fibers",
    "🏋️ Slow the eccentric (lowering) to 3 sec — more time under tension = more growth",
    "🏋️ Retract shoulder blades on all presses — protects rotator cuff, better chest activation",
    "🏋️ Breathe out on exertion — stabilizes core, prevents blood pressure spikes",
    "🏋️ Brace your core like you're about to get punched — protects spine on every compound lift",
    "🏋️ Mind-muscle connection: look at the working muscle — studies show 12% more activation",
    "🏋️ Full ROM > heavier weight — partial reps build partial muscles",
    "🏋️ Don't lock out joints at the top — keeps tension on muscle, saves joint cartilage",
    "🏋️ Control the negative — that's where most muscle damage (growth stimulus) happens",
    "🏋️ 2 warm-up sets before working weight — primes the joint, prevents cold-start injuries",
    "🏋️ Stretch the muscle you just trained between sets — fascia stretch = room to grow",
    "🏋️ Push day: keep wrists neutral on presses — bent wrists leak force and cause pain",
    "🏋️ Leg day: drive through heels on squats — shifts load from knees to glutes/hams",
    "🏋️ Pull day: initiate rows with elbows, not hands — ensures back does the work, not biceps",
    "🏋️ Deadlifts: chest up, chin tucked — neutral spine is non-negotiable for heavy pulls",
    "🏋️ Rest 90-120s between sets for hypertrophy — shorter = not recovered, longer = cooling off",
    "🏋️ Log your weights today — can't progressively overload if you don't know last week's numbers",
    "🏋️ Record one set on your phone — you'll catch form issues you can't feel",
    "🏋️ Push day: try drop sets on last exercise — pushes past failure when you're already fatigued",
    "🏋️ If a joint hurts (not muscle burn), STOP — pain ≠ gain, that's an injury warning",
    "🏋️ Grip the bar hard — neural irradiation makes the whole chain stronger",
    "🏋️ Keep neck neutral on every lift — craning forward compresses cervical discs",
    "🏋️ Try a 1-sec pause at the bottom — eliminates momentum, makes the muscle do all the work",
    "🏋️ 2-min stretch after your session — reduces next-day soreness by 20-30%",
    "🏋️ Sip water between sets — even 2% dehydration drops strength output noticeably",
    "🏋️ Pull day: try single-arm rows — fixes left-right imbalances your barbell hides",
    "🏋️ Leg day: pause squats once a month — builds confidence and strength out of the hole",
    "🏋️ Push day: incline before flat — prioritizes upper chest while you're freshest",
    "🏋️ Tempo matters: 2 sec up, 1 sec hold, 3 sec down — that's a quality rep",
    "🏋️ Protein within 1-2 hours post-workout — the anabolic window is real, just wider than bro-science says"
];

// Habit tips — Atomic Habits principles applied to fitness
const HABIT_TIPS = [
    "🧠 You don't rise to your goals — you fall to your systems",
    "🧠 \"I GET to work out\" — not everyone physically can. Be grateful",
    "🧠 Reduce friction: lay out gym clothes tonight for tomorrow",
    "🧠 Just put on your shoes. Momentum creates itself after that",
    "🧠 Two-Minute Rule: Can't do full workout? Just do 2 minutes",
    "🧠 Never miss twice. One bad day is fine. Two breaks the chain",
    "🧠 Habit stacking: After I [morning coffee], I will [stretch]",
    "🧠 Frequency > Duration. 15 min daily beats 2 hrs once a week",
    "🧠 Environment design: keep your mat visible, gym bag by the door",
    "🧠 Temptation bundle: favorite podcast ONLY during workouts",
    "🧠 Don't solve Step 2 before Step 1. Just GO. Solutions appear",
    "🧠 Track only 2-3 habits max. Tracking 20 is exhausting",
    "🧠 Identity shift: \"I am someone who doesn't miss workouts\"",
    "🧠 The goal isn't the workout — it's becoming the TYPE of person who trains",
    "🧠 Delayed gratification: results take months. Trust the process",
    "🧠 Your brain wants instant reward — that's what this streak counter is for",
    "🧠 Make bad habits hard: uninstall, log out, add friction",
    "🧠 Accountability: tell someone your plan today — social pressure works",
    "🧠 1% better daily = 37x better in one year. Small wins compound",
    "🧠 Don't wait for motivation. Action creates motivation, not the reverse",
    "🧠 Implementation intention: I will [exercise] at [time] in [place]",
    "🧠 Experiment → observe → fix → lock in. Don't theorize forever",
    "🧠 Reward yourself ONLY after the habit. Movie after gym, not before",
    "🧠 The chain of ticks on your tracker — you won't want to break it",
    "🧠 Struggling today? Use the diagnostic: Is it hard? Forgotten? Unrewarding?",
    "🧠 Join the gym CLOSEST to you. Distance is the #1 friction killer",
    "🧠 Knowledge without application = useless. Apply one thing TODAY",
    "🧠 Commitment device: sign up for a class — now you HAVE to show up",
    "🧠 Separate pleasures from bad habits. Don't pair Netflix + junk food",
    "🧠 Visualize the version of you 6 months from now. That person is built daily"
];

function getDailyChallenge() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const exIdx = seed % EXERCISE_TIPS.length;
    const habIdx = (seed * 7 + 13) % HABIT_TIPS.length; // different offset so they don't correlate
    return EXERCISE_TIPS[exIdx] + '\n' + HABIT_TIPS[habIdx];
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

function isSoundEnabled() {
    return localStorage.getItem('fitTimer_soundOff') !== 'true';
}

function getAudioContext() {
    if (!isSoundEnabled()) return null;
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

const waterDropletAudio = new Audio('sounds/water-droplet.mp3');
waterDropletAudio.volume = 0.6;
const waterSplashAudio = new Audio('sounds/water-splash.mp3');
waterSplashAudio.volume = 0.7;

function playWaterDrop(isLastGlass) {
    try {
        if (isLastGlass) {
            waterSplashAudio.currentTime = 0;
            waterSplashAudio.play();
            setTimeout(() => { waterSplashAudio.pause(); }, 1200);
        } else {
            waterDropletAudio.currentTime = 0;
            waterDropletAudio.play();
            setTimeout(() => { waterDropletAudio.pause(); }, 600);
        }
    } catch (e) {}
}

function playStartTimer() {
    try {
        const ctx = getAudioContext();
        // Beep-Beep-GO: two 440Hz beeps + one high 880Hz
        const beeps = [{f:440, t:0, d:0.1}, {f:440, t:0.15, d:0.1}, {f:880, t:0.3, d:0.2}];
        beeps.forEach(({f, t, d}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + d);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + d);
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
        // Ascending Chime — C→E→G→C high (triumphant staircase)
        const notes = [{f:523,t:0,d:0.15},{f:659,t:0.15,d:0.15},{f:784,t:0.30,d:0.15},{f:1047,t:0.45,d:0.3}];
        notes.forEach(({f, t, d}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + d);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + d);
        });
    } catch (e) {}
}

function playLevelUp() {
    try {
        const ctx = getAudioContext();
        // 8-Bit Retro Scale — rapid ascending with square wave (NES style)
        const steps = [523, 587, 659, 698, 784, 880, 988, 1047];
        steps.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'square';
            const t = i * 0.06;
            gain.gain.setValueAtTime(0.12, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + 0.07);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + 0.07);
        });
    } catch (e) {}
}

function playAchievement() {
    try {
        const ctx = getAudioContext();
        // Mario Stage Clear — fast ascending run + triumphant ending (retro square wave)
        const melody = [
            {f:523,t:0,d:0.08},{f:659,t:0.08,d:0.08},{f:784,t:0.16,d:0.08},{f:1047,t:0.24,d:0.08},
            {f:1319,t:0.32,d:0.08},{f:1568,t:0.40,d:0.08},{f:2093,t:0.48,d:0.25},
            {f:1568,t:0.73,d:0.07},{f:2093,t:0.80,d:0.3}
        ];
        melody.forEach(({f, t, d}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.12, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + t + d * 0.7);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + d);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + d);
        });
        // Add triangle bass layer for warmth
        const bass = [{f:262,t:0.48,d:0.25},{f:262,t:0.80,d:0.3}];
        bass.forEach(({f, t, d}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.06, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + d);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + d);
        });
    } catch (e) {}
}

function playWorkoutSelect() {
    try {
        const ctx = getAudioContext();
        // Punchy Thud — low-frequency impact (gym weight drop)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.03);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}

function playFoodSelect() {
    try {
        const ctx = getAudioContext();
        // Warm two-note chord (A4 + C#5)
        [{f:440,t:0},{f:554,t:0}].forEach(({f, t}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.12, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + 0.2);
        });
    } catch (e) {}
}

function playSleepSelect() {
    try {
        const ctx = getAudioContext();
        // Soft low hum (280Hz + 350Hz)
        [{f:280,t:0},{f:350,t:0}].forEach(({f, t}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        });
    } catch (e) {}
}

function playHealthTick() {
    try {
        const ctx = getAudioContext();
        // Quick high tick (1200Hz, 60ms)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.06);
    } catch (e) {}
}

function playXPGain() {
    try {
        const ctx = getAudioContext();
        // 3-Note Sparkle — C6→E6→G6 (quick ascending)
        const notes = [{f:1047,t:0,d:0.08},{f:1319,t:0.06,d:0.08},{f:1568,t:0.12,d:0.1}];
        notes.forEach(({f, t, d}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.12, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + d);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + d);
        });
    } catch (e) {}
}

function playStreakChime() {
    try {
        const ctx = getAudioContext();
        // Sparkly Ascending — quick high-register notes
        const notes = [{f:1568,t:0,d:0.08},{f:1760,t:0.06,d:0.08},{f:2093,t:0.12,d:0.08},{f:2637,t:0.18,d:0.12}];
        notes.forEach(({f, t, d}) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = f;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.1, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + t + d);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + d);
        });
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
