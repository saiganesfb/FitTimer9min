# FitnessTracker — Step-by-Step Recreation Guide

## 📅 Created: May 17, 2026

Use this guide to recreate the project from scratch on any computer (no Copilot needed).

---

## Prerequisites

- Any modern web browser (Chrome, Edge, Firefox)
- A text editor (VS Code, Notepad++, or even Notepad)
- That's it! No installs, no terminal commands.

---

## Step 1: Create the Folder Structure

Create these folders and files:

```
FitnessTracker/
├── app/
│   ├── index.html      ← Main app (open this in browser)
│   ├── style.css       ← All styling
│   └── script.js       ← All logic
├── Documentation/
│   ├── 01_Learning_and_Concepts.md
│   └── 02_Step_by_Step_Guide.md (this file)
└── README.md
```

---

## Step 2: Create `index.html`

This is the skeleton of your app. Open a new file, paste this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏋️ FitTimer — Workout Tracker</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="app-container">
        <!-- Header -->
        <header class="app-header">
            <h1>🏋️ FitTimer</h1>
            <p class="tagline">Just press start. We'll handle the rest.</p>
        </header>

        <!-- Timer Section -->
        <section class="timer-section">
            <!-- Duration selector -->
            <div class="duration-selector">
                <button class="duration-btn" data-minutes="9">9 min</button>
                <button class="duration-btn active" data-minutes="15">15 min</button>
                <button class="duration-btn" data-minutes="30">30 min</button>
                <button class="duration-btn" data-minutes="45">45 min</button>
            </div>

            <!-- Circular Timer -->
            <div class="timer-ring-container">
                <div class="timer-ring">
                    <div class="timer-inner">
                        <span class="timer-display">15:00</span>
                        <span class="timer-label">READY</span>
                    </div>
                </div>
            </div>

            <!-- Controls -->
            <div class="controls">
                <button id="startBtn" class="control-btn start-btn">▶ START</button>
                <button id="pauseBtn" class="control-btn pause-btn hidden">⏸ PAUSE</button>
                <button id="resetBtn" class="control-btn reset-btn hidden">↺ RESET</button>
            </div>
        </section>

        <!-- Stats Section -->
        <section class="stats-section">
            <div class="stat-card">
                <span class="stat-value" id="streakCount">0</span>
                <span class="stat-label">Day Streak 🔥</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" id="weekCount">0</span>
                <span class="stat-label">This Week</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" id="totalCount">0</span>
                <span class="stat-label">Total Sessions</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" id="totalMinutes">0</span>
                <span class="stat-label">Total Minutes</span>
            </div>
        </section>

        <!-- History Section -->
        <section class="history-section">
            <h2>📅 Recent Sessions</h2>
            <div id="historyList" class="history-list">
                <!-- Filled by JavaScript -->
            </div>
        </section>
    </div>

    <!-- Celebration Overlay -->
    <div id="celebration" class="celebration hidden">
        <div class="celebration-content">
            <h2>🎉 WORKOUT DONE!</h2>
            <p class="celebration-message"></p>
            <button id="celebrationClose" class="control-btn">NICE! →</button>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
```

**What each section does:**
- `<header>` — App name and tagline
- `.timer-section` — The main timer with duration buttons and start/pause/reset
- `.stats-section` — Shows streak, weekly count, totals
- `.history-section` — List of recent completed sessions
- `#celebration` — Popup that shows when you complete a workout

---

## Step 3: Create `style.css`

This makes everything look good. Key techniques used:
- **CSS Variables** — Define colors once, reuse everywhere
- **Flexbox** — Layout alignment
- **conic-gradient** — The circular progress ring
- **Transitions** — Smooth button hover effects
- **@keyframes** — Celebration animation

The full CSS is in the `app/style.css` file. Key sections:
1. CSS variables (`:root`) — Color palette
2. Layout (`.app-container`) — Centered column
3. Timer ring (`.timer-ring`) — Circular progress using conic-gradient
4. Buttons — Duration selector + control buttons
5. Stats cards — Grid of 4 stat boxes
6. History list — Scrollable session log
7. Animations — Pulse, celebrate, confetti

---

## Step 4: Create `script.js`

This is the brain. Key functions:

| Function | Purpose |
|----------|---------|
| `startTimer()` | Starts the countdown |
| `pauseTimer()` | Pauses without losing progress |
| `resetTimer()` | Resets to selected duration |
| `recordSession()` | Saves completed session to localStorage |
| `calculateStreak()` | Counts consecutive days |
| `updateStats()` | Refreshes the stat cards |
| `renderHistory()` | Shows recent sessions |
| `celebrate()` | Shows the completion popup |

The full logic is in `app/script.js`.

---

## Step 5: Open and Use

1. Double-click `app/index.html` (opens in your default browser)
2. Select duration (9 / 15 / 30 / 45 min)
3. Click **START**
4. Work out!
5. When timer finishes → celebration shows → session saved automatically

---

## Step 6: Check Your Data

Open browser Developer Tools (F12) → Application tab → Local Storage → look for:
- `fitTimerSessions` — Array of all your workouts
- `fitTimerSettings` — Your preferences

---

## Customization Ideas

### Change colors
Edit the `:root` variables in `style.css`:
```css
:root {
    --primary: #your-color;
    --accent: #your-accent;
}
```

### Add more durations
Add a button in `index.html`:
```html
<button class="duration-btn" data-minutes="60">60 min</button>
```

### Add workout types
Modify `recordSession()` in `script.js` to include a type field.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Timer doesn't start | Check browser console (F12) for errors |
| Data disappeared | Did you clear browser data? localStorage gets wiped |
| Looks broken on phone | Make sure `<meta name="viewport">` is in the HTML head |

---

## How to Move to Another Computer

1. Copy the entire `FitnessTracker/app/` folder
2. Open `index.html` in a browser
3. Done! (Previous workout data stays in the old browser's localStorage)

To transfer data:
1. On old computer: Open console (F12), run: `copy(localStorage.getItem('fitTimerSessions'))`
2. On new computer: Open console, run: `localStorage.setItem('fitTimerSessions', '<paste here>')`

---

*This guide pairs with `01_Learning_and_Concepts.md` which explains the WHY behind each decision.*
