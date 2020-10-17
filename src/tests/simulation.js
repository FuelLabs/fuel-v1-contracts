// here we will do an optimistic test of functionality
// build Fuel, with proxy
// build a few blocks
// withdraw some funds
// htlc out of chain
// bond withdraw out of chain
// build more blocks
// present fraud, tackle fraud
// build more blocks
// present foreign fraud, tackle fraud
// build more blocks
const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, pack, combine, chunkJoin } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const OwnedProxy = require('../builds/OwnedProxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('./harness');

module.exports = test('simualtion', async t => {
    // Setup Addresses
    const producer = t.wallets[0].address;
    const cold = t.wallets[1].address;
    const userA = t.wallets[2].address;
    const userAWallet = t.wallets[2];
    const userB = t.wallets[2].address;
    const userBWallet = t.wallets[2];

    // Before method.
    async function state () {
        // Produce the Block Producer Proxy.
        const proxy = await t.deploy(OwnedProxy.abi, OwnedProxy.bytecode, [
            producer,
            cold,
        ]);

        // Produce Fuel and the Genesis Hash.
        const genesisHash = utils.keccak256('0xdeadbeaf');
        const contract = await t.deploy(abi, bytecode, [
            proxy.address,
            20,
            20,
            20,
            utils.parseEther('1.0'),
            "Fuel",
            "1.0.0",
            1,
            genesisHash,
        ]);

        // Produce the token.
        const totalSupply = utils.parseEther('100000000000000.00');
        const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

        // Make a Deposit for User A.
        const userAFunnel = await contract.funnel(userA);
        const userAAmount = utils.parseEther('10000.45');

        // Trander for User A Deposit Funnel.
        await t.wait(erc20.transfer(userAFunnel, userAAmount, overrides), 'erc20 transfer');
        await t.wait(t.wallets[0].sendTransaction({
            ...overrides,
            value: userAAmount,
            to: userAFunnel,
        }), 'ether to funnel');

        // User A Deposit Ether.
        const userADepositEther = new Deposit({
            token: 0,
            owner: userA,
            blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
            value: userAAmount,
        });
        const userADepositEtherx = await t.wait(contract.deposit(userA, utils.emptyAddress, overrides),
            'ether deposit', errors);

        // User A Deposit Token.
        const userADepositToken = new Deposit({
            token: 1,
            owner: userA,
            blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
            value: userAAmount,
        });
        const userADepositTokenTx = await t.wait(contract.deposit(userA, erc20.address, overrides),
            'ether deposit', errors);
    }
  
    // Produce State.
    await state();
});