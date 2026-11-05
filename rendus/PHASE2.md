# TubbyChat — Phase 2 : socle client-serveur et première fonctionnalité temps réel

> Projet fil rouge · Web temps réel · Filière IW · Livrables de la phase 2 (J1 fin, J2)

| Livrable demandé | Où | État |
|------------------|----|------|
| Client et serveur qui communiquent selon le contrat de messages | `client/src/socket.js`, `server/src/ws/` | ✅ |
| Fichier docker compose qui lance l'ensemble | `docker-compose.yml` | ✅ |

| Critère de réussite observable | Comment le montrer | Résultat mesuré |
|--------------------------------|--------------------|-----------------|
| Deux navigateurs ouverts : une action dans l'un est visible dans l'autre en moins d'une seconde | §2 | ≈ 50 ms (scénario automatisé), instantané à l'œil |
| Une seule commande `docker compose up` démarre l'application sur un poste propre | §1 | ✅ (images construites depuis le dépôt, aucune étape manuelle) |
| Les messages échangés, observés dans l'onglet Réseau, sont conformes au contrat | §3 | ✅ (validation stricte côté serveur, même schéma que [`PHASE1.md` §4](PHASE1.md#4-contrat-de-messages)) |

---

## 1. Lancement en une commande

```bash
git clone git@github.com:goumarry/tubbychat.git && cd tubbychat
docker compose up --build          # 2 à 3 min la première fois
```

| Service lancé | Rôle | Port exposé |
|---------------|------|-------------|
| `web` | nginx : client Vue compilé + répartiteur `/api` et `/ws` | **8090** |
| `api-1`, `api-2` | serveur Node.js + `ws` (même image) | aucun (derrière nginx) |
| `redis` | broker + stockage (healthcheck : les API attendent qu'il réponde) | aucun |
| `prometheus`, `grafana` | mesures (phase 5) | 9090, 3001 |

Aucune variable d'environnement n'est obligatoire : les valeurs par défaut sont dans `docker-compose.yml`. Aucune API payante, aucune donnée simulée : ce sont de vrais utilisateurs qui écrivent.

## 2. Démonstration (1 min 30, jalon J2)

1. Ouvrir http://localhost:8090 dans **Chrome** et dans une **fenêtre privée** (ou Firefox).
2. Créer `alice` (violet) d'un côté et `bob` (vert) de l'autre.
3. Les deux arrivent sur « La Colline ». L'antenne de chaque Tubby s'allume dans la liste de présence de l'autre.
4. Bob commence à écrire : chez Alice, **trois fleurs poussent** (« bob écrit… »).
5. Alice envoie « Eh-oh ! » : le message apparaît chez Bob **immédiatement**. Chez Alice, il est d'abord grisé (« envoi… »), puis confirmé par l'`ack` du serveur.
6. Bob a la conversation sous les yeux : Alice voit « **Lu par bob** » sous son message.

Fonctionnalités temps réel livrées : messages, saisie en cours, présence, accusés de lecture, historique à l'arrivée, cinq salons (dont un réservé aux admins).

## 3. Conformité au contrat (onglet Réseau)

Outils de développement → **Réseau** → filtre **WS** → cliquer sur `ws?ticket=…` → onglet **Messages**.

Ce qu'on voit à la connexion d'Alice, puis à l'envoi d'un message (flèche verte = envoyé, rouge = reçu) :

```text
↓ {"type":"welcome","user":"alice","color":"violet","role":"membre","instance":"api-1","sessionSeconds":900}
↑ {"type":"join","room":"colline"}
↓ {"type":"joined","room":"colline","members":[{"user":"bob","color":"vert"}],"reads":{}}
↓ {"type":"history","room":"colline","messages":[…],"complete":true,"resumed":false}
↑ {"type":"chat","room":"colline","text":"Eh-oh !","clientMsgId":"5f0c2a9e-…"}
↓ {"type":"ack","clientMsgId":"5f0c2a9e-…","id":"1793617914799-0"}
↓ {"type":"chat","room":"colline","id":"1793617914799-0","from":"alice","color":"violet","text":"Eh-oh !","at":1793617914799,"clientMsgId":"5f0c2a9e-…","via":"api-1"}
↓ {"type":"read","room":"colline","user":"bob","upTo":"1793617914799-0"}
```

Chaque trame correspond ligne pour ligne à une entrée du contrat ([`PHASE1.md` §4](PHASE1.md#4-contrat-de-messages)).

**Côté serveur**, on peut afficher les mêmes trames dans les journaux (désactivé par défaut, pour des raisons de volume et de vie privée) :

```bash
LOG_MESSAGES=1 docker compose up -d api-1 api-2
docker compose logs -f api-1 api-2 | grep "ws "     # ws ← reçu du client, ws → envoyé au client
```

Le ticket contenu dans un `reauth` est masqué dans ces journaux.

**Comment le contrat est garanti dans le code** :

| Côté | Fichier | Rôle |
|------|---------|------|
| Serveur | `server/src/ws/schema.js` | Contrat client → serveur : type connu, champs obligatoires, types, longueurs, motif du nom de salon, **champs inconnus refusés** |
| Serveur | `server/src/ws/handlers.js` | Un handler par type (`join`, `leave`, `chat`, `typing`, `read`, `reauth`). L'auteur (`from`, `color`) est pris dans la session |
| Client | `client/src/socket.js` | Seul endroit qui envoie et reçoit. Accepte un objet ou un tableau d'objets (regroupement `BATCH_MS`) |
| Client | `client/src/store.js` | Applique chaque type reçu à l'état réactif (messages, présence, lectures) |

## 4. Mesure « moins d'une seconde »

Scénario automatisé (2 navigateurs, alice sur api-1 et bob sur api-2) : **≈ 51 ms** entre le clic sur « Envoyer » et l'affichage chez l'autre utilisateur, en passant par Redis.
En charge (phase 5, 100 connexions), la latence serveur est de 3 ms au p50.

## 5. Choix d'implémentation de la phase

| Sujet | Choix | Raison |
|-------|-------|--------|
| État du client | un `reactive()` Vue dans `store.js` | Pinia n'apporte rien à cette taille |
| Validation | écrite à la main (≈ 80 lignes) | Pas de dépendance (Zod) ; chaque règle peut s'expliquer à l'oral |
| Affichage optimiste | message grisé jusqu'à l'`ack` | L'utilisateur voit son message tout de suite, et sait s'il est vraiment enregistré |
| Sécurité XSS | interpolation `{{ }}` uniquement, jamais `v-html` | Vue échappe le HTML |
