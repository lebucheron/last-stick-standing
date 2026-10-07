# Cosmétiques V1

Les 26 objets se trouvent dans `cosmetics-core.js` : 12 skins, 7 effets et 7 arènes. Les six Classic, Pouf et Classic Arena sont possédés dès le départ. États : verrouillé, débloqué non acheté, acheté/possédé, équipé. La sauvegarde locale utilise une nouvelle clé, sans modifier le portefeuille existant.

Les six couleurs Classic ne sont pas affichées dans le vestiaire : le choix existant du stickman fournit déjà ces couleurs. « Apparence classique » retire le skin et conserve la couleur originale du stickman du ticket.

Les arènes proposent « Voir dans l’arène », même avant déblocage : un aperçu temporaire dans le vrai canvas, sans changer la possession ou l'équipement sauvegardé. « Fermer l’aperçu » restitue le décor équipé. Les arbres, enceintes, échafaudages, écrans, colonnes et établi sont des dessins de fond ; ils ne sont jamais des plateformes ou des obstacles de simulation.

## Progression

Une course terminée avec au moins un ticket compte comme une partie. Un ticket sur le gagnant compte comme une victoire, indépendamment du bénéfice fictif du ticket. Deux tickets dans la même course ne donnent qu'une partie et au maximum une victoire. Aucune progression de spectateur. Rare : 15 parties ; Épique : 25 parties et 3 victoires ; Légendaire : 50 parties et 7 victoires. Aucun avantage de physique, de collision ou de décision.

## Prix et Forest

Un prix cible commun à chaque rareté, toutes catégories confondues : Rare 0,25 €, Épique 0,75 €, Légendaire 2 €. Bidouille Workshop utilise le tarif légendaire. Le nombre de $STICK doit évoluer avec le cours du coin, et non rester fixe.

`LastStickCosmetics.connectPurchases(adapter)` attend trois méthodes asynchrones :

- `quote({itemId,targetEurCents})` retourne `{itemId,targetEurCents,currency:'STICK',units,expiresAt}`. `units` est une chaîne entière en unités minimales du token ; `expiresAt` est un timestamp en millisecondes.
- `purchase(quote)` présente le devis et demande la confirmation du portefeuille Forest, puis retourne un reçu. Aucune transaction automatique.
- `verifyOwnership({itemId,receipt})` vérifie le règlement sur un serveur de confiance et retourne `{itemId,owned:true}`.

`tokenUnits(cents,eurMicrosPerToken,decimals)` convertit le prix avec arrondi supérieur. Le serveur devra produire un devis signé et limité dans le temps, vérifier les prérequis, le cours, le contrat du coin, le destinataire et le reçu, puis enregistrer la possession. Il ne doit pas faire confiance à la progression ou à la possession locale. Aucun fournisseur de cours, portefeuille ou paiement réel n'est activé dans cette version ; le bouton d'achat reste indisponible sans adaptateur.

## Salle multijoueur

Le jeu existant simule six stickmen communs, pas un avatar distinct par joueur. Un cosmétique appartient donc au stickman du ticket pendant la course. Le premier détenteur d'un ticket qui choisit l'apparence d'un stickman la fixe pour la salle ; les autres tickets sur ce stickman voient cette même apparence. Les changements se font avant le départ. La sélection locale utilise les stickmen des tickets, jamais le simple survol/sélection du menu.

`cosmetic_selection` transmet uniquement `roundId`, `runner`, `skin` et `death`. Le Worker vérifie le ticket, la fenêtre de sélection, les identifiants et la possession. Les objets gratuits sont acceptés ; les objets payants nécessitent la liste serveur `cosmetic-owned:<player>`, à remplir uniquement après vérification du futur achat. Le message `cosmetics` diffuse les apparences à la salle et les restitue aux nouveaux arrivants. L'arène n'est jamais envoyée au serveur.

## Validation et livraison

Tests : `node tools/test-cosmetics.mjs`, `node backend/test-worker.mjs`, `node tools/simulate-ruleset.mjs 300`. Une comparaison sur les graines 1 à 300 avec le moteur GitHub d'origine donne les mêmes résultats, durées et décès. Le navigateur a également vérifié une course avec ticket, les trois catégories, la sauvegarde et le parcours achat/équipement avec un adaptateur de test uniquement.

Cette copie est prête pour revue, pas publiée. Pour activer le partage en ligne, déployer aussi le Worker modifié ; l'ancien serveur ignore les messages cosmétiques. La progression et le vestiaire restent locaux dans cette V1. Le paiement et la synchronisation sécurisée des achats nécessitent le futur service Forest. Les mises/règlements de démonstration existants sont inchangés ; aucune nouvelle mise ou récompense monétaire n'a été ajoutée.
