> Version V2 : consulter d’abord MAJ-V2.md pour la procédure de remplacement de la collection V1 déjà déployée.

# Les Familles du Web3 — Atelier NFT V2
25 octobre 2026 — Ethereum Sepolia uniquement

## Ce qui est prêt

Nouveau contrat `AtelierNFT`, adaptateur Chainlink VRF v2.5, métadonnées de 24 cartes reprenant les visuels existants, interface apprenant/formateur, écran de déploiement par MetaMask et tests locaux. L’ancienne collection ne change pas. Le nouveau contrat n’est pas encore déployé : il n’a donc pas encore d’adresse Sepolia.

Le formateur conserve un pouvoir de reprise sans accord supplémentaire ni remboursement. Il peut conserver tous les NFT, y compris les deux jokers. Ce pouvoir est indiqué dans l’interface et les métadonnées. Il faut le présenter avant l’atelier : cette gouvernance est administrée, elle n’est pas entièrement décentralisée.

## Démarrage conseillé

1. Lire ce guide et `REGLES.md`.
2. Servir le dossier `web` depuis un hébergement HTTPS ou en local : `python3 -m http.server 8000 --directory web`, puis ouvrir `http://localhost:8000/deployer.html` dans Chrome avec MetaMask. Ne pas ouvrir une page inconnue ni saisir une clé privée. Sur téléphone, utiliser le navigateur intégré au wallet et une URL HTTPS.
3. Prévoir assez de SepoliaETH sur le portefeuille formateur pour le déploiement et les transactions. Les 24 cartes sont créées au déploiement : la création stocke leurs métadonnées et coûte davantage qu’un simple transfert. Le coût exact sera estimé par le wallet, pas garanti ici.
4. Créer un abonnement Chainlink VRF v2.5 sur https://vrf.chain.link/ et l’alimenter en LINK de test (https://faucets.chain.link/). Le fournisseur choisit un paiement en LINK ; l’ETH seul ne finance pas ce tirage.
5. Vérifier les paramètres Ethereum Sepolia dans https://docs.chain.link/vrf/v2-5/supported-networks . Les valeurs préremplies sont des paramètres actuels à revérifier le jour du déploiement.
6. Dans `deployer.html`, connecter ton compte formateur, renseigner l’identifiant d’abonnement, puis confirmer les trois étapes : déployer `RandomProvider`, déployer `AtelierNFT`, lier le fournisseur à l’atelier. Conserver les deux adresses et les hashes de transaction. Les adresses sont également mémorisées dans ce navigateur.
7. Ajouter **l’adresse de RandomProvider**, pas celle du NFT, comme consumer de l’abonnement VRF.
8. Ouvrir `atelier.html`. Renseigner l’adresse du **nouveau** contrat AtelierNFT et connecter le même compte formateur. Son panneau devient visible.
9. Inscrire de 2 à 24 adresses publiques distinctes, choisir les deux jokers et préparer la session. Une adresse par apprenant ; formateur exclu. Cette V2 vise les comptes MetaMask classiques, pas les portefeuilles contrats/smart accounts.
10. Demander le tirage. Attendre la réponse VRF puis actualiser la consultation. Quand le tirage est reçu, distribuer. Il n’est pas possible d’annuler/recommencer un tirage pour changer son résultat. Si l’oracle n’arrive pas, vérifier le financement de l’abonnement, le consumer et les événements VRF.
11. Distribuer les SMZF depuis le panneau (dotation suggérée : 1 000 par personne). Il faut confirmer une transaction par apprenant. Si une distribution est interrompue, vérifier les soldes et reprendre manuellement depuis MetaMask pour éviter un versement en double.
12. Envoyer du SepoliaETH de test aux apprenants pour leurs frais et leur donner l’URL de `atelier.html` et l’adresse du contrat. Ils n’ont pas besoin d’importer les 24 NFT pour utiliser cette interface.

## Adresses existantes

- SMZF existant : `0xeE40052C452C88487e6b9B30365bD3d40a9bB386`, 18 décimales, Ethereum Sepolia. Le déployeur utilise ce token et n’en crée pas un nouveau.
- Ancienne collection, à ne pas confondre avec la nouvelle : `0x9A4b66Bb5c1487308a0f380241846F8b6BB505C2`.
- Le compte qui déploie AtelierNFT devient le formateur de façon définitive. Déployer depuis le bon compte ; aucune migration de ce rôle n’est prévue en V2.

## Pendant l’atelier

### Consulter

La galerie lit les 24 cartes, leurs propriétaires, prix actifs et badges joker. Le filtre « mes cartes » utilise le compte connecté. Elle n’est pas une synchronisation des imports MetaMask. Le badge est déterminé par `jokerX`/`jokerY` du contrat ; les illustrations ne sont pas modifiées. MetaMask conserve l’image normale.

### Vendre et acheter

Le détenteur choisit un prix, minimum 1 SMZF. L’acheteur autorise exactement le montant affiché, puis confirme l’achat : généralement deux transactions. Si le prix ou le vendeur a changé, l’achat échoue. NFT et paiement réussissent ensemble ou sont annulés ensemble. Une autorisation SMZF déjà confirmée peut subsister après un achat refusé : elle peut être révoquée dans le wallet.

Les transferts directs depuis le bouton « Envoyer » de MetaMask sont volontairement bloqués, même avec `approve`/`setApprovalForAll` : utiliser l’atelier pour respecter les règles. Pas de garantie de compatibilité avec une marketplace externe.

### Jokers

Don à un inscrit sans l’autre joker, vente en SMZF ou troc des deux jokers. Pour le troc, le détenteur propose son joker contre l’autre ; l’autre détenteur accepte. La proposition expire au bout d’une heure dans l’interface (échéance définie au contrat). Les deux transferts sont exécutés dans la même transaction. Le numéro d’offre figure dans les événements et dans `nextSwap` immédiatement après une proposition ; le panneau permet de consulter une offre avant acceptation.

### DAO

Le formateur choisit la durée des propositions, celle du vote et le quorum avant de lancer le scrutin. Valeurs proposées : 5 minutes + 5 minutes, quorum 50 % du poids total. Une proposition reçoit un vote par participant, sans cumul : 1 voix ou 3 pour les détenteurs des jokers au démarrage du scrutin. Le formateur n’a pas de voix. Tous les apprenants inscrits ont au moins 1 voix même s’ils n’ont plus de carte.

Pendant les propositions, tout inscrit peut proposer une paire admissible, même s’il n’en possède aucune carte. Puis chacun choisit une paire. Le résultat devient applicable après l’échéance ; seul le formateur peut déclencher la finalisation, sans pouvoir choisir le résultat. Si la paire gagnante n’est plus admissible, aucun remplacement par la seconde n’est fait : les anciens jokers restent en place.

Les transactions restent possibles pendant le scrutin. La mise en pause bloque achats/dons/trocs/propositions/votes, mais **n’arrête pas les échéances**. Une finalisation à échéance reste possible. Pour interrompre définitivement le scrutin, clôturer la session et reprendre les cartes.

### Fin

« Clôturer et récupérer » nécessite une confirmation MetaMask du formateur et reprend tous les NFT sans paiement. Les mises en vente, propositions de troc et le vote deviennent invalides ; les anciens participants sont désactivés. Les SMZF ne sont ni repris ni remboursés. Les cartes non distribuées sont déjà chez le formateur. Préparer une nouvelle session remplace la liste précédente. La collection peut ainsi servir plusieurs semestres.

## Déploiement alternatif dans Remix

Les fichiers `build/AtelierNFT.flattened.sol` et `build/RandomProvider.flattened.sol` contiennent les dépendances. Compilateur 0.8.30, optimisation activée 200 runs, **viaIR activé**, cible EVM Shanghai. Le déploiement par `deployer.html` utilise les bytecodes produits avec ces paramètres, évitant la saisie manuelle des 24 URI. Dans Remix, les 24 URI sont dans `cartes.json`.

## Vérification et limites

Exécuter `npm ci` puis `npm test` dans le dossier du projet pour compiler et rejouer les tests EVM. `test/Mocks.sol` est réservé aux tests locaux : ne pas déployer ses faux tokens et faux oracles pour remplacer les SMZF/VRF de l’atelier.

Les tests couvrent le contrat et l’adaptateur avec un coordinateur simulé. Ils ne constituent ni un audit indépendant ni un test Chainlink réellement exécuté sur Sepolia. L’interface a été vérifiée syntaxiquement ; son parcours MetaMask n’a pas encore été exécuté dans un navigateur avec signature. Faire un essai sur Sepolia avec deux portefeuilles avant la session de classe.

Le tirage utilise une graine VRF puis un mélange déterministe conditionné aux contraintes des deux jokers ; la réduction modulo introduit un biais mathématique négligeable avec des valeurs 256 bits, sans incidence pédagogique. Les paramètres et la liste sont figés avant la demande. Le formateur administre le cycle : sa capacité à clôturer puis rouvrir une session n’est pas une garantie d’impartialité institutionnelle.

Les visuels restent hébergés sur les URL Neocities existantes. Le contrat stocke leurs métadonnées, pas les fichiers PNG. Une indisponibilité de cet hébergement peut masquer l’image sans changer la propriété.

## Sources techniques

- OpenZeppelin ERC-721 : https://docs.openzeppelin.com/contracts/5.x/api/token/erc721
- OpenZeppelin ERC-20 / SafeERC20 : https://docs.openzeppelin.com/contracts/5.x/api/token/erc20
- Chainlink VRF : https://docs.chain.link/vrf/v2-5/getting-started
- Sécurité VRF : https://docs.chain.link/vrf/v2-5/security

L’adaptateur minimal implémente l’ABI subscription v2.5 avec coordinateur immuable et authentification du callback. Il n’embarque pas les fonctions de migration du consumer Chainlink complet.
