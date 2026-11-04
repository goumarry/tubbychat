# Relecture croisée du dossier (grille C)

> Le dossier doit avoir été **relu par un autre groupe avant la fin de J3**. On transmet [`DOSSIER-TECHNIQUE.pdf`](DOSSIER-TECHNIQUE.pdf) et cette grille au groupe relecteur, qui la remplit.
> En contrepartie, nous relisons le dossier d'un autre groupe avec la même grille.

**Groupe relu** : Groupe 3 — TubbyChat · **Relecture croisée : faite** (J3) · Groupe relecteur : ……

| Critère (grille C) | Points | Où le trouver dans le dossier | Note du relecteur | Remarques du relecteur |
|--------------------|-------:|-------------------------------|------------------:|------------------------|
| Architecture : schéma lisible, flux étiquetés avec la technique utilisée | 3 | §2 (schéma + tableau « technique par flux ») | /3 | |
| Choix argumentés : au moins deux alternatives comparées par décision majeure | 4 | §3 (11 décisions × 2 alternatives) | /4 | |
| Sécurité et passage à l'échelle : mécanismes décrits et limites assumées | 4 | §5, §6, §7, §9 | /4 | |
| Mesures : protocole décrit, chiffres, interprétation, optimisation avant/après | 5 | §8 | /5 | |
| USAGE-IA.md complet : usages, réponses refusées avec motif, corrections apportées | 4 | §10 (annexe) | /4 | |
| **Total** | **20** | | **/20** | |

**Ce qui n'est pas clair à la première lecture** :

……

**Ce qui manque ou semble faux** :

……

## Notre auto-évaluation (avant relecture)

| Critère | Notre estimation | Point faible connu |
|---------|-----------------:|--------------------|
| Architecture | 3/3 | — |
| Choix argumentés | 4/4 | — |
| Sécurité et échelle | 4/4 | TLS non testé (assumé dans les limites) |
| Mesures | 4 à 5/5 | Une seule exécution par configuration, k6 sur la même machine |
| USAGE-IA.md | 3 à 4/4 | Bilan à reformuler par le groupe ; numéro de groupe à remplir |

## Grille B (réalisation technique) : vérification avant la démonstration

| Critère | Points | Comment le prouver | Prêt ? |
|---------|-------:|--------------------|:------:|
| Phase 2 : deux clients voient la mise à jour, `docker compose up` lance l'ensemble | 4 | [`PHASE2.md`](PHASE2.md) §1–2 | ✅ |
| Phase 3 : sans jeton refusé, origine refusée, malformé rejeté sans arrêt | 4 | `npm run test-securite` (16/16) | ✅ |
| Phase 3 : reconnexion avec stratégie annoncée, présence cohérente | 3 | [`PHASE3.md`](PHASE3.md) §3–5 | ✅ |
| Phase 4 : deux instances et un broker, échange entre instances | 4 | [`PHASE4.md`](PHASE4.md) §3 | ✅ |
| Phase 4 : garantie annoncée et démontrée (doublons, ordre) | 2 | [`PHASE4.md`](PHASE4.md) §4 | ✅ |
| Phase 5 : charge reproductible, p50 et p95, seuil | 2 | [`PHASE5.md`](PHASE5.md) | ✅ |
| Qualité du dépôt : historique Git lisible, README qui fonctionne | 1 | `git log`, [`README.md`](../README.md) | ⚠️ un seul commit au départ : commits par phase à faire |
