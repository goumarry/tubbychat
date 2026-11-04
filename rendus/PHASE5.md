# TubbyChat — Phase 5 : tests de charge, observabilité et optimisation

> Projet fil rouge · Web temps réel · Filière IW · Livrables de la phase 5 (J3)
> Mesures réalisées le 2 novembre 2026.

| Livrable demandé | Où | État |
|------------------|----|------|
| Scénario de charge scripté et versionné | `load/chat.js` (k6), service `k6` du `docker-compose.yml` (profil `charge`) | ✅ |
| Métriques exposées : connexions actives, messages par seconde, latence (histogramme), erreurs et déconnexions | `server/src/metrics.js`, route `/metrics` de chaque instance | ✅ |
| Tableau de bord | Grafana, « TubbyChat temps réel », provisionné depuis `infra/grafana/` | ✅ |
| Une optimisation mesurée avant/après | regroupement des envois (`BATCH_MS=20`) | ✅ |

| Critère de réussite observable | Où |
|--------------------------------|----|
| Le protocole de mesure est écrit : machine, durée, montée en charge, point d'horodatage | §3 |
| Les résultats donnent p50 et p95 de latence, le débit et le nombre de connexions à partir duquel la latence se dégrade | §4 |
| Le gain de l'optimisation est chiffré avec la même méthode avant et après | §5 et §6 |

**En une phrase** : sans optimisation, la latence se dégrade vers **580 connexions** (p95 de bout en bout 10,2 s) ; en regroupant les envois pendant 20 ms, on tient **plus de 1000 connexions** avec un p95 de **143 ms**.

---

## 1. Métriques exposées

Chaque instance expose `/metrics` au format Prometheus (`prom-client`). Prometheus les relève toutes les 5 s. La route est bloquée par nginx depuis l'extérieur.

| Métrique demandée | Nom | Type | Labels |
|-------------------|-----|------|--------|
| Connexions actives | `ws_connections_active` | Gauge | `server` |
| Messages par seconde | `ws_messages_total` (→ `rate()`) | Counter | `server`, `direction` (in/out), `type` |
| Latence | `ws_message_latency_seconds` | **Histogram** (5 ms → 2,5 s) | `server` |
| Erreurs | `ws_errors_total` | Counter | `server`, `code` |
| Déconnexions | `ws_disconnects_total` | Counter | `server`, `close_code` |
| (en plus) Poignées de main refusées | `ws_handshake_rejected_total` | Counter | `server`, `reason` |

Le label s'appelle `server`, car Prometheus réserve déjà `instance` pour l'adresse de la cible.

## 2. Tableau de bord Grafana

http://localhost:3001 → « TubbyChat temps réel » (aucun compte à créer, tout est provisionné au démarrage).

| Panneau | Requête PromQL |
|---------|----------------|
| Connexions actives (total et par instance) | `sum(ws_connections_active)` · `ws_connections_active` |
| Messages par seconde (entrants / sortants) | `sum by (direction) (rate(ws_messages_total[30s]))` |
| Latence p50 / p95 / p99 | `histogram_quantile(0.95, sum by (le) (rate(ws_message_latency_seconds_bucket[1m])))` |
| Erreurs par code | `sum by (code) (rate(ws_errors_total[1m]))` |
| Déconnexions par code de fermeture | `sum by (close_code) (increase(ws_disconnects_total[1m]))` |
| Poignées de main refusées par motif | `sum by (reason) (increase(ws_handshake_rejected_total[1m]))` |
| Mémoire des instances | `process_resident_memory_bytes` |

## 3. Protocole de mesure

| Élément | Valeur |
|---------|--------|
| Machine | Intel Core i5-13420H (12 cœurs logiques), 7,6 Go de RAM, Windows + WSL2, Docker 29.9 |
| Pile testée | `docker compose` : nginx → 2 instances Node.js 22 (`api-1`, `api-2`) → Redis 7.4 |
| Générateur | k6 0.54 dans un conteneur, **sur la même machine** (il partage le CPU avec les serveurs) |
| Montée en charge | paliers 100 → 300 → 600 → 1000 utilisateurs virtuels (20 s de montée, 30 s de palier), puis descente |
| Comportement d'un utilisateur | connexion HTTP, ticket, WebSocket, `join` d'un des 4 salons publics (≈ 250 personnes par salon à 1000 VU), **1 message toutes les 2 s**, connexion de 60 s renouvelée |
| Durée d'une exécution | 3 min 35 s (4 paliers de 50 s, puis 15 s de descente) |
| Seuil de dégradation retenu | le p95 serveur dépasse **200 ms** |
| Point d'horodatage (k6) | `Date.now()` mis dans le texte à l'envoi ; latence = réception de **son propre** message diffusé − horodatage. C'est l'aller-retour complet client → nginx → instance → Redis (Stream + pub/sub) → instance → client. Une seule horloge (même machine). |
| Point d'horodatage (serveur) | histogramme `ws_message_latency_seconds` : de la réception du message sur l'instance d'origine jusqu'à sa remise aux sockets sur l'instance de destination (Prometheus, fenêtre de 30 s) |
| Configuration particulière | `MAX_CONN_PER_IP=100000`, car toutes les connexions k6 viennent de la même IP |
| Préparation | historique des salons vidé avant chaque exécution, même scénario et même machine pour « avant » et « après » |

Démonstration en direct (version courte de 1 min 40, avant/après) : voir [`DEMO-CHARGE.md`](DEMO-CHARGE.md).

Commandes :
```bash
MAX_CONN_PER_IP=100000 docker compose up -d                      # avant
MAX_CONN_PER_IP=100000 BATCH_MS=20 docker compose up -d          # après (optimisation)
MAX_CONN_PER_IP=100000 docker compose --profile charge run --rm k6
```

## 4. Avant optimisation (`BATCH_MS=0` : un `ws.send` par message et par destinataire)

Évolution mesurée côté serveur (Prometheus, relevé toutes les 15 s) :

| Connexions | Messages reçus/s | Messages diffusés/s | p50 serveur | p95 serveur |
|-----------:|-----------------:|--------------------:|------------:|------------:|
| 100 | 47 | 1 050 | 3 ms | 10 ms |
| 300 | 151 | 10 700 | 5 ms | 22 ms |
| 524 | 186 | 15 800 | 4 ms | 17 ms |
| 567 | 265 | 32 100 | 5 ms | 42 ms |
| **584** | 293 | 38 200 | 31 ms | **> 2 500 ms** |
| 600 | 296 | 34 800 | 1 366 ms | > 2 500 ms |

**Seuil de dégradation : environ 570 à 590 connexions** (≈ 35 000 messages diffusés par seconde). Au-delà, les deux processus Node (un cœur chacun) sont saturés, et la contre-pression coupe les clients trop lents : le nombre de connexions retombe de 600 à 404.

Bilan k6 sur toute l'exécution :

| Mesure | Valeur |
|--------|--------|
| Latence de bout en bout p50 / p90 / p95 | **74 ms / 6,35 s / 10,24 s** |
| Temps d'ouverture du WebSocket p95 | 17,9 s |
| Messages reçus par les clients | 4 108 801 (18 600/s), en 4 480 777 trames |
| Connexions HTTP en échec (hors 409 attendus) | 87 (délais dépassés pendant la saturation) |

## 5. Après optimisation (`BATCH_MS=20` : regroupement des envois pendant 20 ms)

| Connexions | Messages reçus/s | p50 serveur | p95 serveur |
|-----------:|-----------------:|------------:|------------:|
| 100 | 50 | 3 ms | 5 ms |
| 300 | 146 | 3 ms | 7 ms |
| 600 | 298 | 3 ms | 19 ms |
| 1 000 | 498 | 5 ms | 39 ms |

Le seuil de dégradation **n'est pas atteint à 1000 connexions**, le maximum du scénario.

Bilan k6 :

| Mesure | Valeur |
|--------|--------|
| Latence de bout en bout p50 / p90 / p95 | **34 ms / 97 ms / 143 ms** |
| Temps d'ouverture du WebSocket p95 | 16 ms |
| Messages reçus par les clients | 3 253 947 (14 700/s), en **1 402 779 trames** (2,3 messages par trame) |
| Messages émis par les serveurs | 3 304 060 : k6 en a reçu 98,5 %, le reste étant encore en vol à la fermeture des connexions |
| Erreurs WebSocket | 0 |

## 6. Gain de l'optimisation

| Indicateur | Avant | Après | Gain |
|-----------|------:|------:|-----:|
| p95 de bout en bout (scénario complet) | 10,24 s | 143 ms | **÷ 70** |
| Connexions avant dégradation | ≈ 580 | > 1 000 | **× 1,7 au moins** |
| p95 serveur à 600 connexions | > 2,5 s | 19 ms | — |
| Ouverture du WebSocket p95 | 17,9 s | 16 ms | — |
| Messages par trame | ≈ 1 | 2,3 | ÷ 2,3 trames et appels système |

**Interprétation.** Le coût dominant n'est pas Redis, c'est l'envoi : à 250 personnes par salon, chaque message reçu produit 250 `ws.send`, donc 250 trames et 250 écritures sur le réseau. En regroupant pendant 20 ms, une trame transporte plusieurs messages : moins d'appels système et moins de travail pour la boucle d'événements de Node.

**Le prix à payer :** jusqu'à 20 ms d'attente supplémentaire par message, ce qu'on voit dans le p50 de bout en bout à faible charge. C'est pour cela que l'option est désactivée par défaut (`BATCH_MS=0`), afin de garder des trames lisibles une par une dans l'onglet Réseau pendant les démonstrations. En production, on l'activerait.

## 7. Limites de la mesure

- k6 tourne sur la même machine que les serveurs : il consomme lui-même du CPU, et à 1000 VU il devient en partie le goulot d'étranglement. Les chiffres **sous-estiment** la capacité réelle.
- Une seule exécution par configuration. Le protocole prévoit 3 exécutions et la médiane : à refaire avant la soutenance si le temps le permet.
- L'histogramme serveur s'arrête à 2,5 s : « > 2 500 ms » signifie « au-delà de la mesure ».
- Les identifiants de messages k6 sont uniques **par exécution** (préfixe `RUN`). Une version antérieure du script les réutilisait ; une relance dans les 5 min faisait alors ignorer les messages comme doublons par le serveur. Les mesures ci-dessus ne sont pas concernées (messages émis au complet), mais le défaut a été corrigé le 4 novembre.
- WSL2 et Docker Desktop ajoutent une couche réseau virtuelle qui n'existerait pas sur un serveur Linux.

## 8. Ligne pour le tableau comparatif

| Technique | Broker | Instances | Outil de charge | Connexions avant dégradation | p50 / p95 | Débit | Optimisation et gain |
|-----------|--------|-----------|-----------------|------------------------------|-----------|-------|----------------------|
| WebSocket (`ws`) | Redis (pub/sub + Streams) | 2 | k6 | ≈ 580 (> 1000 après optimisation) | 74 ms / 10,2 s → 34 ms / 143 ms | ≈ 300 messages reçus/s, ≈ 35 000 diffusés/s | Regroupement 20 ms : p95 ÷ 70, connexions × 1,7 au moins |
