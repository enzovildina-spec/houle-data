"""Test de fumée : l'appli démarre sans erreur JavaScript et le mode Conditions s'ouvre (réseau simulé)."""
import os, sys
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
    check(not errs, "aucune erreur JavaScript : " + "; ".join(errs[:3]))
    b.close()
print("\n%d échec(s)" % len(fails))
sys.exit(1 if fails else 0)
