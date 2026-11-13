/* Usage : node app/tools/build-exposure.js land.geojson [known-spots.json] [sortie.json]
   Calcule l'exposition de chaque spot connu d'après un trait de côte (Natural Earth, domaine public).
   Estimation simple : ne tient pas compte des fonds, des courants ni de la houle qui contourne les caps. */
const fs = require('fs');
const path = require('path');
const X = require('./exposure-core.js');
const land = process.argv[2];
if (!land) { console.error('Il faut le fichier de terres (GeoJSON).'); process.exit(1); }
const spotsFile = process.argv[3] || path.join(__dirname, '../src/data/known-spots.json');
const out = process.argv[4] || path.join(__dirname, '../src/data/exposure.json');
const rings = X.ringsFromGeoJSON(JSON.parse(fs.readFileSync(land, 'utf8')));
const seg = X.segmentsOf(rings);
console.log(rings.length, 'anneaux,', seg.length / 4, 'segments');
const spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8'));
const res = {};
let n = 0;
for (const s of spots) {
  const e = X.computeExposure(seg, s[1], s[2]);
  if (e.o) res[X.key(s[1], s[2])] = { o: e.o, w: e.w, f: e.f };
  if (++n % 50 === 0) console.log(n, '/', spots.length);
}
fs.writeFileSync(out, JSON.stringify({ v: 1, src: 'Natural Earth (terres, domaine public)', spots: res }));
console.log(Object.keys(res).length, 'spots écrits dans', out);
