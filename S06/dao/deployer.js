'use strict';

const expectedTrainer = '0x02999d79d178fB7Af885b5B14F97224d26B54B2d';
const gameAddress = '0x6b94f3f7eCa95E1425B2c86Bf666e4682910d19e';
const expectedSmzf = '0xeE40052C452C88487e6b9B30365bD3d40a9bB386';
const prepare = document.getElementById('prepare');
const deploy = document.getElementById('deploy');
const status = document.getElementById('status');
const links = document.getElementById('links');
let prepared;
let submitted = false;

async function run(action) {
  prepare.disabled = true;
  deploy.disabled = true;
  try {
    await action();
  } catch (error) {
    status.textContent = error.shortMessage || error.message;
  } finally {
    prepare.disabled = submitted;
    deploy.disabled = submitted || !prepared;
  }
}

async function json(file) {
  const response = await fetch(file, { cache: 'no-store' });
  if (!response.ok) throw Error('Fichier indisponible : ' + file);
  return response.json();
}

async function formateur(provider) {
  if ((await provider.getNetwork()).chainId !== 11155111n) throw Error('Sélectionnez Sepolia.');
  const [account] = await provider.send('eth_accounts', []);
  if (!account || ethers.getAddress(account) !== ethers.getAddress(expectedTrainer)) {
    throw Error('Sélectionnez le portefeuille formateur du jeu.');
  }
  return provider.getSigner(account);
}

prepare.onclick = () => run(async () => {
  prepared = null;
  if (!window.ethereum || !window.ethers) throw Error('Ouvrez cette page avec MetaMask.');
  if ((await json('config.json')).dao) throw Error('Une DAO est déjà configurée pour cet atelier.');
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const signer = await formateur(provider);
  const game = new ethers.Contract(gameAddress, ['function smzf() view returns(address)'], provider);
  const smzf = ethers.getAddress(await game.smzf());
  if (smzf !== ethers.getAddress(expectedSmzf)) throw Error('Le jeton SMZF du jeu a changé. Vérifiez son adresse.');
  const token = new ethers.Contract(smzf, ['function decimals() view returns(uint8)'], provider);
  const price = ethers.parseUnits('100', await token.decimals());
  const { abi, bytecode } = await json('deployment.json');
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const request = await factory.getDeployTransaction(expectedTrainer, smzf, price);
  const gas = await signer.estimateGas(request);
  const fee = await provider.getFeeData();
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice;
  const estimate = gasPrice === null ? '' : ' · Frais estimés au maximum : ' + ethers.formatEther(gas * gasPrice) + ' ETH Sepolia';
  status.textContent = 'Prêt · Formateur ' + expectedTrainer + ' · SMZF ' + smzf + estimate;
  prepared = { provider, request };
});

deploy.onclick = () => run(async () => {
  if (!prepared || (await json('config.json')).dao) throw Error('Préparation indisponible ou DAO déjà configurée.');
  const signer = await formateur(prepared.provider);
  status.textContent = 'Confirmez la création de la DAO dans MetaMask.';
  const tx = await signer.sendTransaction(prepared.request);
  submitted = true;
  const link = document.createElement('a');
  link.href = 'https://sepolia.etherscan.io/tx/' + tx.hash;
  link.textContent = 'Suivre la transaction sur Sepolia';
  links.replaceChildren(link);
  status.textContent = 'La transaction a été envoyée. En attente de confirmation…';
  const receipt = await tx.wait();
  if (receipt.status !== 1 || !receipt.contractAddress) throw Error('Le déploiement n’a pas abouti.');
  status.textContent = 'DAO déployée. Adresse à transmettre pour activer la page atelier : ' + receipt.contractAddress;
});
