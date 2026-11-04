# TubbyChat 🌞

Messagerie temps réel avec salons, présence et accusés de lecture, sur la colline des Télétubbies.
Projet fil rouge — Web temps réel — filière IW.

**Stack** : Node.js + `ws` · Vue 3 + Vite · Redis (pub/sub + Streams) · nginx (2 instances derrière un répartiteur) · Prometheus + Grafana · k6.
**Tous les rendus** (phases 1 à 6, dossier technique PDF, script vidéo, soutenance, tableau comparatif) sont dans [`rendus/`](rendus/README.md). Le journal d'usage de l'IA est [`USAGE-IA.md`](USAGE-IA.md).
Architecture détaillée : [`rendus/ARCHITECTURE.md`](rendus/ARCHITECTURE.md).

## Le sujet

**Utilisateurs** : des étudiants d'une promo qui discutent par thème.

**Scénario principal**
1. Alice crée son Tubby (pseudo, mot de passe, couleur) ou se connecte.
2. Elle arrive dans « La Colline » : elle voit l'historique récent et qui est en ligne (les antennes s'allument).
3. Elle écrit : Bob, connecté depuis un autre navigateur **et une autre instance du serveur**, reçoit le message en quelques dizaines de millisecondes.
4. Bob lit le message : Alice voit « Lu par bob ».
5. Alice perd le réseau : le soleil se cache derrière un nuage, son client se reconnecte seul et rattrape les messages manqués.

## Lancer

Prérequis : Docker Desktop (ou Docker Engine + Compose v2).

```bash
docker compose up --build
```

| Service | Adresse |
|---------|---------|
| **Application** | http://localhost:8090 |
| Grafana (tableau de bord « TubbyChat temps réel ») | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

Le premier lancement télécharge les images et construit le client (2 à 3 minutes).
Le compte nommé **`admin`** a le rôle admin et peut entrer dans « Le placard de Noo-Noo ».

> Le port 8090 a été choisi pour ne pas entrer en conflit avec la démo du module M6 (8080/8081).

## Démonstrations, phase par phase

### Phase 2 : temps réel
Ouvrez http://localhost:8090 dans **deux navigateurs** (ou une fenêtre normale + une fenêtre privée), créez deux Tubbies et écrivez. Dans les outils de développement, onglet **Réseau → WS → Messages**, les trames correspondent au contrat ([`rendus/PHASE1.md`](rendus/PHASE1.md) §4).

Pour voir les trames **côté serveur** (désactivé par défaut) :
```bash
LOG_MESSAGES=1 docker compose up -d api-1 api-2
docker compose logs -f api-1 api-2 | grep "ws "     # ← = reçu du client, → = envoyé au client
```

### Phase 3 : sécurité
```bash
docker compose exec api-1 npm run test-securite
```
16 vérifications, dont les 3 critères officiels : connexion sans jeton refusée (401), origine non autorisée refusée (403), message malformé rejeté **sans arrêt du serveur** (la même connexion continue de fonctionner). S'y ajoutent : ticket rejoué, droits par salon, doublons, message trop gros (1009), débit, révocation (4003).

Vérification à la main de l'origine :
```bash
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Origin: https://evil.example" \
     http://localhost:8090/ws
# → HTTP/1.1 403 Forbidden
```

### Phase 3 : reconnexion, reprise, présence
- **Coupure** : `docker compose stop api-1 api-2`, attendre 10 s, puis `docker compose start api-1 api-2`. Pendant la panne, le soleil passe derrière un nuage (« nouvel essai dans N s ») et les messages écrits restent grisés (« envoi… »). Au retour, les clients se reconnectent seuls en 5 à 10 s, et les messages en attente partent **une seule fois**.
- **Stratégie** : délai croissant (×2 à partir de 0,5 s), plafond de 10 s, gigue complète, remise à zéro après 10 s de connexion stable, tentative immédiate sur l'événement `online` ou le bouton « Encore ! Encore ! ».
- **Reprise** : à la reconnexion, le client renvoie `join` avec `since` = le dernier id reçu. Si des messages ont été supprimés par la limite de 1000 par salon, un bandeau l'indique (perte documentée).
- **Présence** : un onglet fermé disparaît en **moins de 2 s** (mesuré : 0,6 s), et en **moins de 35 s** en cas de coupure brutale (battement toutes les 10 s, expiration à 30 s).
- **Expiration de session** : `SESSION_TTL_SECONDS=60 docker compose up -d` → le serveur envoie `session_expiring`, le client renouvelle sans couper (`reauth`).
- **Révocation** : « Au revoir ! » déconnecte l'utilisateur **partout**. Ses autres onglets reçoivent 4003, sur toutes les instances.

### Phase 4 : deux instances
Le soleil indique l'instance (« connecté à api-1 » / « api-2 »). Rechargez un des navigateurs jusqu'à avoir une instance différente de chaque côté, puis échangez. Ensuite :
```bash
docker compose stop api-1     # les clients d'api-1 reçoivent 1001 et passent sur api-2
docker compose start api-1
```
**Garantie annoncée** : « au moins une fois » vers les clients, dédoublonnage par id côté client et par `clientMsgId` côté serveur, ordre garanti par salon ([`rendus/PHASE4.md`](rendus/PHASE4.md) §4).

### Phase 5 : charge et mesures
```bash
MAX_CONN_PER_IP=100000 docker compose up -d                  # toutes les connexions k6 viennent d'une seule IP
MAX_CONN_PER_IP=100000 docker compose --profile charge run --rm k6
MAX_CONN_PER_IP=100000 BATCH_MS=20 docker compose up -d      # optimisation, puis relancer k6
docker compose up -d                                         # revenir à la configuration normale
```
Pendant le test, regardez Grafana. Les résultats sont dans [`rendus/PHASE5.md`](rendus/PHASE5.md) : sans optimisation, la dégradation commence vers 580 connexions ; avec le regroupement (20 ms), on dépasse 1000 connexions et le p95 de bout en bout passe de 10,2 s à 143 ms.

## Développer le client sans Docker

```bash
docker compose up -d          # serveur, Redis, etc.
cd client && npm install && npm run dev    # http://localhost:5173 (proxy vers :8090)
```

## Arborescence

Voir [`rendus/ARCHITECTURE.md`](rendus/ARCHITECTURE.md) §12.

## Images et thème

Toutes les illustrations (Tubbies, soleil, collines, fleurs, moulin) sont des **dessins SVG originaux** faits dans le code, inspirés de l'univers des Télétubbies. Aucune image officielle n'est utilisée : les personnages appartiennent à leur ayant droit (WildBrain).
