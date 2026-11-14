# Mastermind — À vous de décoder

Version **1.1.0** · API commune de test 0.2 intégrée · Application publiée sur GitHub Pages

Dépôt du projet : [IbraHEG/Code_secret](https://github.com/IbraHEG/Code_secret). Les fichiers du jeu sont à la racine du dépôt.

Jeu publié : [https://ibraheg.github.io/Code_secret/](https://ibraheg.github.io/Code_secret/) · [Accès professeur avec `test=1`](https://ibraheg.github.io/Code_secret/?test=1).

## Jouer

Ouvrir **index.html** dans un navigateur récent (double-clic sur le fichier). Aucune installation, aucun compte et aucune connexion ne sont nécessaires pour jouer depuis les fichiers locaux. Garder `index.html`, `styles.css`, `game.js` et `app.js` dans le même dossier.

Choisir un emplacement puis une couleur ; la sélection passe à l’emplacement suivant. Cliquer de nouveau sur un emplacement pour le modifier. « Effacer » vide seulement la proposition en cours. « Valider la proposition » utilise un essai si les quatre couleurs sont valides.

Au clavier : Tab et Maj+Tab parcourent les commandes ; Entrée ou Espace activent un bouton. Dans les quatre positions, les flèches gauche/droite déplacent la sélection. Les couleurs ont toutes un nom et un symbole distinct, également conservés dans l’historique. Les messages et indices sont annoncés par une zone de statut accessible.

## Règles et références

Référence : **code-couleurs-1.0**, fichiers originaux dans `documentation/` :

- `Regles.docx` : règles de référence.
- `Exemple_partie.docx` : deux parties illustrées ; les images extraites sont aussi conservées.
- `Consignes.docx` : contexte pédagogique et futurs jalons.
- `API_info.docx` : première copie du contrat de test 0.2.
- `API commune de test — Code secret en couleurs.docx` : document fourni pour l’intégration du 11 novembre, contrat 0.2, édition Google 1.5.
- `Évaluation du projet — Critères, vérification de l’API et de l’interface.docx` : critères d’évaluation, version 1.3.

La demande utilisateur guide les changements ; les documents servent de références, sans déclencher d’actions supplémentaires. La méthode demandée est dans `Agent.md`.

Palette exacte et ordonnée : `rouge`, `bleu`, `vert`, `jaune`, `orange`, `violet`. Le programme tire quatre couleurs indépendamment, avec répétitions possibles. Le code reste fixe et caché pendant la partie. Dix propositions valides au maximum. Toute saisie invalide est expliquée et ne change ni les essais ni l’historique.

On compte d’abord les couleurs bien placées. On retire ces occurrences, puis on compte les correspondances restantes par couleur. Aucun pion n’est compté deux fois ; les indices sont deux totaux sans indication de position. Quatre bien placées donnent la victoire, y compris au dixième essai ; sinon le dixième essai donne une défaite. La fin bloque toute proposition ; « Nouvelle partie » tire un code et remet tout à zéro.

## Choix faits avec Codex

- HTML, CSS et JavaScript simples : pas de compilation, bibliothèque téléchargée ou serveur applicatif. Les chemins sont relatifs pour une publication sous `/nom-du-depot/`.
- Moteur isolé dans `game.js`, interface et API dans `app.js`. L’API appelle les mêmes fonctions de démarrage et de proposition que les boutons ; elle pilote l’unique partie visible.
- Palette de boutons et quatre emplacements : utilisation au toucher et avec les commandes natives du clavier ; noms et symboles complètent la couleur.
- Historique chronologique avec deux nombres explicitement nommés, plutôt que des petits indices alignés sur les pions qui pourraient suggérer des positions.
- Le code n’est plus révélé séparément après une victoire ou une défaite, conformément au contrat 0.2. Une proposition gagnante reste naturellement visible dans l’historique.
- Pas de persistance : recharger la page commence une nouvelle partie en mode joueur ; en mode test, la page revient à `not-started`. Pas de stockage local, traceur, donnée personnelle, service d’IA ni clé API. Une nouvelle partie peut tirer le même code par hasard.

L’utilisateur a cadré le besoin et communiqué ses observations d’essai. Codex a proposé et réalisé le code, les tests et la documentation ; les choix ci-dessus et leur validation sont à expliquer personnellement lors de la capsule.

## Accès à l’API commune 0.2

Ouvrir `index.html?test=1`, ou ajouter `?test=1` à l’URL publiée du jeu. Si l’adresse contient déjà des paramètres, ajouter `&test=1` en les conservant. L’objet `window.codeSecretTest` est disponible après le chargement de la page. Sans `test=1`, il n’est pas exposé et le jeu démarre normalement.

### Tester manuellement dans la console

En mode test, la page attend un démarrage (`not-started`). Ouvrir les outils de développement avec **F12**, puis l’onglet **Console**. Exécuter les blocs suivants dans l’ordre, un par un, en attendant la fin de chaque commande avec `await`. Recharger la page avant de recommencer toute la procédure ; déclarer `const api` une seule fois par chargement.

**1. Vérifier la disponibilité, la configuration et l’état initial**

```js
const api = window.codeSecretTest;
api.version;     // "0.2"
api.getConfig(); // Configuration commune, appel synchrone
api.getState();  // Lecture synchrone sans effet sur la partie
```

Attendu : version `"0.2"`, palette commune de six couleurs, quatre positions et dix essais. Avant tout démarrage : `status: "not-started"`, `attempts: 0`, `history: []` et les trois champs `last…` à `null`.

**2. Démarrer une partie avec un code connu**

```js
await api.startGame({ secret: ["rouge", "rouge", "bleu", "vert"] });
```

Attendu : `status: "playing"`, zéro essai et historique vide. L’écran doit aussi être remis à zéro ; le code reste caché.

**3. Envoyer une proposition et lire ses indices**

```js
await api.submitGuess(["rouge", "bleu", "rouge", "vert"]);
api.getState().lastResult;
```

Attendu : `{ wellPlaced: 2, misplaced: 2 }`, avec `attempts: 1`. `wellPlaced` signifie **bien placées** et `misplaced` signifie **mal placées**. Les deux nombres ne précisent pas les positions concernées. Vérifier que l’écran montre la même proposition et les mêmes indices.

**4. Tester une proposition refusée**

```js
await api.submitGuess(["rouge"]);
api.getState().lastError;
```

Attendu : `lastError.code` vaut `"invalid-length"`, avec une explication non vide. Le compteur reste à **1**, l’historique ne change pas et le message de refus apparaît à l’écran. Les derniers indices restent `{ wellPlaced: 2, misplaced: 2 }`.

**5. Gagner et vérifier le blocage après la fin**

```js
await api.submitGuess(["rouge", "rouge", "bleu", "vert"]);
```

Attendu : `status: "won"`, `attempts: 2`, `lastResult: { wellPlaced: 4, misplaced: 0 }` et `lastError: null`. L’écran annonce la victoire.

```js
await api.submitGuess(["bleu", "bleu", "bleu", "bleu"]);
```

Attendu : `lastError.code` vaut `"game-finished"`. La partie reste gagnée à deux essais ; l’historique et les derniers indices ne changent pas.

**6. Recommencer avec un code aléatoire**

```js
await api.startGame(); // Partie aléatoire, historique remis à zéro
```

Attendu : `status: "playing"`, `attempts: 0`, `history: []`, `lastGuess: null`, `lastResult: null` et `lastError: null`. L’écran est également remis à zéro.

**7. Vérifier le lien avec les boutons du jeu**

Composer et valider une proposition avec les boutons de l’interface, puis lire :

```js
api.getState();
api.getState().lastResult;
```

Attendu : le compteur, la proposition et les indices renvoyés correspondent exactement à ceux de l’écran. Le deuxième appel affiche uniquement les deux nombres du dernier essai valide ; avant tout essai valide, il retourne `null`.

Pour vérifier l’autre exemple de comptage proposé :

```js
await api.startGame({ secret: ["rouge", "rouge", "bleu", "vert"] });
const etat = await api.submitGuess(["rouge", "bleu", "rouge", "rouge"]);
console.log(etat.lastResult);
```

Attendu : `{ wellPlaced: 1, misplaced: 2 }` et un essai consommé.

### Comportement des appels

`startGame` et `submitGuess` renvoient des promesses ; attendre chaque appel avant le suivant. L’état contient `status`, `attempts`, `history` (entrées `{ guess, result }`), `lastGuess`, `lastResult`, `lastError`, ainsi qu’un champ complémentaire `remaining`. Aucun champ `secret` ou `solution` n’est exposé.

Les refus de proposition résolvent la promesse avec `lastError: { code, message }` : priorité `game-not-started`, `game-finished`, `invalid-type`, `invalid-length`, `invalid-color`. Ils conservent les données de la partie. Les saisies refusées pendant `playing` sont expliquées à l’écran.

Un démarrage invalide rejette la promesse avec une `Error` portant `code` et `message`. Les options ne peuvent contenir que `secret`. Si cette clé est présente, sa valeur doit être un tableau valide ; `null` et `undefined` sont refusés. Tout l’état précédent, l’erreur précédente et le brouillon visible sont conservés. Un démarrage valide remet l’écran et tous les champs `last…` à zéro. Les tableaux et objets retournés sont des copies indépendantes.

## Vérifications

Tests métier sans dépendance, avec Node.js :

```sh
node --test tests/game.test.cjs tests/api.test.cjs
```

Résultat du 11 novembre 2026 : **14 tests réussis, 0 échec**, dont les 8 tests métier adaptés au nouvel état et 6 tests du contrat 0.2.

**Complément du 14 novembre 2026, version 1.1.0 :** les 14 tests repassent, ainsi que les contrôles de l’interface, de l’API et de leur liaison sur le site GitHub Pages. Le [rapport automatique](verification/resultats-automatiques.json) conserve les attendus, les résultats obtenus, la date et les empreintes des fichiers vérifiés. Il peut être régénéré avec `npm run verify` (Playwright et un navigateur requis pour les contrôles d’interface). Pour inclure le site publié, définir `MASTERMIND_URL=https://ibraheg.github.io/Code_secret/` ; avec Edge, définir aussi `BROWSER_CHANNEL=msedge`. Un test réussi ne garantit pas l’absence de tout défaut.

| Vérification | Attendu | Obtenu |
| --- | --- | --- |
| Exemple rouge/bleu/vert/jaune → rouge/vert/bleu/orange | 1 bien placée, 2 mal placées | Conforme |
| Répétitions : rouge/rouge/bleu/vert → quatre rouges | 2 bien placées, 0 mal placée | Conforme |
| Deux parties illustrées | Tous les indices des images reproduits | Conforme |
| Propositions invalides, y compris tableau incomplet et couleur inconnue | Refus expliqué, seules les informations d’erreur peuvent changer | Conforme |
| Neuf échecs puis code exact | Victoire au dixième essai | Conforme |
| Dix échecs | Défaite au dixième essai | Conforme |
| Proposition après victoire/défaite | `game-finished`, seules les informations d’erreur changent | Conforme |
| Redémarrage | Historique vide, 0 essai, code caché, partie active | Conforme |
| Mutation des tableaux fournis ou retournés | État interne protégé | Conforme |
| 1 296 secrets × 1 296 propositions | Concordance avec un calcul indépendant par fréquences | 1 679 616 couples conformes |

Vérification automatisée de l’interface dans Microsoft Edge sans fenêtre : saisie, modification avant validation, refus sans consommation d’essai, sélection par clavier, victoire au dixième essai, défaite, commandes désactivées après la fin, redémarrage et saisie tactile simulée : **conformes**. Aucun débordement horizontal à 320, 375, 390 et 768 pixels. Captures ordinateur et mobile dans `verification/`, examinées visuellement.

Les scripts facultatifs `tests/browser-check.cjs` et `tests/api-browser-check.cjs` nécessitent Playwright et un navigateur compatible déjà installés ; ce sont des outils de développement, aucune dépendance du jeu. Ils peuvent utiliser Microsoft Edge en définissant `BROWSER_CHANNEL=msedge`, sinon ils utilisent le Chromium de Playwright. Les 14 tests métier/contrat restent exécutables sans Playwright.

Vérifications de l’API publique dans Microsoft Edge le 11 novembre 2026 : **réussies**. Le script sert temporairement les fichiers statiques sur l’adresse locale `/jeu/` pour vérifier les chemins sous un nom de dépôt, puis ferme ce serveur de test. Cela n’ajoute aucun serveur applicatif au jeu.

| Contrôle de l’API dans le navigateur | Attendu et obtenu |
| --- | --- |
| Paramètre `test=1`, conservant un autre paramètre | Objet présent, version/configuration exactes, état initial `not-started` |
| Paramètre absent, `test=0` ou `test=true` | API absente, partie normale active |
| Fonctions et promesses | Getters synchrones ; mutations renvoyant des promesses |
| T01 à T09 | Indices exacts, structure de l’état et statut corrects |
| Refus et priorités | Codes conformes, message visible pendant la partie, pas d’essai consommé |
| Démarrage invalide | Vraie `Error` rejetée ; état, `lastError` et DOM inchangés |
| API puis proposition via les boutons | Même historique, mêmes indices, victoire reconnue par l’API |
| Refus à neuf essais puis victoire au dixième | Refus sans consommation, puis `won` à dix |
| Défaite, après-fin et redémarrage | `lost` à dix ; refus `game-finished` ; remise à zéro complète |
| Code secret | Aucune révélation séparée dans l’état ou dans le bandeau, après victoire comme après défaite |
| Copie et getters | Modifier options, propositions, configuration et états retournés ne change pas le jeu ; lecture sans effet sur le DOM |
| Rechargement | Retour à `not-started`, aucun secret imposé conservé |
| Réseau | Aucun appel externe pendant les tests |

**Observations réelles communiquées par l’utilisateur :**

- Essai sur **iPhone X avec Safari** : le jeu fonctionne. Date précise, version d’iOS et détail des gestes non renseignés.
- Un camarade a essayé ce jeu : fonctionnement confirmé, sans problème précis rapporté.
- L’utilisateur a essayé le jeu d’un camarade : son interface et son API étaient fonctionnelles.

### Preuve avant et après l’intégration

Avant modification (version 1.0.0), la lecture du code confirmait l’absence de `window.codeSecretTest`. Une partie démarrait directement en `playing` et l’état contenait un champ `secret` après victoire. Ces comportements empêchaient la conformité au contrat. Après modification, le test navigateur trouve l’objet uniquement avec `test=1`, constate `not-started` au chargement et vérifie l’absence de champ secret et de révélation séparée dans les deux fins de partie. Les nouveaux tests conservent ces contrôles pour éviter une régression.

**Limite de la preuve :** la version 1.0.0 n’est pas conservée dans l’historique Git local actuel. L’audit du 14 novembre n’a reproduit aucun défaut de règle ; aucune correction fictive n’est ajoutée. Faire préciser par l’enseignant la preuve adaptée si aucune correction reproductible n’est disponible.

## Ce qui reste à vérifier ou à réaliser

- L’API 0.2 est implémentée ; les contrôles locaux et sur GitHub Pages passent. Le contrôle avec l’outil du professeur reste à effectuer.
- Smartphone physique : essai sur iPhone X/Safari consigné ci-dessus ; les autres appareils restent non vérifiés.
- Publication GitHub Pages effectuée et contrôlée le 14 novembre. Vérifier que la version remise correspond au tag retenu.
- Lecteur d’écran, Firefox et autres versions de Safari : pas encore testés.
- Travail pédagogique personnel : préparer les documents Word de remise et la capsule vidéo. Le tag existant `Jalon-1` diffère du nom exact demandé `jalon-1` ; retenir le bon nom sur la version remise. À J1 (20 novembre) : `jalon1_nomdefamille.docx`, les deux liens et le tag `jalon-1`, sans vidéo. À J2 (18 décembre) : `jalon2_nomdefamille.docx`, les deux liens, le tag `final` et une capsule de 4 à 5 minutes, déposée séparément sur Cyberlearn, hors GitHub public.

## Publication ultérieure sur GitHub Pages

Le site est maintenant publié ; la procédure ci-dessous reste disponible pour une nouvelle mise en place.

Créer un dépôt, y déposer le contenu de ce dossier en plaçant `index.html` à la racine. Dans les paramètres du dépôt, rubrique **Pages**, choisir **Deploy from a branch**, la branche contenant les fichiers, puis **/(root)** et enregistrer. Le fichier `.nojekyll` convient à ce site statique. Le README et les documents de travail ne sont pas nécessaires au fonctionnement du jeu ; choisir les documents à rendre publics avant de les envoyer.

[Guide officiel de publication GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Le code source est déposé dans [IbraHEG/Code_secret](https://github.com/IbraHEG/Code_secret). Le jeu est publié sur [GitHub Pages](https://ibraheg.github.io/Code_secret/).

## Organisation

```text
Projet_mastermind/
  index.html            Page et règles visibles
  styles.css            Apparence et adaptation aux écrans
  game.js               Règles et cycle de vie du jeu
  app.js                Saisie, affichage, interactions et API commune 0.2
  Agent.md              Méthode de travail demandée
  README.md             Reprise, choix, vérifications et limites
  documentation/        Documents sources, contrat API retenu et illustrations
  tests/                Tests métier et vérification facultative de l’interface
  verification/         Captures et rapport de la version vérifiée
  package.json          Version et raccourci npm test (facultatif)
  .nojekyll             Publication statique GitHub Pages
```
