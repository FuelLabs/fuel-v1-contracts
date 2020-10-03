/// @dev Prove complex transaction to be valid in summing, witness, input checks.
const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('./harness');

module.exports = test('proveComplex', async t => {

    // Construct contract
    async function state (opts = {}) {
        const producer = t.wallets[0].address;
        const contract = await t.deploy(abi, bytecode, defaults(producer));

        const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
        const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

        let token = utils.emptyAddress;
        let tokenId = '0x00';
        let numTokens = 1;

        // try an ether deposit
        const funnela = await contract.funnel(producer);
        const valuea = utils.bigNumberify(1000);

        await t.wait(erc20.transfer(funnela, valuea, overrides), 'erc20 transfer');
        token = erc20.address;
        tokenId = '0x01';
        numTokens = 2;

        const deposit = new Deposit({
            token: tokenId,
            owner: producer,
            blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
            value: valuea,
        });
        const etx = await t.wait(contract.deposit(producer, token, overrides),
            'ether deposit', errors);
    }

    // Empty state.
    await state();
    
});