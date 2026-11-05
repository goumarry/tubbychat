# Ligne du groupe pour le tableau comparatif (annexe C)

> À reporter dans le tableau commun de la promo, pour la synthèse du jour 4. Source des chiffres : [`PHASE5.md`](PHASE5.md).

| Groupe | Technique | Broker | Instances | Outil de charge | Connexions avant dégradation | p50 / p95 | Débit | Optimisation et gain |
|--------|-----------|--------|-----------|-----------------|------------------------------|-----------|-------|----------------------|
| Groupe 3 — TubbyChat | WebSocket (`ws`, Node.js) | Redis 7.4 (pub/sub + Streams) | 2 (derrière nginx) | k6 | ≈ 580 (sans optimisation) · > 1000 (avec) | 74 ms / 10,2 s → **34 ms / 143 ms** | ≈ 300 messages reçus/s, ≈ 35 000 diffusés/s | Regroupement des envois (20 ms) : p95 ÷ 70, connexions × 1,7 au moins |

**Comment lire cette ligne** :
- *p50 / p95* : latence de bout en bout mesurée par k6 (envoi → réception de son propre message diffusé), sur l'ensemble du scénario de 100 à 1000 utilisateurs, avant puis après optimisation.
- *Seuil* : nombre de connexions à partir duquel le p95 serveur dépasse 200 ms.
- *Débit* : au seuil, avec ≈ 145 personnes par salon ; chaque message reçu est diffusé à tous les membres de son salon.
- Machine : i5-13420H, 7,6 Go de RAM, WSL2 ; k6 sur la même machine.
