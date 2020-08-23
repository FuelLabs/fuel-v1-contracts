// 25,000 subscription transactions
const { test, utils } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('../protocol/src/block');
const tx = require('../protocol/src/transaction');
const { Deposit } = require('../protocol/src/deposit');
const { defaults } = require('../tests/harness');
const ethers = require('ethers');
const gasPrice = require('@fuel-js/gasprice');
const rootDeployment = require('./root_deployment2');

module.exports = test('retrive funds', async t => { try {
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

  const producer = t.getWallets()[0].address;
  const config = {
    provider: t.getProvider(),
    wallet: t.getWallets()[0],
    operators: process.env['fuel_v1_default_seed']
      || ethers.Wallet.createRandom().signingKey.mnemonic,
  };

  const baseValue = utils.parseEther('.001');

  let wallets = [];
  let workers = [];
  for (var i = 0; i < 8; i++) {
    workers.push((async () => {
      try {
        const _i = i;

        // Setup Wallet from Numonic
        let wallet = new ethers.Wallet.fromMnemonic(
          config.operators,
          "m/44'/60'/0'/1/" + _i,
        );

        // Connect Wallet to provider
        wallet = wallet.connect(config.provider);

        // Get this wallet balances address
        const walletBalance = await config.provider.getBalance(wallet.address);

        console.log('getting funds from', wallet.address, ' ',
          utils.formatUnits(walletBalance, 'ether'), 'ether');

        // wallet
        if (walletBalance.gt(baseValue)) {
          // Send Transaction back to Main wallet
          const sendTx = await wallet.sendTransaction({
            to: config.wallet.address,
            value: walletBalance.sub(utils.parseEther('.1')),
          });
          await sendTx.wait();
        }
      } catch (walletError) {
        throw new utils.ByPassError(walletError);
      }
    })());
  }

  await Promise.all(workers);


} catch (error) { t.error(error, errors); } });
