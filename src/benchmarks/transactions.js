// 100,000 transfers
const { test, utils } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes, EMPTY_SIGNATURE_HASH } = require('../protocol/src/block');
const tx = require('../protocol/src/transaction');
const { Deposit } = require('../protocol/src/deposit');
const { defaults } = require('../tests/harness');
const ethers = require('ethers');
const gasPrice = require('@fuel-js/gasprice');
const rootDeployment = require('./produce');

module.exports = test('100k transactions', async t => { try {
  // attempt actual deployment
  if (process.env['fuel_v1_network']) {
    console.error('Benchmarking on network: ' + process.env['fuel_v1_network']);
    t.setProvider(ethers.getDefaultProvider(process.env['fuel_v1_network'], {
      infrua: process.env['fuel_v1_default_infura'],
    }));
    t.setPrivateKey(process.env['fuel_v1_default_operators'].split(',')[0]);
  }

  // set tx overrides object
  t.setOverrides({
    gasLimit: 6000000,
    gasPrice: (await gasPrice(t.getProvider())).safe,
  });

  // simulate 100k tx's
  const transactionsToSimulate = 100000;
  const ethereumBlockSize = 8000000;
  let cumulativeGasUsed = utils.bigNumberify(0);

  const producer = t.getWallets()[0].address;
  const contract = await t.deploy(abi, bytecode,
      defaults(producer, utils.parseEther('.01')), t.getWallets()[0], t.getOverrides());

  let tokenId = '0x00';
  let ownerId = '0xdeadbe';

  let transaction = await tx.Transaction({
    override: true,
    witnesses: [ t.wallets[0] ],
    metadata: [ tx.Metadata() ],
    data: [ tx.UTXO() ],
    inputs: [ tx.Input() ],
    outputs: [tx.OutputTransfer({
      amount: utils.parseEther('1.0'),
      token: tokenId,
      owner: [ownerId],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [ownerId],
    })],
    contract,
  });

  const transactions = (new Array(transactionsToSimulate))
    .fill(0)
    .map(() => transaction);

  const { rootHashes, gasUsed } = await rootDeployment(transactions, {
    provider: t.getProvider(),
    wallet: t.getWallets()[0],
    tokenId,
    operators: process.env['fuel_v1_default_seed']
      || ethers.Wallet.createRandom().signingKey.mnemonic,
    contract,
  });
  cumulativeGasUsed = cumulativeGasUsed.add(gasUsed);


  const _testReduction = (await t.getProvider().getNetwork()).name === 'unknown'
    ? 0
    : 7; // 7 blocks back
  const currentBlock = utils.bigNumberify(await t.getProvider().getBlockNumber()).sub(_testReduction);
  const currentBlockHash = (await t.getProvider().getBlock(currentBlock.toNumber())).hash;

  console.log('submitting at current block', currentBlock, currentBlockHash, _testReduction);

  let block = await contract.commitBlock(currentBlock, currentBlockHash, 1, rootHashes.slice(0, 128), {
    ...t.getOverrides(),
    value: await contract.BOND_SIZE(),
  });
  block = await block.wait();
  let block2 = await contract.commitBlock(currentBlock, currentBlockHash, 2, rootHashes.slice(128, 128 + 128), {
    ...t.getOverrides(),
    value: await contract.BOND_SIZE(),
  });
  block2 = await block2.wait();
  let block3 = await contract.commitBlock(currentBlock, currentBlockHash, 3, rootHashes.slice(256, 256 + 128), {
    ...t.getOverrides(),
    value: await contract.BOND_SIZE(),
  });
  block3 = await block3.wait();

  cumulativeGasUsed = cumulativeGasUsed.add(block.cumulativeGasUsed);
  cumulativeGasUsed = cumulativeGasUsed.add(block2.cumulativeGasUsed);
  cumulativeGasUsed = cumulativeGasUsed.add(block3.cumulativeGasUsed);

  t.ok(1, `Transactions Submitted: ${transactionsToSimulate}`);
  t.ok(1, `Roots committed: ${rootHashes.length}`);
  t.ok(1, `Blocks committed: 3`);
  t.ok(1, `Cumulative gas used: ${cumulativeGasUsed.toString(rootHashes)}`);
  t.ok(1, `Ethereum blocks used: ${cumulativeGasUsed.div(ethereumBlockSize)}`);
  t.ok(1, `@$100 USD per Block: $${cumulativeGasUsed.div(ethereumBlockSize).mul(100)} USD`);
  t.ok(1, `@$50 USD per Block: $${cumulativeGasUsed.div(ethereumBlockSize).mul(50)} USD`);

} catch (error) { t.error(error, errors); } });
