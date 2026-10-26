# Vérification de la version 2
26 octobre 2026

## Résultats obtenus

54 contrôles réussis dans Ganache, EVM Shanghai, avec ethers 6.15.0, solc 0.8.30 et OpenZeppelin Contracts 5.4.0. Le journal complet est dans `test-v2.txt`. Le message Ganache indiquant un repli µWS vers JavaScript concerne uniquement la performance du banc de test.

- Création des 24 NFT avec les vraies métadonnées préparées pour la nouvelle collection.
- Distribution et récupération pour 24, 12, 10, 9 et 2 participants : quotas égaux et reliquat exact; deux jokers chez deux apprenants distincts.
- Refus des doublons, effectifs excessifs, inscription du formateur et administration par apprenant.
- Refus d’un faux résultat aléatoire, du nouveau tirage et de la distribution avant réponse.
- Transferts directs refusés, y compris après approval et via safeTransferFrom.
- Don ordinaire refusé; don joker vers autre détenteur de joker ou adresse extérieure refusé.
- Achat sans fonds/approbation refusé; prix modifié refusé; paiement et propriété vérifiés après achat réussi.
- Achat du second joker refusé; troc accepté uniquement par son destinataire; deux propriétaires inversés après troc; ancienne vente invalidée.
- Don de joker et pause du marché.
- Scrutins simultanés, candidature joker, candidature formateur et vote anticipé refusés.
- Snapshot des droits de vote maintenu malgré le déplacement du joker; double vote refusé; résultat adopté.
- Quorum absent, égalité et paire devenue détenue par le même portefeuille : maintien de la paire initiale.
- Reprise sans paiement même en pause; impossibilité pour un apprenant de reprendre; maintien des SMZF et désactivation des participants.
- Nouveau semestre sans anciens droits; clôture invalide les offres précédentes.
- Adaptateur VRF : liaison unique, authentification du coordinateur, cycle request/callback/distribution avec coordinateur simulé.

Compilation des sources autonomes destinée à Remix réussie. Contrat AtelierNFT : 15 705 octets de bytecode d’exécution, sous la limite EIP-170 de 24 576 octets. L’interface atelier et le déployeur ont passé le contrôle de syntaxe JavaScript.

## Ce qui n’a pas encore été exécuté

- Aucun contrat de cette nouvelle collection déployé sur Sepolia.
- Aucun tirage Chainlink réel consommé : abonnement à créer/alimenter et consumer à inscrire.
- Aucun parcours navigateur MetaMask signé : le premier essai doit être réalisé avec le portefeuille formateur et deux comptes apprenants de test.
- Aucun audit indépendant. Les tests ne prouvent pas l’absence de tout défaut.
- Les 24 fichiers PNG existants n’ont pas fait l’objet d’une vérification de disponibilité individuelle.

## Paramètres de compilation

Optimisation : 200 runs; viaIR : true; EVM : Shanghai; compilateur : 0.8.30. `npm ci` puis `npm test`. Pas de clé privée dans le projet.

## Complément V2

Deux nouveaux tests : finalisation à échéance refusée à un apprenant inscrit et à une adresse extérieure. Le formateur finalise avec succès. Le nouvel écran a également été contrôlé pour la saisie de neuf apprenants (deux cartes chacun, six conservées), les doublons et la présence d’un seul bouton de finalisation dans le panneau formateur. Le déployeur contient bien le bytecode V2 recompilé.
