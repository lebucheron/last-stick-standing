# Méthode d’équilibrage

## Version courante

`R5` agrandit les cubes de 40 à 50 px et fait passer l’arène de dix à huit colonnes. Les résultats R4 et antérieurs restent séparés et ne doivent pas être mélangés à R5 pour décider d’un réglage. La simulation de validation sur 2 000 manches donne 27,6 s de moyenne, un 90e percentile à 37,7 s et 2,05 % de combats finaux.

Chaque modification susceptible de changer les probabilités de victoire crée une nouvelle version de règles. Une correction purement graphique peut conserver la version existante.

## Une manche, une observation

Le serveur regroupe les événements par identifiant de manche et conserve un seul résultat statistique, quel que soit le nombre de spectateurs ou d’appareils connectés. Les manches lancées avec `?test` sont exclues.

Le rapport conserve la version, la seed, le gagnant, les six positions initiales, la durée, les éliminations et la présence éventuelle d’un combat final. La seed permet de reproduire un résultat intéressant.

## Lecture des résultats

- L’objectif théorique de chaque couleur est `16,7 %` des victoires.
- Une position est évaluée par `victoires / apparitions` et non par son total brut de victoires.
- Le tableau affiche une marge statistique à 95 % pour les couleurs.
- La médiane décrit une manche habituelle. Le 90e percentile révèle les manches qui s’éternisent.
- Avant 100 manches, les résultats sont exploratoires.
- À partir de 600 manches, un biais persistant mérite une enquête.
- Entre 3 000 et 10 000 manches, les petits écarts deviennent interprétables.
- À 10 000 manches, un écart doit encore être expliqué par la mécanique avant toute correction.

## Règle de décision

Une couleur ou une position n’est jamais corrigée à partir de quelques victoires visibles. On vérifie d’abord l’intervalle statistique, les positions occupées, les causes de mort et les seeds concernées. Après une modification, la nouvelle version repart avec son propre échantillon.
