const { test, utils } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../src/builds/Fuel.json');
const OwnedProxy = require('../src/builds/OwnedProxy.json');
const ERC20 = require('../src/builds/ERC20.json');
const ethers = require('ethers');
const gasPrice = require('@fuel-js/gasprice');
const write = require('write');
const readFile = require('fs-readfile-promise');
const deployments = require('../src/deployments/Fuel.json');

// Network Specification
const network_name = process.env['fuel_v1_network'];

// One week in seconds
const oneWeek = 604800;

// One day in seconds
const oneDay = 86400;

// One week in eth block times
const oneWeekInBlocks = Math.round(oneWeek / 13);

// One day in eth block times
const oneDayInBlock = Math.round(oneDay / 13);

// Convert Seed / Operators to Wallets
function operatorsToWallets(operators = '') {
  let wallets = [];

  for (var i = 0; i < 8; i++) {
    wallets.push(new ethers.Wallet.fromMnemonic(
      operators,
      "m/44'/60'/0'/1/" + i,
    ));
  }

  return wallets;
}

// Is this just a deployment verification.
const verify = process.env['verify'] === '1';

// If it's just a verification, we use a fake operator.
if (verify) {
  // Specify a fo-operator.
  process.env['fuel_v1_default_operators'] = utils.hexlify(utils.randomBytes(32));

  // Log verifying deployment.
  console.log('Verifying deployment');
}

// Deployment transaction hashes.
const transactionHashes = {
  'rinkeby': '0x712b3a2e6a79a639d74b849df2b48dd2c6be6055d8791662557275e01a33e0d2',
  'ropsten': '',
  'mainnet': '0x8fb57c93bfaa578af174de240f8067b8bf2dc886d9e1f32ceb06a5953742984b',
};

// Deploy Fuel to Network
module.exports = test(`Deploy Fuel Version 1.0 to ${network_name}`, async t => { try {
  // Check Network Specification
  utils.assert(network_name, 'fuel_v1_network not specified in environment variables');
  utils.assert(process.env['fuel_v1_default_infura'], 'fuel_v1_default_infura not specified in environment variables');
  utils.assert(process.env['fuel_v1_default_operators'], 'fuel_v1_default_operators not specified in environment variables');

  // Network
  const network = ethers.utils.getNetwork(network_name);

  // Get Default Provider for Infura
  t.setProvider(ethers.getDefaultProvider(network.name, {
    infrua: process.env['fuel_v1_default_infura'],
  }));
  t.setPrivateKey(process.env['fuel_v1_default_operators'].split(',')[0]);

  // Primary Wallet 0 Operator
  const wallet = t.getWallets()[0];

  // Setup
  const operator = process.env['fuel_v1_default_seed']
    ? operatorsToWallets(process.env['fuel_v1_default_seed'])[0].address
    : wallet.address;
  const gasPrices = (await gasPrice(t.getProvider()));

  // Faucet Address
  const faucet = process.env['fuel_v1_default_faucet']
    ? (new ethers.Wallet(process.env['fuel_v1_default_faucet'])).address
    : operator;

  // Faucet log
  console.log('deployer address @ ', wallet.address);
  console.log('operator address @ ', operator);
  console.log('faucet address @ ', faucet);

  // set tx overrides object
  t.setOverrides({
    gasLimit: 4000000,
    gasPrice: gasPrices.median,
  });

  // The operator for this wallet.
  const operatorAddress = (verify
    ? process.env['fuel_operator']
    : operator);

  // Cold wallet address.
  const coldWallet = network_name === 'mainnet'
    ? '0x3e947a271a37Ae7B59921c57be0a3246Ee0d887C'
    : operatorAddress;

  // Mainnet proxy.
  let proxy = {
   address: '0x416fd705858c247de79972112974e25bfabb83ca',
  };

   // Produce the Block Producer Proxy.
   if (network_name !== 'mainnet') {
    proxy = await t.deploy(
      OwnedProxy.abi,
      OwnedProxy.bytecode,
      [
         operatorAddress,
         coldWallet,
      ],
      wallet,
      t.getOverrides(),
    );
   }

  // Genesis Block Hash. Generated from genesis.js.
  const genesis_hash = '0x9299da6c73e6dc03eeabcce242bb347de3f5f56cd1c70926d76526d7ed199b8b';

  // Set Deployment Parameters
  const deploymentParameters = [
    // Block Producer
    proxy.address,

    // finalizationDelay: uint256 | 2 weeks | Seconds: (14 * 24 * 60 * 60) / 13 = 93046
    oneWeekInBlocks * 2,

    // submissionDelay: uint256, | 1 day | Seconds: (1 * 24 * 60 * 60) / 13 = 6646
    oneDayInBlock * 7,

    // penaltyDelay: uint256, | 1 day | Seconds: (1 * 24 * 60 * 60) / 13 = 6646
    6646 / 2, // oneDayInBlock, no pentatly delay for testnet

    // Bond Size
    utils.parseEther(
      process.env['bond_size']
      || '.1'
    ),

    // Contract name
    "Fuel",

    // Contract version
    "1.0.0",

    // Contract
    network.chainId,

    // Contract Genesis
    genesis_hash,
  ];

  // If it's a verification, we stop it here
  if (verify) {
    // Assert there is a deployment to verify.
    utils.assert(deployments.v1[network_name], 'there is no deployment for this network');

    // Get the contract code from the provider.
    const contractCode = (await t.getProvider()
      .getTransaction(transactionHashes[network_name]))
      .data;

    // Code produced from deployment.
    const fuelInterface = new ethers.utils.Interface(abi);
    const producedBytecode = fuelInterface.deployFunction
      .encode(bytecode, deploymentParameters);

    // Assert the bytecode to be the same.
    utils.assert(contractCode === producedBytecode, 'bytecode-verified');

    // Log verified.
    console.log('Bytecode verified.');

    // Stop deployment sequence from progressing.
    return;
  }

   // set tx overrides object
   t.setOverrides({
    gasLimit: 3000000,
    gasPrice: gasPrices.median,
  });

  // Setup Contract for Deployment
  const contract = await t.deploy(abi, bytecode,
      deploymentParameters, wallet, t.getOverrides());

  // Setup Fake Token for Deployment send to Faucet
  const totalSupply = utils.bigNumberify('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
  const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode,
      [wallet.address, totalSupply], wallet, t.getOverrides());

  // Determine Contract Funnel
  const funnela = await contract.funnel(faucet);
  await t.wait(erc20.transfer(funnela, totalSupply, t.getOverrides()), 'erc20 transfer');
  await t.wait(contract.deposit(faucet, erc20.address, t.getOverrides()),
    'ether deposit', errors);

  // Write changes
  const out = './src/deployments/Fuel.json';

  // Read old JSON if ANy
  let FuelDeployments = {};
  try {
    FuelDeployments = JSON.parse(await readFile(out, 'utf8'));
  } catch (error) {}

  // Set new deployments
  FuelDeployments = {
    ...(FuelDeployments || {}),
    v1: {
      ...((FuelDeployments || {}).v1 || {}),
      [network_name]: contract.address,
    },
  };

  // Write new File
  await write(out, JSON.stringify(FuelDeployments, null, 2), { overwrite: true });

  // End
  console.log(`Fuel Version 1.0 deployed to ${network_name} @ address ${contract.address} in file ${out}`);

  } catch (error) { console.error(error); }
});
