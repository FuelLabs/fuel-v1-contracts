// 100k Points Claims One-off points burning
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

module.exports = test('100k Points Claims', async t => { try {
  // set tx overrides object
  t.setOverrides({
    gasLimit: 6000000,
    gasPrice: (await gasPrice(t.getProvider())).safe,
  });

  const outputsPerDispersalTx = 8;
  const transactionsToSimulate = 100000 / outputsPerDispersalTx;
  const ethereumBlockSize = 8000000;
  let cumulativeGasUsed = utils.bigNumberify(0);

  const producer = t.getWallets()[0].address;
  const contract = await t.deploy(abi, bytecode,
      defaults(producer, utils.parseEther('.01')), t.getWallets()[0], t.getOverrides());
  const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
  const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode,
      [producer, totalSupply], t.getWallets()[0], t.getOverrides());

  let token = erc20.address;
  let tokenId = '0x01';
  const funnela = await contract.funnel(producer);
  const valuea = utils.bigNumberify(1000);
  await t.wait(erc20.transfer(funnela, valuea, t.getOverrides()), 'erc20 transfer');
  await t.wait(contract.deposit(producer, token, t.getOverrides()),
    'ether deposit', errors);
  await contract.commitAddress(producer, t.getOverrides());
  const ownerId = await contract.addressId(producer);

  let transaction = await tx.Transaction({
    override: true,
    witnesses: [ t.getWallets()[0] ],
    metadata: [ tx.Metadata() ],
    data: [ tx.UTXO() ],
    inputs: [ tx.Input() ],
    outputs: [tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    })],
    contract,
  });

  const transactions = (new Array(transactionsToSimulate))
    .fill(0)
    .map(() => transaction);

  let rootsCommitted = 0;
  let rootHashes = [];

  t.ok(1, `committing roots, this might take up to 10 minutes..`);

  // produce it in a block
  const chunkSize = Math.round((await contract.MAX_ROOT_SIZE()).div(2) / (transaction.encodePacked().length / 2));
  for (var chunk = 0; chunk < transactionsToSimulate; chunk += chunkSize) {
    const txs = transactions.slice(chunk, chunk + chunkSize);
    if (!txs.length) break;
    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combine(txs)),
      rootLength: utils.hexDataLength(combine(txs)),
      fee: chunk,
      feeToken: tokenId,
    }));
    rootHashes.push(root.keccak256Packed());
    let rootTx = await contract.commitRoot(root.properties.merkleTreeRoot().get(), tokenId, chunk, combine(txs), t.getOverrides());
    rootTx = await rootTx.wait();
    rootsCommitted += 1;
    cumulativeGasUsed = cumulativeGasUsed.add(rootTx.cumulativeGasUsed);
  }

  const currentBlock = await t.getProvider().getBlockNumber();
  const currentBlockHash = (await t.getProvider().getBlock(currentBlock)).hash;
  let block = await contract.commitBlock(currentBlock, currentBlockHash, 1, rootHashes.slice(0, 128), {
    ...t.getOverrides(),
    value: await contract.BOND_SIZE(),
  });
  block = await block.wait();

  cumulativeGasUsed = cumulativeGasUsed.add(block.cumulativeGasUsed);

  t.ok(1, `Claims Processed: ${transactionsToSimulate * outputsPerDispersalTx}`);
  t.ok(1, `Transactions Submitted: ${transactionsToSimulate}`);
  t.ok(1, `Roots committed: ${rootHashes.length}`);
  t.ok(1, `Blocks committed: 1`);
  t.ok(1, `Cumulative gas used: ${cumulativeGasUsed.toString(rootHashes)}`);
  t.ok(1, `Ethereum blocks used: ${cumulativeGasUsed.div(ethereumBlockSize)}`);
  t.ok(1, `@$100 USD per Block: $${cumulativeGasUsed.div(ethereumBlockSize).mul(100)} USD`);
  t.ok(1, `@$50 USD per Block: $${cumulativeGasUsed.div(ethereumBlockSize).mul(50)} USD`);

} catch (error) { t.error(error, errors); } });
