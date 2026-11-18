const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const project = path.resolve(__dirname, '..');
const dependency = createRequire(path.join(process.env.POLAR_TEST_DEPENDENCIES || project, 'package.json'));
const solc = dependency('solc');
const source = 'contracts/ClansPolarDaoV2.sol';
const compile = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { [source]: { content: fs.readFileSync(path.join(project, source), 'utf8') } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'shanghai',
    viaIR: true,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
  }
}), {
  import(file) {
    const location = file.startsWith('@openzeppelin/') ? dependency.resolve(file) : path.join(project, file);
    return { contents: fs.readFileSync(location, 'utf8') };
  }
}));
const errors = compile.errors?.filter(error => error.severity === 'error') ?? [];
if (errors.length) throw Error(errors.map(error => error.formattedMessage).join('\n'));
const artifact = compile.contracts[source].ClansPolarDaoV2;
fs.writeFileSync(path.join(project, 'site', 'deployment.json'), JSON.stringify({
  abi: artifact.abi,
  bytecode: '0x' + artifact.evm.bytecode.object
}));
