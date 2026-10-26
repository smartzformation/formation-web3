# Règles contractuelles retenues — V2

- Collection distincte de 24 NFT uniques, IDs 1 à 24, visuels réutilisés.
- SMZF existant, 18 décimales, Ethereum Sepolia. Aucun euro engagé.
- Formateur immuable : créateur du contrat, détenteur initial des 24 NFT, seul administrateur des sessions et du tirage, pouvoir de récupération sans contrepartie. Les apprenants en sont informés.
- 2 à 24 adresses classiques distinctes et une adresse par apprenant. Transactions NFT limitées aux inscrits, formateur exclu des participants et du vote.
- Distribution : q = partie entière de 24/n pour chaque apprenant, reliquat 24 modulo n chez le formateur. Deux jokers choisis avant le tirage, distribués obligatoirement à deux apprenants distincts. Tirage VRF puis mélange déterministe.
- Cartes ordinaires : ventes en SMZF uniquement entre apprenants; prix libre, minimum 1 SMZF. Distribution initiale et reprise par le formateur sont exemptées.
- Jokers : vente en SMZF, don sans contrepartie à un inscrit ne détenant pas l’autre joker, troc atomique contre l’autre joker avec acceptation du destinataire. Aucun apprenant ne termine une opération avec les deux jokers. Le formateur peut les détenir tous deux.
- Les approvals ERC721 héritées ne contournent pas les règles : tous les transferts directs sont bloqués.
- Prix et vendeur explicitement acceptés par l’acheteur. Prix modifié = transaction refusée. Un déplacement invalide la vente et les anciennes propositions impliquant la carte; aucune offre ne redevient active si la carte revient à son ancien propriétaire.
- Vote : 1 voix par inscrit, 3 voix au total par détenteur de joker à l’ouverture, sans cumul avec le nombre de cartes. Transfert d’un joker pendant le scrutin sans déplacement du poids figé. Un vote par adresse. Pas de votes simultanés.
- Propositions : paires de cartes ordinaires uniquement, toutes deux distribuées, détenues par deux inscrits distincts. Jokers actuels et cartes chez le formateur exclus. Paires identiques inversées dédupliquées.
- Une période de propositions précède une période de vote. Quorum choisi au lancement (1 à 10 000 points de base, 50 % proposé), calculé sur le poids exprimé / poids total. Meilleur score unique gagne; égalité, zéro voix, quorum insuffisant ou paire gagnante devenue inadmissible = maintien des jokers.
- Admissibilité revérifiée à la finalisation. Les anciens jokers peuvent être candidats au scrutin suivant. Nouvelle paire = nouveaux droits immédiats et bonus au prochain scrutin.
- Par simplicité et prudence, un changement de paire invalide **toutes** les offres de marché et de troc encore actives, pas seulement celles des quatre cartes concernées. Les propriétaires peuvent republier leurs offres. Le badge de galerie suit le contrat.
- Pause réversible pour le marché, les propositions et les votes; les échéances ne s’arrêtent pas. Récupération toujours possible une fois le tirage finalisé. Clôture sans reprise de SMZF et sans remboursement des achats.
- Durant un tirage demandé ou reçu, finaliser la distribution avant de clôturer; aucune nouvelle graine ni modification des entrées ne sont autorisées.
- Après clôture : 24 cartes chez le formateur, aucune offre exécutable, vote clos, anciens participants désactivés. Préparation possible du semestre suivant.
- Limite de la règle « vente uniquement » : une vente à petit prix peut économiquement ressembler à un cadeau; le contrat contrôle le paiement minimum, pas les accords privés entre personnes.

- V2 : application du résultat du vote exclusivement réservée au portefeuille formateur (`onlyTrainer`).
