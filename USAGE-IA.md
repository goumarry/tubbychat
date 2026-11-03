# USAGE-IA — Groupe G_ — TubbyChat

> Tenu au fil de l'eau. Toute ligne de code doit pouvoir être expliquée à l'oral par un membre du groupe.

## Outils utilisés
- Claude Code (modèle Claude Opus 5.5, Anthropic)

## Journal
| Date / phase | Besoin | Demande (résumé) | Retenu ? | Vérification effectuée | Correction apportée |
|--------------|--------|------------------|----------|------------------------|---------------------|
| 2026-11-02 / phase 1 | Architecture | Document d'architecture complet à partir de la fiche projet (schéma, décisions, contrat de messages) | Oui | Relecture par le groupe : À FAIRE | Mis à jour après l'implémentation (port 8090, plafond de 10 s, pas de Pinia ni de Zod) |
| 2026-11-02 / phases 2 à 5 | Implémentation | Serveur Node + ws + Redis, client Vue au thème Télétubbies, nginx, Prometheus, Grafana, k6 | Oui | `npm run test-securite` : 16/16. Scénario navigateur automatisé (2 utilisateurs, 2 instances, panne de 10 s, arrêt d'instance, présence). k6 avant/après | Voir lignes suivantes |
| 2026-11-02 / phase 3 | Reconnexion | Plafond de reconnexion à 30 s proposé au départ | Modifié | Test de panne de 10 s : 37 s pour revenir | Plafond ramené à 10 s → retour en 5 à 10 s |
| 2026-11-02 / phase 3 | Reprise | Détection des messages perdus par comparaison avec le plus vieil id | Modifié | Relecture : la logique était fausse (toujours « complet ») | Utilisation de `max-deleted-entry-id` (XINFO STREAM, Redis 7) |
| 2026-11-02 / phase 5 | Charge | Script k6 | Modifié | 1re exécution : boucle de 885 000 requêtes en échec (cookies vidés à chaque itération) ; 2e : 56 000 refus 429 (quota par IP réinitialisé par `compose run`) | `noCookiesReset`, pause après échec, suppression du `depends_on` du service k6 |
| 2026-11-02 / phase 2 | Interface | Mise en page de l'en-tête | Modifié | Capture d'écran : texte du soleil écrasé | Conflit de nom de classe `.sun` corrigé (`.sunslot`) |

## Réponses refusées
| Date / phase | Réponse proposée (résumé) | Motif du refus |
|--------------|---------------------------|----------------|
|  |  |  |

## Bilan (5 lignes au plus)
À compléter par le groupe : ce que l'IA a accéléré, ce que nous avons vérifié nous-mêmes, ce que nous avons appris.
