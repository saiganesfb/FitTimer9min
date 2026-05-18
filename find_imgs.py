import urllib.request, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch(url):
    req = urllib.request.Request(url)
    return json.loads(urllib.request.urlopen(req, context=ctx).read())

def fetch_all(base_url):
    results = []
    url = base_url
    while url:
        data = fetch(url)
        results.extend(data['results'])
        url = data.get('next')
    return results

# Get all translations
translations = fetch_all('https://wger.de/api/v2/exercise-translation/?format=json&limit=200&language=2')
# Get all images
all_images = fetch_all('https://wger.de/api/v2/exerciseimage/?format=json&limit=300')

# Build maps
id_to_images = {}
for img in all_images:
    eid = img['exercise']
    if eid not in id_to_images:
        id_to_images[eid] = []
    id_to_images[eid].append(img)

# Search for seated leg raise, leg extension, ankle weight exercises
keywords = ['seated leg', 'leg extension', 'chair', 'quadricep', 'knee extension', 
            'seated knee', 'ankle', 'glute raise', 'hip abduction', 'hip extension',
            'lying leg', 'prone', 'fire hydrant', 'clam', 'side lying']

print("=== SEATED LEG RAISE / ANKLE WEIGHT EXERCISES ===")
for t in translations:
    name_lower = t['name'].lower()
    if any(kw in name_lower for kw in keywords):
        eid = t['exercise']
        if eid in id_to_images:
            for img in id_to_images[eid]:
                is_photo = any(x in img['image'].lower() for x in ['.jpg','.jpeg','.webp'])
                tag = 'PHOTO' if is_photo else ('GIF' if '.gif' in img['image'] else 'PNG')
                print(f"  [{tag}] {t['name']} (id:{eid}) main={img['is_main']}")
                print(f"        {img['image']}")
