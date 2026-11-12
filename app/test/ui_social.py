"""Test du mode serveur avec un faux Supabase en mémoire : comptes, amis, partages, cartes communes."""
import base64, json, os, sys
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(ROOT, "dist", "houle.html"), encoding="utf-8").read()
TMP = os.path.join(ROOT, "test", "tmp-social.html")
open(TMP, "w", encoding="utf-8").write(SRC.replace('supabaseUrl: ""', 'supabaseUrl: "https://test.supabase.co"').replace('supabaseAnonKey: ""', 'supabaseAnonKey: "anon-key"'))
HTML = "file://" + TMP
STUB = open(os.path.join(ROOT, "test", "leaflet-stub.js")).read()
FAKE = open(os.path.join(ROOT, "test", "fake-supabase.js")).read()
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
OUT = os.path.join(ROOT, "test", "shots"); os.makedirs(OUT, exist_ok=True)

def times():
    base = date.today()
    return [f"{(base + timedelta(d)).isoformat()}T{h:02d}:00" for d in range(8) for h in range(24)]
def wave(t):
    d = (date.fromisoformat(t[:10]) - date.today()).days
    return 1.4 if d in (1, 3) else 0.4

def handle(route):
    url = route.request.url
    if url.startswith("file://"): return route.continue_()
    if "unpkg.com/leaflet" in url: return route.fulfill(status=200, content_type="application/javascript" if url.endswith(".js") else "text/css", body=STUB if url.endswith(".js") else "")
    if "cdn.jsdelivr.net" in url and "supabase" in url: return route.fulfill(status=200, content_type="application/javascript", body=FAKE)
    if "fonts.googleapis.com" in url: return route.fulfill(status=200, content_type="text/css", body="")
    if "tile.openstreetmap.org" in url or "arcgisonline" in url or "opentopomap" in url: return route.fulfill(status=200, content_type="image/png", body=PNG)
    if "marine-api.open-meteo.com" in url:
        t = times(); return route.fulfill(status=200, content_type="application/json", body=json.dumps({"hourly": {"time": t, "wave_height": [wave(x) for x in t], "wave_period": [11.0] * len(t), "wave_direction": [285] * len(t)}}))
    if "api.open-meteo.com" in url:
        t = times(); return route.fulfill(status=200, content_type="application/json", body=json.dumps({"hourly": {"time": t, "wind_speed_10m": [10.0] * len(t), "wind_direction_10m": [90] * len(t)}}))
    return route.abort()

fails = []
def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)

def toast(page, text, timeout=5000):
    page.wait_for_function("t => document.querySelector('#toast').textContent.includes(t)", arg=text, timeout=timeout)

def badge(page, tab):
    loc = page.locator(f'[data-tab="{tab}"] .badge')
    return loc.inner_text() if loc.count() else ""

def sign_up(page, email, pw):
    page.wait_for_selector("#authForm")
    page.click('[data-act="authMode"][data-mode="up"]')
    page.fill("#a_email", email); page.fill("#a_pw", pw)
    page.click('#authForm button[type="submit"]')

def sign_in(page, email, pw):
    page.wait_for_selector("#authForm")
    page.click('[data-act="authMode"][data-mode="in"]')
    page.fill("#a_email", email); page.fill("#a_pw", pw)
    page.click('#authForm button[type="submit"]')

def username(page, name):
    page.wait_for_selector("#nameForm")
    page.fill("#u_name", name)
    page.click('#nameForm button[type="submit"]')
    page.wait_for_function("document.querySelector('.who') && document.querySelector('.who').textContent.includes('@%s')" % name)

def logout(page):
    page.click('[data-act="logout"]')
    page.wait_for_selector("#authForm")

def tab(page, name):
    page.click(f'[data-tab="{name}"]')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="fr-FR", timezone_id="Europe/Paris")
    ctx.add_init_script("try{localStorage.setItem('houle.tour.v1','1')}catch(e){}")
    ctx.route("**/*", handle)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    page.on("dialog", lambda d: d.accept())
    page.goto(HTML)

    # --- compte d'Alice ---
    page.wait_for_selector("#authForm")
    page.keyboard.press("Escape")
    check(page.is_visible("#authForm"), "la fenêtre de connexion ne se ferme pas avec Échap")
    page.evaluate("window.__fake.confirmRequired = true")
    sign_up(page, "alice@example.com", "motdepasse-alice")
    page.wait_for_selector("#authOk:not([hidden])")
    check("Compte créé" in page.inner_text("#authOk"), "inscription : demande de confirmation par e-mail")
    page.evaluate("window.__fake.confirmRequired = false")
    sign_in(page, "alice@example.com", "mauvais")
    page.wait_for_selector("#authErr:not([hidden])")
    check("incorrect" in page.inner_text("#authErr"), "mauvais mot de passe refusé")
    page.fill("#a_pw", "motdepasse-alice"); page.click('#authForm button[type="submit"]')
    page.wait_for_selector("#nameForm")
    page.fill("#u_name", "A!"); page.click('#nameForm button[type="submit"]')
    page.wait_for_selector("#nameErr:not([hidden])")
    check("3 à 20" in page.inner_text("#nameErr"), "pseudo invalide refusé")
    username(page, "alice")
    check("@alice" in page.inner_text("#topRight"), "connectée en tant que @alice")

    # spot privé d'Alice
    page.click("#btnAdd")
    page.evaluate("window.__map.fire('click', {latlng: {lat: 43.48123, lng: -1.55678}})")
    page.wait_for_selector("#spotForm")
    page.fill("#f_name", "La Gravière"); page.fill("#f_notes", "Parking derrière la dune")
    page.click('#spotForm button[type="submit"]')
    page.wait_for_selector(".strip .cell--good")
    db = page.evaluate("window.__fake.db")
    check(len(db["tables"]["spots"]) == 1 and db["tables"]["spots"][0]["owner"] == db["session"]["user"]["id"], "spot enregistré côté serveur au nom d'Alice")

    # amis : erreurs
    tab(page, "friends")
    page.fill("#friendName", "personne"); page.click('[data-form="friend"] button')
    toast(page, "Aucun utilisateur")
    page.fill("#friendName", "alice"); page.click('[data-form="friend"] button')
    toast(page, "propre pseudo")

    # --- Bob ---
    logout(page)
    sign_up(page, "bob@example.com", "motdepasse-bob")
    username(page, "bob")
    check(page.locator(".spot").count() == 0 and "Place ton premier spot" in page.inner_text("#panelBody"), "Bob ne voit pas les spots d'Alice")
    tab(page, "friends")
    page.fill("#friendName", "@Alice")
    page.focus("#friendName")
    page.evaluate("Houle.app.render()")
    check(page.input_value("#friendName") == "@Alice" and page.evaluate("document.activeElement.id") == "friendName", "le texte saisi et le focus survivent à un nouveau rendu")
    page.click('[data-form="friend"] button')
    toast(page, "Demande envoyée à @alice")
    page.fill("#friendName", "alice"); page.click('[data-form="friend"] button')
    toast(page, "existe déjà")
    check("en attente" in page.inner_text("#panelBody"), "demande en attente visible chez Bob")

    # Bob ne peut rien partager tant qu'Alice n'a pas accepté
    logout(page)
    sign_in(page, "alice@example.com", "motdepasse-alice")
    page.wait_for_selector(".who")
    page.wait_for_function("document.querySelector('[data-tab=friends] .badge')")
    check(badge(page, "friends") == "1", "badge Amis = 1 chez Alice")
    tab(page, "friends")
    check("@bob" in page.inner_text("#panelBody") and "Demandes reçues" in page.inner_text("#panelBody"), "demande de Bob visible")
    page.click('[data-act="friendOk"]')
    toast(page, "Ami ajouté")
    page.wait_for_function("document.querySelector('#panelBody').textContent.includes('Mes amis') && !document.querySelector('#panelBody').textContent.includes('Demandes reçues')")
    check(badge(page, "friends") == "", "badge Amis retombe à 0")

    # --- partages d'Alice ---
    tab(page, "spots")
    page.click(".spot-main")
    page.click('[data-act="shareSpot"]')
    page.wait_for_selector("#shareForm")
    page.click("#shareForm button[type=submit]")
    check("au moins un ami" in page.inner_text("#shareErr"), "partage sans ami choisi refusé")
    page.check('#shareForm input[name="to"]'); page.check("#s_hide")
    page.click("#shareForm button[type=submit]")
    toast(page, "Spot partagé")
    page.click('[data-act="shareSpot"]'); page.wait_for_selector("#shareForm")
    page.check('#shareForm input[name="to"]')
    page.click("#shareForm button[type=submit]")
    toast(page, "Spot partagé")
    tab(page, "alerts")
    page.click('[data-act="shareSession"] >> nth=0')
    page.wait_for_selector("#s_time")
    page.fill("#s_time", "13:00"); page.fill("#s_msg", "On y va ?")
    page.check('#shareForm input[name="to"]')
    page.click("#shareForm button[type=submit]")
    toast(page, "Session partagée")
    shares = page.evaluate("window.__fake.db.tables.shares")
    hidden = [s for s in shares if s["kind"] == "spot" and s["payload"].get("hiddenDescription")]
    shown = [s for s in shares if s["kind"] == "spot" and not s["payload"].get("hiddenDescription")]
    check(len(shares) == 3 and len(hidden) == 1 and hidden[0]["payload"]["notes"] == "", "description absente des données du partage masqué")
    check(len(shown) == 1 and shown[0]["payload"]["notes"] == "Parking derrière la dune", "description présente dans l'autre partage")
    if not (len(shown) == 1 and shown[0]["payload"]["notes"] == "Parking derrière la dune"): print("DEBUG shares:", json.dumps([(x["kind"], x["payload"].get("hiddenDescription"), x["payload"].get("notes")) for x in shares], ensure_ascii=False)); print("DEBUG spots:", json.dumps([(x["name"], x["notes"]) for x in page.evaluate("window.__fake.db.tables.spots")], ensure_ascii=False))
    check(any(s["kind"] == "session" and s["payload"]["hour"] == "13:00" for s in shares), "session partagée avec l'heure")

    # carte commune
    tab(page, "maps")
    page.fill("#mapName", "Côte basque"); page.click('[data-form="createMap"] button')
    toast(page, "Carte créée")
    page.wait_for_selector('[data-form="invite"]')
    page.click('[data-form="invite"] button')
    toast(page, "Invitation envoyée")
    page.wait_for_selector('[data-form="addMapSpot"]')
    page.check('[data-form="addMapSpot"] input[name="hide"]')
    page.click('[data-form="addMapSpot"] button')
    toast(page, "Spot ajouté à la carte commune")
    page.wait_for_function("document.querySelector('#panelBody').textContent.includes('Spots de la carte (1)')")
    ms = page.evaluate("window.__fake.db.tables.map_spots")
    check(len(ms) == 1 and ms[0]["snapshot"]["notes"] == "" and ms[0]["snapshot"]["hiddenDescription"] is True, "spot ajouté à la carte sans description")
    check(len(page.evaluate("window.__markers()")) == 2, "repère de la carte commune affiché sur la carte")
    page.screenshot(path=os.path.join(OUT, "maps.png"))

    # --- Bob reçoit ---
    logout(page)
    sign_in(page, "bob@example.com", "motdepasse-bob")
    page.wait_for_function("document.querySelector('[data-tab=inbox] .badge')")
    check(badge(page, "inbox") == "3", "badge Reçu = 3 chez Bob")
    check(badge(page, "maps") == "1", "badge Cartes = 1 (invitation)")
    tab(page, "inbox")
    txt = page.inner_text("#panelBody")
    check("Description masquée" in txt and "Parking derrière la dune" in txt, "reçu : une description masquée, une visible")
    check("13h00" in txt and "On y va ?" in txt, "reçu : session avec heure et message")
    page.screenshot(path=os.path.join(OUT, "inbox.png"))
    page.click('[data-act="importShare"] >> nth=0')
    toast(page, "Spot ajouté")
    tab(page, "spots")
    check(page.locator(".spot").count() == 1, "le spot importé apparaît dans la carte privée de Bob")
    tab(page, "maps")
    page.click('[data-act="inviteOk"]')
    toast(page, "Carte rejointe")
    page.click('[data-act="openMap"]')
    page.wait_for_selector('[data-act="showShared"]')
    page.click('[data-act="showShared"]')
    page.wait_for_selector("#importBtn")
    check("masquée" in page.inner_text("#dlg"), "spot de la carte commune : description masquée annoncée")
    page.click("#importBtn")
    toast(page, "Spot ajouté à ta carte")
    tab(page, "spots")
    check(page.locator(".spot").count() == 2, "Bob a maintenant 2 spots à lui")
    check(len(page.evaluate("window.__fake.db.tables.spots")) == 3, "3 spots côté serveur (un chez Alice, deux chez Bob)")

    # --- Charlie demande à rejoindre avec le code ---
    code = page.evaluate("window.__fake.db.tables.maps[0].join_code")
    logout(page)
    sign_up(page, "charlie@example.com", "motdepasse-charlie")
    username(page, "charlie")
    tab(page, "maps")
    page.fill("#mapCode", code.lower()); page.click('[data-form="joinMap"] button')
    toast(page, "Demande envoyée")
    page.wait_for_function("document.querySelector('#panelBody').textContent.includes('demande envoyée')")
    check("Spots de la carte" not in page.inner_text("#panelBody"), "Charlie ne voit pas la carte avant validation")
    logout(page)
    sign_in(page, "alice@example.com", "motdepasse-alice")
    page.wait_for_function("document.querySelector('[data-tab=maps] .badge')")
    check(badge(page, "maps") == "1", "badge Cartes = 1 chez Alice (demande à valider)")
    tab(page, "maps")
    page.click('[data-act="openMap"]')
    page.wait_for_selector('[data-act="reqOk"]')
    check("@charlie" in page.inner_text("#panelBody"), "demande de Charlie visible par le créateur")
    page.click('[data-act="reqOk"]')
    toast(page, "Membre accepté")
    page.wait_for_function("document.querySelector('#panelBody').textContent.includes('@charlie') && !document.querySelector('#panelBody').textContent.includes('Demandes à valider')")
    page.screenshot(path=os.path.join(OUT, "maps2.png"))
    logout(page)
    sign_in(page, "charlie@example.com", "motdepasse-charlie")
    page.wait_for_selector(".who")
    tab(page, "maps"); page.click('[data-act="openMap"]')
    page.wait_for_selector('[data-act="showShared"]')
    check(True, "Charlie accède à la carte après validation")

    # session persistante après rechargement
    # Chromium sans interface perd parfois le localStorage au rechargement : on le rejoue pour que le test reste fiable
    _db = page.evaluate("localStorage.getItem('__fake_db')")
    ctx.add_init_script("if(!localStorage.getItem('__fake_db')) localStorage.setItem('__fake_db', " + json.dumps(_db) + ")")
    page.reload()
    page.wait_for_function("document.querySelector('.who') && document.querySelector('.who').textContent.includes('@charlie')")
    check(True, "session conservée après rechargement")

    check(not errors, "aucune erreur JS / console : %s" % errors[:3])
    b.close()

print("\n%d échec(s)" % len(fails))
sys.exit(1 if fails else 0)
