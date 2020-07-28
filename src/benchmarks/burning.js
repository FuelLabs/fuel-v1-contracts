// 75,000 one-off points burning
const { test, utils } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('../tests/harness');
const ethers = require('ethers');
const gasPrice = require('@fuel-js/gasprice');
const refill = require('@fuel-js/refill');
const rootDeployment = require('./root_deployment2');

module.exports = test('75k Burn Transactions', async t => { try {
  // attempt actual deployment
  if (process.env['fuel_v1_network']) {
    console.error('Benchmarking on network: ' + process.env['fuel_v1_network']);
    t.setProvider(ethers.getDefaultProvider(process.env['fuel_v1_network'], {
      infrua: process.env['fuel_v1_default_infura'],
    }));
    t.setPrivateKey(process.env['fuel_v1_default_operators'].split(',')[0]);
  }

  // simulate 75k tx's
  const transactionsToSimulate = 75000;
  const ethereumBlockSize = 8000000;
  let cumulativeGasUsed = utils.bigNumberify(0);

  const producer = t.getWallets()[0].address;
  const gasPrices = (await gasPrice(t.getProvider()));

  // set tx overrides object
  t.setOverrides({
    gasLimit: 6000000,
    gasPrice: gasPrices.safe,
  });

  const contract = await t.deploy(abi, bytecode,
      defaults(producer, utils.parseEther('.01')), t.getWallets()[0], t.getOverrides());
  // const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
  // const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode,
  //     [producer, totalSupply], t.getWallets()[0], t.getOverrides());

  // let token = erc20.address;
  let tokenId = '0x00';
  // const funnela = await contract.funnel(producer);

  /*
  const valuea = utils.bigNumberify(1000);
  await t.wait(erc20.transfer(funnela, valuea, t.getOverrides()), 'erc20 transfer');
  await t.wait(contract.deposit(producer, token, t.getOverrides()),
    'ether deposit', errors);
    */
  // const commitTx = await contract.commitAddress(producer, t.getOverrides());
  // await commitTx.wait();
  const ownerId = '0xdeadbe'; // await contract.addressId(producer);

  let transaction = await tx.Transaction({
    override: true,
    witnesses: [ t.getWallets()[0] ],
    metadata: [ tx.Metadata() ],
    data: [ tx.UTXO() ],
    inputs: [ tx.Input() ],
    outputs: [tx.OutputTransfer({
      amount: utils.parseEther('1.0'),
      token: tokenId,
      owner: ['0x00'], // the null address
    }), tx.OutputReturn({
      data: ['0xaa'], // special burn flag for consistancy
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

  let blocksCommitted = 0;

  const _testReduction = (await t.getProvider().getNetwork()).name === 'unknown'
    ? 0
    : 7; // 7 blocks back
  const currentBlock = utils.bigNumberify(await t.getProvider().getBlockNumber()).sub(_testReduction);
  const currentBlockHash = (await t.getProvider().getBlock(currentBlock.toNumber())).hash;

  console.log('submitting at current block', currentBlock, currentBlockHash, _testReduction);


  let block = await contract.commitBlock(currentBlock, currentBlockHash, 1, rootHashes.slice(0, 128), {
    ...t.getOverrides(),
    value: await contract.BOND_SIZE(),
    gasPrice: gasPrices.fast,
  });
  block = await block.wait();
  blocksCommitted += 1;
  cumulativeGasUsed = cumulativeGasUsed.add(block.cumulativeGasUsed);

  if (rootHashes.slice(128).length) {
    let block2 = await contract.commitBlock(currentBlock, currentBlockHash, 2, rootHashes.slice(128, 128 + 128), {
      ...t.getOverrides(),
      value: await contract.BOND_SIZE(),
      gasPrice: gasPrices.fast,
    });
    block2 = await block2.wait();
    cumulativeGasUsed = cumulativeGasUsed.add(block2.cumulativeGasUsed);
    blocksCommitted += 1;
  }

  if (rootHashes.slice(256).length) {
    let block3 = await contract.commitBlock(currentBlock, currentBlockHash, 3, rootHashes.slice(256, 256 + 128), {
      ...t.getOverrides(),
      value: await contract.BOND_SIZE(),
      gasPrice: gasPrices.fast,
    });
    block3 = await block3.wait();
    cumulativeGasUsed = cumulativeGasUsed.add(block3.cumulativeGasUsed);
    blocksCommitted += 1;
  }

  if (rootHashes.slice(384).length) {
    let block4 = await contract.commitBlock(currentBlock, currentBlockHash, 3, rootHashes.slice(384, 384 + 128), {
      ...t.getOverrides(),
      value: await contract.BOND_SIZE(),
      gasPrice: gasPrices.fast,
    });
    block4 = await block4.wait();
    cumulativeGasUsed = cumulativeGasUsed.add(block4.cumulativeGasUsed);
    blocksCommitted += 1;
  }

  t.ok(1, `Transactions Submitted: ${transactionsToSimulate}`);
  t.ok(1, `Roots committed: ${rootHashes.length}`);
  t.ok(1, `Blocks committed: ${blocksCommitted}`);
  t.ok(1, `Cumulative gas used: ${cumulativeGasUsed.toString(rootHashes)}`);
  t.ok(1, `Ethereum blocks used: ${(cumulativeGasUsed.toNumber() / ethereumBlockSize)}`);
  t.ok(1, `@$100 USD per Block: $${(cumulativeGasUsed.toNumber() / ethereumBlockSize) * 100} USD`);
  t.ok(1, `@$50 USD per Block: $${(cumulativeGasUsed.toNumber() / ethereumBlockSize) * 50} USD`);

} catch (error) { console.error(error); t.error(error, errors); } });
