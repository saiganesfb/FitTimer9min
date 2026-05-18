"""Bundle FitTimer app into a single self-contained HTML file."""
import base64, os

app = r'C:\D\MYSPACE\FitnessTracker\app'

# Read files
with open(os.path.join(app, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()
with open(os.path.join(app, 'style.css'), 'r', encoding='utf-8') as f:
    css = f.read()
with open(os.path.join(app, 'db.js'), 'r', encoding='utf-8') as f:
    db_js = f.read()
with open(os.path.join(app, 'gamification.js'), 'r', encoding='utf-8') as f:
    gam_js = f.read()
with open(os.path.join(app, 'script.js'), 'r', encoding='utf-8') as f:
    script_js = f.read()

# Base64 encode MP3s
for fname, varname in [('water-droplet.mp3', 'sounds/water-droplet.mp3'), ('water-splash.mp3', 'sounds/water-splash.mp3')]:
    fpath = os.path.join(app, 'sounds', fname)
    if os.path.exists(fpath):
        with open(fpath, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()
        gam_js = gam_js.replace(f"'{varname}'", f"'data:audio/mpeg;base64,{b64}'")

# Replace external CSS link with inline
html = html.replace('<link rel="stylesheet" href="style.css?v=21">', f'<style>\n{css}\n</style>')

# Replace external script tags with inline
html = html.replace('<script src="db.js?v=21"></script>', f'<script>\n{db_js}\n</script>')
html = html.replace('<script src="gamification.js?v=21"></script>', f'<script>\n{gam_js}\n</script>')
html = html.replace('<script src="script.js?v=21"></script>', f'<script>\n{script_js}\n</script>')

# Remove service worker registration (won't work from single file)
sw_line = "if ('serviceWorker' in navigator) { navigator.serviceWorker.register('service-worker.js'); }"
html = html.replace(sw_line, '// service worker disabled in bundled mode')

# Write output
out_path = r'C:\D\MYSPACE\FitnessTracker\FitTimer.html'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(out_path) / 1024
print(f'Done: FitTimer.html ({size_kb:.0f} KB)')
