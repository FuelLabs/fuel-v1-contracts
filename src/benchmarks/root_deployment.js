// 75,000 one-off points burning
const utils = require('@fuel-js/utils');
const { chunk, pack, combine } = require('@fuel-js/struct');
const ethers = require('ethers');
const { RootHeader, merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const gasPrice = require('@fuel-js/gasprice');
const refill = require('@fuel-js/refill');

// give it txs, => root hashes back
async function rootDeployment(transactions = [], config = {}) {
  try {
    let rootsCommitted = 0;
    let rootHashes = [];
    const gasPrices = (await gasPrice(config.provider));

    // refill module to send to all the different keys
    let rootDeployPromises = [];
    let cumulativeGasUsed = utils.bigNumberify(0);

    // 54000 bytes
    const targetRootSize = utils.bigNumberify(32000); // await config.contract.MAX_ROOT_SIZE()

    // produce it in a block
    const chunkSize = targetRootSize
      .div(utils.hexDataLength(transactions[0].encodePacked())).toNumber();

    // refill root accounts
    const _provider = config.provider;
    const wallets = [];
    const maxRootProducers = 8;
    const rootProducersCount = Math.ceil(transactions.length / chunkSize);
    const gasCostPerRoot = utils.parseEther('.14');
    const numberOfProducersToRefill = Math.min(rootProducersCount, maxRootProducers);
    const cycles = Math.ceil(rootProducersCount / numberOfProducersToRefill);
    const allocationPerRoot = gasCostPerRoot.mul(cycles);

    console.log('Gas price to start: ', utils.formatUnits(gasPrices.fast, 'gwei'));
    console.log('Number of root producers: ', numberOfProducersToRefill);
    console.log('Number of roots to deploy: ', rootProducersCount);
    console.log('Number of cycles per producer: ', cycles);
    console.log('Ether allocation per root: ', utils.formatUnits(allocationPerRoot, 'ether'), ' ether');
    console.log('Allocating: ',
      utils.formatUnits(allocationPerRoot.mul(numberOfProducersToRefill), 'ether'),
      ' ether to producers');
    for (var i = 0; i < numberOfProducersToRefill; i++) {
      const _wallet = new ethers.Wallet.fromMnemonic(
        config.operators,
        "m/44'/60'/0'/1/" + i,
      );
      wallets.push(_wallet.connect(_provider));
    }

    console.log('refill tx receipt',
      await refill(config.wallet, wallets.map(w => w.address), allocationPerRoot));

    /// let nonce = await config.provider.getTransactionCount(producer);
    const gwei = 100000000;
    let rootIndex = 0;
    let nonces = {};
    let lastAcceptedGasPrice = null;
    for (var chunk = 0; chunk < transactions.length;) {
      const walletIndex = rootIndex % numberOfProducersToRefill;
      nonces[walletIndex] = await config.provider.getTransactionCount(wallets[walletIndex].address);
      const txs = transactions.slice(chunk, chunk + chunkSize);
      const root = (new RootHeader({
        rootProducer: wallets[walletIndex].address,
        merkleTreeRoot: merkleTreeRoot(txs),
        commitmentHash: utils.keccak256(combine(txs)),
        rootLength: utils.hexDataLength(combine(txs)),
        fee: chunk,
        feeToken: config.tokenId,
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
          for (;attemptCounts < 1000;) {
            try {
              const gasAttempt = utils.bigNumberify(gwei).mul(attemptCounts); // add 1 gwei per attempt
              const gasPrice = (lastAcceptedGasPrice || gasPrices.safe.add(gwei * 10))
                .add(gasAttempt);
              const _contract = config.contract.connect(wallets[_walletIndex]);
              console.log('attempt',
                _walletIndex,
                wallets[_walletIndex].address,
                'submitting @ ',
                utils.formatUnits(gasPrice, 'gwei'),
                ' gwei',
                ' nonce ',
                nonces[_walletIndex],
                'roots deployed',
                rootHashes.length);
              rootTx = await _contract.commitRoot(
                _root.properties.merkleTreeRoot().get(),
                config.tokenId,
                fee,
                combine(_txs), {
                nonce: nonces[_walletIndex],
                gasLimit: 1000000,
                gasPrice, // attemptCounts > 0 ? gasPrices.fast : gasPrices.safe,
              });
              rootTx = await rootTx.wait();
              lastAcceptedGasPrice = gasPrice;
              nonces[_walletIndex] += 1;
              rootsCommitted += 1;
              attemptCounts = 11;
              cumulativeGasUsed = cumulativeGasUsed.add(rootTx.cumulativeGasUsed);
              break;
            } catch (error) {
              try {
                if ((error.message || '').indexOf('insufficient funds') !== -1
                    || (error.message || '').indexOf('insufficient') !== -1
                    || (error.message || '').indexOf('low') !== -1) {
                  const refillTx = await config.wallet.sendTransaction({
                    to: wallets[_walletIndex].address,
                    value: allocationPerRoot,
                  });
                  await refillTx.wait();
                }
              } catch (error) {
                console.log('refill tx failed');
                console.error(error);
              }
              console.log(error.message, error.results);
              await utils.wait(5 * 1000);
              attemptCounts++;
            }
          }
          return rootTx;
        } catch (error) {
          throw new utils.ByPassError(error);
        }
      })());
      chunk += chunkSize;
      rootIndex += 1;
    }

    const receipts = await Promise.all(rootDeployPromises);
    // await Promise.all(receipts.map(receipt => receipt.wait()));

    return { rootHashes, gasUsed: cumulativeGasUsed };
  } catch (error) {
    throw new utils.ByPassError(error);
  }
}

module.exports = rootDeployment;
