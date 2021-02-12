const { test, utils, overrides } = require('@fuel-js/environment');
const { combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const { BlockHeader, RootHeader,
    merkleTreeRoot } = require('@fuel-js/protocol2/src/block');
const tx = require('@fuel-js/protocol2/src/transaction');
const protocol = require('@fuel-js/protocol2/src');
const { defaults } = require('../utils/harness');
const TransactionProof = require('../utils/transactionProof');

module.exports = test('DoubleSpend_fuzz', async t => {

    // Producer.
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

    // Total supply.
    const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
    const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

    // Token stuff.
    let token = erc20.address;
    let tokenId = '0x01';
    let numTokens = 2;

    // Try a fuel deposit with ERC20.
    const funnel = await contract.funnel(producer);
    const depositValue = utils.bigNumberify(1000);

    // Do ERC20 z.
    await t.wait(erc20.transfer(funnel, depositValue, overrides), 'erc20 transfer');

    // Sign with Funnel.
    const deposit = new protocol.deposit.Deposit({
        token: tokenId,
        owner: producer,
        blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
        value: depositValue,
    });
    await t.wait(
        contract.deposit(producer, token, overrides),
        'token deposit',
        errors,
    );

    async function produceBlock(txs = [], fee = 0, feeToken = 0, opts = {}) {
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
            combine(txs), overrides),
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
        const rootTransactionProof = TransactionProof({
            block: header,
            root: root,
            transactions: txs,
            inputOutputIndex: opts.inputOutputIndex || 0, // set to zero.
            transactionIndex: 0, // set to zero.
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

    async function state(opts = {}) {
        // Produce 8 blocks for 8 roots to spend.
        const block1 = await produceBlock(
            [await tx.Transaction({
                inputs: [ tx.InputDeposit({
                  witnessReference: 0,
                  owner: producer,
                }) ],
                metadata: [ tx.MetadataDeposit( deposit.object() ) ],
                witnesses: [ t.wallets[0] ],
                data: [ deposit ],
                outputs: [ tx.OutputTransfer({
                  amount: 100,
                  token: tokenId,
                  owner: producer,
                }), tx.OutputWithdraw({
                  amount: 500,
                  token: tokenId,
                  owner: producer,
                }), tx.OutputReturn({
                  data: ['0xaa'],
                }), tx.OutputHTLC({
                  amount: 100,
                  token: tokenId,
                  owner: producer,
                  expiry: 100000,
                  digest: utils.sha256(opts.preImage || utils.emptyBytes32),
                  returnOwner: producer,
                }) ],
                contract,
                chainId: 1,
                ...(opts.proofA || {}),
              })],
            34000,
            0,
            {
                ...(opts.proofA || {}),
            }
        );

        const block2 = await produceBlock(
            [await tx.Transaction({
                inputs: [ tx.InputDeposit({
                  witnessReference: 0,
                  owner: producer,
                }) ],
                metadata: [ tx.MetadataDeposit( deposit.object() ) ],
                witnesses: [ t.wallets[0] ],
                data: [ deposit ],
                outputs: [ tx.OutputTransfer({
                  amount: 100,
                  token: tokenId,
                  owner: producer,
                }), tx.OutputWithdraw({
                  amount: 500,
                  token: tokenId,
                  owner: producer,
                }), tx.OutputReturn({
                  data: ['0xaa'],
                }), tx.OutputHTLC({
                  amount: 100,
                  token: tokenId,
                  owner: producer,
                  expiry: 100000,
                  digest: utils.sha256(opts.preImage || utils.emptyBytes32),
                  returnOwner: producer,
                }) ],
                contract,
                chainId: 1,
                ...(opts.proofB || {}),
              })],
            utils.parseEther('0.00001'),
            0,
            {
                ...(opts.proofB || {}),
            }
        );

        // Tip.
        const tip = await contract.blockTip();

        // Arguments.
        const args = [
            block1.proof.encodePacked(),
            block2.proof.encodePacked(),
        ];

        // Generate the fraud hash
        const fraudHash = utils.keccak256(
            contract.interface.functions.proveDoubleSpend.encode(args),
        );

        // Commit the fraud hash.
        await t.wait(contract.commitFraudHash(fraudHash, {
            ...overrides,
        }), 'commit fraud hash', errors);

        // Wait 10 blocks for fraud finalization.
        await t.increaseBlock(10);

        // Revert.
        if (opts.revert) {
            await t.revert(contract.proveDoubleSpend(...args, {
                ...overrides,
            }), errors[opts.revert], opts.revert, errors);
            t.equalBig(await contract.blockTip(), tip, 'tip');
            return;
        }

        // Fraud.
        if (opts.fraud) {
            const fraudTx = await t.wait(contract.proveDoubleSpend(...args, {
                ...overrides,
            }), 'invalid input', errors);
            t.equal(fraudTx.logs.length, 1, 'logs detected');
            t.equalBig(fraudTx.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
            t.equalBig(await contract.blockTip(), tip.sub(1), 'tip');
            return;
        }

        // Prove invalid input.
        const validTx = await t.wait(contract.proveDoubleSpend(...args, {
            ...overrides,
        }), opts.valid || 'valid', errors);
        t.equalBig(await contract.blockTip(), tip, 'tip');

        if (!validTx) {
            t.ok(0, 'not ok');
            return;
        }

        if (validTx.logs.length) {
            console.log(validTx.logs);
        }
    }

    async function lastItem(opts = {}) {
        await state({
            proofA: {
                override: true,
                inputOutputIndex: 7, // <-- this is double spend
                inputs: [
                    tx.InputHTLC({
                        witnessReference: 0,
                        preImage: utils.emptyBytes32,
                    }),
                    tx.InputTransfer({
                        witnessReference: 3,
                    }),
                    tx.InputRoot({
                        witnessReference: 1,
                    }),
                    tx.InputTransfer({
                        witnessReference: 0,
                    }),
                    tx.InputTransfer({
                        witnessReference: 3,
                    }),
                    tx.InputRoot({
                        witnessReference: 7,
                    }),
                    tx.InputTransfer({
                        witnessReference: 1,
                    }),
                    opts.proofA.lastInput,
                ],
                metadata: [
                    tx.Metadata({
                        blockHeight: 2,
                        transactionIndex: 1,
                        rootIndex: 3,
                        outputIndex: 4,
                    }),
                    tx.Metadata({
                        blockHeight: 1,
                        transactionIndex: 1,
                        rootIndex: 3,
                        outputIndex: 4,
                    }),
                    tx.Metadata({
                        blockHeight: 2,
                        transactionIndex: 0,
                        rootIndex: 12,
                        outputIndex: 3,
                    }),
                    tx.Metadata({
                        blockHeight: 3,
                        transactionIndex: 0,
                        rootIndex: 0,
                        outputIndex: 0,
                    }),
                    tx.Metadata({
                        blockHeight: 4,
                        transactionIndex: 0,
                        rootIndex: 120,
                        outputIndex: 7,
                    }),
                    tx.Metadata({
                        blockHeight: 5,
                        transactionIndex: 0,
                        rootIndex: 127,
                        outputIndex: 2,
                    }),
                    tx.Metadata({
                        blockHeight: 6,
                        transactionIndex: 267,
                        rootIndex: 3,
                        outputIndex: 0,
                    }),
                    opts.proofA.lastMetadata,
                ],
            },
            proofB: {
                override: true,
                inputOutputIndex: 7, // <-- this is double spend
                inputs: [
                    tx.InputHTLC({
                        witnessReference: 0,
                        preImage: utils.emptyBytes32,
                    }),
                    tx.InputTransfer({
                        witnessReference: 3,
                    }),
                    tx.InputRoot({
                        witnessReference: 1,
                    }),
                    tx.InputTransfer({
                        witnessReference: 0,
                    }),
                    tx.InputHTLC({
                        witnessReference: 0,
                        preImage: utils.hexlify(utils.keccak256('0xaa')),
                    }),
                    tx.InputRoot({
                        witnessReference: 7,
                    }),
                    tx.InputTransfer({
                        witnessReference: 1,
                    }),
                    opts.proofB.lastInput,
                ],
                metadata: [
                    tx.Metadata({
                        blockHeight: 2,
                        transactionIndex: 1,
                        rootIndex: 3,
                        outputIndex: 4,
                    }),
                    tx.Metadata({
                        blockHeight: 1,
                        transactionIndex: 1,
                        rootIndex: 3,
                        outputIndex: 4,
                    }),
                    tx.Metadata({
                        blockHeight: 2,
                        transactionIndex: 0,
                        rootIndex: 12,
                        outputIndex: 3,
                    }),
                    tx.Metadata({
                        blockHeight: 3,
                        transactionIndex: 0,
                        rootIndex: 0,
                        outputIndex: 0,
                    }),
                    tx.Metadata({
                        blockHeight: 4,
                        transactionIndex: 0,
                        rootIndex: 120,
                        outputIndex: 7,
                    }),
                    tx.Metadata({
                        blockHeight: 5,
                        transactionIndex: 0,
                        rootIndex: 127,
                        outputIndex: 2,
                    }),
                    tx.Metadata({
                        blockHeight: 6,
                        transactionIndex: 267,
                        rootIndex: 3,
                        outputIndex: 0,
                    }),
                    opts.proofB.lastMetadata,
                ],
            },
            ...(opts.state || {}),
        });
    }

    await state({
        proofA: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: utils.emptyAddress,
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        proofB: {
            inputOutputIndex: 8, // <-- overflow selection, invalid
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: utils.emptyAddress,
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        revert: 'index-overflow',
    });

    await state({
        proofA: {
            inputOutputIndex: 1, // <-- overflow selection, invalid
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: utils.emptyAddress,
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        proofB: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: utils.emptyAddress,
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        revert: 'input-position-overflow',
    });

    await lastItem({
        proofA: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: producer,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38276, // <-- this makes it valid
                token: 367,
            }),
        },
        proofB: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: producer,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38277,
                token: 367,
            }),
        },
        state: {
            name: 'valid deposit item'
        },
    });

    await lastItem({
        proofA: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: producer,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38277,
                token: 367,
            }),
        },
        proofB: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: producer,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38277,
                token: 367, // <-- this is invalid
            }),
        },
        state: {
            fraud: 'double-spend',
            name: 'invalid deposit last item'
        },
    });

    await lastItem({
        proofA: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: utils.emptyAddress,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38277,
                token: 367,
            }),
        },
        proofB: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: utils.emptyAddress,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38277,
                token: 367, // <-- this is invalid
            }),
        },
        state: {
            fraud: 'double-spend',
        },
    });

    await lastItem({
        proofA: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: utils.emptyAddress,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38277,
                token: 367,
            }),
        },
        proofB: {
            lastInput: tx.InputDeposit({
                witnessReference: 3,
                owner: utils.emptyAddress,
            }),
            lastMetadata: tx.MetadataDeposit({
                blockNumber: 38277,
                token: 368,
            }),
        },
        state: {
            valid: 'last item correct deposit',
        },
    });

    await lastItem({
        proofA: {
            lastInput: tx.Input({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 38278,
                transactionIndex: 367,
                rootIndex: 127,
                outputIndex: 7,
            }),
        },
        proofB: {
            lastInput: tx.Input({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 38277, // <-- makes this valid
                transactionIndex: 367,
                rootIndex: 127,
                outputIndex: 7,
            }),
        },
        state: {
            valid: 'last item correct',
        },
    });

    await lastItem({
        proofA: {
            lastInput: tx.Input({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 38278,
                transactionIndex: 367,
                rootIndex: 127,
                outputIndex: 7,
            }),
        },
        proofB: {
            lastInput: tx.Input({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 38278,
                transactionIndex: 367,
                rootIndex: 127,
                outputIndex: 7,
            }),
        },
        state: {
            fraud: 'double-spend',
            name: 'last double spend',
        },
    });

    await lastItem({
        proofA: {
            lastInput: tx.InputHTLC({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 0,
                transactionIndex: 0,
                rootIndex: 0,
                outputIndex: 0,
            }),
        },
        proofB: {
            lastInput: tx.InputHTLC({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 0,
                transactionIndex: 0,
                rootIndex: 0,
                outputIndex: 0,
            }),
        },
        state: {
            fraud: 'double-spend',
            name: 'last double spend',
        },
    });

    await lastItem({
        proofA: {
            lastInput: tx.InputHTLC({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 0,
                transactionIndex: 0,
                rootIndex: 0,
                outputIndex: 0,
            }),
        },
        proofB: {
            lastInput: tx.InputHTLC({
                witnessReference: 0,
            }),
            lastMetadata: tx.Metadata({
                blockHeight: 0,
                transactionIndex: 0,
                rootIndex: 0,
                outputIndex: 1,
            }),
        },
        state: {
            valid: 'all invalid except last itemss',
        },
    });

    await state({
        proofA: {
            inputOutputIndex: 0, // <-- this is double spend
            inputs: [
                tx.InputHTLC({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        proofB: {
            inputOutputIndex: 0, // <-- this is double spend
            inputs: [
                tx.InputHTLC({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        fraud: 'double-spend',
        name: 'htlc double spend',
    });

    await state({
        proofA: {
            inputOutputIndex: 0, // <-- this is double spend
            inputs: [
                tx.InputRoot({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        proofB: {
            inputOutputIndex: 0, // <-- this is double spend
            inputs: [
                tx.InputRoot({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        fraud: 'double-spend',
        name: 'root double spend',
    });

    await state({
        proofA: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputRoot({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        proofB: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputRoot({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 1, // <-- makes valid
                    outputIndex: 0,
                }),
            ],
        },
        valid: 'not double spend root',
    });
    
    await state({
        proofA: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputHTLC({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        proofB: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputHTLC({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 1, // <-- makes valid
                    outputIndex: 0,
                }),
            ],
        },
        valid: 'not double spend htlc',
    });

    await state({
        proofA: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: producer,
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        proofB: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: utils.emptyAddress, // <-- makes it valid
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        valid: 'not double spend',
    });

    await state({
        proofA: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputTransfer({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        proofB: {
            inputOutputIndex: 0,
            inputs: [
                tx.InputTransfer({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 1, // <-- makes valid
                    outputIndex: 0,
                }),
            ],
        },
        valid: 'not double spend',
    });

    await state({
        proofA: {
            inputOutputIndex: 0, // <-- double spend
            inputs: [
                tx.InputTransfer({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        proofB: {
            inputOutputIndex: 0, // <-- double spend
            inputs: [
                tx.InputTransfer({
                    witnessReference: 0,
                }),
            ],
            metadata: [
                tx.Metadata({
                    blockHeight: 0,
                    transactionIndex: 0,
                    rootIndex: 0,
                    outputIndex: 0,
                }),
            ],
        },
        fraud: 'double-spend',
    });

    await state({
        proofA: {
            inputOutputIndex: 0, // <-- double spend
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: producer,
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        proofB: {
            inputOutputIndex: 0, // <-- double spend
            inputs: [
                tx.InputDeposit({
                    witnessReference: 0,
                    owner: producer,
                }),
            ],
            metadata: [
                tx.MetadataDeposit(
                    deposit.object(),
                ),
            ],
        },
        fraud: 'double-spend',
    });

});
