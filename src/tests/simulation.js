/*
Purpose:
This test will simulate mainnet Fuel usage and setup.

1) deployment
2) valid blocks
3) withraw funds
4) htlc out of chain
5) commit fraud, produce a few invalid blocks, revert chain
6) produce valid blocks
7) do a swap
8) withdraw block bond
9) produce blocks
10) gather fees from roots
11) withdraw fees
*/
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

        // Set fee stipulations.
        let feeToken = 1;
        let fee = utils.parseEther('.000012');

        // Make a block.
        async function makeBlock(opts = {}) {
            // Fake leafs.
            const fakeLeaf = new Leaf({
                data: chunk(utils.hexlify(utils.randomBytes(120))),
            });

            // Produce Transactions.
            const txs = [fakeLeaf];

            // Produce Root.
            const root = (new RootHeader({
                rootProducer: producer,
                merkleTreeRoot: merkleTreeRoot(txs),
                commitmentHash: utils.keccak256(combine(txs)),
                rootLength: utils.hexDataLength(combine(txs)),
                feeToken: feeToken,
                fee: fee,
            }));

            // Root is committed from a different address than the Proxy.
            await t.wait(contract.commitRoot(
                root.properties.merkleTreeRoot().get(),
                0,
                0,
                combine(txs),
                overrides,
            ), 'valid submit', errors);

            // Get block tip.
            const blockTip = (await contract.blockTip()).add(1);

            // Produce block.
            const header = (new BlockHeader({
                producer: proxy.address,
                height: blockTip,
                numTokens: 1,
                numAddresses: 1,
                roots: [root.keccak256Packed()],
            }));

            // Commit block on-chain.
            const currentBlock = await t.provider.getBlockNumber();
            const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;

            // Commit transaction encoded data.
            const commitTx = contract.interface.functions.commitBlock.encode([
                currentBlock,
                currentBlockHash,
                blockTip,
                [root.keccak256Packed()],
            ]);

            // Produce block commitment from the Proxy contract.
            await t.wait(t.wallets[0].sendTransaction({
                ...overrides,
                value: await contract.BOND_SIZE(),
                to: proxy.address,
            }), 'ether to proxy');
            const block = await t.wait(
                proxy.transact(
                    contract.address,
                    await contract.BOND_SIZE(),
                    commitTx,
                    overrides,
                ),
                'commit block',
                errors);

            header.properties.blockNumber().set(block.logs[0].blockNumber);
            t.equalBig(await contract.blockTip(), 1, 'tip');

            // Return the headers and data.
            return {
                block: header,
                root,
                txs,
            };
        }

        // Make two blocks.
        await makeBlock();
        await makeBlock();
    }
  
    // Produce State.
    await state();
});