# Clans Polar DAO V2

Prototype Solidity autonome pour vérifier les règles de S06. Il utilise une instance locale de POLARVOTE issue du code du jeton V1. Les adresses, le proxy UUPS et les historiques existants restent en dehors de ce prototype.

## Inventaire et écarts

Référence pédagogique du 18 novembre 2026. [Scénario S06 V0.3](https://drive.google.com/file/d/1TgnhKox-XIbzH9zRQkdIAk9wKOior4no/view)

| Sujet | Existant inspecté | Règle V2 |
| --- | --- | --- |
| Dotation | La gouvernance V1 distribue un jeton via `rewardWinner` ou `buyPolarVote`. Dans la source locale du jeu, `enroll` crédite un solde interne SMZF et transfère les fonds du formateur à la réserve du jeu. | L’inscription laisse les soldes POLARVOTE à zéro. Le formateur attribue un jeton au gagnant inscrit, une seule fois par identifiant de manche et par session, comme dans la gouvernance V1. |
| Idées et soutiens | V1 et maquette ouvrent directement une proposition depuis le rôle formateur. | Un inscrit peut proposer et soutenir, même avec zéro jeton. Deux autres inscrits distincts et un solde positif du proposant rendent l’idée éligible à l’ouverture. |
| Électorat | La V1 retient les détenteurs du jeton hors réserve, y compris hors groupe. Le jeu local utilise son électorat d’inscrits. La maquette propose une voix par rôle joueur. | L’ouverture, réservée au formateur, fige les inscrits au solde positif et leur nombre de POLARVOTE. Les transferts suivants affectent les prochains scrutins. |
| Décompte et quorum | V1 fige les adresses et compte une voix par adresse, avec quorum de trois. Le jeu et la maquette comparent leurs compteurs Oui/Non sans quorum. S06 V0.3 présente une voix par jeton et laisse la méthode de photographie ouverte. | Un bulletin Oui/Non par adresse éligible alimente les deux décomptes. Le quorum commun exige trois votants distincts. Chaque décompte requiert une majorité stricte. |
| Application et reset | La maquette annonce une application à la session suivante. La V1 rappelle ses POLARVOTE et conserve les résultats. Le jeu possède son propre suivi des décisions et des rappels. | Le formateur peut différer ou appliquer une décision officiellement adoptée. POL-007 applique un changement typé du mode officiel. Les autres actions enregistrent une intervention du formateur dans le jeu. La clôture restaure le mode égalitaire, désactive les achats, rappelle les jetons et conserve les résultats et statuts d’application. |

La référence GitHub est le commit `ae41eb09de798b391a68f67ab5e97b1be88e63fa`. La page DAO affiche « Simulation » et utilise le stockage local de `maquette.js`. Elle donne accès à la DAO après les deux rappels et présente un sélecteur de rôles. Le parcours S06 exige un vote pendant que les soldes nécessaires aux achats sont encore disponibles. `sepolia.js` relie les écrans du jeu au proxy du jeu. `polar-v2.js` contient le code de création de JeuPolarV2, une évolution du jeu S05. [Page DAO](https://github.com/smartzformation/formation-web3/blob/ae41eb09de798b391a68f67ab5e97b1be88e63fa/S05/jeu-polar/dao.html) · [Logique de simulation](https://github.com/smartzformation/formation-web3/blob/ae41eb09de798b391a68f67ab5e97b1be88e63fa/S05/jeu-polar/maquette.js) · [Connexion au jeu](https://github.com/smartzformation/formation-web3/blob/ae41eb09de798b391a68f67ab5e97b1be88e63fa/S05/jeu-polar/sepolia.js)

Sources Solidity inspectées localement dans les téléchargements. `Clans-Polar-Gouvernance-V1/contracts/ClansPolarGovernance.sol` contient le jeton, la gouvernance et son proxy. `Maquette-Les-9-Clans-du-Polar 5/sources/JeuPolar.sol` gère inscription, partie, crédit, rappels et vote historique. `JeuPolarV2.sol` y ajoute notamment la fin anticipée de manche et les échanges ouverts. La correspondance de ces sources locales avec le bytecode actuellement actif reste à vérifier.

## Choix du prototype

- Groupe de 3 à 20 portefeuilles distincts fourni intégralement à l’ouverture. Le jeu local a une limite propre de neuf joueurs. Pour un parcours commun, respecter la limite du jeu et utiliser le même groupe.
- La qualification se calcule à partir du solde courant. Elle se met à jour après un transfert sans appel supplémentaire et peut disparaître avant l’ouverture si le proposant cède son dernier jeton. Une fois le scrutin ouvert, adresses, poids et mode officiel restent figés.
- Le formateur peut clore avant l’échéance. À l’échéance, tout compte peut constater le résultat. Un scrutin actif doit être clôturé avant la remise à zéro.
- POL-007 accepte une cible explicite, égalitaire ou pondérée. La proposition suit le parcours commun. Le changement exige un résultat officiel adopté, une action du formateur et l’absence de scrutin actif. Les autres décisions restent des interventions manuelles dont le statut peut être consigné.
- Les achats s’activent après la manche par le formateur. Le prototype prélève un ERC-20 directement du portefeuille, avec un prix fixé à la construction en unités minimales. Le test utilise 100 SMZF fictifs à 18 décimales. La dotation de jeu reste gérée par le jeu. Le scénario S06 V0.3 doit être actualisé pour retirer la promesse d’un POLARVOTE par apprenant à l’inscription. L’utilisation du crédit interne restant après la manche nécessite une décision d’intégration. Le prototype ne débite pas le crédit interne du jeu.

## Vérification et raccordement

Avec Node.js, installer les dépendances épinglées avec `npm install`, puis lancer `npm test`. Si elles existent déjà dans un autre projet, `POLAR_TEST_DEPENDENCIES` peut désigner ce répertoire. Le test compile avec Solidity 0.8.24 et exécute les assertions dans un appel simulé sur une EVM en mémoire. Il vérifie que celle-ci reste au bloc zéro.

Pour raccorder l’interface existante, afficher le groupe et les droits du portefeuille connecté, utiliser `isQualified` pour la file du formateur, puis `snapshotWeight` et `hasVoted` pour le bulletin. Présenter les deux décomptes, le mode officiel figé, le quorum et le statut d’application sur la fiche historique. Le parcours achats doit être adapté au mécanisme de règlement SMZF retenu avant de relier des boutons à un contrat. Le scénario de recette principal est un scrutin à trois votants dont deux votent Pour avec un jeton chacun et un vote Contre avec trois jetons. Le décompte égalitaire adopte 2–1 et le décompte pondéré rejette 2–3.

Avec une seule manche et un seul jeton gagné, il faut au moins deux autres inscrits détenteurs d’un POLARVOTE pour ouvrir le scrutin. Les achats V2 et les récompenses de manches supplémentaires peuvent fournir ces droits.
