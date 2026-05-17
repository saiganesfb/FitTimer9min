# FitTimer — Multi-User Workout Tracker

A zero-friction Pomodoro-style timer that auto-records your workouts with a real database.

## Why?

Research shows **60 minutes of weight training per week** (9 min/day) delivers maximum health impact. This app removes every excuse by making tracking effortless:

1. Open the app → Pick your profile
2. Pick duration (9 / 15 / 30 / 45 min)
3. Press START
4. Work out
5. Done — session auto-saved to database

## Quick Start

Open `app/index.html` in any browser. That's it.

## Features

- **Multi-user profiles** — family/roommates can share the same app
- Circular countdown timer with visual progress ring
- One-click start — zero manual logging
- **STOP button** with 3 choices: Record partial / Discard / Continue
- Auto-records completed sessions to IndexedDB
- **Calendar history** — month view with green dots on workout days
- Streak tracking (current + longest)
- Yearly statistics
- **Export data** — download JSON backup
- 3-tab interface: Timer | History | Profile
- Keyboard shortcut: Space to start/pause
- Dark theme, mobile-friendly
- No installs, no accounts, no internet needed

## Tech

Pure HTML + CSS + JavaScript. Data stored in browser **IndexedDB** (a real database built into every browser).

| File | Purpose |
|------|---------|
| `app/index.html` | Structure (tabs, dialogs, profile selector) |
| `app/style.css` | Dark theme, animations, calendar grid |
| `app/db.js` | IndexedDB wrapper (users + sessions tables) |
| `app/script.js` | Timer, profiles, history, export |

## Documentation

- `Documentation/01_Learning_and_Concepts.html` — Architecture, analogies, code explanations (open in browser)
- `Documentation/02_Step_by_Step_Guide.html` — How to recreate from scratch on any machine (open in browser)

## Database

Your data lives in IndexedDB (browser's built-in database):

| Table | Fields | Purpose |
|-------|--------|---------|
| `users` | id, name, height, weight, goal, createdAt | User profiles |
| `sessions` | id, userId, date, duration, targetDuration, completed | Workout records |
