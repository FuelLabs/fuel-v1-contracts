const { test, utils } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../src/builds/Fuel.json');
const ERC20 = require('../src/builds/ERC20.json');
const { defaults } = require('../src/tests/harness');
const ethers = require('ethers');
const gasPrice = require('@fuel-js/gasprice');
const write = require('write');

// Network Specification
const network_name = process.env['fuel_v1_network'];

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
  const operator = wallet.address;
  const gasPrices = (await gasPrice(t.getProvider()));

  // Faucet Address
  const faucet = process.env['fuel_v1_default_faucet'] || operator;

  // set tx overrides object
  t.setOverrides({
    gasLimit: 6000000,
    gasPrice: gasPrices.safe,
  });

  // Genesis Block Hash
  const genesis_hash = utils.emptyBytes32;

  // Set Deployment Parameters
  const deploymentParameters = [
    // Block Producer
    operator,

    // finalizationDelay: uint256 | 2 weeks | Seconds: (14 * 24 * 60 * 60) / 13 = 93046
    93046,

    // submissionDelay: uint256, | 1 day | Seconds: (1 * 24 * 60 * 60) / 13 = 6646
    6646,

    // penaltyDelay: uint256, | 1 day | Seconds: (1 * 24 * 60 * 60) / 13 = 6646
    6646,

    // Bond Size
    utils.parseEther(process.env['bond_size'] || '1.0'),

    // Contract name
    "Fuel",

    // Contract version
    "1.0.0",

    // Contract
    network.chainId,

    // Contract Genesis
    genesis_hash
  ];

  // Setup Contract for Deployment
  const contract = await t.deploy(abi, bytecode,
      deploymentParameters, wallet, t.getOverrides());

  // Setup Fake Token for Deployment send to Faucet
  const totalSupply = utils.bigNumberify('0xFFFFFFFFFFFFFFFFF');
  const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode,
      [faucet, totalSupply], wallet, t.getOverrides());

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
