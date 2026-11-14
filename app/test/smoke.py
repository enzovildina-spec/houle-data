"""Test de fumée : l'appli démarre sans erreur JavaScript et le mode Conditions s'ouvre (réseau simulé)."""
import json, os, sys
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = "file://" + os.path.join(ROOT, "dist", "houle.html")
STUB = open(os.path.join(ROOT, "test", "leaflet-stub.js")).read()
fails = []
calls = {'om': 0}
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

def handle(route):
    u = route.request.url
    if u.startswith("file://"): return route.continue_()
    if "unpkg.com/leaflet" in u:
        if u.endswith(".js"): return route.fulfill(status=200, content_type="application/javascript", body=STUB)
        return route.fulfill(status=200, content_type="text/css", body="")
    if "open-meteo.com" in u: calls['om'] += 1
    if "open-meteo.com" in u and "unixtime" not in u:   # prévision d'un spot : houle 1,4 m à 11 s, vent faible, tous les jours
        t = [f"{(date.today() + timedelta(d)).isoformat()}T{h:02d}:00" for d in range(8) for h in range(24)]
        if "marine" in u: body = {"hourly": {"time": t, "wave_height": [1.4] * len(t), "wave_period": [11.0] * len(t), "wave_direction": [285] * len(t)}}
        else: body = {"hourly": {"time": t, "wind_speed_10m": [10.0] * len(t), "wind_direction_10m": [90] * len(t)}}
        return route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
    return route.fulfill(status=404, body="")   # tout le reste : réseau coupé

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROMIUM") or None)
    page = b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script("try { localStorage.setItem('houle.tour.v1', '1'); } catch (e) {}")
    page.route("**/*", handle)
    page.goto(HTML)
    page.wait_for_selector("#btnAdd", timeout=15000)
    check(True, "l'appli démarre")
    page.click('#modeSwitch [data-m="cond"]')
    page.wait_for_selector("#condPanel:not([hidden])", timeout=5000)
    page.wait_for_timeout(1500)
    check(page.is_visible("#condPanel"), "le mode Conditions s'ouvre")
    page.click('[data-act="condView"][data-k="swell"]')
    page.wait_for_timeout(500)
    # tableau de prévision : unités en toutes lettres, pieds, définitions, 2e houle avec direction (données simulées)
    page.evaluate("""async () => {
      const K = Houle.cond, n = 48, t0 = Math.floor(Date.now() / 3600000) * 3600, t = Array.from({ length: n }, (_, i) => t0 + i * 3600);
      const arr = (v) => Array.from({ length: n }, () => v);
      K.fetchDetail = async (lat, lon) => ({ lat, lon, t, n, wind: arr(12), gust: arr(20), wdir: arr(90), h: arr(1.8), per: arr(11), dir: arr(280), sh: arr(1.5), sp: arr(12), sd: arr(285),
        s2h: arr(0.6), s2p: arr(7), s2d: arr(230), wh: arr(0.4), wp: arr(4), wd2: arr(90), rise: [], set: [], sea: true,
        main: arr(0).map(() => ({ h: 1.5, t: 12, d: 285 })), power: arr(K.power(1.5, 12)), energy: arr(K.energy(1.5, 12)),
        tide: t.map((x) => 2 * Math.cos(((x - t0) * 2 * Math.PI) / (12.42 * 3600))) });
      const dd = await K.fetchDetail(0, 0); dd.tideExt = K.tideExtremes(dd.t, dd.tide); K.fetchDetail = async () => dd;
      Houle.app.cond.click(47.5, -3.3);
    }""")
    page.wait_for_selector("table.wgt", timeout=5000)
    txt = page.inner_text("table.wgt")
    check("(mètres)" in txt and "(secondes)" in txt, "tableau : unités en toutes lettres")
    page.click('[data-act="wgDef"][data-k="s2"]')
    check("mers croisées" in page.inner_text("#wgDef").lower() or "mer croisée" in page.inner_text("#wgDef").lower(), "définition de la 2e houle au toucher")
    check("direction" in txt.lower() and "kJ" in txt, "2e houle : direction et énergie affichées")
    page.click('[data-act="wgUnit"][data-u="ft"]')
    check("Marée du jour" in page.inner_text("#wgBody") and ("Pleine mer" in page.inner_text("#wgBody") or "Basse mer" in page.inner_text("#wgBody")), "marée : heures de pleine et basse mer")
    check("(pieds)" in page.inner_text("table.wgt") and "5" in page.inner_text("table.wgt"), "option pieds")
    page.click('[data-act="closeDlg"]')
    # vue Profondeur : légende et avertissement, retour au vent sans erreur
    page.click('[data-act="condView"][data-k="depth"]')
    check("GEBCO" in page.inner_text("#condPanel") and "naviguer" in page.inner_text("#condPanel"), "vue Profondeur : légende et avertissement")
    page.click('[data-act="condView"][data-k="wind"]')
    check(page.is_visible('[data-act="condView"][data-k="depth"]'), "retour au vent depuis la profondeur")
    page.click('#modeSwitch [data-m="normal"]')
    check(page.is_visible("#kFilter"), "retour à la carte normale")
    # un spot avec marée préférée
    page.evaluate("Houle.app.openSpotDialog(null, { lat: 48.5, lon: -4.6, name: 'Spot test', rules: { tide: 'mid' } })")
    page.wait_for_selector("#f_tide")
    check(page.input_value("#f_tide") == "mid", "marée pré-remplie depuis les conditions")
    page.select_option("#f_tide", "low")
    page.click('#dlg button[type="submit"]')
    page.wait_for_selector(".spot-name")
    check("marée basse" in page.inner_text(".spot-coords"), "la marée préférée s'affiche sur la fiche du spot")
    # onglet Week-end : classement autour d'un point
    page.click('[data-act="tab"][data-tab="weekend"]')
    page.evaluate("Houle.app.weekend.center = { lat: 48.5, lon: -4.6 }; Houle.app.weekend.centerLabel = 'test'")
    page.click('[data-act="wkRadius"][data-k="50"]')
    page.wait_for_selector(".wk", timeout=15000)
    page.wait_for_function("!document.body.innerText.includes('Analyse des prévisions')", timeout=30000)
    check(page.locator(".wk").count() >= 3, "classement : au moins 3 spots proches")
    check("Bon créneau" in page.inner_text(".wk"), "le premier spot a un bon créneau (houle 1,4 m)")
    page.click('.wk [data-act="wkOpen"] >> nth=0')
    check(not errs, "ouvrir un spot du classement sans erreur")
    # lien de partage d'un spot
    page.click('[data-act="tab"][data-tab="spots"]')
    if not page.is_visible('[data-act="linkSpot"]'): page.click('.spot-main >> nth=0')
    page.click('[data-act="linkSpot"]')
    page.wait_for_selector("#lk_url")
    page.check("#lk_notes")
    link = page.input_value("#lk_url")
    check(link.startswith("https://enzovildina-spec.github.io/houle-data/houle.html#spot="), "lien public du spot")
    h = link[link.index("#"):]
    page.close()
    page = b.new_page(viewport={"width": 1280, "height": 800})
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script("try { localStorage.setItem('houle.tour.v1', '1'); } catch (e) {}")
    page.route("**/*", handle)
    page.goto(HTML + h)
    page.wait_for_selector("text=Spot partagé : Spot test", timeout=10000)
    check("marée basse" in page.inner_text("#dlg"), "le lien reçu affiche la marée conseillée")
    page.click('[data-act="lkAdd"]')
    page.wait_for_selector("#f_name")
    check(page.input_value("#f_name") == "Spot test" and page.input_value("#f_tide") == "low", "ajouter le spot reçu : nom et marée pré-remplis")
    page.close()
    page = b.new_page(viewport={"width": 1280, "height": 800})
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script("try { localStorage.setItem('houle.tour.v1', '1'); } catch (e) {}")
    page.route("**/*", handle)
    page.goto(HTML + "#spot=%3Cscript%3Ealert(1)%3C")
    page.wait_for_selector("#btnAdd")
    check(not page.is_visible("#dlg"), "lien abîmé ignoré")
    # import de lieux Google Maps : privé, sans toucher à l'existant, annulable
    import tempfile
    kml = """<?xml version="1.0"?><kml><Document>
      <Placemark><name>Existant bis</name><Point><coordinates>-1.4488,43.5512,0</coordinates></Point></Placemark>
      <Placemark><name>Anse du Nord</name><description>Joli reef</description><Point><coordinates>-4.6,48.4,0</coordinates></Point></Placemark>
      <Placemark><name>Pointe Sud</name><Point><coordinates>-3.1,47.5,0</coordinates></Point></Placemark>
      <Placemark><name>Un trajet</name><LineString><coordinates>1,2,0 3,4,0</coordinates></LineString></Placemark></Document></kml>"""
    kp = os.path.join(tempfile.mkdtemp(), "mes-lieux.kml"); open(kp, "w").write(kml)
    page.evaluate("Houle.app.S.store.saveSpot({ id: 'x1', name: 'Existant', lat: 43.5512, lon: -1.4488, notes: 'ma note', rules: { disc: 'b' } }).then(async () => { Houle.app.S.spots = await Houle.app.S.store.listSpots(); Houle.app.render(); })")
    page.wait_for_selector("text=Existant")
    om0 = calls['om']
    page.click('[data-act="importPlaces"]')
    page.set_input_files("#ip_file", kp)
    page.wait_for_selector(".ip-row")
    check(page.locator(".ip-row").count() == 3, "aperçu : 3 lieux (le tracé est ignoré)")
    check(page.locator(".ip-row input:checked").count() == 2, "le doublon est décoché")
    check("Déjà dans tes spots" in page.inner_text("#dlg"), "le doublon est expliqué")
    page.click("#ipGo")
    page.wait_for_selector("text=Import terminé")
    check(page.evaluate("Houle.app.S.spots.length") == 3, "2 spots ajoutés, l'existant est conservé")
    ex = page.evaluate("Houle.app.S.spots.find(s => s.id === 'x1')")
    check(ex["notes"] == "ma note" and ex["rules"]["disc"] == "b", "le spot existant n'a pas été modifié")
    check(calls['om'] == om0, "aucune prévision chargée pour les spots importés au repos")
    page.click('#dlg [data-act="closeDlg"]')
    page.click('.spot-main >> text=Anse du Nord')
    page.wait_for_selector('[data-act="followSpot"]')
    page.wait_for_timeout(800)
    check(calls['om'] > om0, "la prévision se charge à l'ouverture d'un spot importé")
    page.click('[data-act="importPlaces"]')
    page.click('[data-act="ipUndo"]')
    page.wait_for_selector("text=Import annulé")
    check(page.evaluate("Houle.app.S.spots.map(s => s.name).join('|')") == "Existant", "annuler l'import retire seulement les spots importés")
    # exposition estimée d'après la côte : un spot sans conditions publiées en reçoit, et la houle masquée est atténuée
    import tempfile
    html = open(os.path.join(ROOT, "dist", "houle.html"), encoding="utf-8").read()
    ex = {"v": 1, "src": "test", "spots": {"47.6382,-3.2092": {"o": [200, 320], "w": [20, 100], "f": [0] * 18 + [300] * 18}}}
    import re
    mm = re.search(r'\.exposureData = \{"v":1,.*?\};\n', html)
    check(mm is not None, "le fichier d'exposition est embarqué")
    marker = mm.group(0) if mm else ''
    tmp = os.path.join(tempfile.mkdtemp(), "houle-expo.html")
    open(tmp, "w", encoding="utf-8").write(html.replace(marker, ".exposureData = " + json.dumps(ex) + ";\n"))
    p2 = b.new_page(viewport={"width": 390, "height": 800})
    p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.add_init_script("try { localStorage.setItem('houle.tour.v1', '1'); } catch (e) {}")
    p2.route("**/*", handle)
    p2.goto("file://" + tmp)
    p2.wait_for_selector("#btnAdd", timeout=15000)
    p2.evaluate("Houle.app.showKnown(Houle.app.known.findIndex(k => k.name === \"Barre d'Étel\"), false)")
    p2.wait_for_selector("text=estimation d'après la côte")
    check(True, "les conditions estimées d'après la côte sont signalées")
    p2.click('[data-act="knownFc"]')
    p2.wait_for_selector("#kfc .strip", timeout=15000)
    check("masquée par la côte" in p2.inner_text("#kfc"), "la note d'atténuation s'affiche")
    check(p2.evaluate("Houle.app.knownRules(Houle.app.known.find(k => k.name === \"Barre d'Étel\")).swellFrom") == 200, "les règles reprennent la fenêtre estimée")
    check(not errs, "aucune erreur JavaScript : " + "; ".join(errs[:3]))
    b.close()
print("\n%d échec(s)" % len(fails))
sys.exit(1 if fails else 0)
