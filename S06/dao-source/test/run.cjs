const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const project = path.resolve(__dirname, '..');
const dependency = createRequire(path.join(process.env.POLAR_TEST_DEPENDENCIES || project, 'package.json'));
const solc = dependency('solc');
const ganache = dependency('ganache');
const source = 'test/Scenarios.sol';

async function run() {
  const compilation = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity',
    sources: { [source]: { content: fs.readFileSync(path.join(project, source), 'utf8') } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'shanghai',
      viaIR: true,
      outputSelection: { '*': { '*': ['evm.bytecode.object', 'evm.deployedBytecode.object'] } }
    }
  }), {
    import(file) {
      const location = file.startsWith('@openzeppelin/') ? dependency.resolve(file) : path.join(project, file);
      return { contents: fs.readFileSync(location, 'utf8') };
    }
  }));
  const errors = compilation.errors?.filter(({ severity }) => severity === 'error') ?? [];
  assert.equal(errors.length, 0, errors.map(({ formattedMessage }) => formattedMessage).join('\n'));
  const dao = compilation.contracts['contracts/ClansPolarDaoV2.sol'].ClansPolarDaoV2;
  assert.ok(dao.evm.deployedBytecode.object.length / 2 < 24576, 'Taille du contrat DAO');
  const code = compilation.contracts[source].Scenarios.evm.bytecode.object;
  const chain = ganache.provider({ logging: { quiet: true } });
  try {
    // A single read-only simulation. No signed transaction, account key, or RPC endpoint.
    await chain.request({
      method: 'eth_call',
      params: [{ data: '0x' + code, gas: '0x1c9c380' }, 'latest']
    });
    assert.equal(await chain.request({ method: 'eth_blockNumber', params: [] }), '0x0');
    console.log('Scénario Solidity V2 réussi sur une EVM locale, sans transaction envoyée.');
  } finally {
    await chain.disconnect();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
