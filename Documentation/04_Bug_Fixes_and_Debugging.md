# FitTimer — Bug Fixes & Debugging Log

## 📅 Created: May 19, 2026

---

## Bug #1: Mobile Tabs Cut Off (Samsung S24 Ultra)

### Symptom
On 412px viewport (Samsung S24 Ultra), tabs after "Mindset" were hidden off-screen. Page had horizontal overflow scrolling.

### Root Cause
8 tabs in a flex container with `body { padding: 20px }` left only 372px for tabs. At `0.8rem` font, words like "Progress" and "Mindset" (7-8 chars) couldn't fit in ~46px per tab.

### Failed Attempts
1. **Attempt 1** (commit 51eec9c): Made tabs `overflow-x: auto` with hidden scrollbar → User rejected: "you just zoomed into it"
2. **Attempt 2** (commit 8097213): `flex: 0 0 auto` then back to `flex: 1` → Still overflowed

### Solution (commit 32aa95f + 26e6c2d)
Reverted to clean state, then applied:
```css
/* Reduce body padding on mobile */
@media (max-width: 480px) {
    body { padding: 12px 8px; }           /* Was 20px */
    .tab-nav { gap: 1px; padding: 3px; }
    .tab-btn { font-size: 0.6rem; padding: 8px 1px; letter-spacing: -0.3px; }
}

/* Base tab fixes */
.tab-btn { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tab-nav { width: 100%; box-sizing: border-box; }
```

### Math That Proved It:
- 412px viewport - 16px body padding = 396px
- Tab nav: 396 - 6px padding - 7px gaps = 383px for 8 buttons
- Per button: 383/8 = ~48px
- "Progress" at 0.6rem ≈ 40px → fits!

### Lesson
Always calculate available space mathematically before trying CSS fixes. Know your viewport width, subtract all padding/gaps, divide by number of items.

---

## Bug #2: Tab Labels Truncated ("Work..", "Mind..")

### Symptom
After fix #1, tabs fit within screen but showed truncated text with ellipsis.

### Root Cause
`text-overflow: ellipsis` + `overflow: hidden` was working as designed — font was still too large.

### Solution (commit 26e6c2d)
Reduced font from `0.68rem` to `0.6rem` + added `letter-spacing: -0.3px` to squeeze characters tighter. Full labels now fit.

---

## Bug #3: Exercise Names Hidden in Workout Tab

### Symptom
On mobile, couldn't see exercise names in the workout log table.

### Root Cause
`.qlog-td-name` had `white-space: nowrap` — long exercise names (e.g., "Incline Dumbbell Press") pushed the table wider than the viewport inside `overflow-x: auto` wrapper.

### Solution (commit 7ce787a)
```css
.qlog-td-name {
    white-space: normal;      /* Was: nowrap */
    word-break: break-word;   /* Wrap long names */
    min-width: 90px;
    max-width: 120px;
}
```

---

## Bug #4: START Button Not Reappearing After Stop & Record

### Symptom
After clicking Stop → Record (1 min partial session), the timer stayed showing Pause/Stop buttons. START never came back. Only "Discard" worked.

### Root Cause
`completeSession()` is an `async` function. The `await addSession(session)` call writes to IndexedDB. In the Capacitor APK WebView, IndexedDB permissions or initialization can fail silently. When `await` throws, the function exits early and the UI reset code at the bottom **never executes**.

Why "Discard" worked: `resetTimer()` is synchronous — no database calls, no async, always succeeds.

### Solution (commit 637ccae)
1. Moved ALL UI reset code to the **top** of `completeSession()`, before any async operations:
```javascript
async function completeSession(isPartial) {
    // Reset UI FIRST (before any async ops that might fail)
    startBtn.classList.remove('hidden');
    startBtn.innerHTML = '&#9654; START';
    pauseBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    // ... then do async DB save, XP calc, celebration, etc.
}
```
2. Wrapped `addSession()` in try-catch
3. Wrapped `Notification` API in `typeof` check (not available in WebView)

### Lesson
**Never put critical UI reset AFTER async calls.** Reset first, then do background work. If background work fails, the user still has a functional UI.

---

## Bug #5: Emojis Corrupted After Multi-Replace

### Symptom
After using the editor's multi_replace_string_in_file with Unicode emoji characters, some emojis appeared as `�` (replacement character) in the file.

### Root Cause
The tool's Unicode escape handling (`\ud83e\uddf1`) didn't map correctly to multi-byte emoji codepoints for some characters (🧱, 💎, 🦘, 🔓).

### Solution
Created a Python script to do the replacement with proper UTF-8 encoding:
```python
import re
with open('app/script.js', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r"\{ name: '.{1,4} Chest'", "{ name: '\U0001f9f1 Chest'", c)
# ... etc
with open('app/script.js', 'w', encoding='utf-8') as f:
    f.write(c)
```

### Lesson
For emoji/Unicode replacements in files, use Python with explicit `encoding='utf-8'` instead of editor tools that may mishandle surrogate pairs.

---

## Bug #6: Service Worker Caching Stale Version

### Symptom
After pushing new code, mobile browser still showed the old version. Even clearing browser cache didn't help.

### Root Cause
The service worker was still serving from `fittimer-v21` cache. SW lifecycle: even after new code is deployed, the old service worker stays active until all tabs are closed AND re-opened.

### Solution (commit f3eae08)
Bumped `CACHE_NAME` from `'fittimer-v21'` to `'fittimer-v22'`. The activate handler deletes old caches:
```javascript
self.addEventListener('activate', e => {
    caches.keys().then(keys =>
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )
});
```

### Nuclear Option (if bumping doesn't help):
Chrome on phone → Settings → Site settings → find site → "Clear & reset"

### Lesson
Always bump `CACHE_NAME` after significant changes. Consider adding a version display in the app footer for quick verification.

---

## Bug #7: GitHub Actions APK Build Failures

### Build #1 Failure: Can't find web assets
- **Error**: Capacitor couldn't locate index.html
- **Cause**: Ran `npx cap init` inside `app/` with `--web-dir .` but the Android project path was wrong
- **Fix**: Run Capacitor from project root with `--web-dir app`

### Build #2 Failure: Invalid source release 21
- **Error**: `error: invalid source release: 21`
- **Cause**: Workflow used JDK 17 but Capacitor's Android library requires JDK 21
- **Fix**: `java-version: '21'` in setup-java action

### Build #3 Failure: Duplicate Kotlin classes
- **Error**: `Duplicate class kotlin.collections.jdk8.CollectionsJDK8Kt`
- **Cause**: kotlin-stdlib 1.8.22 merged jdk7/jdk8 modules internally, but old transitive dependencies still pulled separate jdk7/jdk8 JARs (1.6.21)
- **Fix**: Force resolution in `android/app/build.gradle`:
```groovy
configurations.all {
    resolutionStrategy {
        force 'org.jetbrains.kotlin:kotlin-stdlib:1.9.24'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.9.24'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.24'
    }
}
```

### Lesson
Cloud CI builds expose dependency conflicts that local dev never hits. Read error messages carefully — they usually tell you exactly what version conflicts exist.

---

## Debugging Principles We Applied

1. **Calculate, don't guess** — Mobile layout bugs need viewport math, not trial-and-error
2. **Sync before async** — Critical UI updates go FIRST, before any `await` calls
3. **Try-catch everything async** — One uncaught rejection can freeze an entire flow
4. **Service workers are sticky** — Always bump cache version, always have a "nuclear clear" option
5. **Use Python for Unicode** — Editor tools can mangle multi-byte characters
6. **Read the actual error** — CI build errors are verbose but precise

---

*This is a living document. Add new bugs as they're discovered.*
