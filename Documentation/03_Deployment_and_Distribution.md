# FitTimer — Deployment & Distribution Guide

## 📅 Created: May 19, 2026

---

## 1. How We Deployed (GitHub Pages)

### What is GitHub Pages?
Free hosting by GitHub — push code, it becomes a live website. Perfect for static sites (HTML/CSS/JS).

### Setup Steps We Did:

1. **Created GitHub repo**: `https://github.com/saiganesfb/FitTimer9min`
2. **Added deployment workflow**: `.github/workflows/deploy.yml`
3. **Enabled Pages**: Settings → Pages → Source: GitHub Actions
4. **Live URL**: `https://saiganesfb.github.io/FitTimer9min/`

### The Workflow File (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [master]  # Auto-deploys on every push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './app'           # Only deploys the app/ folder
      - uses: actions/deploy-pages@v4
```

**Key insight**: Only the `app/` folder gets deployed (not Documentation/, bundle.py, etc.)

---

## 2. How We Built the Android APK

### Why Not Local Build?
- Android SDK requires downloading from Google's servers
- LSEG corporate network blocks those downloads (SSL/firewall)
- Solution: **Build in the cloud** using GitHub Actions

### The APK Build Workflow (`.github/workflows/build-apk.yml`):

**Technology**: Capacitor (by Ionic) — wraps web apps in a native Android WebView shell.

**What it does**:
1. Checks out your code on a cloud Ubuntu machine
2. Installs Node.js 20 + JDK 21 + Android SDK
3. Initializes Capacitor pointing at `app/` as the web source
4. Builds a debug APK with Gradle
5. Uploads the APK as a downloadable artifact

**How to trigger**:
1. Go to: `https://github.com/saiganesfb/FitTimer9min/actions`
2. Click "Build Android APK" → "Run workflow" → "Run workflow"
3. Wait ~2 minutes
4. Click the completed run → scroll to Artifacts → download `FitTimer-debug`
5. Extract ZIP → get `app-debug.apk` (~4 MB)

### Issues We Hit During Build:

| Build # | Error | Fix |
|---------|-------|-----|
| #1 | Capacitor couldn't find web assets | Moved `npx cap init` to project root with `--web-dir app` |
| #2 | `error: invalid source release: 21` | Changed JDK from 17 → 21 |
| #3 | Kotlin stdlib duplicate classes | Added `resolutionStrategy` forcing kotlin-stdlib 1.9.24 |
| #4 | ✅ Success! | — |

### Installing the APK on Phone:
1. Transfer APK to phone (email, Drive, USB)
2. Tap the file → "Install" (allow "unknown sources" if prompted)
3. App appears in app drawer with your FitTimer icon

### PWA vs APK Comparison:

| Feature | PWA (Chrome install) | APK (Capacitor) |
|---------|---------------------|-----------------|
| Install method | Chrome → "Add to Home Screen" | Download & sideload APK |
| Needs internet first time | Yes (then cached) | No — files bundled inside |
| App size | ~0 (uses browser) | ~4 MB |
| Updates | Automatic (on refresh) | Rebuild & reinstall |
| Play Store ready | No | Yes (with signing) |

---

## 3. Service Worker & Caching

### What is a Service Worker?
A background script that intercepts network requests. Enables offline mode.

### How ours works (`app/service-worker.js`):
```javascript
const CACHE_NAME = 'fittimer-v22';  // Bump this to force refresh
const ASSETS = ['./index.html', './style.css', './script.js', ...];

// On install: cache all assets
self.addEventListener('install', e => {
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
});

// On activate: delete old caches
self.addEventListener('activate', e => {
    caches.keys().then(keys =>
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )
});
```

### Cache Busting:
When you push new code, bump `CACHE_NAME` (e.g., v22 → v23). On next visit:
1. Browser detects new service-worker.js
2. New SW installs, caches fresh assets
3. Old cache (v21) gets deleted
4. User sees latest version

### Troubleshooting Stale Cache on Mobile:
- Chrome → Settings → Site settings → find the site → "Clear & reset"
- Or: DevTools → Application → Service Workers → Unregister

---

## 4. The Bundle Script (`bundle.py`)

Creates a single self-contained HTML file with everything inlined (for sharing via email where .js files are blocked):

```python
# Reads: app/index.html, app/style.css, app/script.js, app/gamification.js
# Inlines: CSS as <style>, JS as <script>, audio as base64 data URIs
# Outputs: FitTimer.html (one file, works offline)
```

Run: `py -3 bundle.py` → produces `FitTimer.html`

---

## 5. Project Structure (Final)

```
FitnessTracker/
├── .github/workflows/
│   ├── deploy.yml          ← Auto-deploy to GitHub Pages on push
│   └── build-apk.yml       ← Manual trigger: build Android APK
├── app/
│   ├── index.html          ← Main app (1145+ lines)
│   ├── style.css           ← All styling (2200+ lines)
│   ├── script.js           ← Core logic (2500+ lines)
│   ├── gamification.js     ← Sounds, tips, XP system (580+ lines)
│   ├── service-worker.js   ← Offline caching
│   ├── manifest.json       ← PWA manifest (app name, icons)
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── Documentation/
│   ├── 01_Learning_and_Concepts.md
│   ├── 02_Step_by_Step_Guide.md
│   ├── 03_Deployment_and_Distribution.md  ← THIS FILE
│   └── 04_Bug_Fixes_and_Debugging.md
├── .gitignore
├── bundle.py
└── README.md
```

---

*Next: See `04_Bug_Fixes_and_Debugging.md` for all bugs we encountered and how we resolved them.*
