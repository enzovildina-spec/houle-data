// Assemble src/ en un seul fichier : dist/houle.html
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const order = ['util', 'import-parse', 'exposure', 'forecast', 'conditions', 'global', 'store-local', 'store-supabase', 'map', 'app-core', 'app-spots', 'app-social', 'app-help', 'app-known', 'app-weekend', 'app-link', 'app-import', 'app-cond'];
const known = '/* ===== known-spots ===== */\n(globalThis.Houle = globalThis.Houle || {}).knownSpots = ' + read('src/data/known-spots.json').trim() + ';\n';
const expo = '/* ===== exposure-data ===== */\n(globalThis.Houle = globalThis.Houle || {}).exposureData = ' + read('src/data/exposure.json').trim() + ';\n';
let stamp = '';
try { stamp = require('child_process').execSync('git log -1 --format=%h\\ %cd --date=format:%d/%m\\ %H:%M', { cwd: __dirname }).toString().trim(); } catch (e) { stamp = new Date().toISOString().slice(0, 16); }
const ver = '/* ===== version ===== */\n(globalThis.Houle = globalThis.Houle || {}).version = ' + JSON.stringify(stamp) + ';\n';
const js = ver + known + expo + order.map((n) => '/* ===== ' + n + ' ===== */\n' + read('src/js/' + n + '.js')).join('\n') + '\n\nHoule.app.boot();\n';
if (js.includes('</script')) throw new Error('</script> trouvé dans le code JS');

const html = read('src/template.html').replace('/*__CSS__*/', () => read('src/styles.css')).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/houle.html'), html);
console.log('dist/houle.html', Math.round(html.length / 1024) + ' Ko');
