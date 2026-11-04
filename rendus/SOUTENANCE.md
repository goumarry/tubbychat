# Soutenance (J4, à distance) : 7 min de présentation et démonstration, 5 min de questions

> Signal à 6 min, coupure à 7 min. **Chaque membre prend la parole**, et au moins une question sera posée à un membre nommé : chacun doit connaître les autres parties.
> Plan de secours : si la démonstration en direct échoue, bascule immédiate sur la vidéo ([`SCRIPT-VIDEO.md`](SCRIPT-VIDEO.md)).

## Répartition (décidée par le groupe)

| Qui | Prend la parole sur | Parties du code à maîtriser en priorité |
|-----|---------------------|------------------------------------------|
| **Evan Louis** | **Architecture** : sujet, schéma, choix et alternatives, rôle de Redis et des deux instances, conception de la sécurité (ticket, origine) | `docker-compose.yml`, `client/nginx.conf`, `server/src/broker.js`, `presence.js`, `auth.js`, `ws/connection.js` |
| **Alix Pratabuy** | **Démonstration** : scénario à deux navigateurs, arrêt d'une instance, recette de sécurité, reconnexion | `client/src/socket.js`, `store.js`, `util.js`, `server/src/ws/handlers.js`, `schema.js`, `server/test/securite.test.js` |
| **Yoann Goumarre** | **Performances et optimisation** : protocole k6, p50/p95, seuil de dégradation, regroupement des envois, limites | `load/chat.js`, `server/src/ws/send.js`, `metrics.js`, Grafana, [`DEMO-CHARGE.md`](DEMO-CHARGE.md) |

Chacun doit aussi pouvoir répondre sur les parties des autres : une question peut être posée à un membre nommé.

## Déroulé minuté

| Temps | Qui | Contenu | Support |
|------:|-----|---------|---------|
| 0:00–0:30 | Evan | Sujet, utilisateurs, scénario en une phrase | Page de connexion |
| 0:30–2:00 | Evan | **Architecture** : schéma, technique par flux (WebSocket, REST, Redis pub/sub et Streams, HTTP pull) ; 3 choix clés et leurs alternatives : WebSocket contre SSE, Redis contre NATS/Kafka, ticket contre JWT dans l'URL | Schéma de `PHASE1.md` |
| 2:00–3:45 | Alix | **Démonstration** : Alice (api-1) et Bob (api-2), message, « en train d'écrire », « Lu par bob » ; puis `docker compose stop api-1` et reconnexion sur api-2 | Deux navigateurs côte à côte |
| 3:45–4:45 | Alix | **Sécurité** : `npm run test-securite` en direct (Evan explique le ticket et l'origine si le temps le permet) | Terminal |
| 4:45–5:15 | Alix | **Robustesse** : délai croissant, plafond, gigue ; reprise par `since` ; présence | `util.js` (5 lignes) |
| 5:15–6:30 | Yoann | **Mesures** : protocole, seuil à 580 connexions, gain du regroupement (p95 ÷ 70) ; **limites** : une seule machine, une seule exécution, Redis point unique de défaillance | Grafana + tableau de `PHASE5.md` |
| 6:30–7:00 | tous | Conclusion : ce qui marche, ce qu'on ferait ensuite | — |

**Avant de commencer** : stack lancée, deux navigateurs connectés (api-1 / api-2 vérifiés), terminal prêt, Grafana ouvert, vidéo ouverte dans un onglet, partage d'écran testé.

## Questions probables et éléments de réponse

| Question | Réponse courte |
|----------|----------------|
| Pourquoi pas SSE ? | SSE ne va que du serveur vers le client. Une messagerie envoie souvent dans l'autre sens (message, saisie, lu) : il faudrait un POST par action. |
| Pourquoi pas Socket.IO ? | Il fournit reconnexion et salons tout faits. On devait justement les **concevoir et les démontrer** ; avec `ws`, chaque mécanisme est dans notre code. |
| Comment authentifiez-vous le WebSocket ? | Le navigateur ne peut pas mettre d'en-tête `Authorization`. On obtient par HTTP (cookie) un **ticket** de 30 s, à usage unique, passé dans l'URL ; le serveur le consomme avec `GETDEL` pendant la poignée de main. Sans ticket valide : 401 avant même l'ouverture. |
| Le ticket dans l'URL, ce n'est pas dangereux ? | Il dure 30 s, ne sert qu'une fois, et nginx journalise `$uri` sans la query string. Un ticket volé est déjà consommé. |
| À quoi sert la vérification de l'origine si on a un cookie `SameSite` ? | `SameSite` raisonne en **site** et non en **origine** : un sous-domaine compromis est du même site. La liste blanche exacte bloque le CSWSH dans tous les cas. |
| Que se passe-t-il si un message fait 1 Mo ? | `maxPayload` 8 Kio : `ws` ferme en 1009 sans lire le contenu. L'écouteur `ws.on('error')` empêche le processus de s'arrêter. Démontré par le test n° 12. |
| Pourquoi deux instances ? Que fait Redis ? | Prouver qu'on passe à l'échelle horizontalement. Un WebSocket est attaché à une instance ; Redis pub/sub relaie les messages à l'autre. Redis stocke aussi l'historique (Streams), la présence, les sessions et les tickets : les instances n'ont pas d'état propre. |
| Pourquoi pas de session collante dans nginx ? | Un WebSocket reste de toute façon sur son instance, et tout l'état est partagé dans Redis : n'importe quelle instance peut servir n'importe quel client. |
| Quelle garantie de livraison ? | Au moins une fois : Stream durable + reprise + renvoi. Doublons traités par `SET NX` sur `clientMsgId` côté serveur, et par id côté client. Ordre total dans un salon (ids de Stream). Pas d'ordre entre salons : hors périmètre. |
| Pourquoi pas « exactement une fois » ? | Impossible de bout en bout sur un réseau non fiable. On en obtient l'**effet** à l'affichage grâce au dédoublonnage. |
| Pourquoi de la gigue ? | Sans elle, 1000 clients coupés en même temps reviennent à la même milliseconde et refont tomber le serveur (effet de troupeau). |
| Pourquoi un plafond de 10 s et pas 30 s ? | Mesuré : avec 30 s, une panne de 10 s donnait jusqu'à 37 s d'attente. Avec 10 s, le retour prend 5 à 10 s. |
| Comment savez-vous qu'un onglet fermé a disparu ? | Fermeture propre : `presence offline` immédiat (mesuré 0,6 s). Coupure brutale : plus de battement depuis 30 s, retiré par le nettoyeur (< 35 s). |
| Qu'est-ce qui sature à 580 connexions ? | Pas Redis : l'envoi. Un message dans un salon de 250 personnes, ce sont 250 `ws.send`. Les deux processus Node, un cœur chacun, saturent. |
| Le regroupement n'ajoute-t-il pas de la latence ? | Si, jusqu'à 20 ms. C'est pour ça qu'il est désactivé par défaut. Mais sous charge, il divise le p95 par 70. |
| Vos mesures sont-elles fiables ? | Limites assumées : k6 sur la même machine (capacité sous-estimée), une seule exécution par configuration, WSL2. Le protocole est écrit pour être rejoué. |
| Que feriez-vous avec plus de temps ? | Redis Sentinel, TLS testé, abonnement pub/sub par salon, 3 exécutions de mesure avec k6 sur une autre machine. |
| Comment avez-vous utilisé l'IA ? | Voir `USAGE-IA.md` : génération de code et de documents, **toujours vérifiée par un test**. Plusieurs propositions ont été corrigées ou refusées (plafond de 30 s, détection de perte, mode hors ligne du navigateur). |

## Répétition

- [ ] Déroulé chronométré au moins une fois, en dessous de 7:00
- [ ] Partage d'écran testé (application de visioconférence imposée)
- [ ] Chaque membre a répondu à 3 questions de la liste sur une partie qui n'est **pas** la sienne
