// 75,000 one-off points burning
const { test, utils } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { defaults } = require('../tests/harness');
const ethers = require('ethers');
const gasPrice = require('@fuel-js/gasprice');
const write = require('write');

// Network Specification
const network_name = process.env['fuel_v1_network'];

module.exports = test(`Deploy Fuel Version 1.0 to ${network_name}`, async t => { try {
  // Check Network Specification
  utils.assert(network_name, 'unspecified-fuel_v1_network-environment');

  // Network
  const network = ethers.providers.getNetwork(network_name);

  // Get Default Provider for Infura
  t.setProvider(ethers.getDefaultProvider(network.name, {
    infrua: process.env['fuel_v1_default_infura'],
  }));
  t.setPrivateKey(process.env['fuel_v1_default_operators'].split(',')[0]);

  // Primary Wallet 0 Operator
  const wallet = t.getWallets()[0];

  // Setup
  const producer = wallet.address;
  const gasPrices = (await gasPrice(t.getProvider()));

  // Faucet Address
  const faucet = process.env['fuel_v1_default_faucet'] || producer;

  // set tx overrides object
  t.setOverrides({
    gasLimit: 6000000,
    gasPrice: gasPrices.safe,
  });

  const genesis_hash = utils.emptyBytes32;

  // Set Deployment Parameters
  const deploymentParameters = [
    // Block Producer
    producer,

    // finalizationDelay: uint256,
    20,

    // submissionDelay: uint256,
    20,

    // penaltyDelay: uint256,
    20,

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

  // Setup Fake Token for Deployment
  const totalSupply = utils.bigNumberify('0xFFFFFFFFFFFFFFFFF');
  const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode,
      [producer, totalSupply], wallet, t.getOverrides());

  // Determine Contract Funnel
  const funnela = await contract.funnel(producer);
  await t.wait(erc20.transfer(funnela, totalSupply, t.getOverrides()), 'erc20 transfer');
  await t.wait(contract.deposit(producer, erc20.address, t.getOverrides()),
    'ether deposit', errors);

  // Write changes
  const out = './src/builds/Fuel.json';

  // Read old JSON if ANy
  let FuelBuild = {};
  try {
    FuelBuild = JSON.parse(await readFile(out, 'utf8'));
  } catch (error) {}

  // Set new deployments
  FuelBuild.deployments = {
    ...(FuelBuild.deployments || {}),
    v1: {
      ...((FuelBuild.deployments || {}).v1 || {}),
      [network_name]: contract.address,
    },
  };

  // Write new File
  await write(out, JSON.stringify(FuelBuild, null, 2));

  // End
  console.log(`Fuel Version 1.0 deployed to ${network_name} @ address ${contract.address} in file ${out}`);

  } catch (error) { console.error(error); }
});
