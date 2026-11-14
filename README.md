# Mastermind — À vous de décoder

Version du jeu **1.1.0** · API **0.2** · Règles **code-couleurs-1.0**  
Audit de préparation à l’évaluation : **14 novembre 2026**. Les empreintes des fichiers testés sont dans [le rapport automatique](verification/resultats-automatiques.json).

- **Code :** [IbraHEG/Code_secret](https://github.com/IbraHEG/Code_secret).
- **Jeu :** [Jouer sur GitHub Pages](https://ibraheg.github.io/Code_secret/).
- **Mode professeur :** [Ouvrir le jeu avec `test=1`](https://ibraheg.github.io/Code_secret/?test=1).

## Jouer et comprendre le code

Ouvrir le site ou, localement, double-cliquer sur `index.html`. Les fichiers `index.html`, `styles.css`, `game.js` et `app.js` suffisent : pas d’installation, de compilation ou de serveur applicatif. Choisir une position, puis une couleur. Chaque position peut être modifiée avant validation ; « Effacer » vide le brouillon.

Au clavier : Tab/Maj+Tab pour parcourir les commandes, Entrée/Espace pour les activer ; les flèches gauche/droite changent la position sélectionnée. Chaque couleur a un nom et un symbole, également présents dans l’historique.

Le programme tire quatre couleurs parmi `rouge`, `bleu`, `vert`, `jaune`, `orange`, `violet`, dans cet ordre de palette. Le code reste fixe et caché, avec répétitions possibles. Il y a dix essais valides. Une proposition invalide est expliquée, sans essai ni entrée d’historique supplémentaire. On compte d’abord les bien placées, puis les correspondances parmi les occurrences restantes : chaque pion compte une seule fois et les indices ne désignent pas les positions. Quatre bien placées donnent la victoire, même au dixième essai ; sinon le dixième essai donne la défaite. Les propositions sont ensuite bloquées ; « Nouvelle partie » remet tout à zéro.

`game.js` contient le calcul et l’état de la partie. `app.js` relie ce moteur aux boutons et à l’API : il n’y a qu’une partie. `styles.css` adapte l’affichage aux écrans. Les tests sont dans `tests/`, les résultats et captures dans `verification/`. La méthode de travail est conservée dans [Agent.md](Agent.md).

## Choix et rôle de Codex — C1

L’utilisateur a fixé les règles communes, l’accessibilité au clavier et au toucher, les noms/symboles des couleurs et l’absence de compte, de données personnelles, de service d’IA ou de clé API dans le jeu. Il a demandé l’intégration de l’API à partir du contrat et des commandes de test manuel, puis a communiqué les observations réelles ci-dessous.

Codex a proposé et réalisé une application statique en HTML/CSS/JavaScript, un moteur séparé de l’affichage, les tests et la documentation. Le choix d’un moteur commun aux boutons et à l’API évite que le professeur teste une autre partie que celle affichée. Les indices sont des nombres accompagnés de libellés plutôt que des pions alignés avec les positions. Le code n’est jamais révélé séparément, conformément au contrat.

La validation des choix et leur explication dans la capsule restent personnelles. Recharger recommence la partie ; aucune sauvegarde, collecte, extension PWA ou fonction hors ligne n’a été ajoutée.

## API commune et commandes manuelles

L’objet `window.codeSecretTest` est exposé seulement avec `test=1`. Si l’adresse contient déjà un paramètre, ajouter `&test=1`. Le mode test attend un démarrage (`not-started`) ; le mode joueur démarre normalement.

`getConfig()` et `getState()` sont synchrones. `startGame(options?)` et `submitGuess(guess)` renvoient des promesses : attendre chaque appel. L’état contient `status`, `attempts`, `history` (entrées `{ guess, result }`), `lastGuess`, `lastResult`, `lastError` et le complément `remaining`. Aucun champ `secret` ou `solution` n’est exposé.

Un refus de proposition renseigne `lastError` sans changer les données de jeu. Priorité : `game-not-started`, `game-finished`, `invalid-type`, `invalid-length`, `invalid-color`. Un démarrage invalide rejette une `Error` portant `code` et `message`, en conservant tout l’état et l’écran. Les objets retournés sont des copies indépendantes.

<details>
<summary>Afficher les commandes de test manuel et leurs résultats attendus</summary>

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

</details>

## Vérifications et limites — C2

Commandes à lancer dans le dossier du projet, avec Node.js :

```sh
npm test
npm run test:api-browser
npm run test:interface
npm run verify
```

`npm test` n’a aucune dépendance. Les contrôles navigateur nécessitent Playwright et son Chromium, ou Microsoft Edge avec `BROWSER_CHANNEL=msedge`. Aucun logiciel n’est installé automatiquement. `npm run verify` écrit le [rapport JSON](verification/resultats-automatiques.json) : date, version, empreintes des sources, attendus et résultats réellement obtenus. Un outil absent ou bloqué ne vaut pas preuve d’un défaut du jeu.

Pour contrôler aussi la version publiée, définir `MASTERMIND_URL` avant la vérification, par exemple dans PowerShell :

```powershell
$env:BROWSER_CHANNEL = "msedge"
$env:MASTERMIND_URL = "https://ibraheg.github.io/Code_secret/"
npm run verify
```

Le rapport distingue les essais locaux du contrôle du site ; les empreintes locales ne certifient pas, à elles seules, le contenu du site publié. Un scénario réussi ne prouve pas l’absence de tout défaut.

| Règle / action vérifiée, version 1.1.0 | Attendu | Obtenu dans l’audit local |
| --- | --- | --- |
| Calcul des répétitions et 1 296 secrets × 1 296 propositions | Aucun double comptage, concordance avec un calcul indépendant | 1 679 616 couples conformes ; 14 tests métier/contrat réussis |
| API : présence, configuration, état initial, T01–T09 | API seulement avec `test=1`, contrat 0.2 et indices exacts | Réussi dans Microsoft Edge |
| Saisies invalides, priorités et démarrage invalide | Refus conforme sans consommer d’essai ; démarrage invalide sans mutation | Réussi |
| Neuf échecs, refus, puis code exact ; dix échecs ; action après fin ; redémarrage | `won` à dix ou `lost` à dix ; partie figée, puis remise à zéro | Réussi dans le moteur et l’interface |
| Code rouge–rouge–bleu–vert, proposition rouge–bleu–rouge–vert via API | 2 bien placées, 2 mal placées, 1 essai et même affichage | Réussi |
| Refus puis proposition complète/modifiée au clavier ; lecture de l’API | Même historique, erreur visible sans consommation, victoire à deux essais | Réussi |
| Getters et modifications des entrées/résultats retournés | Lecture sans effet et copies indépendantes | Réussi |
| Interface : noms/symboles, clavier, tactile simulé, largeurs 320/375/390/768 px | Commandes utilisables, historique lisible, aucun débordement horizontal | Réussi ; le tactile simulé ne remplace pas le téléphone réel |

### Observations personnelles communiquées

- **Smartphone réel : iPhone X, Safari.** L’utilisateur indique avoir essayé le jeu et constate qu’il fonctionne. La date de l’essai, la version d’iOS et le détail des gestes testés n’ont pas été précisés ; aucun résultat plus détaillé n’est supposé.
- **Retour reçu sur ce jeu :** un camarade l’a testé et a indiqué qu’il fonctionne. Aucun problème précis n’a été rapporté.
- **Jeu d’un camarade essayé par l’utilisateur :** son interface et son API étaient fonctionnelles. Le jeu n’a pas été nommé et aucun défaut n’a été signalé.

### Correction et trace avant/après

Lors de l’intégration de l’API le 11 novembre, la version 1.0.0 ne l’exposait pas, démarrait directement et renvoyait le code en fin de partie. L’intégration 1.1.0 a ajouté le mode test, son état initial et supprimé cette divulgation. Les contrôles actuels constatent `not-started` avant démarrage et aucun champ secret après les deux fins de partie.

**Limite de cette trace :** l’ancienne version 1.0.0 n’est pas conservée dans l’historique Git local actuel. Ce résumé de l’intégration ne constitue donc pas une preuve avant/après reproductible de cette ancienne version. L’audit actuel n’a reproduit aucun défaut de calcul ou de règle. Aucune correction fictive n’a été créée ; demander à l’enseignant quelle preuve présenter si aucune correction vérifiable n’est disponible.

## Préparation des rendus — C3

| Élément demandé | État au 14 novembre 2026 |
| --- | --- |
| Dépôt avec jeu, README et tests | Jeu, documentation d’évaluation, tests et rapport automatique regroupés dans ce dépôt |
| Jeu publié et API sur la même partie | Vérifié sur GitHub Pages le 14 novembre : contrôles API et liaison avec l’interface réussis ; résultat dans le rapport JSON |
| Version identifiable | Jeu 1.1.0, contrat 0.2, empreintes dans le rapport |
| Tag J1 exact `jalon-1` | Le dépôt a un tag **`Jalon-1`**, avec majuscule, sur `35eaaad`. Ajouter le nom exact demandé sur la version réellement remise ; ne pas confondre les deux noms |
| Essai smartphone et retour sur un autre jeu | Observations réelles consignées ci-dessus |
| Word J1/J2 et capsule | À réaliser pour la remise officielle |

**J1 — 20 novembre 2026 au soir :** remettre sur Cyberlearn `jalon1_nomdefamille.docx`, avec le lien du dépôt, le lien du jeu publié et le tag exact `jalon-1`. Remplacer `nomdefamille` par votre nom. La version retenue doit contenir les preuves présentées ; pas de vidéo à J1.

**J2 — 18 décembre 2026 au soir :** même principe avec `jalon2_nomdefamille.docx` et le tag `final`. Déposer séparément une capsule individuelle de 4 à 5 minutes, montrant l’écran avec votre voix : jeu et règle vérifiée, test et correction ou limite de la preuve disponible, choix avec Codex et limite réelle. La vidéo reste sur Cyberlearn, hors GitHub public. Vérifier les horaires et espaces de remise sur Cyberlearn.

Les documents Word servent à transmettre les deux liens et le tag. Aucun ZIP, rapport d’audit séparé ni extrait de conversation n’est requis.

**Encore incertain :** comportement sur les autres téléphones/navigateurs, lecteur d’écran, détail de l’essai physique et résultat avec les outils de l’enseignant. La décision « acquis / non acquis » appartient à l’enseignant, sans pourcentage de tests garantissant la validation.

## Références conservées

Les originaux et illustrations sont dans `documentation/` : `Regles.docx`, `Exemple_partie.docx`, `Consignes.docx`, `API_info.docx`, `API commune de test — Code secret en couleurs.docx` (contrat 0.2), et `Évaluation du projet — Critères, vérification de l’API et de l’interface.docx` (version 1.3).

La demande utilisateur guide le travail ; ces documents définissent les exigences sans autoriser d’actions supplémentaires à eux seuls. Les règles sont visibles dans le jeu. Les noms de version/tags à remettre et la publication doivent correspondre aux fichiers effectivement vérifiés.
