const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const { combine, chunkJoin } = require('@fuel-js/struct');
const { BlockHeader, RootHeader, merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const protocol = require('@fuel-js/protocol');
const { defaults } = require('../utils/harness');

module.exports = test('InvalidTransaction', async t => {

    // Construct contract.
    async function state (opts = {}) {
        const producer = t.wallets[0].address;
        const contract = await t.deploy(abi, bytecode, defaults(producer));

        const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
        const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

        // try an ether deposit
        const funnela = await contract.funnel(producer);
        const valuea = utils.bigNumberify(1000);

        await t.wait(erc20.transfer(funnela, valuea, overrides), 'erc20 transfer');
        let token = erc20.address;
        let tokenId = '0x01';
        let numTokens = 2;

        const deposit = new protocol.deposit.Deposit({
            token: tokenId,
            owner: producer,
            blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
            value: valuea,
        });
        await t.wait(contract.deposit(producer, token, overrides),
            'deposit', errors);

        async function produceBlock(txs = [], fee = 0, feeToken = 0) {
            // Root.
            if (txs.length <= 0) {
                txs = [
                    protocol.root.Leaf({ data: utils.hexlify(utils.randomBytes(124)) }),
                ];
            }

            // Produce a root.
            const root = (new RootHeader({
                rootProducer: producer,
                merkleTreeRoot: merkleTreeRoot(txs),
                commitmentHash: utils.keccak256(combine(txs)),
                rootLength: utils.hexDataLength(combine(txs)),
                feeToken,
                fee,
            }));

            // Produce a root.
            await t.wait(contract.commitRoot(
                root.properties.merkleTreeRoot().get(),
                feeToken,
                fee,
                combine(txs),
                overrides
            ),
                'valid submit', errors);
            
            // Get block tip.
            const tip = (await contract.blockTip()).add(1);

            // Create a header.
            const header = new BlockHeader({
                producer,
                height: tip,
                numTokens,
                numAddresses: 1,
                roots: [root.keccak256Packed()],
            });

            // Current block.
            const currentBlock = await t.provider.getBlockNumber();
            const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
            const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, tip, [root.keccak256Packed()], {
                ...overrides,
                value: await contract.BOND_SIZE(),
            }), 'commit new block', errors);
            header.properties.blockNumber().set(block.events[0].blockNumber);
            header.properties.previousBlockHash().set(
                await contract.blockCommitment(tip.sub(1)),
            );
            t.equalBig(await contract.blockTip(), tip, 'new block tip');

            // Submit a withdrawal proof.
            const rootTransactionProof = protocol.transaction.TransactionProof({
                block: header,
                root: root,
                transactions: txs,
                inputOutputIndex: 0,
                transactionIndex: 0,
                ...(opts.proof || {}),
            });

            // Add this property
            rootTransactionProof.root = root;

            // Return Block, Tip, Root, Proof, Txs.
            return {
                height: tip,
                block: header,
                root: root,
                rootTransactionProof,
                proof: rootTransactionProof,
                txs,
                feeToken,
                amount: root.properties.rootLength().get().mul(fee),
            };
        }

        await produceBlock([
            ...(opts.fillTxs || []),
        ], 0, 0);

        const block = await produceBlock([
            ...(opts.fillTxs || []),
            opts.makeTx 
                ? await opts.makeTx({
                    contract,
                    deposit,
                    producer,
                    tokenId,
                    token,
                    deposit,
                    numTokens,
                })
                : opts.tx,
        ], 0, 0);
        const proof = block.proof;

        // Generate the fraud hash
        const fraudHash = utils.keccak256(contract.interface.functions.proveInvalidTransaction.encode(
            [
                proof.encodePacked(),
            ],
        ));

        // Commit the fraud hash.
        await t.wait(contract.commitFraudHash(fraudHash, {
            ...overrides,
        }), 'commit fraud hash', errors);

        // Wait 10 blocks for fraud finalization.
        await t.increaseBlock(10);

        if (opts.revert) {
            fraudTx = await t.revert(
                contract.proveInvalidTransaction(
                    proof.encodePacked(), /* arg2, */ {
                    ...overrides,
                }),
                errors[opts.revert],
                opts.revert,
            );

            t.equalBig(await contract.blockTip(), 1, 'tip');

            return;
        }

        if (opts.valid) {
            const validTx = await t.wait(contract.proveInvalidTransaction(proof.encodePacked(), {
                ...overrides,
            }), opts.valid, errors);

            if (!validTx) {
                t.ok(0, 'not ok');
                return;
            }

            if (validTx.logs.length) {
                console.log(validTx.logs);
            }

            t.equalBig(validTx.logs.length, 0, 'no logs or fraud');
            t.equalBig(await contract.blockTip(), 2, 'tip');
            return;
        }

        const fraudTx = await t.wait(contract.proveInvalidTransaction(proof.encodePacked(), {
            ...overrides,
        }), 'submit fraud transaction', errors);

        if (!fraudTx) {
            t.ok(0, 'likely reverted, invalid');
            return;
        }

        if (!fraudTx.events.length) {
            console.log(fraudTx);
            t.ok(0, 'no events ' + opts.fraud);
            return;
        }

        t.equalBig(await contract.blockTip(), 1, 'tip');
        t.ok(fraudTx.events[0].args.fraudCode.gt(1),
            'fraud code detected: ' + fraudTx.events[0].args.fraudCode);
        if (opts.fraud) {
            t.equalBig(fraudTx.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
        }
        return;
    }

    // Generate FF number values at specific bytelengths.
    function ff(len = 0) {
        return '0x' + (new Array(len)).fill(0).map(() => 'ff').join('');
    }

    // A fill tx.
    const fill = protocol.root.Leaf({
        data: utils.hexlify(utils.randomBytes(124)),
    });

    // Using all FF's.
    await state({
        tx: protocol.root.Leaf({
            data: ff(42),
        }),
    });
    

    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 3,
                    outputIndex: 2,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 2,
                    outputIndex: 7,
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 20,
                    outputIndex: 1,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 100,
                    outputIndex: 3,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }), // <-- invalid metadata length not inputs
            ],
            data: [
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32), // <-- max num
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    witnessReference: 3,
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 2,
                    preImage: ff(32), // <-- max num
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 3,
                }),
                protocol.inputs.InputRoot({
                    witnessReference: 0,
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 0,
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 3,
                    preImage: utils.emptyBytes32, // <-- min bound
                }),
                protocol.inputs.InputDeposit({
                    witnessReference: 3,
                    ...deposit.object(),
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 1,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    owner: ff(20), // <-- max value
                    amount: ff(32), // <-- max value
                    token: '0x00',
                    noshift: true,
                }),
            ],
            witnesses: [
                t.wallets[0],
                { _producer: true },
                { _caller: true },
                { _producer: true },
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        fraud: 'metadata-inputs',
    });

    async function lastItem(opts = {}) {
        await state({
            fillTxs: [ fill ],
            makeTx: ({
                contract,
                deposit,
            }) => protocol.transaction.Transaction({
                override: true,
                metadata: [
                    protocol.metadata.MetadataDeposit({
                        ...deposit.object(),
                    }),
                    protocol.metadata.Metadata({
                        blockHeight: 1,
                        rootIndex: 0,
                        transactionIndex: 3,
                        outputIndex: 2,
                    }),
                    protocol.metadata.Metadata({
                        blockHeight: 1,
                        rootIndex: 0,
                        transactionIndex: 2,
                        outputIndex: 7,
                    }),
                    protocol.metadata.Metadata({ // root
                        blockHeight: 1,
                        rootIndex: 0,
                        transactionIndex: 0,
                        outputIndex: 0,
                    }),
                    protocol.metadata.Metadata({
                        blockHeight: 1,
                        rootIndex: 0,
                        transactionIndex: 20,
                        outputIndex: 1,
                    }),
                    protocol.metadata.Metadata({
                        blockHeight: 1,
                        rootIndex: 0,
                        transactionIndex: 100,
                        outputIndex: 3,
                    }),
                    protocol.metadata.MetadataDeposit({
                        ...deposit.object(),
                    }),
                    ...(opts.lastMetadata ? [
                        opts.lastMetadata
                    ] : []),
                ],
                data: [
                    ff(32),
                    ff(32),
                    ff(32),
                    ff(32),
                    ff(32),
                    ff(32),
                    ff(32),
                    ff(32), // <-- max num
                ],
                inputs: [
                    protocol.inputs.InputDeposit({
                        witnessReference: 2,
                        ...deposit.object(),
                    }),
                    protocol.inputs.InputHTLC({
                        witnessReference: 1,
                        preImage: ff(32), // <-- max num
                    }),
                    protocol.inputs.InputTransfer({
                        witnessReference: 2,
                    }),
                    protocol.inputs.InputRoot({
                        witnessReference: 0,
                    }),
                    protocol.inputs.InputTransfer({
                        witnessReference: 0,
                    }),
                    protocol.inputs.InputHTLC({
                        witnessReference: 2,
                        preImage: utils.emptyBytes32, // <-- min bound
                    }),
                    protocol.inputs.InputDeposit({
                        witnessReference: 2,
                        ...deposit.object(),
                    }),
                    ...(opts.lastInput ? [
                        opts.lastInput
                    ] : []),
                ],
                outputs: [
                    protocol.outputs.OutputTransfer({
                        owner: ff(20), // <-- max value
                        amount: ff(32), // <-- max value
                        token: '0x00',
                        noshift: true,
                    }),
                    protocol.outputs.OutputHTLC({
                        owner: ff(20), // <-- max with shift
                        amount: ff(32),
                        token: '0x01',
                        digest: ff(32),
                        returnOwner: ff(20),
                    }),
                    protocol.outputs.OutputReturn({
                        data: '0xaa',
                    }),
                    protocol.outputs.OutputReturn({
                        data: '0xaa',
                    }),
                    protocol.outputs.OutputTransfer({
                        owner: t.wallets[1].address,
                        amount: '0x01',
                        token: '0x01',
                    }),
                    protocol.outputs.OutputHTLC({
                        owner: '0x00',
                        amount: '0x00',
                        token: '0x00',
                        returnOwner: t.wallets[3].address,
                    }),
                    protocol.outputs.OutputReturn({
                        data: '0xaa',
                    }),
                    ...(opts.lastOutput ? [
                        opts.lastOutput
                    ] : []),
                ],
                witnesses: [
                    t.wallets[0],
                    { _producer: true },
                    { _caller: true },
                ],
                contract,
                chainId: 1,
            }),
            proof: {
                transactionIndex: 1,
            },
            ...opts,
        });
    }

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(2), // <-- invalid
            token: '0x01',
            shift: 248,
            noPack: true,
        }),
        fraud: 'outputs-amount-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(32), // <-- invalid
            token: '0x01',
            shift: 248, // <-- invalid
            noPack: true,
        }),
        fraud: 'outputs-amount-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(10),
            token: '0x01',
            shift: 80,
            noPack: true,
        }),
        valid: 'shift is fine',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(32),
            token: '0x01',
            shift: 0,
            noPack: true,
        }),
        valid: 'valid shift full 32',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(1),
            token: '0x01',
            shift: 248,
            noPack: true,
        }),
        valid: 'valid shift full 32',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(16),
            token: '0x01',
            shift: 128,
            noPack: true,
        }),
        valid: 'valid shift full 32',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(30),
            token: '0x01',
            shift: 16,
            noPack: true,
        }),
        valid: 'valid shift full 32',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: '0x00',
            token: '0x00',
            shift: 255, // <-- invalid
            noPack: true,
        }),
        fraud: 'output-shift-mod',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: '0x00',
            token: '0x00',
            shift: 8,
            noPack: true,
        }),
        valid: 'valid mod',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: '0x00',
            token: '0x00',
            shift: 7, // <-- invalid
            noPack: true,
        }),
        fraud: 'output-shift-mod',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: '0x00',
            token: '0x00',
            noPack: true,
        }),
        valid: 'no problem here',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: '0x00',
            token: ff(255), // <-- this is an invalid
            noPack: true,
        }),
        fraud: 'outputs-token-length-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: '0x00',
            amount: ff(255), // <-- this is an invalid
            token: '0x00',
            noPack: true,
        }),
        fraud: 'outputs-amount-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: ff(255), // <-- this is an invalid
            amount: ff(255), // <-- this is an invalid
            token: ff(255), // <-- this is an invalid
            noPack: true,
        }),
        fraud: 'outputs-size-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: ff(255), // <-- this is an invalid
            amount: '0x00',
            token: '0x00',
        }),
        fraud: 'outputs-owner-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: ff(21), // <-- this is an invalid
            amount: '0x00',
            token: '0x00',
        }),
        fraud: 'outputs-owner-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputWithdraw({
            owner: utils.emptyBytes32, // <-- this is an invalid
            amount: '0x00',
            token: '0x00',
        }),
        fraud: 'outputs-owner-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: '0x00',
            amount: '0x00',
            token: '0x00',
            noPack: true,
        }),
        valid: 'no problem here',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: '0x00',
            amount: '0x00',
            token: ff(5), // <-- this is an invalid
            noPack: true,
        }),
        fraud: 'outputs-token-length-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: '0x00',
            amount: '0x00',
            token: ff(255), // <-- this is an invalid
            noPack: true,
        }),
        fraud: 'outputs-token-length-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: '0x00',
            amount: ff(255), // <-- this is an invalid
            token: '0x00',
            noPack: true,
        }),
        fraud: 'outputs-amount-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: ff(255), // <-- this is an invalid
            amount: ff(255),
            token: ff(255),
            noPack: true,
        }),
        fraud: 'outputs-size-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: ff(255), // <-- this is an invalid
            amount: '0x00',
            token: '0x00',
        }),
        fraud: 'outputs-owner-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: ff(21), // <-- this is an invalid
            amount: '0x00',
            token: '0x00',
        }),
        fraud: 'outputs-owner-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputTransfer({
            owner: utils.emptyBytes32, // <-- this is an invalid
            amount: '0x00',
            token: '0x00',
        }),
        fraud: 'outputs-owner-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputHTLC({
            owner: '0x00',
            amount: '', // <-- this is an invalid
            token: '0x00',
            returnOwner: '0x00',
            noPack: true,
        }),
        fraud: 'outputs-amount-underflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputHTLC({
            owner: '0x00',
            amount: '0x00',
            token: '0x02',
            returnOwner: '0x00',
        }),
        fraud: 'outputs-token-id-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputHTLC({
            owner: '0x00',
            amount: '0x00',
            token: '0x02', // <-- this is an invalid
            returnOwner: '0x00',
        }),
        fraud: 'outputs-token-id-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputHTLC({
            owner: '0x02', // <-- this is an overflow
            amount: '0x00',
            token: '0x00',
            returnOwner: '0x00',
        }),
        fraud: 'outputs-owner-id-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputHTLC({
            owner: '0x00',
            amount: '0x00',
            token: '0x00',
            returnOwner: '0x02', // <-- this is an overflow
        }),
        fraud: 'outputs-return-owner-id-overflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputHTLC({
            owner: '', // <-- this is invalid
            amount: '0x00',
            token: '0x00',
            returnOwner: '0x00',
        }),
        fraud: 'outputs-owner-underflow',
    });

    await lastItem({
        lastOutput: protocol.outputs.OutputHTLC({
            owner: '0x00',
            amount: '0x00',
            token: '0x00',
            returnOwner: '', // <-- this is invalid
        }),
        fraud: 'outputs-return-owner-underflow',
    });

    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 3,
                    outputIndex: 2,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 2,
                    outputIndex: 7,
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 20,
                    outputIndex: 1,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 100,
                    outputIndex: 3,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 127, // <-- max bound
                    transactionIndex: 2023, // <-- max bound
                    outputIndex: 7, // <-- max bound
                }),
            ],
            data: [
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32), // <-- max num
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    witnessReference: 3,
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 2,
                    preImage: ff(32), // <-- max num
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 3,
                }),
                protocol.inputs.InputRoot({
                    witnessReference: 0,
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 0,
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 3,
                    preImage: utils.emptyBytes32, // <-- min bound
                }),
                protocol.inputs.InputDeposit({
                    witnessReference: 3,
                    ...deposit.object(),
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 1,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    owner: ff(20), // <-- max value
                    amount: ff(32), // <-- max value
                    token: '0x00',
                    noshift: true,
                }),
                protocol.outputs.OutputHTLC({
                    owner: ff(20), // <-- max with shift
                    amount: ff(32),
                    token: '0x01',
                    digest: ff(32),
                    returnOwner: ff(20),
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputWithdraw({
                    owner: ff(20),
                    amount: ff(32),
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x01',
                    token: '0x01',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x00',
                    returnOwner: t.wallets[3].address,
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x04', // <-- this is invalid
                }),
            ],
            witnesses: [
                t.wallets[0],
                { _producer: true },
                { _caller: true },
                { _producer: true },
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        fraud: 'outputs-token-id-overflow',
    });

    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 3,
                    outputIndex: 2,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 2,
                    outputIndex: 7,
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 20,
                    outputIndex: 1,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 100,
                    outputIndex: 3,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 127, // <-- max bound
                    transactionIndex: 2023, // <-- max bound
                    outputIndex: 7, // <-- max bound
                }),
            ],
            data: [
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32),
                ff(32), // <-- max num
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    witnessReference: 3,
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 2,
                    preImage: ff(32), // <-- max num
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 3,
                }),
                protocol.inputs.InputRoot({
                    witnessReference: 0,
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 0,
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 3,
                    preImage: utils.emptyBytes32, // <-- min bound
                }),
                protocol.inputs.InputDeposit({
                    witnessReference: 3,
                    ...deposit.object(),
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 1,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    owner: ff(20), // <-- max value
                    amount: ff(32), // <-- max value
                    token: '0x00',
                    noshift: true,
                }),
                protocol.outputs.OutputHTLC({
                    owner: ff(20), // <-- max with shift
                    amount: ff(32),
                    token: '0x01',
                    digest: ff(32),
                    returnOwner: ff(20),
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputWithdraw({
                    owner: ff(20),
                    amount: ff(32),
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x01',
                    token: '0x01',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x00',
                    returnOwner: t.wallets[3].address,
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
            ],
            witnesses: [
                t.wallets[0],
                { _producer: true },
                { _caller: true },
                { _producer: true },
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        valid: 'bounds check',
    });

    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 3,
                    outputIndex: 2,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 2,
                    outputIndex: 7,
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 20,
                    outputIndex: 1,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 100,
                    outputIndex: 3,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    witnessReference: 6,
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 2,
                    preImage: utils.sha256('0xaa'),
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 3,
                }),
                protocol.inputs.InputRoot({
                    witnessReference: 0,
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 0,
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 6,
                    preImage: utils.emptyBytes32,
                }),
                protocol.inputs.InputDeposit({
                    witnessReference: 5,
                    ...deposit.object(),
                }),
                protocol.inputs.InputRoot({
                    witnessReference: 1,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[2].address,
                    amount: '0x01',
                    token: '0x00',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                    returnOwner: '0x00',
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputWithdraw({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x01',
                    token: '0x01',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x00',
                    returnOwner: t.wallets[3].address,
                }),
                protocol.outputs.OutputReturn({
                    data: '0xbbbb',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
            ],
            witnesses: [
                t.wallets[0],
                { _producer: true },
                t.wallets[1],
                { _caller: true },
                t.wallets[0],
                { _producer: true },
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        valid: 'transfer outputs 8 - mix inputs 8',
    });

    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 3,
                    outputIndex: 2,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 2,
                    outputIndex: 7,
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 20,
                    outputIndex: 1,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 100,
                    outputIndex: 3,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({ // root
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    witnessReference: 6,
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 2,
                    preImage: utils.sha256('0xaa'),
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 3,
                }),
                protocol.inputs.InputRoot({
                    witnessReference: 0,
                }),
                protocol.inputs.InputTransfer({
                    witnessReference: 0,
                }),
                protocol.inputs.InputHTLC({
                    witnessReference: 6,
                    preImage: utils.emptyBytes32,
                }),
                protocol.inputs.InputDeposit({
                    witnessReference: 5,
                    ...deposit.object(),
                }),
                protocol.inputs.InputRoot({
                    witnessReference: 1,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[2].address,
                    amount: '0x01',
                    token: '0x00',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                    returnOwner: '0x00',
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputWithdraw({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: t.wallets[1].address,
                    amount: '0x01',
                    token: '0x01',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x00',
                    returnOwner: t.wallets[3].address,
                }),
                protocol.outputs.OutputReturn({
                    data: '0xbbbb',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
            ],
            witnesses: [
                t.wallets[0],
                { _producer: true },
                t.wallets[1],
                { _caller: true },
                t.wallets[0],
                { _producer: true },
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        valid: 'transfer outputs 8 - mix inputs 8',
    });

    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                }),
                protocol.inputs.InputTransfer({
                }),
                protocol.inputs.InputRoot({
                }),
                protocol.inputs.InputTransfer({
                }),
                protocol.inputs.InputHTLC({
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputRoot({
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x01',
                    token: '0x00',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                    returnOwner: '0x00',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputWithdraw({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x01',
                    token: '0x01',
                }),
                protocol.outputs.OutputHTLC({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x00',
                    returnOwner: '0x00',
                }),
                protocol.outputs.OutputReturn({
                    data: '0x00',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
            ],
            witnesses: [
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        valid: 'transfer outputs 8 - mix inputs 8',
    });
    
    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                }),
                protocol.inputs.InputTransfer({
                }),
                protocol.inputs.InputRoot({
                }),
                protocol.inputs.InputTransfer({
                }),
                protocol.inputs.InputHTLC({
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputRoot({
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
                protocol.outputs.OutputTransfer({
                    owner: '0x00',
                    amount: '0x00',
                    token: '0x01',
                }),
            ],
            witnesses: [
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        valid: 'transfer outputs 8 - mix inputs 8',
    });

    await state({
        fillTxs: [ fill ],
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.Metadata({
                    blockHeight: 1,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputHTLC({
                }),
                protocol.inputs.InputTransfer({
                }),
                protocol.inputs.InputRoot({
                }),
                protocol.inputs.InputTransfer({
                }),
                protocol.inputs.InputHTLC({
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputRoot({
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        proof: {
            transactionIndex: 1,
        },
        valid: 'inputs mix 8',
    });

    // Valid.
    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [  
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx one deposit',
    });

    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx one deposit',
    });

    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx one deposit',
    });


    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                { _caller: true },
                { _caller: true },
                { _caller: true },
                { _caller: true },
                { _caller: true },
                { _caller: true },
                { _caller: true },
                { _caller: true },
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx 8 caller',
    });


    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                t.wallets[0],
                t.wallets[0],
                t.wallets[0],
                t.wallets[0],
                t.wallets[0],
                t.wallets[0],
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx 6 signature witnesses',
    });

    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                { _producer: true },
                { _producer: true },
                { _producer: true },
                { _producer: true },
                { _producer: true },
                { _producer: true },
                { _producer: true },
                { _producer: true },
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx 8 producer',
    });

    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                { _producer: true },
                t.wallets[0],
                { _caller: true },
                t.wallets[1],
                { _caller: true },
                t.wallets[2],
                { _producer: true },
                t.wallets[3],
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx 8 witness mix',
    });



    await state({
        makeTx: ({
            contract,
            deposit,
        }) => protocol.transaction.Transaction({
            override: true,
            metadata: [
                protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }),
            ],
            data: [
                utils.keccak256('0xaa'),
            ],
            inputs: [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputReturn({
                    data: '0xaa',
                }),
            ],
            witnesses: [
                { _producer: true },
                t.wallets[0],
                { _caller: true },
                t.wallets[1],
                { _caller: true },
                t.wallets[2],
                { _producer: true },
                t.wallets[3],
            ],
            contract,
            chainId: 1,
        }),
        valid: 'normal tx 8 witness mix',
    });

    await state({
        tx: protocol.root.Leaf({
            data: ff(120),
        }),
    });

    await state({
        tx: protocol.root.Leaf({
            data: ff(500),
        }),
    });

    await state({
        tx: protocol.root.Leaf({
            data: ff(894),
        }),
    });

    await state({
        tx: protocol.root.Leaf({
            data: ff(896),
        }),
    });

    // Using all zeros.
    await state({
        tx: protocol.root.Leaf({
            data: utils.hexZeroPad('0x00', 120),
        }),
    });

    // Smallest
    await state({
        tx: protocol.root.Leaf({
            data: utils.hexZeroPad('0x00', 42),
        }),
    });

    // Largest
    await state({
        tx: protocol.root.Leaf({
            data: utils.hexZeroPad('0x00', 894),
        }),
    });

    // Overflow.
    await state({
        tx: protocol.root.Leaf({
            data: utils.hexZeroPad('0x00', 899),
        }),
    });

    // Fuzz the InvalidTransaction function using random data.
    for (var i = 0; i < 100; i++) {
        await state({
            tx: protocol.root.Leaf({ data: utils.hexlify(utils.randomBytes(124)) }),
        });
    }

});
