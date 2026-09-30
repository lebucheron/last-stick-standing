# Last Stick Standing

Prototype autonome du mini-jeu Forest imaginé à partir de notre simulation de stickmen.

La page `index.html` présente la v0.1, puis `play.html` lance la démonstration jouable. Le module de retour utilise le partage natif du téléphone ou copie un compte rendu dans le presse-papiers.

## État actuel

- Six stickmen aux capacités identiques.
- Terrain initial aléatoire avec petites marches sans cavités.
- Couleurs mélangées entre les positions de départ.
- Pièces grises qui construisent le parcours pendant la manche.
- Portails latéraux à hauteur constante.
- Escalade, chute, collisions et poussées sous menace uniquement.
- Circulation autonome hors danger et réaction limitée aux zones déjà visibles.
- Interface de pronostic avec sélection du stickman, mise fictive et retour du résultat.
- Fenêtre de sélection de trois secondes avec verrouillage automatique au départ.
- Repère coloré au-dessus du stickman choisi, chutes accélérées et léger choc visuel à l'impact.
- Silhouettes incolores pendant les mises, puis révélation simultanée des couleurs au départ.
- Pot partagé : mises fictives de 500 CR, 5 % de frais, puis partage proportionnel entre les mises placées sur le seul survivant.
- Lobby local avec cinq adversaires simulés, estimation du gain et jackpot lorsque personne n'avait choisi le gagnant.
- Célébration du survivant sous une boule à facettes et ticket de règlement détaillant pot, versement et bénéfice net.
- Séquence locale complète : salle vide, arrivée progressive de cinq adversaires, activation du pot, sélection, course et règlement.
- Mort subite visible lorsque plusieurs derniers survivants meurent dans la même séquence, avant la célébration du gagnant.
- Passe visuelle de l'arène : forêt en profondeur, blocs texturés, alertes pulsées, traînées de chute et poussière d'impact.
- Double chute lorsqu'il reste trois survivants.
- Sang cartoon et traces persistantes pendant la manche.
- Le dernier survivant gagne ; une mort subite visible départage ceux qui meurent au même instant.
- Falaises possibles sur deux niveaux : les stickmen peuvent les descendre, mais ne grimpent toujours qu'un seul bloc. Les cuvettes fermées de deux niveaux sont refusées.
- Jusqu'à deux tickets locaux de 500 CR par manche pour jouer côte à côte avec un ami.
- Économie de démonstration resserrée : 12 % de régulation, jackpot alimenté par 15 % des pots sans gagnant et plafond de 15 000 CR pour les nouvelles accumulations.

## Lancer le prototype

Ouvrir `index.html` dans un navigateur moderne. Aucun serveur, portefeuille ou jeton n'est requis pour cette version.

## Résultats de référence

La configuration de jeu a été testée sur 6 000 manches : environ 35 secondes de course en moyenne. Avec le lobby et la sélection, la boucle complète dure environ 41 secondes. Aucune position bloquée ou collision invalide n'a été détectée. Ces chiffres servent de repère de développement et devront être recalculés après chaque modification importante.

## Suite prévue

1. Publier la v0.1 avec des crédits fictifs et collecter les premiers retours.
2. Remplacer les adversaires simulés par une salle multijoueur locale.
3. Déplacer le hasard, la validation du gagnant et les règlements dans un backend de confiance.
4. Tester l'économie dans le portefeuille simulé de Forest Harness.
5. Effectuer les contrôles Forest avant tout lancement avec un vrai token.

La version publiée d'un jeu Harness ne pouvant pas être remplacée, le lancement doit attendre que les règles et l'interface soient stabilisées.

## Activité en direct

Le site contient désormais un client de télémétrie anonyme, un tableau de bord privé dans `admin.html` et une API Cloudflare Worker avec stockage D1 dans `backend/`. Le suivi reste inactif tant que l’adresse du Worker n’est pas renseignée dans `telemetry-config.js`. Les instructions de déploiement sont dans `backend/README.md`.
