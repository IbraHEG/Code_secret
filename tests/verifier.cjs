/* Rapport reproductible : tests existants + empreintes de la version vérifiée.
   Aucune installation automatique et aucun appel à un service externe. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const files = ['index.html', 'styles.css', 'game.js', 'app.js', 'package.json',
  'tests/game.test.cjs', 'tests/api.test.cjs', 'tests/api-browser-check.cjs', 'tests/browser-check.cjs', 'tests/verifier.cjs'];
const report = {
  dateUTC: new Date().toISOString(), version, node: process.version,
  portee: 'Tests automatisés locaux, et contrôle de l’URL MASTERMIND_URL si renseignée ; ne remplace pas un essai sur téléphone réel.',
  empreintesSHA256: Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])),
  controles: [],
};
function run(id, args, expected, extraEnv = {}) {
  const env = { ...process.env };
  delete env.MASTERMIND_URL;
  Object.assign(env, extraEnv);
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env, timeout: 120000 });
  const passed = !result.error && result.status === 0;
  const entry = { id, attendu: expected, statut: passed ? 'reussi' : 'a-examiner',
    codeSortie: result.status, sortie: result.stdout.trim() };
  if (extraEnv.MASTERMIND_URL) entry.url = extraEnv.MASTERMIND_URL;
  if (!passed) entry.diagnostic = result.error?.message || result.stderr.trim();
  report.controles.push(entry);
  console.log(`${id} : ${entry.statut}`);
}
run('regles-et-contrat', ['--test', 'tests/game.test.cjs', 'tests/api.test.cjs'],
  '14 tests réussis : règles, contrat 0.2 et 1 679 616 couples de codes conformes au calcul indépendant.');
let browserAvailable;
try { require.resolve('playwright'); browserAvailable = true; } catch { browserAvailable = false; }
if (browserAvailable) {
  run('api-et-interface', ['tests/api-browser-check.cjs'],
    'API accessible seulement en mode test ; résultats T01–T09, refus, fins et redémarrages conformes ; même partie au clavier et via API.');
  run('interface-et-tactile-simule', ['tests/browser-check.cjs'],
    'Saisie/modification, refus, victoire au dixième, défaite et redémarrage conformes ; aucun débordement à 320/375/390/768 px ; saisie tactile simulée possible.');
  if (process.env.MASTERMIND_URL) {
    run('api-et-interface-publiees', ['tests/api-browser-check.cjs'],
      'Contrôles du contrat et du lien API/interface réussis sur l’URL publique fournie.',
      { MASTERMIND_URL: process.env.MASTERMIND_URL });
  }
} else {
  report.controles.push({ id: 'controles-navigateur', statut: 'non-verifie',
    diagnostic: 'Playwright indisponible. Aucun résultat navigateur ne peut être conclu de cette exécution.' });
  console.log('Contrôles navigateur : non vérifiés (Playwright indisponible).');
}
fs.mkdirSync(path.join(root, 'verification'), { recursive: true });
fs.writeFileSync(path.join(root, 'verification', 'resultats-automatiques.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Rapport : verification/resultats-automatiques.json');
if (report.controles.some(check => check.statut !== 'reussi')) process.exitCode = 1;
