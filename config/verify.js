const { test, utils } = require('@fuel-js/environment');
const { bytecode, abi } = require('../src/builds/Fuel.json');
const ethers = require('ethers');
const deployments = require('../src/deployments/Fuel.json');

// Network Specification.
const network_name = 'mainnet';

// One week in seconds.
const oneWeek = 604800;

// One day in seconds.
const oneDay = 86400;

// One week in eth block times.
const oneWeekInBlocks = Math.round(oneWeek / 13);

// One day in eth block times.
const oneDayInBlock = Math.round(oneDay / 13);

// Log verifying deployment.
console.log('Verifying deployment...');

// Verify transaction hashes.
const transactionHashes = {
  'rinkeby': '0x712b3a2e6a79a639d74b849df2b48dd2c6be6055d8791662557275e01a33e0d2',
  'mainnet': '0x0c6df9a3357210843817404c5754fc461b3b9e892cc4e62d46011d94ded55005',
};

// Verify Fuel to Network.
module.exports = test(`Verify Fuel Version 1.1 to ${network_name}`, async t => {
    try {
        // Check Network Specification.
        utils.assert(
            process.env['fuel_v1_default_infura'],
            'fuel_v1_default_infura not specified in environment variables'
        );
    
        // Network.
        const network = ethers.utils.getNetwork(network_name);

        // Get Default Provider for Infura.
        t.setProvider(ethers.getDefaultProvider(network.name, {
            infrua: process.env['fuel_v1_default_infura'],
        }));

        // Mainnet proxy.
        let proxy = {
            address: '0xfa990ea3cc8f1ec066986477edf457ffbad6e39c',
        };

        // Genesis Block Hash. Generated from genesis.js.
        const genesis_hash = '0x9299da6c73e6dc03eeabcce242bb347de3f5f56cd1c70926d76526d7ed199b8b';

        // Set Deployment Parameters.
        const deploymentParameters = [
            // Block Producer.
            proxy.address,

            // FinalizationDelay: uint256 | 2 weeks | Seconds: (14 * 24 * 60 * 60) / 13 = 93046.
            oneWeekInBlocks * 2,

            // SubmissionDelay: uint256, | 1 day | Seconds: (1 * 24 * 60 * 60) / 13 = 6646.
            oneDayInBlock * 5,

            // PenaltyDelay: uint256, | 1 day | Seconds: (1 * 24 * 60 * 60) / 13 = 6646.
            6646 / 2, // oneDayInBlock, no pentatly delay for testnet.

            // Bond Size.
            utils.parseEther(
                '.5'
            ),

            // Contract name.
            "Fuel",

            // Contract version.
            "1.1.0",

            // Contract.
            network.chainId,

            // Contract Genesis.
            genesis_hash,
        ];

        // If it's a verification, we stop it here.
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
    } catch (error) {
        console.error(error);
    }
});
