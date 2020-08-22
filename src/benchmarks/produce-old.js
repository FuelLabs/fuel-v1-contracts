// 75,000 one-off points burning
const utils = require('@fuel-js/utils');
const { chunk, pack, combine } = require('@fuel-js/struct');
const ethers = require('ethers');
const { RootHeader, merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const gasPrice = require('@fuel-js/gasprice');
const refill = require('@fuel-js/refill');

// Constants
const gwei = 100000000;

// Target Root Size
const targetRootSize = 32000; // 39000; // 32000;

// Max Root Producers
const maxProducers = 24;

// Calldata per byte gas cost
const calldataPerByte = 16;

// Approxiamte (1 million approximatly) targetRootSize * 16 + extra 2
const gasLimitPerRoot = targetRootSize * (calldataPerByte + 2);

// Padding 10 Gwei for Now
const gasPricePadding = gwei * 10;

// Wait on Root Failure 7 seconds
const waitTime = 7 * 1000;

// Convert Seed / Operators to Wallets
function operatorsToWallets(config = {}) {
  let wallets = [];

  for (var i = 0; i < maxProducers; i++) {
    const _wallet = new ethers.Wallet.fromMnemonic(
      config.operators,
      "m/44'/60'/0'/1/" + i,
    );

    wallets.push(_wallet.connect(config.provider));
  }

  return wallets;
}

// Chunk Size based on Target Root Size
function transactionsPerRoot(transaction = '') {
  return targetRootSize / utils.hexDataLength(transaction.encodePacked());
}

function subslice(arr = [], start = 0, len = 0) {
  return arr.slice(start, start + len);
}

// give it txs, => root hashes back
async function rootDeployment(transactions = [], config = {}) {
  try {
    // Calculate Transactions Per Root based on Transactions
    const numPerRoot = transactionsPerRoot(transactions[0]);

    // Get Starting gas Prices
    const gasPrices = (await gasPrice(config.provider));

    // Gas Per Root after Fee
    const gasPerRoot = gasPrices.fast.mul(gasLimitPerRoot);

    // Number of Roots to Assign
    const numRoots = Math.ceil(transactions.length / numPerRoot);

    // Number of Producers to use, either 1 - 8
    const maxRootProducers = Math.min(numRoots, maxProducers);

    // Establish wallets
    const wallets = operatorsToWallets(config).slice(0, maxRootProducers);

    // Max roots to producers
    const rootsPerProducer = Math.ceil(numRoots / maxRootProducers);

    // Allocation Per Producer
    const allocationPerProducer = utils.parseEther('.03').mul(rootsPerProducer); // gasPerRoot.mul(rootsPerProducer);

    // Allocation Message
    console.log(
      'Allocating ',
      utils.formatUnits(allocationPerProducer.mul(maxRootProducers), 'ether'), ' ether',
      'to ', maxRootProducers, ' producers ');
    console.log('safe gas price @ ', utils.formatUnits(gasPrices.safe, 'gwei'), ' gwei per root');
    console.log('fast gas price @ ', utils.formatUnits(gasPrices.fast, 'gwei'), ' gwei per root');

    // Refill Root Producers
    await refill(config.wallet, wallets.map(w => w.address), allocationPerProducer);

    // Roots
    let roots = [];

    // Roots to Deploy
    for (var rootIndex = 0; rootIndex < numRoots; rootIndex++) {

      // Add Root to Roots
      roots.push(subslice(transactions, rootIndex * numPerRoot, numPerRoot));

    }

    // Dispersal Message
    console.log('Deploying ', roots.length, ' roots');

    // Setup multiple streams in promises
    let workers = [];
    let rootHashes = [];
    let gasUsed = utils.bigNumberify(0);

    // Assign Roots to Wallets
    let walletIndex = 0;
    for (const wallet of wallets) {

      // Root production for this root
      workers.push((async () => {
        try {

          // Bring Variables into Memory
          const _roots = subslice(roots, walletIndex * rootsPerProducer, rootsPerProducer);
          const _walletIndex = walletIndex;
          const _wallet = wallet;
          const _contract = config.contract.connect(_wallet);

          // Get Safe Gas Price
          let _gasPrice = gasPrices.safe.add(gasPricePadding);

          // Deploy each Root
          let _rootIndex = 0;
          for (const root of _roots) {

            // If the root is empty stop
            if (!root.length) break;

            // Setup the Header for this Root
            const header = new RootHeader({
              rootProducer: _wallet.address,
              merkleTreeRoot: merkleTreeRoot(root),
              commitmentHash: utils.keccak256(combine(root)),
              rootLength: utils.hexDataLength(combine(root)),
              fee: utils.bigNumberify(_wallet.address).add(_rootIndex),
              feeToken: config.tokenId,
            });

            // Root hash
            const _rootHash = header.keccak256Packed();

            // Add Root Hashes
            rootHashes.push(header.keccak256Packed());

            // balance
            const balance = await config.provider.getBalance(_wallet.address);

            // Error
            let rootError = true;

            // Make the Root Tx, Keep Trying Until it Goes Through
            while (rootError) {
              try {
                // Message for Worker
                console.log('Worker ',
                  _walletIndex,
                  ' attempting to deploy root', _rootHash, ' with a balance of',
                  utils.formatUnits(balance, 'ether'),
                  ' ether',
                  ' at a gas price of ',
                  utils.formatUnits(_gasPrice, 'gwei'),
                  ' gwei');

                // Transaction Options
                const rootTxOptions = {
                  gasLimit: gasLimitPerRoot,
                  gasPrice: _gasPrice,
                };

                // The Root Transaction
                let rootTx = await _contract.commitRoot(
                  header.properties.merkleTreeRoot().get(),
                  config.tokenId,
                  header.properties.fee().get(),
                  combine(root),
                  rootTxOptions,
                );

                // Wait this Root to Finish
                rootTx = await rootTx.wait();

                // Add Cumulative Cost
                gasUsed = gasUsed.add(rootTx.cumulativeGasUsed);

                // Set the Root to Fine
                rootError = null;
              } catch (error) {
                // Increase Gas for Next Go
                _gasPrice = _gasPrice.add(gwei / 10);

                // If the Gas Price is Too High, Set it to Fast w/ Padding..
                if (_gasPrice.gt(gasPrices.fast)) {
                  _gasPrice = gasPrices.fast.add(gasPricePadding);
                }

                // Console Error
                console.log('Worker ',
                  _walletIndex,
                  ' error: ',
                  error.message,
                  error.responseText,
                  ' new gas price: ', utils.formatUnits(_gasPrice, 'gwei'), ' gwei');

                // Wait on Failure
                await utils.wait(waitTime);
              }
            } // End While

            _rootIndex++;
          }

        } catch (workerError) {
          throw new utils.ByPassError(workerError);
        }
      })());

      // Increase Wallet Index
      walletIndex++;
    }

    // Wait on root production
    await Promise.all(workers);

    // Return the Gas Used
    return {
      rootHashes,
      gasUsed,
    };
  } catch (error) {
    throw new utils.ByPassError(error);
  }
}

module.exports = rootDeployment;
