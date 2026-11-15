'use strict';

(() => {
  const proxy = '0x6b94f3f7eCa95E1425B2c86Bf666e4682910d19e';
  const explorer = 'https://sepolia.etherscan.io';
  const endpoints = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
  ];
  const abi = [
    'function round() view returns (uint256)',
    'function phase() view returns (uint8)',
    'function participantsOf(uint256 round) view returns (address[])',
    'event RoundChanged(uint256 indexed round, uint8 phase, uint256 deadline)',
    'event HolderChanged(uint256 indexed round, uint256 indexed card, address indexed player)',
    'event Sale(uint256 indexed card, address indexed seller, address indexed buyer, uint256 price)',
  ];
  const cards = new Map(catalog.map(card => [BigInt(card.id), card]));
  const byId = id => document.getElementById(id);
  const refresh = byId('journal-refresh');
  const status = byId('journal-status');
  const content = byId('journal-content');
  const hands = byId('journal-hands');
  const moves = byId('journal-moves');
  const dateFormat = new Intl.DateTimeFormat('fr-FR', {dateStyle: 'short', timeStyle: 'medium'});
  const compareLogs = (a, b) => a.blockNumber - b.blockNumber || a.index - b.index;

  function append(parent, tag, value) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    parent.append(node);
    return node;
  }

  function cardName(id) {
    const card = cards.get(id);
    return card ? card.name + ' · ' + card.clan + ' · NFT ' + id : 'NFT ' + id;
  }

  async function roundLogs(game, round, head) {
    const holders = game.filters.HolderChanged(round);
    const phases = game.filters.RoundChanged(round);
    const changes = [];
    for (let end = head; end >= 0;) {
      const start = Math.max(0, end - 1999);
      const [holderLogs, phaseLogs] = await Promise.all([
        game.queryFilter(holders, start, end),
        game.queryFilter(phases, start, end),
      ]);
      changes.push(...holderLogs);
      const distribution = phaseLogs.find(log => log.args.phase === 1n);
      if (distribution) {
        return {distribution, changes: changes.sort(compareLogs)};
      }
      end = start - 1;
    }
    throw Error('Le bloc de distribution de cette manche est introuvable.');
  }

  async function readRound(game, provider, round, head) {
    const [{distribution, changes}, players] = await Promise.all([
      roundLogs(game, round, head),
      game.participantsOf(round, {blockTag: head}),
    ]);
    const sales = new Map();
    const dates = new Map();
    const blocks = [...new Set(changes.map(log => log.blockNumber))];
    for (let index = 0; index < blocks.length; index += 6) {
      await Promise.all(blocks.slice(index, index + 6).map(async number => {
        const [block, events] = await Promise.all([
          provider.getBlock(number),
          game.queryFilter(game.filters.Sale(), number, number),
        ]);
        if (!block) throw Error('Impossible de lire la date d’un mouvement.');
        dates.set(number, dateFormat.format(block.timestamp * 1000));
        for (const event of events) {
          sales.set(event.transactionHash + ':' + event.args.card, event.args.price);
        }
      }));
    }
    const ownership = new Map();
    const rows = changes.map(log => {
      const {card, player} = log.args;
      const previous = ownership.get(card);
      ownership.set(card, player);
      const price = sales.get(log.transactionHash + ':' + card);
      const operation = log.transactionHash === distribution.transactionHash ? 'Distribution'
        : price !== undefined ? 'Vente'
          : player === ethers.ZeroAddress ? 'Récupération' : 'Échange';
      return {card, previous, player, price, operation, date: dates.get(log.blockNumber), hash: log.transactionHash};
    });
    return {players, ownership, rows};
  }

  function render({players, ownership, rows}) {
    for (const player of players) {
      const section = append(hands, 'section');
      section.className = 'panel';
      const held = [...ownership].filter(([, owner]) => owner === player);
      const title = append(section, 'h3', player + ' · ' + held.length + (held.length === 1 ? ' carte' : ' cartes'));
      title.style.overflowWrap = 'anywhere';
      const grid = append(section, 'div');
      grid.className = 'cards';
      for (const [id] of held) {
        const tile = append(grid, 'article');
        tile.className = 'tile';
        const card = cards.get(id);
        if (card?.image) {
          const image = append(tile, 'img');
          image.src = card.image;
          image.alt = '';
          image.loading = 'lazy';
        }
        append(tile, 'p', cardName(id));
      }
    }
    for (const row of rows.reverse()) {
      const tr = append(moves, 'tr');
      for (const value of [row.date, row.operation, cardName(row.card), row.previous ?? 'Distribution',
        row.player === ethers.ZeroAddress ? 'Hors manche' : row.player,
        row.price === undefined ? '—' : ethers.formatUnits(row.price, 18) + ' SMZF']) {
        append(tr, 'td', value);
      }
      const link = append(append(tr, 'td'), 'a', 'Voir les logs');
      link.href = explorer + '/tx/' + row.hash + '#eventlog';
    }
    content.hidden = false;
  }

  async function loadSnapshot(provider) {
    const game = new ethers.Contract(proxy, abi, provider);
    const head = await provider.getBlockNumber();
    const atHead = {blockTag: head};
    const [round, phase] = await Promise.all([game.round(atHead), game.phase(atHead)]);
    if (phase === 0n || phase >= 4n) {
      return {message: 'Aucune manche en cours. Le journal se remplit à la prochaine distribution.'};
    }
    const data = await readRound(game, provider, round, head);
    const [currentRound, currentPhase] = await Promise.all([game.round(), game.phase()]);
    if (currentRound !== round || currentPhase === 0n || currentPhase >= 4n) {
      return {message: 'La manche a changé. Actualise le journal.'};
    }
    return {data, message: 'Manche ' + round + ' · données lues au bloc ' + head.toLocaleString('fr-FR')};
  }

  async function load() {
    refresh.disabled = true;
    content.hidden = true;
    hands.replaceChildren();
    moves.replaceChildren();
    status.dataset.state = 'pending';
    status.textContent = 'Lecture de la manche sur Sepolia…';
    try {
      let lastError;
      for (const endpoint of endpoints) {
        const request = new ethers.FetchRequest(endpoint);
        request.timeout = 10000;
        const provider = new ethers.JsonRpcProvider(request, 11155111);
        try {
          const snapshot = await loadSnapshot(provider);
          if (snapshot.data) render(snapshot.data);
          status.textContent = snapshot.message;
          status.dataset.state = '';
          return;
        } catch (error) {
          lastError = error;
        } finally {
          provider.destroy();
        }
        status.textContent = 'Connexion Sepolia interrompue. Nouvelle tentative…';
      }
      throw lastError;
    } catch (error) {
      status.dataset.state = 'warning';
      status.textContent = 'Impossible de charger les données de la manche sur Sepolia. Clique sur « Actualiser depuis Sepolia » pour réessayer.';
      console.error(error);
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.onclick = load;
  void load();
})();
