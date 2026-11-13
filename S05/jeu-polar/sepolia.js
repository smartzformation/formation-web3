'use strict';

(() => {
  const proxy = '0x6b94f3f7eCa95E1425B2c86Bf666e4682910d19e';
  const implementation = '0x8A752577A64C5B0a140226927b7B488Fb6290E7b';
  const collection = '0xf335004227ccaF2ea0EF28C8D431B21260b29E42';
  const currency = '0xeE40052C452C88487e6b9B30365bD3d40a9bB386';
  const trainer = '0x02999d79d178fB7Af885b5B14F97224d26B54B2d';
  const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const abi = [
    'function owner() view returns (address)',
    'function collection() view returns (address)',
    'function smzf() view returns (address)',
    'function version() view returns (uint256)',
    'function session() view returns (uint256)',
    'function sessionOpen() view returns (bool)',
    'function closing() view returns (bool)',
    'function removePlayer(address player)',
    'function openSession()',
    'function phase() view returns (uint8)',
    'function round() view returns (uint256)',
    'function deadline() view returns (uint256)',
    'function remaining() view returns (uint256)',
    'function startRound(uint256 duration)',
    'function finishRound()',
    'function finishRoundEarly()',
    'function offerOpenSwap(uint256 mine)',
    'function acceptOpenSwap(uint256 id, uint256 mine)',
    'function handSize() view returns (uint256)',
    'function participantsOf(uint256 id) view returns (address[])',
    'function results(uint256 id, address player) view returns (uint8 cards, bool complete, bool eligible, int256 gain)',
    'function recallRoundNFTs()',
    'function listings(uint256 id) view returns (uint256 price, uint256 revision, uint256 round)',
    'function listCard(uint256 id, uint256 price)',
    'function buy(uint256 id, address seller, uint256 expectedPrice, uint256 expectedRevision)',
    'function offerSwap(uint256 mine, uint256 theirs)',
    'function acceptDeal(uint256 id)',
    'function rejectDeal(uint256 id)',
    'function cancelDeal(uint256 id)',
    'function dealCount() view returns (uint256)',
    'function deals(uint256 id) view returns (address proposer, address recipient, uint256 card, uint256 otherCard, uint256 price, uint256 revision, uint256 otherRevision, uint256 round, uint8 status)',
    'function dealIsLive(uint256 id) view returns (bool)',
    'function activeCards() view returns (uint256[])',
    'function holder(uint256 id) view returns (address)',
    'function prepareRound(uint256[][] families, address[] recipients)',
    'function enroll(address player)',
    'function startingCredit() view returns (uint256)',
    'function balanceOf(address player) view returns (uint256)',
    'function playerList() view returns (address[])',
    'function catalogue(uint256) view returns (uint32 family, uint8 role, bool joker)',
    'function registerCard(uint256 id, uint32 family, uint8 role, bool joker)',
  ];
  const button = document.getElementById('connect-polar');
  const status = document.getElementById('polar-status');
  const wallet = window.ethereum?.providers?.find(provider => provider.isMetaMask) ?? window.ethereum;
  const isSameAddress = (a, b) => a?.toLowerCase() === b.toLowerCase();
  const register = document.getElementById('register-polar');
  const catalogStatus = document.getElementById('catalog-status');
  const openSession = document.getElementById('open-polar-session');
  const sessionStatus = document.getElementById('session-polar-status');
  const enrollment = document.getElementById('enroll-polar');
  const enrollmentStatus = document.getElementById('polar-enrollment-status');
  const playerList = document.getElementById('polar-player-list');
  const playerInput = document.getElementById('polar-player-address');
  const dealPanel = document.getElementById('polar-deal-panel');
  const dealButton = document.getElementById('polar-deal');
  const dealStatus = document.getElementById('polar-deal-status');
  const hands = document.getElementById('polar-hands');
  const handsPanel = document.getElementById('polar-hands-panel');
  const refreshHands = document.getElementById('polar-refresh-hands');
  const roundStatus = document.getElementById('polar-round-status');
  const startRound = document.getElementById('polar-start-round');
  const startStatus = document.getElementById('polar-start-status');
  const roundDuration = document.getElementById('polar-round-duration');
  const roundUnit = document.getElementById('polar-round-unit');
  const playerHand = document.getElementById('polar-hand');
  const handList = document.getElementById('polar-hand-list');
  const handCount = document.getElementById('polar-hand-count');
  const marketEmpty = document.getElementById('polar-market-empty');
  const handTab = document.getElementById('polar-hand-tab');
  const jokers = document.getElementById('polar-jokers');
  const jokerList = document.getElementById('polar-joker-list');
  const marketTab = document.getElementById('polar-market-tab');
  const market = document.getElementById('polar-market');
  const marketList = document.getElementById('polar-market-list');
  const marketBalance = document.getElementById('polar-market-balance');
  const marketStatus = document.getElementById('polar-market-status');
  const resultsPanel = document.getElementById('polar-results');
  const roundEnd = document.getElementById('polar-round-end');
  const finishEarly = document.getElementById('polar-finish-early');
  const finishButton = document.getElementById('polar-finish');
  const recallButton = document.getElementById('polar-recall');
  const endStatus = document.getElementById('polar-end-status');
  let countdown = null;
  let canOpenSession = false;
  let pendingSession = null;
  let revision = 0;
  let nextCard = null;
  let registrationBusy = false;
  let pendingTransaction = null;
  let supportsV2 = false;
  let latestConfirmedBlock = 0;

  if (handTab && marketTab) {
    const tabs = [handTab, marketTab];
    for (const tab of tabs) {
      tab.onclick = () => {
        for (const candidate of tabs) {
          const selected = candidate === tab;
          document.getElementById(candidate.getAttribute('aria-controls')).hidden = !selected;
          candidate.setAttribute('aria-current', String(selected));
        }
        if (tab === marketTab && !button.disabled && button.textContent === 'Actualiser depuis Sepolia') {
          void verify(false);
        }
      };
    }
  }

  async function refreshCatalogue(game, attempt) {
    const clans = [...new Set(catalog.map(card => card.clan))];
    const expected = catalog.map(card => ({
      ...card, family: clans.indexOf(card.clan) + 1, role: card.number - 1, joker: card.number === 1,
    }));
    const registered = [];
    for (let index = 0; index < expected.length; index += 9) {
      const batch = expected.slice(index, index + 9);
      registered.push(...await Promise.all(batch.map(card => game.catalogue(card.id))));
      if (attempt !== revision) return;
    }
    let missing = 0;
    const registeredByFamily = new Map();
    for (const [index, card] of expected.entries()) {
      const stored = registered[index];
      if (stored.family === 0n) {
        missing++;
        nextCard ??= card;
      } else if (stored.family !== BigInt(card.family) || stored.role !== BigInt(card.role) || stored.joker !== card.joker) {
        nextCard = null;
        throw Error('La carte n° ' + card.id + ' est enregistrée avec des paramètres différents.');
      } else {
        registeredByFamily.set(card.family, (registeredByFamily.get(card.family) || 0) + 1);
      }
    }
    canOpenSession = [...registeredByFamily.values()].filter(count => count === 5).length >= 2;
    catalogStatus.textContent = (expected.length - missing) + ' / ' + expected.length + ' cartes enregistrées.'
      + (nextCard ? ' Prochaine carte : n° ' + nextCard.id + ' · ' + nextCard.clan + ' · ' + nextCard.name + '.' : '');
  }

  function updateSessionButton() {
    if (openSession) openSession.disabled = !canOpenSession || registrationBusy || Boolean(pendingTransaction);
  }

  async function confirmedAction(account, attempt, method, args, feedback) {
    if (button.disabled || attempt !== revision) return;
    button.disabled = true;
    try {
      const [selected] = await wallet.request({method: 'eth_accounts'});
      const chain = await wallet.request({method: 'eth_chainId'});
      if (!isSameAddress(selected, account) || chain !== '0xaa36a7' || attempt !== revision) {
        throw Error('Vérifie le compte et le réseau Sepolia avant de continuer.');
      }
      const provider = new ethers.BrowserProvider(wallet);
      const game = new ethers.Contract(proxy, abi, await provider.getSigner(account));
      await game[method].staticCall(...args);
      if (attempt !== revision) return;
      feedback.textContent = 'Confirme la transaction dans MetaMask.';
      const tx = await game[method](...args);
      if (attempt === revision) feedback.textContent = 'Transaction en attente · ' + tx.hash;
      const receipt = await tx.wait();
      if (receipt?.status !== 1) throw Error('Transaction non confirmée.');
      latestConfirmedBlock = Math.max(latestConfirmedBlock, receipt.blockNumber);
      if (attempt !== revision) return;
      feedback.textContent = method === 'offerOpenSwap'
        ? 'Proposition confirmée sur Sepolia. Retrouve-la dans Marché.'
        : 'Transaction confirmée sur Sepolia.';
      await verify(false);
    } catch (error) {
      if (attempt === revision) {
        feedback.textContent = method === 'finishRound' && error.reason === 'Temps restant'
          ? 'Attends le prochain bloc Sepolia, puis réessaie.'
          : error.reason || error.shortMessage || error.message;
      }
    } finally {
      button.disabled = false;
    }
  }

  function clearPlayerCards(message) {
    if (!playerHand) return;
    handList.replaceChildren();
    marketList.replaceChildren();
    handCount.textContent = message;
    marketEmpty.textContent = message;
    marketEmpty.hidden = false;
    marketBalance.textContent = '';
    if (jokerList) jokerList.textContent = message;
  }

  const cardInfo = id => catalog.find(card => BigInt(card.id) === id);

  function makeCardTile(id) {
    const card = cardInfo(id);
    const joker = card?.number === 1;
    const tile = document.createElement('article');
    tile.className = 'tile';
    if (card?.image) {
      const image = document.createElement('img');
      image.src = card.image;
      image.alt = '';
      image.loading = 'lazy';
      tile.append(image);
    }
    const label = document.createElement('p');
    label.className = 'pill';
    label.textContent = card
      ? card.clan + ' · ' + (joker ? '★ Joker' : 'Carte n° ' + card.number) + ' · NFT ' + id
      : 'NFT n° ' + id;
    const name = document.createElement('h3');
    name.textContent = card?.name ?? 'Carte de la collection';
    tile.append(label, name);
    return tile;
  }

  async function showJokers(game, account, attempt, round, atBlock, state) {
    if (!jokerList) return;
    const exchanges = [];
    let last = await game.dealCount(atBlock);
    while (last > 0n && attempt === revision) {
      const batch = [];
      for (let index = 0; index < 8 && last > 0n; index++, last--) batch.push(last);
      const deals = await Promise.all(batch.map(async id => ({id, deal: await game.deals(id, atBlock)})));
      exchanges.push(...deals.filter(({deal}) => deal.round === round && deal.status === 0n
        && (deal.recipient === ethers.ZeroAddress || (deal.otherCard !== 0n
          && (isSameAddress(deal.proposer, account) || isSameAddress(deal.recipient, account))))));
      if (deals.some(({deal}) => deal.round < round)) break;
    }
    const live = await Promise.all(exchanges.map(({id}) => game.dealIsLive(id, atBlock)));
    if (attempt !== revision) return;
    jokerList.replaceChildren();

    const label = id => {
      const card = cardInfo(id);
      return card ? card.clan + ' · ' + card.name : 'NFT ' + id;
    };
    const action = (title, method, args) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = title;
      control.onclick = () => confirmedAction(account, attempt, method, args, marketStatus);
      return control;
    };
    const available = state.filter(({id}) => cardInfo(id)?.number === 1);
    const mine = available.filter(({seller}) => isSameAddress(seller, account));
    if (!supportsV2) {
      jokerList.append('Les annonces ouvertes seront disponibles après la mise à jour du contrat.');
    }
    const pending = exchanges.filter((_, index) => live[index]);
    const ownOpen = new Set();
    for (const [title, own] of [['Mes propositions', true], ['Autres propositions', false]]) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      jokerList.append(heading);
      const group = pending.filter(({deal}) => isSameAddress(deal.proposer, account) === own);
      if (!group.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'Aucune proposition en attente.';
        jokerList.append(empty);
        continue;
      }
      const grid = document.createElement('div');
      grid.className = 'cards';
      jokerList.append(grid);
      for (const {id, deal} of group) {
        if (own && deal.recipient === ethers.ZeroAddress) ownOpen.add(deal.card);
        grid.append(makeProposalTile(id, deal));
      }
    }
    return ownOpen;

    function makeProposalTile(id, deal) {
      const isOpen = deal.recipient === ethers.ZeroAddress;
      const isMine = isSameAddress(deal.proposer, account);
      const received = isSameAddress(deal.recipient, account);
      const row = makeCardTile(deal.card);
      if (isOpen) {
        const description = document.createElement('p');
        description.textContent = (isMine ? 'Tu proposes ' : 'Tu reçois ') + label(deal.card)
          + (isMine ? ' · annonce ouverte' : '');
        row.append(description);
        if (isMine) row.append(action('Retirer la proposition', 'cancelDeal', [id]));
        else if (mine.length) {
          const give = document.createElement('label');
          const choice = document.createElement('select');
          give.append('Tu donnes ', choice);
          for (const card of mine) {
            const option = document.createElement('option');
            option.value = String(card.id);
            option.textContent = label(card.id);
            choice.append(option);
          }
          const accept = document.createElement('button');
          accept.type = 'button';
          accept.textContent = 'Accepter l’échange';
          accept.onclick = () => {
            const offered = BigInt(choice.value);
            if (window.confirm('Tu donnes ' + label(offered) + '. Tu reçois ' + label(deal.card) + '. Confirmer cet échange ?')) {
              void confirmedAction(account, attempt, 'acceptOpenSwap', [id, offered], marketStatus);
            }
          };
          row.append(give, accept);
        } else row.append('Il te faut un joker pour accepter.');
        return row;
      }
      const description = document.createElement('p');
      description.textContent = received
        ? 'Reçue · Tu donnes ' + label(deal.otherCard) + ' et reçois ' + label(deal.card)
        : 'Envoyée · Tu proposes ' + label(deal.card) + ' contre ' + label(deal.otherCard);
      row.append(description);
      if (received) row.append(action('Accepter', 'acceptDeal', [id]), action('Refuser', 'rejectDeal', [id]));
      else row.append(action('Annuler', 'cancelDeal', [id]));
      return row;
    }
  }

  async function showPlayerCards(game, account, attempt, players) {
    const enrolled = players.some(player => isSameAddress(player, account));
    if (!enrolled) {
      clearPlayerCards('Ce compte ne participe pas à la session.');
      return;
    }
    const blockTag = Math.max(await game.runner.getBlockNumber(), latestConfirmedBlock);
    const atBlock = {blockTag};
    const [cards, round, balance] = await Promise.all([
      game.activeCards(atBlock), game.round(atBlock), game.balanceOf(account, atBlock),
    ]);
    const state = await Promise.all(cards.map(async id => {
      const [seller, listing] = await Promise.all([game.holder(id, atBlock), game.listings(id, atBlock)]);
      return {id, seller, listing};
    }));
    let ownOpen;
    try {
      ownOpen = await showJokers(game, account, attempt, round, atBlock, state);
    } catch {
      if (attempt === revision && jokerList) {
        jokerList.textContent = 'Lecture des échanges impossible. Actualise depuis Sepolia.';
      }
    }
    if (attempt !== revision) return;
    marketBalance.textContent = 'Solde de jeu · ' + ethers.formatUnits(balance, 18) + ' SMZF';
    handList.replaceChildren();
    marketList.replaceChildren();
    for (const {id, seller, listing} of state) {
      const own = isSameAddress(seller, account);
      const card = cardInfo(id);
      const joker = card?.number === 1;
      const listed = !joker && listing.round === round && listing.price > 0n;
      if (!own && !listed) continue;

      const tile = makeCardTile(id);

      if (listed) {
        const price = document.createElement('p');
        price.className = 'status';
        price.textContent = 'En vente · ' + ethers.formatUnits(listing.price, 18) + ' SMZF';
        tile.append(price);
      }
      if (!own) {
        const holder = document.createElement('small');
        holder.textContent = 'Vendeur · ' + seller.slice(0, 6) + '…' + seller.slice(-4);
        holder.title = seller;
        const buy = document.createElement('button');
        buy.type = 'button';
        buy.textContent = balance < listing.price ? 'Solde insuffisant' : 'Acheter';
        buy.disabled = balance < listing.price;
        buy.onclick = () => confirmedAction(account, attempt, 'buy',
          [id, seller, listing.price, listing.revision], marketStatus);
        tile.append(holder, buy);
      } else if (!joker) {
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.placeholder = 'Prix en SMZF';
        input.setAttribute('aria-label', 'Prix en SMZF pour ' + name.textContent);
        if (listed) input.value = ethers.formatUnits(listing.price, 18);
        const sell = document.createElement('button');
        sell.type = 'button';
        sell.textContent = listed ? 'Modifier le prix' : 'Mettre en vente';
        sell.onclick = () => {
          try {
            const price = ethers.parseUnits(input.value.trim().replace(',', '.'), 18);
            if (price <= 0n) throw Error('Saisis un prix supérieur à zéro.');
            void confirmedAction(account, attempt, 'listCard', [id, price], marketStatus);
          } catch (error) {
            marketStatus.textContent = 'Saisis un prix valide supérieur à zéro.';
          }
        };
        tile.append(input, sell);
        if (listed) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.textContent = 'Retirer la vente';
          remove.onclick = () => confirmedAction(account, attempt, 'listCard', [id, 0n], marketStatus);
          tile.append(remove);
        }
      }
      if (own && joker && supportsV2) {
        const propose = document.createElement('button');
        propose.type = 'button';
        propose.disabled = ownOpen?.has(id) ?? false;
        propose.textContent = propose.disabled ? 'Échange proposé' : 'Proposer un échange';
        propose.onclick = () => confirmedAction(account, attempt, 'offerOpenSwap', [id], marketStatus);
        tile.append(propose);
      }
      (own ? handList : marketList).append(tile);
    }
    const count = handList.childElementCount;
    handCount.textContent = count ? count + (count === 1 ? ' carte en main' : ' cartes en main')
      : 'Aucune carte en main.';
    marketEmpty.textContent = 'Aucune carte en vente par les autres joueurs.';
    marketEmpty.hidden = marketList.childElementCount > 0;

  }

  const addText = (parent, tag, value) => {
    const node = document.createElement(tag);
    node.textContent = value;
    parent.append(node);
    return node;
  };

  async function showHands(game, account, attempt, players) {
    if (playerHand) return showPlayerCards(game, account, attempt, players);
    if (!hands || !isSameAddress(account, trainer)) return;
    const blockTag = Math.max(await game.runner.getBlockNumber(), latestConfirmedBlock);
    const atBlock = {blockTag};
    const cards = await game.activeCards(atBlock);
    const cardsByPlayer = new Map(players.map(player => [player.toLowerCase(), []]));
    for (let index = 0; index < cards.length; index += 8) {
      const batch = cards.slice(index, index + 8);
      const owners = await Promise.all(batch.map(id => game.holder(id, atBlock)));
      if (attempt !== revision) return;
      owners.forEach((owner, offset) => cardsByPlayer.get(owner.toLowerCase())?.push(batch[offset]));
    }
    if (attempt !== revision) return;
    hands.replaceChildren();
    handsPanel.hidden = false;
    if (!players.length) addText(hands, 'p', 'Aucun joueur inscrit à cette session.');
    for (const [index, player] of players.entries()) {
      const held = cardsByPlayer.get(player.toLowerCase());
      const section = document.createElement('section');
      section.className = 'panel';
      const count = held.length + (held.length === 1 ? ' carte' : ' cartes');
      addText(section, 'h3', 'Joueur ' + (index + 1) + ' · ' + count);
      const address = addText(section, 'p', player);
      address.className = 'muted';
      address.style.overflowWrap = 'anywhere';
      const grid = document.createElement('div');
      grid.className = 'cards';
      for (const id of held) grid.append(makeCardTile(id));
      section.append(grid);
      hands.append(section);
    }
  }

  function resetRound() {
    clearInterval(countdown);
    if (roundStatus) roundStatus.textContent = '';
    if (startRound) startRound.hidden = true;
    if (market) market.disabled = true;
    if (playerHand) playerHand.disabled = true;
    if (jokers) jokers.disabled = true;
    if (roundEnd) roundEnd.hidden = true;
    if (finishButton) finishButton.disabled = true;
    if (finishEarly) finishEarly.hidden = true;
    if (resultsPanel) {
      resultsPanel.hidden = true;
      resultsPanel.replaceChildren();
    }
    if (recallButton) recallButton.hidden = true;
  }

  async function showResults(game, round, attempt) {
    if (!resultsPanel) return;
    const [players, size] = await Promise.all([game.participantsOf(round), game.handSize()]);
    const rows = await Promise.all(players.map(async player => ({
      player, result: await game.results(round, player),
    })));
    if (attempt !== revision) return;

    const compareGain = (a, b) => a.result.gain > b.result.gain ? -1 : a.result.gain < b.result.gain ? 1 : 0;
    const compareFamily = (a, b) => Number(b.result.eligible) - Number(a.result.eligible)
      || Number(b.result.cards - a.result.cards) || compareGain(a, b);
    const gainLabel = gain => (gain > 0n ? '+' : '') + ethers.formatUnits(gain, 18) + ' SMZF';
    addText(resultsPanel, 'h2', 'Classements sur Sepolia · manche ' + round);
    addText(resultsPanel, 'p', 'Le classement des familles départage les joueurs au gain net de la manche si leur progression est identique.');
    const columns = document.createElement('div');
    columns.className = 'split';
    resultsPanel.append(columns);

    function showRanking(title, compare, headings, values) {
      const section = document.createElement('section');
      columns.append(section);
      addText(section, 'h3', title);
      const wrapper = document.createElement('div');
      wrapper.className = 'scroll';
      section.append(wrapper);
      const table = document.createElement('table');
      wrapper.append(table);
      const header = document.createElement('tr');
      table.createTHead().append(header);
      for (const heading of ['Rang', 'Portefeuille', ...headings]) addText(header, 'th', heading);
      const body = table.createTBody();
      const sorted = [...rows].sort(compare);
      let rank = 1;
      for (const [index, row] of sorted.entries()) {
        if (index && compare(sorted[index - 1], row) !== 0) rank = index + 1;
        const tr = body.insertRow();
        const walletLabel = row.player.slice(0, 6) + '…' + row.player.slice(-4);
        [rank, walletLabel, ...values(row.result)].forEach(value => addText(tr, 'td', value));
        tr.cells[1].title = row.player;
      }
    }
    showRanking('Familles', compareFamily, ['Progression', 'Gain net'], result => [
      result.cards + '/' + size + (result.complete && !result.eligible ? ' · cartes en trop' : ''),
      gainLabel(result.gain),
    ]);
    showRanking('Gains en SMZF', compareGain, ['Gain net'], result => [gainLabel(result.gain)]);
    resultsPanel.hidden = false;
  }

  function formatRoundTime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor(seconds / 60) % 60;
    const clock = String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    if (!days && !hours) return clock;
    return (days ? days + ' j ' : '') + String(hours).padStart(2, '0') + ':' + clock;
  }

  async function showRound(game, account, attempt) {
    if (!roundStatus) return;
    const [phase, round, deadline, remaining] = await Promise.all([
      game.phase(), game.round(), game.deadline(), game.remaining(),
    ]);
    if (attempt !== revision) return;
    resetRound();
    const isTrainer = isSameAddress(account, trainer);
    if (startRound) startRound.hidden = phase !== 1n || !isTrainer;
    if (roundEnd) roundEnd.hidden = !isTrainer || phase === 0n || phase === 1n;
    if (finishButton) {
      finishButton.hidden = phase === 4n || phase === 5n;
      finishButton.onclick = () => confirmedAction(account, attempt, 'finishRound', [], endStatus);
    }
    if (finishEarly) {
      finishEarly.hidden = !supportsV2 || !isTrainer || (phase !== 2n && phase !== 3n);
      finishEarly.onclick = () => {
        if (window.confirm('Arrêter le chrono et enregistrer le classement avec les cartes et soldes actuels ?')) {
          void confirmedAction(account, attempt, 'finishRoundEarly', [], endStatus);
        }
      };
    }
    if (recallButton && isSameAddress(account, trainer) && (phase === 4n || phase === 5n)) {
      recallButton.hidden = !(await game.activeCards()).length || attempt !== revision;
      recallButton.onclick = () => confirmedAction(account, attempt, 'recallRoundNFTs', [], endStatus);
    }
    const endDate = new Date(Number(deadline) * 1000);
    const end = phase === 2n && !Number.isNaN(endDate.getTime())
      ? ' · Fin prévue le ' + endDate.toLocaleString('fr-FR', {dateStyle: 'medium', timeStyle: 'short'})
      : '';
    function renderTime() {
      if (attempt !== revision) return 0;
      const seconds = phase === 3n ? Number(remaining)
        : Math.max(0, Math.ceil(Number(deadline) - Date.now() / 1000));
      if (market) market.disabled = phase !== 2n || !seconds;
      if (playerHand) playerHand.disabled = phase !== 2n || !seconds;
      if (jokers) jokers.disabled = phase !== 2n || !seconds;
      if (finishEarly && phase === 2n && !seconds) finishEarly.hidden = true;
      if (finishButton) {
        finishButton.disabled = !isTrainer || phase !== 2n || Boolean(seconds);
        finishButton.textContent = finishButton.disabled
          ? 'Terminer la manche après le chrono' : 'Terminer la manche sur Sepolia';
      }
      if (phase === 2n || phase === 3n) {
        const time = formatRoundTime(seconds);
        const label = phase === 3n ? 'en pause' : seconds ? 'en cours' : 'temps écoulé';
        roundStatus.textContent = 'Manche ' + round + ' sur Sepolia · ' + label + ' · ' + time + end;
        if (phase === 2n && !seconds) clearInterval(countdown);
        return seconds;
      }
      const labels = ['Aucune manche préparée', 'Cartes distribuées · en attente du départ',
        '', '', 'Manche terminée', 'Manche annulée'];
      roundStatus.textContent = labels[Number(phase)] ?? 'État de la manche inconnu';
      return 0;
    }
    if (renderTime() && phase === 2n) countdown = setInterval(renderTime, 1000);
    if (phase === 4n) await showResults(game, round, attempt);
  }

  function resetConnection() {
    revision++;
    resetRound();
    if (dealPanel) dealPanel.hidden = true;
    if (handsPanel) handsPanel.hidden = true;
    hands?.replaceChildren();
    clearPlayerCards('Connecte MetaMask pour afficher les cartes.');
    if (enrollment) enrollment.hidden = true;
    playerList?.replaceChildren();
    canOpenSession = false;
    updateSessionButton();
    nextCard = null;
    if (register) register.disabled = true;
    status.textContent = 'Compte ou réseau modifié. Relance la vérification.';
    if (playerHand) {
      button.textContent = 'Vérifier avec MetaMask';
      marketStatus.textContent = '';
    }
  }

  wallet?.on('chainChanged', resetConnection);
  wallet?.on('accountsChanged', resetConnection);

  async function verify(requestAccounts) {
    button.disabled = true;
    resetRound();
    if (dealPanel) dealPanel.hidden = true;
    if (handsPanel) handsPanel.hidden = true;
    hands?.replaceChildren();
    clearPlayerCards('Lecture des cartes…');
    if (enrollment) enrollment.hidden = true;
    playerList?.replaceChildren();
    canOpenSession = false;
    updateSessionButton();
    nextCard = null;
    if (register) register.disabled = true;
    status.textContent = 'Lecture du contrat…';
    let attempt = revision;
    try {
      if (!wallet?.isMetaMask) throw Error('Ouvre cette adresse locale dans le navigateur qui contient MetaMask.');
      if (await wallet.request({method: 'eth_chainId'}) !== '0xaa36a7') {
        throw Error('Sélectionne Sepolia dans MetaMask, puis relance la vérification.');
      }
      const [account] = await wallet.request({method: requestAccounts ? 'eth_requestAccounts' : 'eth_accounts'});
      if (!account) throw Error('Connecte ton compte MetaMask.');
      if (!requestAccounts && attempt !== revision) return;
      attempt = revision;
      const provider = new ethers.BrowserProvider(wallet);
      if ((await provider.getNetwork()).chainId !== 11155111n) throw Error('Le réseau a changé. Sélectionne Sepolia.');
      const game = new ethers.Contract(proxy, abi, provider);
      const [slot, owner, nft, token, version, session, isOpen, players] = await Promise.all([
        provider.getStorage(proxy, implementationSlot), game.owner(), game.collection(), game.smzf(),
        game.version(), game.session(), game.sessionOpen(), game.playerList(),
      ]);
      const logic = '0x' + slot.slice(-40);
      if (!isSameAddress(owner, trainer) || !isSameAddress(nft, collection) || !isSameAddress(token, currency)
          || (version === 1n ? !isSameAddress(logic, implementation)
            : version !== 2n || !await window.polarV2CodeMatches(provider, logic))) {
        throw Error('La configuration lue sur Sepolia diffère de celle attendue pour JeuPolar.');
      }
      if (attempt !== revision) return;
      supportsV2 = version === 2n;
      status.textContent = 'JeuPolar V' + version + ' vérifié sur Sepolia. Wallet connecté ' + account
        + (isSameAddress(account, trainer) ? ' (formateur). ' : '. ')
        + (isOpen ? 'Session ' + session + ' ouverte · ' + players.length + ' joueur(s).' : 'Aucune session ouverte.');
      if (isOpen) await Promise.all([showHands(game, account, attempt, players), showRound(game, account, attempt)]);
      else clearPlayerCards('Aucune session ouverte.');
      if (attempt !== revision) return;
      if (playerHand) button.textContent = 'Actualiser depuis Sepolia';
      if (enrollment) {
        const isTrainer = isSameAddress(account, trainer);
        const [activeCards, closing] = isOpen && isTrainer
          ? await Promise.all([game.activeCards(), game.closing()])
          : [[], true];
        if (attempt !== revision) return;
        const canEditPlayers = isOpen && isTrainer && !closing && !activeCards.length;
        if (dealPanel) dealPanel.hidden = !isOpen || !isTrainer || (players.length < 2 && !activeCards.length);
        if (dealButton) dealButton.disabled = !canEditPlayers || players.length < 2;
        playerList.replaceChildren();
        for (const player of players) {
          const row = document.createElement('li');
          row.textContent = player;
          if (canEditPlayers) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Retirer';
            remove.setAttribute('aria-label', 'Retirer ' + player);
            remove.onclick = () => {
              if (window.confirm('Retirer ce joueur ? Son solde SMZF de jeu revient au formateur. Il ne pourra être réinscrit que lors d’une nouvelle session.')) {
                void confirmedAction(account, attempt, 'removePlayer', [player], enrollmentStatus);
              }
            };
            row.append(' ', remove);
          }
          playerList.append(row);
        }
        enrollment.hidden = !canEditPlayers || players.length >= 9;
      }
      if (register && isSameAddress(account, trainer) && !isOpen) {
        await refreshCatalogue(game, attempt);
        if (attempt === revision) register.disabled = !nextCard || Boolean(pendingSession);
      } else if (register) {
        catalogStatus.textContent = isOpen ? 'Le catalogue est verrouillé pendant une session.' : 'Enregistrement réservé au formateur.';
      }
    } catch (error) {
      if (attempt === revision) {
        status.textContent = error.shortMessage || error.message;
        clearPlayerCards('Lecture impossible. Relance la vérification.');
      }
    } finally {
      button.disabled = false;
      updateSessionButton();
    }
  }

  button.onclick = () => verify(true);
  if (refreshHands) refreshHands.onclick = () => {
    if (!button.disabled) void verify(false);
  };
  if (playerHand && wallet?.isMetaMask) {
    const initialRevision = revision;
    void Promise.all([
      wallet.request({method: 'eth_accounts'}),
      wallet.request({method: 'eth_chainId'}),
    ]).then(([accounts, chain]) => {
      if (accounts.length && chain === '0xaa36a7' && revision === initialRevision && !button.disabled) {
        return verify(false);
      }
    }).catch(() => {});
  }

  if (register) register.onclick = async () => {
    if (!nextCard || registrationBusy) return;
    registrationBusy = true;
    updateSessionButton();
    register.disabled = true;
    button.disabled = true;
    const attempt = revision;
    const card = nextCard;
    try {
      const [account] = await wallet.request({method: 'eth_accounts'});
      if (!isSameAddress(account, trainer) || await wallet.request({method: 'eth_chainId'}) !== '0xaa36a7' || revision !== attempt) {
        throw Error('Sélectionne le compte formateur sur Sepolia, puis vérifie la connexion.');
      }
      const provider = new ethers.BrowserProvider(wallet);
      const game = new ethers.Contract(proxy, abi, await provider.getSigner(trainer));
      if (!pendingTransaction) {
        if (await game.sessionOpen()) throw Error('Le catalogue est verrouillé pendant une session.');
        const args = [card.id, card.family, card.role, card.joker];
        await game.registerCard.staticCall(...args);
        catalogStatus.textContent = 'Vérifie la transaction dans MetaMask.';
        pendingTransaction = await game.registerCard(...args);
      }
      catalogStatus.textContent = 'Attente de confirmation sur Sepolia… ' + pendingTransaction.hash;
      const receipt = await pendingTransaction.wait(1, 120000);
      pendingTransaction = null;
      if (!receipt || receipt.status !== 1) throw Error('Enregistrement non confirmé.');
      if (attempt !== revision) return;
      nextCard = null;
      await refreshCatalogue(game, attempt);
    } catch (error) {
      if (error.receipt) pendingTransaction = null;
      if (attempt === revision) catalogStatus.textContent = error.shortMessage || error.message;
    } finally {
      registrationBusy = false;
      updateSessionButton();
      button.disabled = false;
      register.disabled = !nextCard || attempt !== revision;
      register.textContent = pendingTransaction ? 'Vérifier la transaction en attente' : 'Enregistrer la prochaine carte';
    }
  };
  if (openSession) openSession.onclick = async () => {
    if (!canOpenSession || registrationBusy || pendingTransaction) return;
    openSession.disabled = true;
    button.disabled = true;
    register.disabled = true;
    const attempt = revision;
    try {
      const [account] = await wallet.request({method: 'eth_accounts'});
      if (!isSameAddress(account, trainer) || await wallet.request({method: 'eth_chainId'}) !== '0xaa36a7' || attempt !== revision) {
        throw Error('Sélectionne le compte formateur sur Sepolia, puis relance la vérification.');
      }
      const provider = new ethers.BrowserProvider(wallet);
      const game = new ethers.Contract(proxy, abi, await provider.getSigner(trainer));
      if (!pendingSession && !(await game.sessionOpen())) {
        await game.openSession.staticCall();
        sessionStatus.textContent = 'Vérifie l’ouverture de session dans MetaMask.';
        pendingSession = await game.openSession();
      }
      if (pendingSession) {
        sessionStatus.textContent = 'Attente de confirmation sur Sepolia… ' + pendingSession.hash;
        const receipt = await pendingSession.wait(1, 120000);
        pendingSession = null;
        if (!receipt || receipt.status !== 1) throw Error('Ouverture non confirmée.');
      }
      if (attempt !== revision) return;
      if (!(await game.sessionOpen())) throw Error('La session reste fermée sur Sepolia.');
      await button.onclick();
      sessionStatus.textContent = 'Session ouverte. Les joueurs pourront être inscrits à l’étape suivante.';
    } catch (error) {
      if (error.receipt) pendingSession = null;
      if (attempt === revision) sessionStatus.textContent = error.shortMessage || error.message;
    } finally {
      button.disabled = false;
      register.disabled = !nextCard || attempt !== revision || Boolean(pendingSession);
      openSession.textContent = pendingSession ? 'Vérifier la transaction en attente' : 'Ouvrir une session sur Sepolia';
      updateSessionButton();
    }
  };
  if (enrollment) enrollment.onsubmit = async event => {
    event.preventDefault();
    if (button.disabled || enrollment.hidden) return;
    const submit = enrollment.querySelector('button');
    const attempt = revision;
    submit.disabled = true;
    button.disabled = true;
    try {
      const player = ethers.getAddress(playerInput.value.trim());
      if (player === ethers.ZeroAddress || isSameAddress(player, trainer)) {
        throw Error('Utilise une adresse de joueur distincte du compte formateur.');
      }
      const [account] = await wallet.request({method: 'eth_accounts'});
      if (!isSameAddress(account, trainer) || await wallet.request({method: 'eth_chainId'}) !== '0xaa36a7' || attempt !== revision) {
        throw Error('Sélectionne le compte formateur sur Sepolia, puis relance la vérification.');
      }
      const provider = new ethers.BrowserProvider(wallet);
      const signer = await provider.getSigner(trainer);
      const game = new ethers.Contract(proxy, abi, signer);
      const smzf = new ethers.Contract(currency, [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function balanceOf(address owner) view returns (uint256)',
      ], signer);
      const [players, isOpen, amount, allowance, balance, activeCards, closing] = await Promise.all([
        game.playerList(), game.sessionOpen(), game.startingCredit(),
        smzf.allowance(trainer, proxy), smzf.balanceOf(trainer), game.activeCards(), game.closing(),
      ]);
      if (!isOpen || closing || activeCards.length || players.length >= 9) {
        throw Error('Il faut une session ouverte, une place libre et aucune carte déjà distribuée.');
      }
      if (players.some(address => isSameAddress(address, player))) throw Error('Ce joueur est déjà inscrit.');
      if (balance < amount) throw Error('Le solde SMZF du formateur est insuffisant.');
      if (attempt !== revision) return;
      if (allowance < amount) {
        enrollmentStatus.textContent = 'Confirme dans MetaMask l’autorisation de ' + ethers.formatUnits(amount, 18) + ' SMZF pour JeuPolar.';
        const approval = await smzf.approve(proxy, amount);
        enrollmentStatus.textContent = 'Autorisation SMZF en attente · ' + approval.hash;
        if ((await approval.wait()).status !== 1) throw Error('Autorisation SMZF non confirmée.');
      }
      if (attempt !== revision) return;
      await game.enroll.staticCall(player);
      if (attempt !== revision) return;
      enrollmentStatus.textContent = 'Confirme l’inscription du joueur dans MetaMask.';
      const tx = await game.enroll(player);
      enrollmentStatus.textContent = 'Inscription en attente · ' + tx.hash;
      if ((await tx.wait()).status !== 1) throw Error('Inscription non confirmée.');
      if (attempt !== revision) return;
      const credit = await game.balanceOf(player);
      playerInput.value = '';
      enrollmentStatus.textContent = 'Joueur inscrit · ' + ethers.formatUnits(credit, 18) + ' SMZF crédités dans le jeu.';
      await button.onclick();
    } catch (error) {
      if (attempt === revision) enrollmentStatus.textContent = error.shortMessage || error.message;
    } finally {
      submit.disabled = false;
      button.disabled = false;
    }
  };
  if (dealButton) dealButton.onclick = async () => {
    if (button.disabled || dealPanel.hidden) return;
    const attempt = revision;
    dealButton.disabled = true;
    button.disabled = true;
    try {
      const [account] = await wallet.request({method: 'eth_accounts'});
      if (!isSameAddress(account, trainer) || await wallet.request({method: 'eth_chainId'}) !== '0xaa36a7' || attempt !== revision) {
        throw Error('Sélectionne le compte formateur sur Sepolia, puis vérifie la connexion.');
      }
      const provider = new ethers.BrowserProvider(wallet);
      const signer = await provider.getSigner(trainer);
      const game = new ethers.Contract(proxy, abi, signer);
      const nft = new ethers.Contract(collection, [
        'function ownerOf(uint256) view returns (address)',
        'function isApprovedForAll(address owner, address operator) view returns (bool)',
        'function setApprovalForAll(address operator, bool approved)',
      ], signer);
      const [players, activeCards, approved] = await Promise.all([
        game.playerList(), game.activeCards(), nft.isApprovedForAll(trainer, proxy),
      ]);
      if (players.length < 2 || activeCards.length || !await game.sessionOpen() || await game.closing()) {
        throw Error('Il faut une session ouverte, au moins deux joueurs et aucune carte déjà distribuée.');
      }
      const stock = [];
      for (let index = 0; index < catalog.length; index += 8) {
        const batch = await Promise.all(catalog.slice(index, index + 8).map(async card => {
          const stored = await game.catalogue(card.id);
          if (stored.family === 0n || !isSameAddress(await nft.ownerOf(card.id), trainer)) return null;
          return {id: card.id, family: Number(stored.family), role: Number(stored.role), joker: stored.joker};
        }));
        if (attempt !== revision) return;
        stock.push(...batch.filter(Boolean));
      }
      const {proposeDeal} = await import('./distribution.mjs');
      const {families, recipients, size} = proposeDeal(stock, players);
      if (attempt !== revision) return;
      if (!approved) {
        dealStatus.textContent = 'Confirme dans MetaMask l’autorisation de gérer la collection POLAR9 pour le proxy JeuPolar.';
        const approval = await nft.setApprovalForAll(proxy, true);
        dealStatus.textContent = 'Autorisation POLAR9 en attente · ' + approval.hash;
        if ((await approval.wait()).status !== 1) throw Error('Autorisation POLAR9 non confirmée.');
      }
      if (attempt !== revision) return;
      await game.prepareRound.staticCall(families, recipients);
      if (attempt !== revision) return;
      dealStatus.textContent = 'Confirme le dépôt et la distribution des ' + recipients.length + ' cartes dans MetaMask.';
      const tx = await game.prepareRound(families, recipients);
      dealStatus.textContent = 'Distribution en attente · ' + tx.hash;
      if ((await tx.wait()).status !== 1) throw Error('Distribution non confirmée.');
      if (attempt !== revision) return;
      await verify(false);
      if (attempt === revision) dealStatus.textContent = 'Distribution confirmée · ' + size + ' cartes par joueur, dont 1 joker.';
    } catch (error) {
      if (attempt === revision) dealStatus.textContent = error.shortMessage || error.message;
    } finally {
      button.disabled = false;
      if (attempt === revision && !dealPanel.hidden && !hands.querySelector('.tile')) dealButton.disabled = false;
    }
  };
  if (startRound) startRound.onsubmit = async event => {
    event.preventDefault();
    if (button.disabled || startRound.hidden || !roundDuration.reportValidity()) return;
    const attempt = revision;
    const submit = startRound.querySelector('button');
    const duration = BigInt(roundDuration.valueAsNumber) * BigInt(roundUnit.value);
    if (duration > 8640000000000n - BigInt(Math.ceil(Date.now() / 1000))) {
      startStatus.textContent = 'Cette durée dépasse la date maximale que le navigateur peut afficher.';
      return;
    }
    button.disabled = true;
    submit.disabled = true;
    try {
      const [account] = await wallet.request({method: 'eth_accounts'});
      if (!isSameAddress(account, trainer) || await wallet.request({method: 'eth_chainId'}) !== '0xaa36a7' || attempt !== revision) {
        throw Error('Sélectionne le compte formateur sur Sepolia, puis relance la vérification.');
      }
      const provider = new ethers.BrowserProvider(wallet);
      const game = new ethers.Contract(proxy, abi, await provider.getSigner(trainer));
      await game.startRound.staticCall(duration);
      if (attempt !== revision) return;
      startStatus.textContent = 'Confirme le démarrage de la manche dans MetaMask.';
      const tx = await game.startRound(duration);
      startStatus.textContent = 'Démarrage en attente · ' + tx.hash;
      const receipt = await tx.wait();
      if (receipt?.status !== 1) throw Error('Démarrage non confirmé.');
      if (attempt !== revision) return;
      startStatus.textContent = 'Démarrage confirmé sur Sepolia.';
      startRound.hidden = true;
      await showRound(game, account, attempt);
    } catch (error) {
      if (attempt === revision) startStatus.textContent = error.shortMessage || error.message;
    } finally {
      submit.disabled = false;
      button.disabled = false;
    }
  };
})();
