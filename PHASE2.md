# TubbyChat — Phase 2 : socle client-serveur et première fonctionnalité temps réel

> Livrables de la phase 2 (fin J1 / J2 1:50). Contrat de messages : [`PHASE1.md` §4](PHASE1.md#4-contrat-de-messages).

| Livrable | Où le trouver |
|----------|---------------|
| Client et serveur qui communiquent selon le contrat | `client/src/socket.js` (client) · `server/src/ws/schema.js`, `handlers.js`, `connection.js` (serveur) |
| Fichier docker compose qui lance l'ensemble | `docker-compose.yml` (web/nginx, api-1, api-2, redis, prometheus, grafana) |

## Première fonctionnalité temps réel
Diffusion d'un message de chat dans un salon : `chat` (client) → écriture dans le Stream Redis + `ack` à l'expéditeur → Pub/Sub → `chat` diffusé à tous les membres du salon, y compris sur l'autre instance (champ `via`).

## Critères de réussite — procédure de vérification

### 1. Deux navigateurs, une action visible dans l'autre en moins d'une seconde
1. `docker compose up --build`, puis ouvrir http://localhost:8090 dans deux navigateurs (ou fenêtre normale + fenêtre privée).
2. Créer deux comptes (ex. `alice`, `bob`), entrer dans « La Colline » dans les deux.
3. Écrire dans l'un : le message doit apparaître dans l'autre sans rechargement, à l'œil en moins d'une seconde.
4. Pour le « réseau local » : depuis un second poste, ouvrir `http://<IP-du-poste>:8090`. Si l'origine est refusée (403), ajouter `http://<IP-du-poste>:8090` à `ALLOWED_ORIGINS` dans `docker-compose.yml`.

### 2. Une seule commande sur un poste propre
- Prérequis : Docker uniquement. Commande : `docker compose up --build`.
- À tester sur un poste sans Node ni dépendances (ou après `docker compose down -v` et `docker system prune -a`) : le premier lancement prend 2 à 3 minutes (images + build du client).

### 3. Messages observés dans l'onglet Réseau conformes au contrat
Outils de développement → Réseau → WS → connexion `/ws` → Messages. À retrouver :

| Sens | Trame attendue |
|------|----------------|
| ⇄ ouverture | `welcome` (user, color, role, instance, sessionSeconds) |
| client → serveur | `{"type":"join","room":"colline"}` puis `joined` + `history` |
| client → serveur | `{"type":"chat","room":"colline","text":"…","clientMsgId":"<uuid>"}` |
| serveur → client | `ack` (`clientMsgId`, `id`) à l'expéditeur, `chat` (`id`, `from`, `color`, `text`, `at`, `clientMsgId`, `via`) à tous |
| client → serveur | `typing`, `read` (`upTo`) |

Une trame mal formée (ex. champ inconnu) doit renvoyer `error` (`invalid_message`) **sans fermer** la connexion.

## À faire valider par le groupe
- [ ] Les trois critères ci-dessus, constatés sur une vraie machine avec Docker.
- [ ] Relecture et explication orale du code (règle de `USAGE-IA.md`) : `schema.js`, `handlers.js`, `socket.js` en priorité.
