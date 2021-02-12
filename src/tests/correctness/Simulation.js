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
const { chunk, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const OwnedProxy = require('../../builds/OwnedProxy.json');
const ERC20 = require('../../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot } = require('@fuel-js/protocol2/src/block');
const tx = require('@fuel-js/protocol2/src/transaction');
const { Deposit } = require('@fuel-js/protocol2/src/deposit');

module.exports = test('Simulation', async t => {
    // Setup Addresses
    const producer = t.wallets[0].address;
    const cold = t.wallets[1].address;
    const coldWallet = t.wallets[1];
    const userA = t.wallets[2].address;
    const userAWallet = t.wallets[2];
    const userB = t.wallets[2].address;

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
            "1.1.0",
            1,
            genesisHash,
        ]);

        // Connect proxy target to Fuel contract.
        const proxyCold = proxy.connect(coldWallet);
        await proxyCold.setTarget(contract.address, overrides);

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

        // Previous block hash.
        let previousBlockHash = genesisHash;

        // Make a block.
        async function makeBlock(opts = {}) {
            // Fake leafs.
            const fakeLeaf = new Leaf({
                data: chunk(utils.hexlify(utils.randomBytes(120))),
            });

            // Transaciton A.
            const txa = await tx.Transaction({
                inputs: [tx.InputDeposit({
                    witnessReference: 0,
                    owner: userA,
                }), tx.InputDeposit({
                    witnessReference: 0,
                    owner: userA,
                })],
                witnesses: [ userAWallet ],
                metadata: [
                    tx.MetadataDeposit(userADepositEther),
                    tx.MetadataDeposit(userADepositToken),
                ],
                data: [
                    userADepositEther,
                    userADepositToken,
                ],
                outputs: [tx.OutputTransfer({
                    amount: utils.parseEther('100.00'),
                    token: 0,
                    owner: producer,
                }), tx.OutputWithdraw({
                    amount: utils.parseEther('100.00'),
                    token: 1,
                    owner: userA,
                }), tx.OutputHTLC({
                    amount: utils.parseEther('100.00'),
                    token: 1,
                    owner: userA,
                    digest: utils.sha256('0xdeadbeaf'),
                    expiry: 100,
                    returnOwner: userB,
                })],
                contract,
            });

            // Produce Transactions.
            const txs = [fakeLeaf, txa, fakeLeaf];

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
                feeToken,
                fee,
                combine(txs),
                overrides,
            ), 'valid submit', errors);

            // Get block tip.
            const blockTip = (await contract.blockTip()).add(1);

            // Produce block.
            const header = (new BlockHeader({
                producer: proxy.address,
                height: blockTip,
                numTokens: 2,
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
                    {
                        gasLimit: 4000000,
                    },
                ),
                'commit block',
                errors);

            // Set header properly.
            header.properties.blockNumber().set(block.logs[0].blockNumber);
            header.properties.previousBlockHash().set(previousBlockHash);
            t.equalBig(await contract.blockTip(), blockTip, 'tip');

            // Previous block hash.
            previousBlockHash = header.keccak256Packed();

            // Transaciton proof.
            const proof = tx.TransactionProof({
                block: header,
                root,
                transactions: txs,
                inputOutputIndex: 1,
                transactionIndex: 1,
                token: erc20.address,
                selector: userA,
            });

            // Return the headers and data.
            return {
                block: header,
                root,
                txs,
                proof,
            };
        }

        // Make two blocks.
        const firstBlock = await makeBlock();
        const secondBlock = await makeBlock();

        // Increase blocks to withdrawal period.
        await t.increaseBlock(await contract.FINALIZATION_DELAY());
    
        // Withdraw funds.
        await t.wait(contract.withdraw(
            secondBlock.proof.encodePacked(),
            overrides,
        ), 'withdraw', errors);

        // Withdraw block reward form both finalized blocks.
        await t.wait(proxy.transact(
            contract.address,
            0,
            contract.interface.functions.bondWithdraw.encode([
                firstBlock.block.encodePacked(),
            ]),
            {
                gasLimit: 4000000,
            },
        ), 'withdraw bond', errors);

        // Some address.
        const someAddress = utils.hexlify(utils.randomBytes(20));
        t.equalBig(await t.getBalance(someAddress), 0, "balance"); 

        // Send bond back to another address.
        await t.wait(proxyCold.transact(
            someAddress,
            await contract.BOND_SIZE(),
            '0x',
            {
                gasLimit: 4000000,
            },
        ), 'move bond', errors);

        // Check balance bond was moved from Proxy.
        t.equalBig(
            await t.getBalance(someAddress), 
            await contract.BOND_SIZE(), 
            "balance",
        );

        // Commit fraud sub-routine.
        async function commitFraud(fn = '', args = []) {
            // Generate the fraud hash
            const fraudHash = utils.keccak256(contract.interface.functions
                .proveDoubleSpend.encode(args));

            // Commit the fraud hash.
            await t.wait(contract.commitFraudHash(
                fraudHash,
                overrides,
            ), 'commit fraud hash', errors);

            // Wait 10 blocks for fraud finalization.
            await t.increaseBlock(10);

            // Commit fraud.
            const fraud = await t.wait(contract.proveDoubleSpend(
                ...args,
                overrides,
            ), 'double spend same deposit', errors);

            // Check penalty.
            t.equalBig(
                await contract.penalty(),
                (await contract.PENALTY_DELAY()).add(fraud.blockNumber),
                'penalty'
            );
        }

        // Third block that is invalid.
        const thirdBlock = await makeBlock();

        // Check block tip.
        t.equalBig(await contract.blockTip(), 3, 'tip');

        // Commit double spend fraud and revert block.
        await commitFraud(
            'proveDoubleSpend',
            [
                firstBlock.proof.encodePacked(),
                thirdBlock.proof.encodePacked(),
            ],
        );

        // Check block tip.
        t.equalBig(await contract.blockTip(), 2, 'tip');

        // Set previous block back to second block.
        previousBlockHash = secondBlock.block.keccak256Packed();

        // Third block that is invalid.
        const thirdBlockAgain = await makeBlock();

        // Check block tip.
        t.equalBig(await contract.blockTip(), 3, 'tip');

        // Third block that is invalid.
        const blockSomething = await makeBlock();
        const blockSomething2 = await makeBlock();
        
        // Increase blocks to withdrawal period.
        await t.increaseBlock(await contract.FINALIZATION_DELAY());
    
        // Withdraw block reward form both finalized blocks.
        t.equalBig(await t.getProvider().getBalance(proxy.address), 0, 'no balance');
        await t.wait(proxy.transact(
            contract.address,
            0,
            contract.interface.functions.bondWithdraw.encode([
                blockSomething.block.encodePacked(),
            ]),
            {
                gasLimit: 4000000,
            },
        ), 'withdraw bond', errors);
        t.equalBig(await t.getProvider().getBalance(proxy.address),
            await contract.BOND_SIZE(), 'no balance');

        t.equalBig(await t.getProvider().getBalance(proxy.address), await contract.BOND_SIZE(),
            'after first bond balance');
        await t.wait(proxy.transact(
            contract.address,
            0,
            contract.interface.functions.bondWithdraw.encode([
                blockSomething2.block.encodePacked(),
            ]),
            {
                gasLimit: 4000000,
            },
        ), 'withdraw bond', errors);
        t.equalBig(await t.getProvider().getBalance(proxy.address),
            (await contract.BOND_SIZE()).mul(2), 
            'after second bond');
    }
  
    // Produce State.
    await state();
});