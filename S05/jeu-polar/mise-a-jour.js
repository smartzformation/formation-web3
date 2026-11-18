'use strict';

(() => {
  function setStatus(element, message, state = '') {
    element.dataset.state = state;
    element.textContent = message;
  }

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
  ];
  const node = id => document.getElementById(id);
  const status = node('upgrade-status');
  let busy = false;
  let generation = 0;
  let state = null;

  function render() {
    node('verify').disabled = busy;
    node('close-panel').hidden = !state?.open;
    node('close-session').disabled = busy || !state?.open || state.closing
      || ![0n, 4n, 5n].includes(state.phase);
    node('return-nft').disabled = busy || !state?.open || !state.closing || state.nft;
    node('return-smzf').disabled = busy || !state?.open || !state.closing || state.smzf;
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
    return {provider, signer, game, version, phase, open, poll, closing, nft, smzf};
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
        setStatus(status, state.version === 2n ? 'JeuPolar V2 activé et vérifié sur Sepolia.'
          : state.open ? 'Session ouverte. Termine la manche si nécessaire, puis clôture la session et récupère les actifs.'
            : state.poll !== 0n ? 'Un vote est ouvert. Termine-le avant la mise à jour.'
              : 'Session fermée.');
      } catch (error) {
        if (attempt === generation) {
          state = null;
          setStatus(status, error.reason || error.shortMessage || error.message, 'warning');
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
      setStatus(status, 'Confirme dans MetaMask.', 'pending');
      const tx = await game[method]();
      setStatus(status, 'Transaction en attente sur Sepolia · ' + tx.hash, 'pending');
      const receipt = await tx.wait();
      if (receipt?.status !== 1) throw Error('Transaction non confirmée.');
    });
  }

  function reset() {
    generation++;
    state = null;
    setStatus(status, 'Compte ou réseau modifié. Relance la vérification.', 'warning');
    render();
  }
  wallet?.on('accountsChanged', reset);
  wallet?.on('chainChanged', reset);
  render();
})();
