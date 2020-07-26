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
  const transactionsToSimulate = 2000;
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

  let rootsCommitted = 0;
  let rootHashes = [];

  t.ok(1, `committing roots, this might take up to 10 minutes..`);

  // refill module to send to all the different keys
  let rootDeployPromises = [];

  // produce it in a block
  const chunkSize = (await contract.MAX_ROOT_SIZE())
    .div(utils.hexDataLength(transaction.encodePacked())).toNumber();

  // refill root accounts
  const _provider = t.getProvider();
  const wallets = [];
  const _wallet = t.getWallets()[0];
  const maxRootProducers = 8;
  const rootProducersCount = Math.ceil(transactions.length / chunkSize);
  const gasCostPerRoot = utils.parseEther('.14');
  const numberOfProducersToRefill = Math.min(rootProducersCount, maxRootProducers);
  const cycles = Math.ceil(rootProducersCount / numberOfProducersToRefill);
  const allocationPerRoot = gasCostPerRoot.mul(cycles);

  console.log('Number of root producers: ', numberOfProducersToRefill);
  console.log('Number of roots to deploy: ', rootProducersCount);
  console.log('Number of cycles per producer: ', cycles);
  console.log('Ether allocation per root: ', utils.formatUnits(allocationPerRoot, 'ether'), ' ether');
  console.log('Allocating: ',
    utils.formatUnits(allocationPerRoot.mul(numberOfProducersToRefill), 'ether'),
    ' ether to producers');
  for (var i = 0; i < numberOfProducersToRefill; i++) {
    const _wallet = new ethers.Wallet.fromMnemonic(
      process.env['fuel_v1_default_seed'],
      "m/44'/60'/0'/1/" + i,
    );
    wallets.push(_wallet.connect(_provider));
  }
  console.log('refill',
    await refill(_wallet, wallets.map(w => w.address), allocationPerRoot));

  /*
  for (var i = 0; i < 128; i++) {
    console.log(Math.round(i % 20));
  }
  return;
  */

  /// let nonce = await t.getProvider().getTransactionCount(producer);
  const gwei = 1000000000;
  let rootIndex = 0;
  let nonces = {};
  for (var chunk = 0; chunk < transactionsToSimulate;) {
    const walletIndex = rootIndex % numberOfProducersToRefill;
    nonces[walletIndex] = await t.getProvider().getTransactionCount(wallets[walletIndex].address);
    const txs = transactions.slice(chunk, chunk + chunkSize);
    const root = (new RootHeader({
      rootProducer: wallets[walletIndex].address,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combine(txs)),
      rootLength: utils.hexDataLength(combine(txs)),
      fee: chunk,
      feeToken: tokenId,
    }));
    rootHashes.push(root.keccak256Packed());
    console.log('Deploying root: ' + root.keccak256Packed());
    rootDeployPromises.push((async () => {
      try {
        const _walletIndex = walletIndex;
        const fee = chunk;
        const _root = root;
        const _txs = txs;
        let attemptCounts = 0;
        let rootTx = null;
        for (;attemptCounts < 150;) {
          try {
            console.log('attempt', _walletIndex, wallets[_walletIndex].address)
            const gasAttempt = utils.bigNumberify(gwei).mul(attemptCounts); // add 1 gwei per attempt
            const gasPrice = gasPrices.safe.add(gwei * 20); // 20 gwei
            const _contract = contract.connect(wallets[_walletIndex]);
            rootTx = await _contract.commitRoot(
              _root.properties.merkleTreeRoot().get(),
              tokenId,
              fee,
              combine(_txs), {
                ...t.getOverrides(),
              nonce: nonces[_walletIndex],
              gasLimit: 1000000,
              gasPrice, // attemptCounts > 0 ? gasPrices.fast : gasPrices.safe,
            });
            rootTx = await rootTx.wait();
            nonces[_walletIndex] += 1;
            rootsCommitted += 1;
            attemptCounts = 11;
            cumulativeGasUsed = cumulativeGasUsed.add(rootTx.cumulativeGasUsed);
            break;
          } catch (error) {
            console.log(error.message, error.results);
            await utils.wait(13 * 1000);
            attemptCounts++;
          }
        }
        return rootTx;
      } catch (error) {
        throw new Error(error);
      }
    })());
    chunk += chunkSize;
    rootIndex += 1;
  }

  const receipts = await Promise.all(rootDeployPromises);
  // await Promise.all(receipts.map(receipt => receipt.wait()));

  console.log('Number of Roots to deploy: ', rootsCommitted, rootHashes.slice(0, 128));

  let blocksCommitted = 0;
  const currentBlock = await t.getProvider().getBlockNumber();
  const currentBlockHash = (await t.getProvider().getBlock(currentBlock)).hash;
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
