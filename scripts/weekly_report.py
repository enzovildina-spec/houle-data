#!/usr/bin/env python3
"""Rapport hebdomadaire Houle : écrit un texte Markdown sur la sortie standard (publié en « issue » GitHub par le workflow)."""
import json, os, re, subprocess, sys, urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.environ.get("PAGES_URL", "https://enzovildina-spec.github.io/houle-data/")
lines, problems = [], []

def run(cmd, timeout=600):
    try:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr)[-1500:]
    except Exception as e:
        return 1, str(e)

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "houle-weekly-check"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()

def section(title, ok, detail=""):
    lines.append(f"- {'✅' if ok else '❌'} **{title}**" + (f" : {detail}" if detail else ""))
    if not ok: problems.append(title)

now = datetime.now(timezone.utc)
lines.append(f"# Rapport Houle du {now.strftime('%d/%m/%Y')}\n")
lines.append("## Contrôles automatiques")

# 1. données météo mondiales
try:
    st, body = fetch(PAGES + "meta.json")
    meta = json.loads(body)
    gen = datetime.strptime(meta["generated"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    age = (now - gen).total_seconds() / 3600
    section("Données météo mondiales fraîches", age <= 14, f"dernière mise à jour il y a {age:.0f} h (cycle {meta['cycle']})")
except Exception as e:
    section("Données météo mondiales", False, f"illisibles ({e})")

# 2. appli en ligne
try:
    st, body = fetch(PAGES + "houle.html")
    section("Appli publiée", st == 200 and len(body) > 100000, f"{len(body)//1024} Ko")
except Exception as e:
    section("Appli publiée", False, f"inaccessible ({e})")

# 3. Open-Meteo répond
try:
    st, _ = fetch("https://marine-api.open-meteo.com/v1/marine?latitude=48.2&longitude=-4.6&hourly=wave_height&forecast_days=1")
    section("Open-Meteo (houle) répond", st == 200)
except Exception as e:
    section("Open-Meteo (houle) répond", False, str(e))

# 4. construction et tests
code, out = run(["node", "app/build.js"])
section("Construction de l'appli", code == 0, out.strip().splitlines()[-1] if out.strip() else "")
code, out = run(["node", "app/test/logic.test.js"])
section("Tests de la logique", code == 0, "" if code == 0 else "\n```\n" + out + "\n```")
code, out = run(["python3", "app/test/smoke.py"])
section("Test de démarrage (navigateur)", code == 0, "" if code == 0 else "\n```\n" + out + "\n```")

# 5. spots sans conditions
try:
    rows = json.load(open(os.path.join(ROOT, "app/src/data/known-spots.json")))
    def has(r):
        e = r[6] if len(r) > 6 and isinstance(r[6], dict) else {}
        return bool(e.get("wd") or e.get("sw"))
    miss = [r[0] for r in rows if not has(r)]
    lines.append(f"- 📍 **Spots connus** : {len(rows)}, dont {len(miss)} sans conditions renseignées")
except Exception as e:
    lines.append(f"- ⚠️ Spots non lus ({e})")

# 6. suggestions : les 3 premiers chantiers non cochés
todo = []
try:
    for l in open(os.path.join(ROOT, "BACKLOG.md"), encoding="utf-8"):
        m = re.match(r"- \[ \] (.+)", l.strip())
        if m: todo.append(m.group(1))
except Exception:
    pass
lines.append("\n## Prochains chantiers proposés")
lines += [f"{i+1}. {t}" for i, t in enumerate(todo[:3])] or ["Rien en attente : ajoute des idées dans `BACKLOG.md`."]
lines.append("\n## Pour avancer")
lines.append("Ouvre la conversation avec Claude et écris simplement « continue Houle » : il prend le premier chantier de la liste.")
if problems:
    lines.insert(1, f"\n> ⚠️ **{len(problems)} point(s) à regarder** : " + ", ".join(problems) + "\n")
print("\n".join(lines))
