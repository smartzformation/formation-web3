'use strict';

(() => {
  const proxy = '0x6b94f3f7eCa95E1425B2c86Bf666e4682910d19e';
  const v1 = '0x8A752577A64C5B0a140226927b7B488Fb6290E7b';
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const trainer = '0x02999d79d178fB7Af885b5B14F97224d26B54B2d';
  const collection = '0xf335004227ccaF2ea0EF28C8D431B21260b29E42';
  const currency = '0xeE40052C452C88487e6b9B30365bD3d40a9bB386';
  const wallet = window.ethereum?.providers?.find(item => item.isMetaMask) ?? window.ethereum;
  const abi = [
    'function owner() view returns (address)', 'function version() view returns (uint256)',
    'function collection() view returns (address)', 'function smzf() view returns (address)',
    'function phase() view returns (uint8)', 'function sessionOpen() view returns (bool)',
    'function activePoll() view returns (uint256)', 'function closing() view returns (bool)',
    'function nftsRecalled() view returns (bool)', 'function smzfRecalled() view returns (bool)',
    'function closeSession()', 'function recallNFTs()', 'function recallSMZF()',
    'function upgradeToAndCall(address implementation, bytes data)',
  ];
  const node = id => document.getElementById(id);
  const status = node('upgrade-status');
  const deploymentKey = 'jeu-polar-sepolia-v2:' + proxy;
  let busy = false;
  let generation = 0;
  let state = null;

  function render() {
    const closed = state && !state.open && state.poll === 0n && state.version === 1n;
    node('verify').disabled = busy;
    node('close-panel').hidden = !state?.open;
    node('close-session').disabled = busy || !state?.open || state.closing
      || ![0n, 4n, 5n].includes(state.phase);
    node('return-nft').disabled = busy || !state?.open || !state.closing || state.nft;
    node('return-smzf').disabled = busy || !state?.open || !state.closing || state.smzf;
    node('deploy-v2').disabled = busy || !closed || Boolean(state.address);
    node('activate-v2').disabled = busy || !closed || !state.address;
    node('deploy-v2').textContent = state?.hash && !state.address
      ? '1. Vérifier le déploiement V2' : '1. Déployer la logique V2';
    node('logic-address').textContent = state?.address ? 'Logique V2 · ' + state.address : '';
  }

  async function read() {
    if (!wallet?.isMetaMask || await wallet.request({method: 'eth_chainId'}) !== '0xaa36a7') {
      throw Error('Ouvre cette page dans Chrome et sélectionne Sepolia dans MetaMask.');
    }
    const [account] = await wallet.request({method: 'eth_accounts'});
    if (account?.toLowerCase() !== trainer.toLowerCase()) throw Error('Sélectionne le compte formateur.');
    const provider = new ethers.BrowserProvider(wallet);
    const signer = await provider.getSigner(trainer);
    const game = new ethers.Contract(proxy, abi, signer);
    const [owner, version, nftAddress, token, raw, phase, open, poll, closing, nft, smzf] = await Promise.all([
      game.owner(), game.version(), game.collection(), game.smzf(), provider.getStorage(proxy, slot),
      game.phase(), game.sessionOpen(), game.activePoll(), game.closing(), game.nftsRecalled(), game.smzfRecalled(),
    ]);
    const logic = '0x' + raw.slice(-40);
    if (owner.toLowerCase() !== trainer.toLowerCase() || nftAddress.toLowerCase() !== collection.toLowerCase()
        || token.toLowerCase() !== currency.toLowerCase() ||
        (version === 1n ? logic.toLowerCase() !== v1.toLowerCase()
          : version !== 2n || !await window.polarV2CodeMatches(provider, logic))) {
      throw Error('La configuration du jeu sur Sepolia ne correspond pas à celle attendue.');
    }
    const hash = localStorage.getItem(deploymentKey);
    const receipt = hash ? await provider.getTransactionReceipt(hash) : null;
    if (receipt?.status === 0) localStorage.removeItem(deploymentKey);
    const address = receipt?.status === 1 ? receipt.contractAddress : null;
    if (address && !await window.polarV2CodeMatches(provider, address)) {
      throw Error('Le déploiement enregistré ne correspond pas au code V2.');
    }
    return {provider, signer, game, version, phase, open, poll, closing, nft, smzf,
      hash: receipt?.status === 0 ? null : hash, address};
  }

  function run(action) {
    return async () => {
      if (busy) return;
      busy = true;
      render();
      let attempt = generation;
      try {
        if (action === verify) {
          if (!wallet?.isMetaMask) throw Error('Ouvre cette page dans Chrome avec MetaMask.');
          await wallet.request({method: 'eth_requestAccounts'});
          attempt = generation;
        }
        const current = await read();
        if (attempt !== generation) return;
        await action(current);
        if (attempt !== generation) return;
        state = await read();
        if (attempt !== generation) return;
        status.textContent = state.version === 2n ? 'JeuPolar V2 activé et vérifié sur Sepolia.'
          : state.open ? 'Session ouverte. Termine la manche si nécessaire, puis clôture la session et récupère les actifs.'
            : state.poll !== 0n ? 'Un vote est ouvert. Termine-le avant la mise à jour.'
              : 'Session fermée. Tu peux déployer ou activer la V2.';
      } catch (error) {
        if (attempt === generation) {
          state = null;
          status.textContent = error.reason || error.shortMessage || error.message;
        }
      } finally {
        busy = false;
        render();
      }
    };
  }

  const verify = () => {};
  node('verify').onclick = run(verify);
  for (const [id, method] of [['close-session','closeSession'], ['return-nft','recallNFTs'], ['return-smzf','recallSMZF']]) {
    node(id).onclick = run(async ({game}) => {
      await game[method].staticCall();
      status.textContent = 'Confirme dans MetaMask.';
      const receipt = await (await game[method]()).wait();
      if (receipt?.status !== 1) throw Error('Transaction non confirmée.');
    });
  }

  function requireReady({open, poll, version}) {
    if (open || poll !== 0n || version !== 1n) throw Error('Ferme la session et termine le vote avant la mise à jour.');
  }

  node('deploy-v2').onclick = run(async current => {
    requireReady(current);
    if (current.address) return;
    let hash = current.hash;
    if (!hash) {
      status.textContent = 'Confirme le déploiement de la logique V2 dans MetaMask.';
      const factory = new ethers.ContractFactory([], window.polarV2CreationCode, current.signer);
      const contract = await factory.deploy();
      hash = contract.deploymentTransaction().hash;
      localStorage.setItem(deploymentKey, hash);
    }
    status.textContent = 'Déploiement en attente · ' + hash;
    const receipt = await current.provider.waitForTransaction(hash, 1, 120000);
    if (receipt?.status !== 1 || !receipt.contractAddress) throw Error('Déploiement non confirmé. Relance la vérification.');
  });

  node('activate-v2').onclick = run(async current => {
    requireReady(current);
    if (!current.address) throw Error('Déploie d’abord la logique V2.');
    await current.game.upgradeToAndCall.staticCall(current.address, '0x');
    status.textContent = 'Confirme l’activation de la V2 dans MetaMask.';
    const receipt = await (await current.game.upgradeToAndCall(current.address, '0x')).wait();
    if (receipt?.status !== 1) throw Error('Activation non confirmée.');
  });

  function reset() {
    generation++;
    state = null;
    status.textContent = 'Compte ou réseau modifié. Relance la vérification.';
    render();
  }
  wallet?.on('accountsChanged', reset);
  wallet?.on('chainChanged', reset);
  render();
})();
