# Vidéo de démonstration de secours (3 min au plus)

> À déposer **avant la fin de J3**. Si la démonstration en direct échoue pendant la soutenance, on bascule immédiatement sur cette vidéo, sans temps supplémentaire.
> Fichier attendu : `rendus/video-demo.mp4`, ou un lien (YouTube non répertorié, Drive) noté dans `rendus/README.md`.

## Préparation (avant d'enregistrer)

```bash
docker compose down && docker compose up -d --build    # stack propre
docker compose exec redis redis-cli FLUSHALL           # historique vide (facultatif)
```

- Écran partagé en deux : **Chrome normal** à gauche, **fenêtre privée** à droite, zoom à 110 %.
- Un terminal visible en bas, avec une police assez grande.
- Comptes déjà créés : `alice` (violet) et `bob` (vert).
- Enregistrement : OBS Studio, ou la Xbox Game Bar de Windows (`Win + Alt + R`). Résolution 1080p, micro testé.
- Vérifier que le soleil affiche **api-1 d'un côté et api-2 de l'autre** (recharger un onglet si besoin).

## Découpage

| Temps | À l'écran | À dire (voix off) |
|------:|-----------|-------------------|
| 0:00–0:15 | Page de connexion, collines et soleil | « TubbyChat : une messagerie temps réel avec salons, présence et accusés de lecture. WebSocket, deux instances Node derrière nginx, Redis entre les deux. Tout démarre avec `docker compose up`. » |
| 0:15–0:45 | Alice et Bob dans La Colline. Bob écrit (les fleurs poussent chez Alice), Alice envoie « Eh-oh ! » | « Alice est sur api-1, Bob sur api-2. Le message passe par Redis et arrive en quelques dizaines de millisecondes. Bob l'a sous les yeux : Alice voit "Lu par bob". » |
| 0:45–1:05 | Outils de développement → Réseau → WS → Messages | « Les trames sont conformes au contrat : `chat` part, le serveur répond `ack` puis diffuse `chat` avec son id et l'instance d'origine dans `via`. » |
| 1:05–1:35 | Terminal : `docker compose exec api-1 npm run test-securite` | « La recette de sécurité : sans ticket, 401 ; mauvaise origine, 403 ; message malformé ou de 20 Kio rejeté sans arrêter le serveur. 16 vérifications sur 16. » |
| 1:35–2:15 | Terminal : `docker compose stop api-1 api-2`. Le soleil passe derrière un nuage ; Alice écrit un message, qui reste grisé. 10 s plus tard : `docker compose start api-1 api-2` | « Panne totale de 10 secondes. Le client réessaie avec un délai croissant, plafonné à 10 s, avec gigue. Au retour, il se reconnecte seul, rattrape l'historique, et le message en attente part une seule fois. » |
| 2:15–2:30 | Fermer l'onglet de Bob : son antenne s'éteint chez Alice | « Présence : un onglet fermé disparaît en moins de 2 secondes ; en cas de coupure brutale, en moins de 35. » |
| 2:30–2:55 | Grafana (http://localhost:3001) : connexions, messages par seconde, latence p95 | « Mesures avec k6 : sans optimisation, la latence se dégrade vers 580 connexions. En regroupant les envois pendant 20 ms, on dépasse 1000 connexions et le p95 passe de 10 s à 143 ms. » |
| 2:55–3:00 | Le soleil qui brille | « Merci ! » |

## Après l'enregistrement
- Vérifier la durée (≤ 3:00), le son et la lisibilité du terminal.
- Déposer la vidéo et noter le lien dans `rendus/README.md` et `rendus/PHASE6.md`.
- `docker compose up -d` pour revenir à la configuration normale.
