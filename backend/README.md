# API d’activité

Ce Worker Cloudflare reçoit des événements anonymes du jeu et alimente `admin.html`. Il conserve un identifiant aléatoire par onglet, l’heure d’activité, les débuts et fins de manches, la couleur choisie, le gagnant et la durée. Il ne collecte ni adresse IP, ni nom, ni Discord, ni portefeuille.

## Déploiement

1. Créer un Worker et une base D1 dans Cloudflare.
2. Copier `wrangler.toml.example` vers `wrangler.toml`, puis renseigner l’identifiant D1.
3. Exécuter `npx wrangler d1 execute last-stick-live --remote --file=schema.sql`.
4. Créer une longue clé privée avec `npx wrangler secret put ADMIN_TOKEN`.
5. Déployer avec `npx wrangler deploy`.
6. Reporter l’URL `workers.dev` dans `telemetry-config.js`, puis publier les fichiers du site.

Le tableau `admin.html` demande l’URL de l’API et la clé privée. La clé reste en mémoire dans l’onglet et n’est pas publiée dans le dépôt.
