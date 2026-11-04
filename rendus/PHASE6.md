# TubbyChat — Phase 6 : dossier technique et soutenance

> Projet fil rouge · Web temps réel · Filière IW · Livrables de la phase 6 (J3 fin, J4)

| Livrable demandé | Fichier | État |
|------------------|---------|------|
| Dossier technique de 8 à 12 pages (plan de la section 9 de la fiche) | [`DOSSIER-TECHNIQUE.pdf`](DOSSIER-TECHNIQUE.pdf) (12 pages), source [`DOSSIER-TECHNIQUE.md`](DOSSIER-TECHNIQUE.md) | ✅ rédigé (Groupe 3, 3 membres) |
| Vidéo de démonstration de secours (3 min au plus) | script : [`SCRIPT-VIDEO.md`](SCRIPT-VIDEO.md) · vidéo : `video-demo.mp4` ou lien | ⬜ **à enregistrer par le groupe** (voix des membres) |
| Ligne du groupe dans le tableau comparatif (annexe C) | [`TABLEAU-COMPARATIF.md`](TABLEAU-COMPARATIF.md) | ✅ ligne prête · ⬜ à reporter dans le tableau commun |
| `USAGE-IA.md` du projet à jour | [`../USAGE-IA.md`](../USAGE-IA.md) (à la racine, comme l'exige la fiche) | ✅ complet (journal, refus, bilan validé par le groupe) |

| Critère de réussite observable | Comment | État |
|--------------------------------|---------|------|
| Le dossier a été relu par un autre groupe (grille C) avant la fin de J3 | [`GRILLE-RELECTURE.md`](GRILLE-RELECTURE.md) | ✅ |
| La vidéo est déposée avant la fin de J3 | Suivre [`SCRIPT-VIDEO.md`](SCRIPT-VIDEO.md) | ⬜ |
| La soutenance tient en 7 min, démonstration comprise | Déroulé minuté et questions probables : [`SOUTENANCE.md`](SOUTENANCE.md) | ✅ rôles répartis · ⬜ répétition chronométrée |

## Correspondance entre le plan imposé et le dossier

| Plan de la fiche (section 9) | Section du dossier | Détail dans |
|------------------------------|--------------------|-------------|
| 1. Contexte, utilisateurs, scénario principal | §1 | [`PHASE1.md`](PHASE1.md) §1 |
| 2. Architecture : schéma, composants, flux et techniques | §2 | [`PHASE1.md`](PHASE1.md) §2, [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 3. Décisions et alternatives comparées | §3 | [`PHASE1.md`](PHASE1.md) §3 |
| 4. Contrat de messages | §4 | [`PHASE1.md`](PHASE1.md) §4 |
| 5. Sécurité : authentification, origine, validation, débit, chiffrement | §5 | [`PHASE3.md`](PHASE3.md) §1–2 |
| 6. Robustesse : reconnexion, reprise, présence | §6 | [`PHASE3.md`](PHASE3.md) §3–5 |
| 7. Passage à l'échelle : broker, instances, garanties de livraison | §7 | [`PHASE4.md`](PHASE4.md) |
| 8. Mesures : protocole, résultats, optimisation avant/après | §8 | [`PHASE5.md`](PHASE5.md) |
| 9. Limites et pistes | §9 | — |
| 10. Annexe : USAGE-IA.md | §10 (inséré automatiquement dans le PDF) | [`../USAGE-IA.md`](../USAGE-IA.md) |

## Régénérer le PDF après une modification

```bash
cd rendus
npm install --no-save marked@14 mermaid@11 puppeteer@23
node build-pdf.cjs        # → DOSSIER-TECHNIQUE.pdf (schémas dessinés, USAGE-IA.md en annexe)
```

## Reste à faire par le groupe (avant la fin de J3)

Déjà fait : groupe et noms, formateur ajouté au dépôt (Laudroid), bilan USAGE-IA validé, relecture croisée, répartition des rôles.

1. **Enregistrer la vidéo** de secours (avant la fin de J3), la déposer et noter son lien dans `rendus/README.md`.
2. **Reporter la ligne du tableau comparatif** dans le tableau commun de la promo.
3. Répéter la soutenance en chronométrant (moins de 7:00).
4. Après chaque modification du dossier ou de `USAGE-IA.md` : régénérer le PDF (`node build-pdf.cjs`).
