"""Test de l'appli en mode local (sans serveur) avec Chromium sans interface.
Le réseau est simulé : Leaflet (faux), tuiles, Open-Meteo, Nominatim."""
import base64, json, os, sys, tempfile
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = "file://" + os.path.join(ROOT, "dist", "houle.html")
STUB = open(os.path.join(ROOT, "test", "leaflet-stub.js")).read()
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
OUT = os.path.join(ROOT, "test", "shots")
os.makedirs(OUT, exist_ok=True)

GOOD, MAYBE = {1, 3, 7}, {5}
def times():
    base = date.today()
    return [f"{(base + timedelta(d)).isoformat()}T{h:02d}:00" for d in range(8) for h in range(24)]
def wave(t):
    d = (date.fromisoformat(t[:10]) - date.today()).days; h = int(t[11:13])
    if d in GOOD: return 1.4
    if d in MAYBE: return 1.4 if h == 10 else 0.4
    return 0.4

calls = {"marine": 0, "wind": 0, "nominatim": 0}
def handle(route):
    url = route.request.url
    if url.startswith("file://"): return route.continue_()
    if "unpkg.com/leaflet" in url:
        if url.endswith(".js"): return route.fulfill(status=200, content_type="application/javascript", body=STUB)
        return route.fulfill(status=200, content_type="text/css", body="")
    if "fonts.googleapis.com" in url: return route.fulfill(status=200, content_type="text/css", body="")
    if "fonts.gstatic.com" in url: return route.abort()
    if "tile.openstreetmap.org" in url or "opentopomap" in url or "arcgisonline" in url: return route.fulfill(status=200, content_type="image/png", body=PNG)
    if "timeformat=unixtime" in url:   # mode Conditions : plusieurs points en une requête
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(url).query)
        lats = [float(x) for x in q["latitude"][0].split(",")]; lons = [float(x) for x in q["longitude"][0].split(",")]
        marine = "marine-api" in url
        calls["cond_m" if marine else "cond_w"] = calls.get("cond_m" if marine else "cond_w", 0) + 1
        calls["cond_pts"] = len(lats)
        import time as _t, math
        t0 = int(_t.time() // 86400 * 86400); ts = [t0 + 3600 * k for k in range(72)]
        out = []
        for la, lo in zip(lats, lons):
            sea = lo <= -1.55
            if marine:
                o = {"latitude": la if sea else la, "longitude": lo if sea else lo + 1.2, "hourly": {"time": ts,
                     "wave_height": [1.5] * 72, "wave_period": [10.0] * 72, "wave_direction": [285] * 72,
                     "swell_wave_height": [1.3 + 0.5 * math.sin(k / 9) for k in range(72)], "swell_wave_period": [12.0] * 72, "swell_wave_direction": [290] * 72,
                     "sea_level_height_msl": [round(1.6 * math.sin(2 * math.pi * k / 12.42), 2) for k in range(72)]}}
            else:
                o = {"latitude": la, "longitude": lo, "hourly": {"time": ts, "wind_speed_10m": [8.0 + 3 * (lo + 2.5) + k * 0.1 for k in range(72)], "wind_direction_10m": [60 + 10 * (la - 43)] * 72}}
            out.append(o)
        return route.fulfill(status=200, content_type="application/json", body=json.dumps(out if len(out) > 1 else out[0]))
    if "marine-api.open-meteo.com" in url:
        calls["marine"] += 1
        t = times()
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"hourly": {"time": t, "wave_height": [wave(x) for x in t], "wave_period": [11.0] * len(t), "wave_direction": [285] * len(t)}}))
    if "api.open-meteo.com" in url:
        calls["wind"] += 1
        t = times()
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"hourly": {"time": t, "wind_speed_10m": [10.0] * len(t), "wind_direction_10m": [90] * len(t)}}))
    if "nominatim.openstreetmap.org" in url:
        calls["nominatim"] += 1
        return route.fulfill(status=200, content_type="application/json", body=json.dumps([{"display_name": "Hossegor, Landes, France", "lat": "43.6636", "lon": "-1.4020"}]))
    return route.abort()

fails = []
def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, accept_downloads=True, locale="fr-FR", timezone_id="Europe/Paris")
    ctx.route("**/*", handle)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)

    page.goto(HTML)
    page.wait_for_selector("#tabs .tab")
    check("Sur cet appareil" in page.inner_text("#topRight"), "mode local affiché")
    check("Place ton premier spot" in page.inner_text("#panelBody"), "état vide du premier lancement")
    check(page.locator(".tab").count() == 2, "2 onglets en mode local (amis masqués)")
    check(page.locator('[data-act="tour"]').count() >= 1, "bouton d'aide présent")
    # tutoriel au premier lancement
    page.wait_for_selector("#dlg[open] .tour")
    check("Bienvenue" in page.inner_text("#dlg"), "tutoriel affiché au premier lancement")
    for i in range(6): page.click('#dlg [data-act="tourNext"]')
    check("Garder tes données" in page.inner_text("#dlg"), "dernière étape du tutoriel")
    page.click('#dlg [data-act="tourSkip"]')
    check(not page.evaluate("document.getElementById('dlg').open"), "tutoriel fermé")
    page.screenshot(path=os.path.join(OUT, "local-home.png"))
    page.click('[data-act="tour"]')
    check("Bienvenue" in page.inner_text("#dlg"), "tutoriel rouvert par ?")
    page.keyboard.press("Escape")
    page.reload(); page.wait_for_selector("#tabs .tab"); page.wait_for_timeout(700)
    check(not page.evaluate("document.getElementById('dlg').open"), "tutoriel pas ré-affiché après lecture")

    # spots connus
    nk = page.evaluate("[...window.__map.layers].filter(l => l.isGroup).reduce((n,g) => n + g.items.length, 0)")
    check(nk == page.evaluate("Houle.app.known.length") and nk > 250, f"{nk} spots connus sur la carte")
    page.fill("#searchInput", "la graviere")
    page.press("#searchInput", "Enter")
    page.wait_for_selector('#searchResults [data-act="goKnown"]')
    check("spot connu" in page.inner_text("#searchResults"), "recherche par nom parmi les spots connus")
    page.click('#searchResults [data-act="goKnown"]')
    check("à environ 300 à 500 m" in page.inner_text("#dlg"), "avertissement de précision affiché")
    page.click('#dlg [data-act="addKnown"]')
    page.wait_for_selector("#f_name")
    check(page.input_value("#f_name").lower().startswith("la gravi"), "nom pré-rempli depuis le spot connu")
    check("," in page.input_value("#f_coords"), "coordonnées pré-remplies")
    page.click('#dlg [data-act="closeDlg"]')
    page.click("#btnKnown")
    check(page.get_attribute("#btnKnown", "aria-pressed") == "false", "bouton masquer les spots connus")
    page.click("#btnKnown")

    # disciplines, filtres, emoji
    check(page.locator("#kFilter .kf").count() == 4, "4 filtres de discipline")
    nb = lambda: page.evaluate("[...window.__map.layers].filter(l => l.isGroup).reduce((n,g) => n + g.items.length, 0)")
    total = nb()
    page.click('#kFilter [data-k="b"]')
    nbody = nb()
    check(0 < nbody < total, f"filtre bodyboard : {nbody} / {total}")
    page.click('#kFilter [data-k="all"]')
    check(nb() == total, "filtre « Tous » rétablit tous les spots")
    # fiche d'un spot connu avec conditions lues + houle prévue + emoji
    page.fill("#searchInput", "la torche"); page.press("#searchInput", "Enter")
    page.wait_for_selector('#searchResults [data-act="goKnown"]')
    page.click('#searchResults [data-act="goKnown"]')
    check("Conditions conseillées" in page.inner_text("#dlg") or "Pas de conditions" in page.inner_text("#dlg"), "bloc conditions affiché")
    page.click('#dlg [data-act="knownFc"]')
    page.wait_for_selector("#kfc .strip")
    check(page.locator("#kfc .cell").count() == 8, "8 jours de houle prévue pour un spot connu")
    check(any(e in page.inner_text("#kfc") for e in ["💤", "〰️", "🌊", "🔥", "⚠️"]), "emoji de houle affiché")
    page.screenshot(path=os.path.join(OUT, "known-dialog.png"))
    page.click('#dlg [data-act="addKnown"]')
    page.wait_for_selector("#f_disc")
    check(page.input_value("#f_disc") in ("s", "b", "l"), "discipline pré-remplie")
    page.select_option("#f_disc", "b")
    page.check("#f_swOn"); page.fill("#f_swFrom", "240"); page.fill("#f_swTo", "320")
    page.click('#spotForm button[type="submit"]')
    page.wait_for_selector(".spot")
    page.wait_for_selector(".spot .swe")
    check(page.locator(".spot .dchip--body").count() == 1, "pastille bodyboard sur ma fiche")
    check(page.locator(".spot .swe").count() == 1, "emoji de houle sur mon spot")
    check(page.evaluate("[...window.__markers()].some(m => m.cls.includes('pin-emoji'))"), "emoji sur le repère de mon spot")
    saved = page.evaluate("Houle.app.S.spots[0].rules")
    check(saved.get("disc") == "b" and saved.get("swellOn") is True and saved.get("swellFrom") == 240, "discipline et direction de houle enregistrées")
    page.click('[data-act="edit"]')
    page.wait_for_selector("#f_name")
    page.once("dialog", lambda d: d.accept())
    page.click('[data-act="delSpot"]')
    page.wait_for_selector(".empty")
    check(page.evaluate("Houle.app.S.spots.length") == 0, "spot d'essai supprimé")
    for _k in calls: calls[_k] = 0   # on repart de zéro pour la suite

    # mode Conditions
    page.click('#modeSwitch [data-m="cond"]')
    page.wait_for_selector("#condPanel:not([hidden]) .cp-status")
    page.wait_for_function("document.querySelector('.cp-status').textContent.includes('Mis à jour')")
    check(calls.get("cond_m") == 1 and calls.get("cond_w") == 1, "une seule requête groupée houle + une vent")
    check(calls["cond_pts"] > 12, f"{calls['cond_pts']} points demandés en une fois")
    check("8 km" in page.inner_text("#condPanel"), "avertissement marée visible")
    painted = page.evaluate("(() => { const c = document.querySelector('.condcanvas'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })()")
    check(painted > 5000, f"la carte des conditions est dessinée ({painted} pixels)")
    page.screenshot(path=os.path.join(OUT, "conditions.png"))
    check(not page.is_visible("#kFilter"), "filtres de spots masqués en mode conditions")
    page.click('[data-act="condLayer"][data-k="wind"]')
    check(page.get_attribute('[data-act="condLayer"][data-k="wind"]', "aria-pressed") == "false", "couche vent désactivée")
    page.click('[data-act="condLayer"][data-k="wind"]')
    page.evaluate("document.getElementById('condTime').value = 6; document.getElementById('condTime').dispatchEvent(new Event('input'))")
    check("Maintenant" not in page.inner_text(".cp-time"), "curseur d'heure : libellé mis à jour")
    page.click('[data-act="condNow"]')
    check("Maintenant" in page.inner_text(".cp-time"), "bouton Maintenant")
    page.evaluate("window.__map.fire('click', {latlng: {lat: 43.5, lng: -2.0}})")
    page.wait_for_selector("table.cond")
    check("SHOM" in page.inner_text("#dlg") and "Houle" in page.inner_text("#dlg"), "détail d'un point avec houle, vent et marée")
    check(page.locator("table.cond tbody tr").count() >= 10, "tableau sur 36 h, toutes les 3 h")
    page.screenshot(path=os.path.join(OUT, "conditions-detail.png"))
    page.click('#dlg [data-act="closeDlg"]')
    page.click('[data-act="condLayer"][data-k="tide"]')
    check("8 km" not in page.inner_text("#condPanel"), "avertissement marée masqué si la couche est coupée")
    page.click('[data-act="condLayer"][data-k="tide"]')
    m0 = calls["cond_m"]
    page.evaluate("window.__bounds = [44.6, -2.5, 46.1, -0.5]; window.__map.fire('moveend')")
    page.wait_for_timeout(1800)
    check(calls["cond_m"] == m0 + 1, "déplacer la carte relance une requête groupée")
    page.evaluate("window.__bounds = [43.0, -2.5, 44.5, -0.5]; window.__map.fire('moveend')")
    page.wait_for_timeout(1200)
    check(calls["cond_m"] == m0 + 1, "revenir sur une zone déjà vue utilise le cache")
    page.click('#modeSwitch [data-m="normal"]')
    check(page.is_hidden("#condPanel") and page.is_visible("#kFilter"), "retour à la carte normale")
    for _k in calls: calls[_k] = 0

    # ajout d'un spot
    page.click("#btnAdd")
    check(page.is_visible("#addBanner"), "bandeau d'ajout visible")
    page.evaluate("window.__map.fire('click', {latlng: {lat: 43.48123, lng: -1.55678}})")
    page.wait_for_selector("#spotForm")
    check(page.input_value("#f_coords") == "43.48123, -1.55678", "coordonnées pré-remplies depuis la carte")
    page.fill("#f_name", "La Gravière")
    page.fill("#f_notes", "Beach break, marée mi-haute.\n<b>test</b>")
    page.fill("#f_link", "https://www.windguru.cz/48552")
    png = os.path.join(tempfile.gettempdir(), "spot.png"); open(png, "wb").write(PNG)
    page.set_input_files("#f_photos", png)
    page.wait_for_selector("#photoList img")
    check(page.locator("#photoList img").count() == 1, "photo ajoutée")
    page.screenshot(path=os.path.join(OUT, "dialog.png"))
    page.click('#spotForm button[type="submit"]')
    page.wait_for_selector(".spot")
    check("La Gravière" in page.inner_text(".spot"), "spot créé")
    page.wait_for_selector(".strip .cell--good")
    cells = page.eval_on_selector_all(".strip .cell", "els => els.map(e => e.className)")
    check(len(cells) == 8, "8 jours dans le bandeau")
    check([i for i, c in enumerate(cells) if "good" in c] == [1, 3, 7], "bons jours : %s" % [i for i, c in enumerate(cells) if "good" in c])
    check([i for i, c in enumerate(cells) if "maybe" in c] == [5], "créneau court détecté")
    check(calls["marine"] == 1 and calls["wind"] == 1, "une requête houle + une requête vent")
    check(page.is_visible(".spot.is-selected .detail"), "fiche dépliée après création")
    check("<b>test</b>" in page.inner_text(".notes"), "HTML des notes échappé (affiché en texte)")
    check(page.locator(".photos img").count() == 1, "photo visible dans la fiche")
    check(page.locator(".detail .days tr").count() == 8, "tableau 8 jours")
    marks = page.evaluate("window.__markers()")
    check(len(marks) == 1 and "pin--good" in marks[0]["cls"], "repère vert (session dans ≤3 jours)")

    # alertes
    badge = page.inner_text('[data-tab="alerts"] .badge')
    check(badge == "1", "badge alertes = 1 (veille)")
    page.click('[data-tab="alerts"]')
    check(page.locator(".alist").first.locator("li").count() == 2, "2 alertes (J-1 et J-3)")
    txt = page.inner_text("#panelBody")
    check("demain" in txt and "dans 3 jours" in txt, "libellés demain / dans 3 jours")
    check("Partager la session" not in txt, "pas de partage de session hors serveur")
    page.screenshot(path=os.path.join(OUT, "alerts.png"))

    # persistance
    page.reload(); page.wait_for_selector(".spot")
    check("La Gravière" in page.inner_text(".spot"), "spot conservé après rechargement")
    page.wait_for_selector(".strip .cell--good")
    check(calls["marine"] == 1, "prévision servie par le cache après rechargement")

    # modification des seuils : vent max 5 -> plus de session
    page.click(".spot-main")
    page.click('[data-act="edit"]')
    page.wait_for_selector("#spotForm")
    check(page.locator("#photoList img").count() == 1, "photo rechargée dans la fiche d'édition")
    page.fill("#f_wind", "5")
    page.click('#spotForm button[type="submit"]')
    page.wait_for_function("document.querySelectorAll('.strip .cell--good').length === 0")
    check(True, "plus de bon jour avec vent max 5 km/h")
    page.click('[data-tab="alerts"]')
    check("Aucune session ne correspond" in page.inner_text("#panelBody"), "message d'absence de session")
    page.click('[data-tab="spots"]')
    check("vent trop fort" in page.inner_text(".detail"), "raison affichée : vent trop fort")

    # recherche : coordonnées collées + lieu
    page.fill("#searchInput", "43,5 -1,5")
    page.press("#searchInput", "Enter")
    page.wait_for_selector("#spotForm")
    check(page.input_value("#f_coords") == "43.50000, -1.50000", "coordonnées collées avec virgule décimale")
    page.click('[data-act="closeDlg"]')
    page.fill("#searchInput", "hossegor")
    page.press("#searchInput", "Enter")
    page.wait_for_selector("#searchResults button")
    page.click('#searchResults [data-act="goPlace"]')
    check(calls["nominatim"] == 1 and page.evaluate("window.__flies.slice(-1)[0][1]") == 13, "recherche d'un lieu puis survol de la carte")

    # export / import
    with page.expect_download() as dl:
        page.click('[data-act="export"]')
    data = json.load(open(dl.value.path()))
    check(data["app"] == "houle" and len(data["spots"]) == 1 and len(data["spots"][0]["photos"]) == 1, "export JSON avec la photo")
    if not page.locator(".spot.is-selected").count(): page.click(".spot-main")
    page.click('[data-act="edit"]'); page.wait_for_selector("#spotForm")
    page.once("dialog", lambda d: d.accept())
    page.click('[data-act="delSpot"]')
    page.wait_for_selector(".empty")
    check(page.locator(".spot").count() == 0, "spot supprimé")
    page.set_input_files("#importFile", dl.value.path())
    page.wait_for_selector(".spot")
    check("La Gravière" in page.inner_text(".spot"), "import restaure le spot")

    # mobile + sombre
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=os.path.join(OUT, "mobile.png"))
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    check(not overflow, "pas de défilement horizontal sur mobile")
    page.click('#modeSwitch [data-m="cond"]')
    page.wait_for_function("document.querySelector('.cp-status').textContent.includes('Mis à jour')")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(OUT, "conditions-mobile.png"))
    check(not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"), "mode conditions : pas de défilement horizontal sur mobile")
    page.click('#modeSwitch [data-m="normal"]')
    ctx2 = b.new_context(viewport={"width": 1280, "height": 800}, color_scheme="dark", locale="fr-FR", timezone_id="Europe/Paris")
    ctx2.route("**/*", handle)
    pg2 = ctx2.new_page()
    pg2.goto(HTML); pg2.wait_for_selector("#tabs .tab")
    pg2.evaluate("""async () => { const s = await Houle.localStore.saveSpot({id:'x1', name:'Les Cavaliers', lat:43.5, lon:-1.53, rules:{}}); }""")
    pg2.reload(); pg2.wait_for_selector(".strip .cell--good")
    pg2.click(".spot-main")
    pg2.screenshot(path=os.path.join(OUT, "dark.png"))
    page.screenshot(path=os.path.join(OUT, "desktop.png"))

    check(not errors, "aucune erreur JS / console : %s" % errors[:3])
    b.close()

print("\n%d échec(s)" % len(fails))
sys.exit(1 if fails else 0)
