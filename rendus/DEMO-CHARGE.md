# Tuto : démontrer le test de charge avant/après au formateur

> Durée de la démo : **environ 5 min** (2 exécutions de 1 min 40 + explications).
> On montre trois choses : **le scénario est scripté**, **la latence se dégrade au-delà d'environ 580 connexions**, et **le regroupement des envois corrige le problème, gain chiffré avec la même méthode**.

---

## 0. Préparation (à faire AVANT que le formateur arrive, 3 min)

```bash
cd tubbychat
MAX_CONN_PER_IP=100000 docker compose up -d --build
```

> `MAX_CONN_PER_IP=100000` : toutes les connexions k6 viennent de la **même IP**. Avec le quota normal (50 par IP), le serveur refuserait les connexions en 429. C'est la seule différence avec la configuration normale ; elle est identique avant et après.

1. Ouvrir **Grafana** : http://localhost:3001 → *Dashboards* → **TubbyChat temps réel**.
2. En haut à droite : période **« Last 5 minutes »**, rafraîchissement **5s**.
3. Ouvrir un **terminal en grand** (police lisible), placé à côté de Grafana.
4. Faire un essai à blanc **au moins 5 minutes avant** la démo, ou pas d'essai du tout. Le script k6 génère des identifiants de messages uniques à chaque exécution, donc il n'y a pas de piège de ce côté. L'essai sert seulement à vérifier que tout démarre.

Disposition conseillée : **terminal à gauche, Grafana à droite**.

---

## 1. Présenter le scénario (30 s)

Ouvrir `load/chat.js` et montrer :

| Ce qu'on montre | Ce qu'on dit |
|-----------------|--------------|
| `stages` du scénario `demo` | « Montée à 300 utilisateurs, palier, puis 750 : on passe exprès au-dessus du seuil mesuré d'environ 580. » |
| `ws.connect` + `join` + `setInterval(… 2000)` | « Chaque utilisateur virtuel fait comme un vrai client : connexion HTTP, ticket, WebSocket, il rejoint un salon et envoie un message toutes les 2 secondes. » |
| `latency.add(Date.now() - …)` | « Point d'horodatage : on met l'heure d'envoi dans le texte, et on mesure à la réception de **son propre** message diffusé. C'est l'aller-retour complet : nginx, instance, Redis, autre instance, client. » |

> À 750 utilisateurs répartis sur 4 salons, il y a environ 190 personnes par salon. **Un** message reçu est donc envoyé **190 fois**. C'est ce qui sature le serveur.

---

## 2. Mesure AVANT optimisation (1 min 40)

```bash
docker compose exec redis redis-cli DEL stream:colline stream:maison-tubby stream:jardin stream:soleil
MAX_CONN_PER_IP=100000 docker compose --profile charge run --rm k6 run -e SCENARIO=demo /scripts/chat.js
```

> La 1re ligne vide l'historique des salons, pour que l'avant et l'après partent du même état (c'est écrit dans le protocole).

**Pendant l'exécution, commenter Grafana :**

| Panneau | Ce qu'on voit | Ce qu'on dit |
|---------|---------------|--------------|
| Connexions actives par instance | montée vers 750, réparties entre api-1 et api-2 | « nginx répartit les connexions entre les deux instances. » |
| Messages par seconde | le flux sortant (`out`) monte à plusieurs dizaines de milliers par seconde | « Chaque message entrant est multiplié par le nombre de membres du salon. » |
| **Latence de diffusion p50 / p95 / p99** | quelques ms à 300 connexions, puis **explosion** au passage vers 600–750 | « Voilà la dégradation : les deux processus Node, un cœur chacun, n'arrivent plus à suivre. » |
| Déconnexions par code | éventuellement des coupures | « La contre-pression coupe les clients trop lents plutôt que de faire exploser la mémoire. » |

**Résultat attendu en fin d'exécution (ordre de grandeur) :**

```text
✗ chat_latency.....: med=197ms   p(90)=1.61s   p(95)=2.86s
  chat_messages_received: 2 736 558
  ws_connecting......: p(95)=9.92s
level=error msg="thresholds on metrics 'chat_latency' have been crossed"
```

> « Le seuil fixé dans le script (p95 < 250 ms) **n'est pas tenu** : k6 l'affiche en rouge (✗). Même l'ouverture d'un WebSocket prend jusqu'à 10 s. »

---

## 3. Activer l'optimisation (20 s)

```bash
MAX_CONN_PER_IP=100000 BATCH_MS=20 docker compose up -d api-1 api-2
docker compose exec api-1 printenv BATCH_MS     # → 20
```

**Expliquer avec `server/src/ws/send.js`** (fonctions `deliver` et `flush`) :

> « Avant : un `ws.send` par message et par destinataire, donc 190 trames et 190 écritures réseau pour un seul message. Après : chaque instance accumule pendant **20 ms** ce qui part vers un même client, puis l'envoie en **une seule trame** (un tableau JSON). Moins d'appels système, moins de travail pour la boucle d'événements. »

---

## 4. Mesure APRÈS optimisation (1 min 40)

Exactement la **même commande**, ce qui fait que c'est la même méthode de mesure :

```bash
docker compose exec redis redis-cli DEL stream:colline stream:maison-tubby stream:jardin stream:soleil
MAX_CONN_PER_IP=100000 docker compose --profile charge run --rm k6 run -e SCENARIO=demo /scripts/chat.js
```

Dans Grafana, la courbe de latence **reste plate** à 750 connexions.

**Résultat attendu :**

```text
✓ chat_latency.....: med=38ms   p(90)=109ms   p(95)=146ms
  chat_messages_received: 3 621 996
  ws_connecting......: p(95)=47ms
```

---

## 5. Conclure avec les chiffres (1 min)

| Indicateur (scénario `demo`, 750 utilisateurs) | Avant | Après | Gain |
|------------------------------------------------|------:|------:|-----:|
| Latence de bout en bout p50 | 197 ms | 38 ms | ÷ 5 |
| Latence de bout en bout **p95** | **2,86 s** | **146 ms** | **÷ 20** |
| Ouverture du WebSocket p95 | 9,9 s | 47 ms | ÷ 200 |
| Messages livrés aux clients | 2,7 millions | 3,6 millions | + 32 % |
| Seuil k6 (p95 < 250 ms) | ✗ franchi | ✓ tenu | — |

*Mesuré le 4 novembre 2026 sur la machine du protocole (i5-13420H, WSL2). Les valeurs varient un peu d'une exécution à l'autre ; l'écart avant/après, lui, reste net.*

À dire :
- « Sur le scénario complet de `PHASE5.md`, de 100 à 1000 utilisateurs, on a mesuré un seuil de dégradation d'**environ 580 connexions** sans optimisation, et **plus de 1000** avec : le p95 passe de 10,2 s à 143 ms. »
- « **Contrepartie** : jusqu'à 20 ms de délai ajouté par message à faible charge. C'est pour ça que l'option est désactivée par défaut, pour garder une trame par message dans l'onglet Réseau pendant les démos. En production, on l'activerait. »
- « **Limite** : k6 tourne sur la même machine que les serveurs et leur prend du CPU. Les chiffres **sous-estiment** la capacité réelle. »

---

## 6. Remettre la configuration normale (après la démo)

```bash
docker compose up -d        # BATCH_MS=0, MAX_CONN_PER_IP=50
```

---

## Si le formateur demande le scénario complet

```bash
MAX_CONN_PER_IP=100000 docker compose --profile charge run --rm k6     # 3 min 35, paliers 100 → 300 → 600 → 1000
```

## Dépannage

| Problème | Cause | Solution |
|----------|-------|----------|
| k6 affiche beaucoup de `✗ poignée de main 101` / erreurs 429 | Quota par IP actif (`MAX_CONN_PER_IP` oublié) | Relancer `MAX_CONN_PER_IP=100000 docker compose up -d api-1 api-2` |
| `BATCH_MS` affiche `0` après l'étape 3 | Variable oubliée sur le `up` | Refaire l'étape 3 en entier |
| Grafana vide | Mauvaise période ou rafraîchissement arrêté | « Last 5 minutes », rafraîchissement 5s |
| La machine rame énormément pendant « avant » | C'est le but : la saturation | Attendre la fin, 1 min 40 |
| `chat_messages_received` anormalement bas | Ancienne version du script, avec des `clientMsgId` qui se répétaient d'une exécution à l'autre (le serveur les ignorait comme doublons) | Corrigé : un identifiant d'exécution (`RUN`) est ajouté dans `load/chat.js` |
