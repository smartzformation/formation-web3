'use strict';

const chainId = 11155111n;
const gameAddress = '0x6b94f3f7eCa95E1425B2c86Bf666e4682910d19e';
const gameAbi = ['function playerList() view returns (address[])'];
// Lower bound preceding the creation of the configured Sepolia DAO.
const firstDaoBlock = 12150000;
const daoAbi = [
  'event SessionOpened(uint256 indexed session)',
  'event WinnerRewarded(uint256 indexed session,bytes32 indexed round,address indexed winner)',
  'event PolarVotePurchased(uint256 indexed session,address indexed player)', 
  'function trainer() view returns (address)',
  'function smzf() view returns (address)',
  'function polarVote() view returns (address)',
  'function purchasePrice() view returns (uint256)',
  'function session() view returns (uint256)',
  'function sessionOpen() view returns (bool)',
  'function purchasesEnabled() view returns (bool)',
  'function officialMode() view returns (uint8)',
  'function latestIdeaId() view returns (uint256)',
  'function activeBallot() view returns (uint256)',
  'function registered(uint256,address) view returns (bool)',
  'function ideas(uint256) view returns (uint256 session,address proposer,uint256 supportCount,uint8 action,string description)',
  'function ballots(uint256) view returns (uint64 deadline,uint8 mode,uint256 eligible,uint256 equalFor,uint256 equalAgainst,uint256 weightedFor,uint256 weightedAgainst,uint8 equalResult,uint8 weightedResult,uint8 application)',
  'function hasSupported(uint256,address) view returns (bool)',
  'function isQualified(uint256) view returns (bool)',
  'function snapshotWeight(uint256,address) view returns (uint256)',
  'function hasVoted(uint256,address) view returns (bool)',
  'function openSession(address[])',
  'function roundRewarded(uint256,bytes32) view returns (bool)',
  'function rewardWinner(bytes32,address)',
  'function enablePurchases()',
  'function buyPolarVote()',
  'function submitIdea(string,uint8) returns (uint256 id)',
  'function supportIdea(uint256)',
  'function openBallot(uint256,uint64)',
  'function castVote(uint256,bool)',
  'function closeBallot()',
  'function recordApplication(uint256,bool)',
  'function closeSession()'
];
const tokenAbi = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)'
];
const modes = ['Égalitaire', 'Pondéré'];
const results = ['En cours', 'Adoptée', 'Rejetée', 'Quorum non atteint'];
const applications = ['En attente', 'Appliquée', 'Différée'];
const $ = id => document.getElementById(id);
const show = (id, visible) => { $(id).hidden = !visible; };
const status = message => { $('status').textContent = message; };
const pageSize = 10n;
let daoAddress;
let provider;
let dao;
let account;
let busy = false;
let page = 0n;

function append(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}

function action(parent, label, handler) {
  const button = append(parent, 'button', label);
  button.type = 'button';
  button.onclick = () => run(handler);
}

function bindForm(id, handler) {
  $(id).onsubmit = event => {
    event.preventDefault();
    run(handler);
  };
}

async function run(handler) {
  if (busy) return;
  busy = true;
  try {
    await handler();
  } catch (error) {
    status(error.code === 'ACTION_REJECTED' || error.code === 4001
      ? 'Action annulée dans le portefeuille.'
      : error.shortMessage || error.message || 'Action impossible.');
  } finally {
    busy = false;
  }
}

async function connect(requestAccounts) {
  dao = null;
  for (const id of ['session', 'trainer', 'history', 'refresh']) show(id, false);
  if (!window.ethereum) throw Error('Ouvrez cette page avec un portefeuille compatible, par exemple MetaMask.');
  provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send(requestAccounts ? 'eth_requestAccounts' : 'eth_accounts', []);
  if (!accounts.length) {
    status('Connectez votre portefeuille sur Sepolia.');
    return;
  }
  if ((await provider.getNetwork()).chainId !== chainId) throw Error('Sélectionnez Sepolia dans votre portefeuille.');
  if (await provider.getCode(daoAddress) === '0x') throw Error('Le contrat DAO est introuvable sur Sepolia.');
  account = ethers.getAddress(accounts[0]);
  dao = new ethers.Contract(daoAddress, daoAbi, await provider.getSigner(account));
  await render();
}

async function send(label, submit) {
  if (!dao || (await provider.getNetwork()).chainId !== chainId) throw Error('Reconnectez le portefeuille sur Sepolia.');
  status(label + ' · Confirmez dans le portefeuille.');
  const tx = await submit();
  status(label + ' · En attente de confirmation.');
  const receipt = await tx.wait();
  return receipt;
}

async function transact(label, submit) {
  await send(label, submit);
  await render(label + ' · Confirmé sur Sepolia.');
}

async function render(message) {
  if (!dao) return;
  const [session, open, trainer, purchases, mode, latest, active, tokenAddress, block] = await Promise.all([
    dao.session(), dao.sessionOpen(), dao.trainer(), dao.purchasesEnabled(), dao.officialMode(),
    dao.latestIdeaId(), dao.activeBallot(), dao.polarVote(), provider.getBlock('latest')
  ]);
  const isTrainer = account === ethers.getAddress(trainer);
  const token = new ethers.Contract(tokenAddress, tokenAbi, provider);
  const [player, balance, stock] = await Promise.all([
    dao.registered(session, account), token.balanceOf(account), token.balanceOf(trainer)
  ]);
  $('facts').textContent = (open ? 'Groupe ' + session + ' · Mode officiel ' + modes[Number(mode)] : 'Aucun groupe ouvert')
    + ' · ' + (isTrainer ? 'Formateur' : player ? 'Joueur inscrit' : 'Observateur') + ' · ' + balance + ' POLARVOTE';
  for (const id of ['session', 'history', 'refresh']) show(id, true);
  show('trainer', isTrainer);
  show('distribution', isTrainer && open);
  show('start', isTrainer && !open);
  show('reward', isTrainer && open);
  show('enable', isTrainer && open && !purchases);
  show('reset', isTrainer && open && active === 0n);
  show('idea', open && player);
  show('buy', open && player && purchases && stock > 0n);
  const end = latest > page * pageSize ? latest - page * pageSize : 0n;
  const low = end > pageSize ? end - pageSize + 1n : 1n;
  const items = [];
  if (active && (active < low || active > end)) items.push(active);
  for (let id = end; id >= low; --id) items.push(id);
  const [cards] = await Promise.all([
    Promise.all(items.map(id => card(id, {
      session, open, isTrainer, player, active, timestamp: BigInt(block.timestamp)
    }))),
    isTrainer && open ? renderDistribution(session, block.number, token, purchases, stock) : undefined
  ]);
  $('entries').replaceChildren(...cards);
  if (!cards.length) append($('entries'), 'p', 'Aucune idée déposée.');
  show('older', end > pageSize);
  show('newer', page > 0n);
  status(message || 'Connecté sur Sepolia · ' + account);
}

async function renderDistribution(session, latest, token, purchases, stock) {
  const message = $('distribution-status');
  message.textContent = 'Lecture des confirmations Sepolia…';
  show('distribution-table', false);
  try {
    let opened;
    for (let end = latest; end >= firstDaoBlock && !opened; end -= 2000) {
      const start = Math.max(firstDaoBlock, end - 1999);
      [opened] = await dao.queryFilter(dao.filters.SessionOpened(session), start, end);
    }
    if (!opened) throw Error('Ouverture du groupe introuvable.');
    const transaction = await provider.getTransaction(opened.transactionHash);
    const roster = dao.interface.decodeFunctionData('openSession', transaction.data)[0];
    const events = [];
    const topics = [
      ['WinnerRewarded', 'PolarVotePurchased'].map(name => dao.interface.getEvent(name).topicHash),
      ethers.toBeHex(session, 32)
    ];
    for (let fromBlock = opened.blockNumber; fromBlock <= latest; fromBlock += 2000) {
      const toBlock = Math.min(fromBlock + 1999, latest);
      events.push(...await provider.getLogs({ address: daoAddress, topics, fromBlock, toBlock }));
    }
    const rows = await Promise.all(roster.map(async address => {
      const row = document.createElement('tr');
      append(row, 'td', address);
      const rewards = [];
      const buys = [];
      for (const log of events) {
        const event = dao.interface.parseLog(log);
        if (event.name === 'WinnerRewarded' && event.args.winner === address) rewards.push(log);
        if (event.name === 'PolarVotePurchased' && event.args.player === address) buys.push(log);
      }
      for (const entries of [rewards, buys]) {
        const cell = append(row, 'td', entries.length ? '' : '0');
        if (entries.length) {
          const link = append(cell, 'a', String(entries.length));
          link.href = 'https://sepolia.etherscan.io/tx/' + entries.at(-1).transactionHash;
          link.setAttribute('aria-label', entries.length + ' · Voir la dernière transaction sur Sepolia');
        }
      }
      append(row, 'td', await token.balanceOf(address, { blockTag: latest }));
      return row;
    }));
    $('distribution-rows').replaceChildren(...rows);
    show('distribution-table', true);
    message.textContent = purchases && stock
      ? 'Achats ouverts à ces inscrits · ' + stock + ' POLARVOTE en réserve.'
      : purchases ? 'Réserve épuisée.' : 'Ces inscrits pourront acheter à l’ouverture des achats.';
  } catch {
    message.textContent = 'Suivi Sepolia indisponible. Clique sur Actualiser pour réessayer.';
  }
}

async function card(id, context) {
  const [idea, ballot, qualified, supported, weight, voted] = await Promise.all([
    dao.ideas(id), dao.ballots(id), dao.isQualified(id), dao.hasSupported(id, account),
    dao.snapshotWeight(id, account), dao.hasVoted(id, account)
  ]);
  const element = document.createElement('article');
  append(element, 'small', 'Groupe ' + idea.session + ' · Idée ' + id);
  append(element, 'h3', idea.description);
  const targetMode = idea.action === 0n ? null : modes[Number(idea.action) - 1];
  if (context.isTrainer) {
    append(element, 'p', 'Déposée par le portefeuille ' + idea.proposer);
    append(element, 'p', targetMode ? 'Type de proposition · POL-007 · ' + targetMode : 'Type de proposition · Idée pour le jeu');
  }
  const current = context.open && context.session === idea.session;
  if (!ballot.deadline) {
    append(element, 'p', idea.supportCount + '/2 soutiens requis · ' + (
      qualified ? 'Qualifiée' : current ? 'En attente de qualification' : 'Groupe clôturé'
    ));
    if (current && context.player && !supported && account !== ethers.getAddress(idea.proposer)) {
      action(element, 'Soutenir', () => transact('Soutien', () => dao.supportIdea(id)));
    }
    if (qualified && context.isTrainer && context.active === 0n) {
      const field = append(element, 'label', 'Durée du scrutin en minutes ');
      const minutes = append(field, 'input', '');
      Object.assign(minutes, { type: 'number', min: '1', max: '1440', value: '10', required: true });
      action(element, 'Ouvrir le scrutin', async () => {
        if (!minutes.reportValidity()) return;
        const block = await provider.getBlock('latest');
        const deadline = BigInt(block.timestamp) + BigInt(minutes.value) * 60n;
        await transact('Ouverture du scrutin', () => dao.openBallot(id, deadline));
      });
    }
    return element;
  }
  const live = context.active === id;
  const expired = context.timestamp >= ballot.deadline;
  const count = ballot.equalFor + ballot.equalAgainst;
  append(element, 'p', 'Mode officiel : ' + modes[Number(ballot.mode)]
    + ' · ' + count + '/' + ballot.eligible + ' votants · Quorum : 3');
  if (live) {
    append(element, 'p', 'Clôture prévue : ' + new Date(Number(ballot.deadline) * 1000).toLocaleString('fr-FR')
      + (weight ? ' · Votre poids figé : ' + weight : '') + (voted ? ' · Bulletin enregistré' : ''));
    if (!expired && weight && !voted) {
      action(element, 'Voter pour', () => transact('Bulletin pour', () => dao.castVote(id, true)));
      action(element, 'Voter contre', () => transact('Bulletin contre', () => dao.castVote(id, false)));
    }
    if (expired || context.isTrainer) {
      action(element, 'Clôturer le scrutin', async () => {
        if (window.confirm('Clôturer ce scrutin et enregistrer son résultat ?')) {
          await transact('Clôture du scrutin', () => dao.closeBallot());
        }
      });
    }
  } else {
    const table = append(element, 'table', '');
    const header = table.createTHead().insertRow();
    for (const title of ['Décompte', 'Pour', 'Contre', 'Résultat']) append(header, 'th', title).scope = 'col';
    const body = table.createTBody();
    const counts = [
      [ballot.equalFor, ballot.equalAgainst, ballot.equalResult],
      [ballot.weightedFor, ballot.weightedAgainst, ballot.weightedResult]
    ];
    counts.forEach(([yes, no, result], mode) => {
      const row = body.insertRow();
      for (const value of [modes[mode] + (Number(ballot.mode) === mode ? ' · Officiel' : ''), yes, no, results[Number(result)]]) {
        append(row, 'td', value);
      }
    });
    const official = ballot.mode === 0n ? ballot.equalResult : ballot.weightedResult;
    if (official === 1n) {
      append(element, 'p', 'Application : ' + applications[Number(ballot.application)]);
      if (current && context.isTrainer && ballot.application !== 1n) {
        if (ballot.application === 0n) action(element, 'Différer', () => transact('Décision différée', () => dao.recordApplication(id, false)));
        if (idea.action === 0n || context.active === 0n) {
          action(element, idea.action === 0n ? 'Consigner l’application' : 'Appliquer POL-007', async () => {
            const prompt = idea.action === 0n ? 'Confirmez-vous avoir appliqué la décision dans le jeu ?' : 'Appliquer le mode ' + targetMode.toLowerCase() + ' aux prochains scrutins ?';
            if (window.confirm(prompt)) await transact('Décision appliquée', () => dao.recordApplication(id, true));
          });
        }
      }
    }
  }
  return element;
}

$('connect').onclick = () => run(() => connect(true));
$('refresh').onclick = () => run(() => render());
$('older').onclick = () => run(async () => { ++page; await render(); });
$('newer').onclick = () => run(async () => { if (page) --page; await render(); });
bindForm('idea', async () => {
  const feedback = $('idea-status');
  const field = $('description');
  const button = $('submit-idea');
  const description = field.value.trim();
  if (!description || new TextEncoder().encode(description).length > 1024) {
    feedback.textContent = 'Saisis une description ou raccourcis le texte.';
    return;
  }
  button.disabled = true;
  field.readOnly = true;
  try {
    feedback.textContent = 'Confirme le dépôt de ton idée dans MetaMask.';
    const receipt = await send('Dépôt de l’idée', async () => {
      const tx = await dao.submitIdea(description, 0);
      feedback.textContent = 'Dépôt envoyé. En attente de confirmation sur Sepolia…';
      return tx;
    });
    field.value = '';
    page = 0n;
    feedback.textContent = 'Idée enregistrée sur Sepolia. ';
    const link = append(feedback, 'a', 'Voir la transaction');
    link.href = 'https://sepolia.etherscan.io/tx/' + receipt.hash;
    try {
      await render('Dépôt de l’idée · Confirmé sur Sepolia.');
    } catch {
      status('Idée enregistrée. Clique sur Actualiser pour rafraîchir la liste.');
    }
  } catch (error) {
    feedback.textContent = error.code === 'ACTION_REJECTED' || error.code === 4001
      ? 'Dépôt annulé dans MetaMask. Ton texte est conservé.'
      : 'Confirmation du dépôt indisponible. Ton texte est conservé. Vérifie ton activité dans MetaMask avant de réessayer.';
  } finally {
    button.disabled = false;
    field.readOnly = false;
  }
});
$('import-players').onclick = () => run(async () => {
  if (!provider || (await provider.getNetwork()).chainId !== chainId) {
    throw Error('Reconnectez le portefeuille sur Sepolia.');
  }
  const game = new ethers.Contract(gameAddress, gameAbi, provider);
  const players = (await game.playerList()).map(ethers.getAddress);
  const roster = [...new Set(players)].filter(address => address !== account && address !== ethers.ZeroAddress);
  if (!roster.length) throw Error('Aucun joueur inscrit à reprendre depuis le jeu.');
  $('roster').value = roster.join('\n');
  status(roster.length + ' joueur(s) repris du jeu. Vérifiez la liste avant d’ouvrir le groupe.'
    + (roster.length < 3 ? ' Il faut au moins trois inscrits.' : ''));
});
bindForm('start', async () => {
  const roster = $('roster').value.split(/[\s,;]+/).filter(Boolean).map(address => ethers.getAddress(address));
  if (roster.length < 3 || roster.length > 20 || new Set(roster).size !== roster.length || roster.includes(account)) {
    throw Error('Saisissez entre 3 et 20 adresses distinctes, hors portefeuille formateur.');
  }
  await transact('Ouverture du groupe', () => dao.openSession(roster));
});
bindForm('reward', async () => {
  const round = $('round').value.trim();
  if (!round) throw Error('Saisissez un identifiant de manche.');
  const winner = ethers.getAddress($('winner').value.trim());
  const roundId = ethers.id(round);
  const session = await dao.session();
  const [open, rewarded, registered, token] = await Promise.all([
    dao.sessionOpen(), dao.roundRewarded(session, roundId), dao.registered(session, winner), dao.polarVote()
  ]);
  if (!open) throw Error('Ouvrez un groupe DAO avant d’attribuer la récompense.');
  if (rewarded) throw Error('Cette manche a déjà été récompensée dans le groupe DAO.');
  if (!registered) throw Error('Le portefeuille du gagnant ne figure pas parmi les inscrits du groupe DAO.');
  const reserve = new ethers.Contract(token, tokenAbi, provider);
  if ((await reserve.balanceOf(account)) === 0n) throw Error('La réserve de POLARVOTE est vide.');
  await transact('Récompense du gagnant', () => dao.rewardWinner(roundId, winner));
});
$('enable').onclick = () => run(() => transact('Ouverture des achats', () => dao.enablePurchases()));
$('reset').onclick = () => run(async () => {
  if (window.confirm('Clôturer le groupe, rappeler les POLARVOTE et restaurer le mode égalitaire ?')) {
    await transact('Clôture du groupe', () => dao.closeSession());
  }
});
$('buy').onclick = () => run(async () => {
  const [asset, price] = await Promise.all([dao.smzf(), dao.purchasePrice()]);
  const smzf = new ethers.Contract(asset, tokenAbi, await provider.getSigner(account));
  const [decimals, balance, allowance] = await Promise.all([
    smzf.decimals(), smzf.balanceOf(account), smzf.allowance(account, daoAddress)
  ]);
  if (balance < price) throw Error('Votre portefeuille ne contient pas assez de SMZF pour cet achat.');
  if (!window.confirm('Acheter 1 POLARVOTE pour ' + ethers.formatUnits(price, decimals) + ' SMZF ?')) return;
  if (allowance < price) await send('Autorisation SMZF', () => smzf.approve(daoAddress, price));
  await transact('Achat du POLARVOTE', () => dao.buyPolarVote());
});

run(async () => {
  const response = await fetch('config.json', { cache: 'no-store' });
  if (!response.ok) throw Error('Configuration de la DAO indisponible.');
  const config = await response.json();
  if (!config.dao) {
    status('La page est prête. La connexion sera disponible après le déploiement de la DAO sur Sepolia.');
    return;
  }
  if (!window.ethers) throw Error('Bibliothèque portefeuille indisponible.');
  daoAddress = ethers.getAddress(config.dao);
  $('connect').disabled = false;
  if (window.ethereum) {
    for (const event of ['chainChanged', 'accountsChanged']) {
      window.ethereum.on(event, () => window.location.reload());
    }
    await connect(false);
  } else {
    status('Connectez un portefeuille compatible avec Sepolia.');
  }
});
