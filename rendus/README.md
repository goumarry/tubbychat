# Rendus du projet fil rouge — TubbyChat

Tous les livrables demandés par la fiche projet sont réunis dans ce dossier. Le seul livrable placé ailleurs est `USAGE-IA.md`, que la fiche demande **à la racine du dépôt**.

## Par phase

| Phase | Fichier | Contenu |
|-------|---------|---------|
| 1 — Sujet et architecture | [`PHASE1.md`](PHASE1.md) | Sujet, utilisateurs, scénario en 5 étapes, schéma avec technique par flux, tableau de décision, contrat de messages, dépôt Git |
| 2 — Socle temps réel | [`PHASE2.md`](PHASE2.md) | `docker compose up`, démonstration à deux navigateurs, conformité des trames au contrat |
| 3 — Sécurité, reconnexion, présence | [`PHASE3.md`](PHASE3.md) | Recette 16/16, ticket et origine, validation, débit, stratégie de reconnexion, reprise, présence |
| 4 — Plusieurs instances | [`PHASE4.md`](PHASE4.md) | 2 instances derrière nginx, Redis pub/sub, garantie « au moins une fois », doublons et ordre |
| 5 — Charge et mesures | [`PHASE5.md`](PHASE5.md) | Métriques, Grafana, protocole, p50/p95, seuil de dégradation, optimisation avant/après |
| 6 — Dossier et soutenance | [`PHASE6.md`](PHASE6.md) | Suivi des livrables de fin de projet et ce qu'il reste à faire |

## Livrables de fin de projet

| Livrable | Fichier |
|----------|---------|
| Dossier technique (12 pages) | [`DOSSIER-TECHNIQUE.pdf`](DOSSIER-TECHNIQUE.pdf) · source [`DOSSIER-TECHNIQUE.md`](DOSSIER-TECHNIQUE.md) · générateur [`build-pdf.cjs`](build-pdf.cjs) |
| Vidéo de secours (≤ 3 min) | script [`SCRIPT-VIDEO.md`](SCRIPT-VIDEO.md) · vidéo : *lien à ajouter ici* |
| Ligne du tableau comparatif | [`TABLEAU-COMPARATIF.md`](TABLEAU-COMPARATIF.md) |
| Relecture croisée (grille C) + auto-évaluation (grille B) | [`GRILLE-RELECTURE.md`](GRILLE-RELECTURE.md) |
| Préparation de la soutenance (déroulé de 7 min, questions probables) | [`SOUTENANCE.md`](SOUTENANCE.md) |
| Tuto de démo du test de charge avant/après (5 min) | [`DEMO-CHARGE.md`](DEMO-CHARGE.md) |
| Journal d'usage de l'IA | [`../USAGE-IA.md`](../USAGE-IA.md) |
| Document d'architecture de référence | [`ARCHITECTURE.md`](ARCHITECTURE.md) |

Lancement de l'application : voir le [`README.md`](../README.md) à la racine.
