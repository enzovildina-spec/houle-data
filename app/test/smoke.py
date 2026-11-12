"""Test de fumée : l'appli démarre sans erreur JavaScript et le mode Conditions s'ouvre (réseau simulé)."""
import json, os, sys
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = "file://" + os.path.join(ROOT, "dist", "houle.html")
STUB = open(os.path.join(ROOT, "test", "leaflet-stub.js")).read()
fails = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

def handle(route):
    u = route.request.url
    if u.startswith("file://"): return route.continue_()
    if "unpkg.com/leaflet" in u:
        if u.endswith(".js"): return route.fulfill(status=200, content_type="application/javascript", body=STUB)
        return route.fulfill(status=200, content_type="text/css", body="")
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
    check(not errs, "aucune erreur JavaScript : " + "; ".join(errs[:3]))
    b.close()
print("\n%d échec(s)" % len(fails))
sys.exit(1 if fails else 0)
