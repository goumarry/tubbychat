# USAGE-IA — Groupe 3 — TubbyChat

Membres : Evan Louis · Alix Pratabuy · Yoann Goumarre

## Outils utilisés
- Claude Code (modèle Claude Opus 5.5, Anthropic)

## Journal
| Date / phase | Besoin | Demande (résumé) | Retenu ? | Vérification effectuée | Correction apportée |
|--------------|--------|------------------|----------|------------------------|---------------------|
| 2026-11-02 / phase 1 | Architecture | Document d'architecture complet à partir de la fiche projet (schéma, décisions, contrat de messages) | Oui | Relecture par le groupe : FAIT | Mis à jour après l'implémentation (port 8090, plafond de 10 s, pas de Pinia ni de Zod) |
| 2026-11-02 / phases 2 à 5 | Implémentation | Serveur Node + ws + Redis, client Vue au thème Télétubbies, nginx, Prometheus, Grafana, k6 | Oui | `npm run test-securite` : 16/16. Scénario navigateur automatisé (2 utilisateurs, 2 instances, panne de 10 s, arrêt d'instance, présence). k6 avant/après | Voir lignes suivantes |
| 2026-11-02 / phase 3 | Reconnexion | Plafond de reconnexion à 30 s proposé au départ | Modifié | Test de panne de 10 s : 37 s pour revenir | Plafond ramené à 10 s → retour en 5 à 10 s |
| 2026-11-02 / phase 3 | Reprise | Détection des messages perdus par comparaison avec le plus vieil id | Modifié | Relecture : la logique était fausse (toujours « complet ») | Utilisation de `max-deleted-entry-id` (XINFO STREAM, Redis 7) |
| 2026-11-02 / phase 5 | Charge | Script k6 | Modifié | 1re exécution : boucle de 885 000 requêtes en échec (cookies vidés à chaque itération) ; 2e : 56 000 refus 429 (quota par IP réinitialisé par `compose run`) | `noCookiesReset`, pause après échec, suppression du `depends_on` du service k6 |
| 2026-11-02 / phase 2 | Interface | Mise en page de l'en-tête | Modifié | Capture d'écran : texte du soleil écrasé | Conflit de nom de classe `.sun` corrigé (`.sunslot`) |
| 2026-11-03 / phase 1 | Livrables | Rédaction de `PHASE1.md` (README, schéma, décisions, contrat) | Oui | Contrat comparé au code (`schema.js`, `handlers.js`) : champs de `welcome`, `joined`, `chat` corrigés pour correspondre à la réalité | `ARCHITECTURE.md` renvoie désormais à `PHASE1.md` (une seule source pour le contrat) |
| 2026-11-03 / phase 2 | Observabilité | Afficher les trames WebSocket dans les journaux Docker | Oui | Trames `ws ←` / `ws →` visibles ; ticket du `reauth` masqué ; `npm run test-securite` toujours 16/16 | Option désactivée par défaut (`LOG_MESSAGES=1` pour l'activer) : volume et vie privée |
| 2026-11-04 / phases 2 à 6 | Livrables | Rédaction de `rendus/PHASE2.md` à `PHASE6.md`, du dossier technique, du script vidéo et du plan de soutenance | Oui | Chaque chiffre recoupé avec les mesures (`PHASE5.md`) et chaque mécanisme avec le code | Durée d'exécution k6 recalculée (3 min 35 s et non 4 min 15 s) ; mention d'une règle ESLint inexistante retirée de `ARCHITECTURE.md` |
| 2026-11-04 / phase 5 | Démo de charge | Scénario court (1 min 40) pour une démonstration en direct avant/après | Modifié | 2e exécution : 20 000 messages reçus au lieu de 3 millions. Une sonde WebSocket indépendante recevait tout : le défaut venait du script | `clientMsgId` identiques d'une exécution à l'autre, donc ignorés comme doublons par le serveur pendant 5 min. Ajout d'un identifiant d'exécution ; avant/après rejoué : p95 2,86 s → 146 ms |

## Réponses refusées
| Date / phase | Réponse proposée (résumé) | Motif du refus |
|--------------|---------------------------|----------------|
| 2026-11-02 / phase 1 | Utiliser Pinia (état), Zod (validation) et pino (journaux) | Dépendances inutiles pour cette taille : un `reactive()`, 80 lignes de validation et un journal JSON maison suffisent et s'expliquent à l'oral |
| 2026-11-02 / phase 3 | Tester la coupure réseau avec le mode « hors ligne » du navigateur (Playwright `setOffline`) | Vérifié : ce mode ne ferme pas les WebSockets déjà ouverts, le test ne prouvait rien. Remplacé par un arrêt réel des deux instances (`docker compose stop`) |
| 2026-11-02 / phase 5 | Un fichier `docker-compose.load.yml` séparé pour la charge | Un deuxième fichier compose à maintenir. Remplacé par une variable d'environnement (`MAX_CONN_PER_IP=100000 docker compose up -d`) |
| 2026-11-02 / phase 3 | Plafond de reconnexion à 30 s | Mesuré : jusqu'à 37 s pour revenir après une panne de 10 s. Plafond ramené à 10 s |

## Bilan (5 lignes au plus)
L'IA a accéléré l'écriture du code de base (serveur, client, configuration Docker) et la mise en forme des livrables.
Tout ce qui est annoncé a été vérifié par une exécution : recette de sécurité 16/16, panne réelle de 10 s, arrêt d'instance, deux campagnes k6.
Plusieurs propositions étaient fausses ou incomplètes et n'ont été corrigées que grâce aux tests (plafond de reconnexion, détection de perte, script k6).
Nous avons appris que « ça marche à l'œil » ne suffit pas : il faut une mesure reproductible pour chaque affirmation.
Chaque membre doit pouvoir expliquer le code de sa partie (répartition dans `rendus/SOUTENANCE.md`).
