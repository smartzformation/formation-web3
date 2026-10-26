# Mise à jour V2 — 26 octobre 2026

## Correction des droits

`finalizeBallot` est désormais protégée par `onlyTrainer` dans le contrat V2. Un apprenant, même inscrit et détenteur d’un joker, ainsi qu’une adresse extérieure, ne peuvent pas appliquer le résultat. Le calcul du résultat reste automatique : le formateur déclenche la finalisation sans choisir le gagnant.

54 contrôles EVM locaux réussis, dont deux nouveaux refus (apprenant, extérieur). La V2 est compilée et prête à déployer. Aucun contrat existant n’est modifié par la publication GitHub.

## Où saisir les adresses ?

Dans l’atelier, cliquer sur **Connecter MetaMask sur Sepolia**, sélectionner `smartz.formation` et attendre la reconnaissance du compte formateur. Le panneau **Espace formateur · Inscription et distribution** apparaît immédiatement sous la configuration de la collection. Le lien **Inscrire les apprenants et préparer la distribution** y conduit directement.

Coller les adresses publiques (une par ligne) dans **Adresses des apprenants**, de 2 à 24 adresses distinctes. Le formulaire annonce les cartes par personne et le reliquat. Les doublons, l’adresse nulle et le portefeuille formateur sont refusés avant signature; le contrat vérifie aussi ces règles. Choisir les deux jokers puis **Préparer la session** et confirmer. Ce n’est qu’ensuite qu’on demande le tirage puis distribue.

Le panneau est masqué pour les autres comptes; cette visibilité n’est pas le contrôle de sécurité. Les restrictions administratives sont dans le contrat. Les adresses d’apprenants inscrites sont publiques sur Sepolia. Aucun nom, email ou clé privée n’est nécessaire.

## Redéploiement nécessaire

La V1 déjà déployée reste à l’adresse `0xfbe3817bf7e21de624c2e9e7f8febf4997e1c9d2`. Elle n’a pas de fonction de mise à niveau. Le fournisseur `0x179F4438813cC5013520456C93AE8448bDabF24d` est lié définitivement à cette V1. Modifier le HTML ne peut pas modifier ces contrats.

1. Ouvrir `../deployer-nft-v2.html` depuis le site GitHub Pages. L’abonnement VRF existant est prérempli; vérifier qu’il s’agit bien du vôtre. Ne pas créer un nouvel abonnement : les LINK restants sont réutilisables.
2. Connecter le compte formateur sur Sepolia.
3. Déployer le **nouveau** fournisseur de tirage V2; confirmer dans MetaMask.
4. Déployer la **nouvelle** collection Atelier V2; confirmer. Les 24 illustrations sont réutilisées mais les NFT ont une nouvelle identité de contrat. Les anciens NFT ne sont ni détruits ni transférés par cette étape.
5. Lier ce nouveau fournisseur à cette collection. La page vérifie `CONTRACT_VERSION == 2` et la correspondance du fournisseur avant d’envoyer la liaison.
6. Dans l’abonnement VRF existant, ajouter comme consumer l’adresse du **nouveau fournisseur**, pas l’ancienne, ni le NFT, ni le portefeuille.
7. Ouvrir le lien de l’atelier affiché après la liaison, avec `?collection=ADRESSE_V2`. La page reconnaît la version; le navigateur mémorise sa nouvelle adresse sur ce site.
8. Communiquer au responsable du site l’adresse V2 afin de la fixer comme collection par défaut pour tous les apprenants. En attendant, partager uniquement le lien incluant `?collection=ADRESSE_V2`.
9. Tester inscription, tirage, distribution et reprise avec deux comptes de test avant la séance.

Les anciennes offres/sessions ne sont pas migrées. Les SMZF déjà déployés restent les mêmes et ne sont pas récupérés ni recréés. Le contrat V2 n’a pas encore fait l’objet d’une transaction Sepolia ni d’un test Chainlink réel dans cette livraison; ces étapes seront effectuées par le formateur dans MetaMask.
