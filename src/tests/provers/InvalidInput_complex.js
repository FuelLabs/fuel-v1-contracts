/// @dev This will check all inputs can leave as withdrawal outputs (bonds and coins).
// make a two deposits (different tokens)
// make a block 1 tx (with 2 withdrawals one for each coin)
// make a second block with root fees as input, do withdrawal for that
// wait finalization
// get block bond back
// get withdrawal back for both coins
// get root fees withdrawal back
// check all parties balances on L1 chain
const { test, utils, overrides } = require('@fuel-js/environment');
const { combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const { BlockHeader, RootHeader,
    merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const protocol = require('@fuel-js/protocol');
const TransactionProof = require('../utils/transactionProof');
const DSTokenAbi = require('../utils/dstoken.abi.json');
const DSBytecode = require('../utils/dstoken.bytecode.js');
const DSToken = { abi: DSTokenAbi, bytecode: DSBytecode };

/// @dev Test various complex summing cases with different witness, input, output and metadata configurations.
module.exports = test('InvalidInput_complex', async t => {

    // Producer.
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, [
        producer,
        200,
        200,
        20,
        utils.parseEther('1.0'),
        "Fuel",
        "1.1.0",
        1,
        utils.emptyBytes32
    ]);

    // Total supply.
    const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
    const erc20 = await t.deploy(DSToken.abi, DSToken.bytecode, [utils.emptyBytes32]);

    const mintTx = await erc20.mint(producer, totalSupply, overrides);
    await mintTx.wait();

    // Token stuff.
    let token = erc20.address;
    let tokenId = '0x01';
    let numTokens = 2;

    // Try a fuel deposit with ERC20.
    const funnel = await contract.funnel(producer);
    const depositValue = utils.bigNumberify(1000);

    // Do ERC20.
    await t.wait(erc20.transfer(funnel, depositValue, overrides), 'erc20 transfer');

    // Sign with Funnel.
    const deposit = new protocol.deposit.Deposit({
        token: tokenId,
        owner: producer,
        blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
        value: depositValue,
    });

    // Do ERC20.
    t.equalBig(await erc20.balanceOf(contract.address), 0, 'no balance of erc20 in contract');

    t.equalBig(await t.getProvider().getBalance(contract.address), 0, 'no ether pre deposit');

    await t.wait(
        contract.deposit(producer, token, overrides),
        'token deposit',
        errors,
    );

    t.equalBig(await t.getProvider().getBalance(contract.address), 0, 'no ether post deposit');
    t.equalBig(await erc20.balanceOf(contract.address), depositValue, 'no balance of erc20 in contract');

    // Commit two addresses.
    const commitA = await contract.commitAddress(producer, overrides); // will now be address 1
    await commitA.wait();

    const commitB = await contract.commitAddress(t.wallets[3].address, overrides); // will now be address 2
    await commitB.wait();

    // Producer Funnel.
    const producerFunnel = await contract.funnel(producer);

    const commitC = await contract.commitAddress(producerFunnel, overrides); // will now be address 3
    await commitC.wait();

    /// Produce a block.
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
            numAddresses: 4,
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
            data: opts.data || null,
            inputOutputIndex: opts.inputOutputIndex || 0, // set to zero.
            transactionIndex: opts.transactionIndex || 0, // set to zero.
            signatureFee: opts.signatureFee || fee,
            signatureFeeToken: opts.signatureFeeToken || feeToken,
            token: opts.addressA ? opts.addressA : (opts.utxo ? opts.utxo.object().owner : 0),
            selector: opts.addressB ?  opts.addressB : (opts.utxo ? opts.utxo.object().returnOwner : 0),
            inputProofs: opts.inputProofs || [],
        });

        // Add this property
        rootTransactionProof.root = root;
        rootTransactionProof.metadata = {
            blockHeight: tip,
            rootIndex: 0,
            transactionIndex: 0,
            rootIndex: 0,
        };

        // Return Block, Tip, Root, Proof, Txs.
        return {
            height: tip,
            block: header,
            root: root,
            proof: rootTransactionProof,
            rootTransactionProof,
            txs,
            feeToken,
            metadata: rootTransactionProof.metadata,
            amount: root.properties.rootLength().get().mul(fee),
            produceProof: (overrideOpts = {}) => {
                return TransactionProof({
                    block: header,
                    root: root,
                    transactions: txs,
                    data: opts.data || null,
                    inputOutputIndex: opts.inputOutputIndex || 0, // set to zero.
                    transactionIndex: overrideOpts.transactionIndex || opts.transactionIndex || 0, // set to zero.
                    signatureFee: opts.signatureFee || fee,
                    signatureFeeToken: opts.signatureFeeToken || feeToken,
                    token: opts.addressA ? opts.addressA : (opts.utxo ? opts.utxo.object().owner : 0),
                    selector: opts.addressB ?  opts.addressB : (opts.utxo ? opts.utxo.object().returnOwner : 0),
                    inputProofs: opts.inputProofs || [],
                });
            },
        };
    }

    t.equalBig(await t.getProvider().getBalance(contract.address), 0, 'no ether pre block 1');

    async function state(opts = {}) {
        // submit proof, but block is valid
        const proofa = [
            opts.blockReferenced.block.encodePacked(),
            opts.blockReferenced.root.encodePacked(),
            0,
            combine(opts.blockReferenced.txs),
        ];

        // Generate the fraud hash
        const fraudHash2 = utils.keccak256(contract.interface.functions.proveMalformedBlock.encode(
            [
                ...proofa,
            ],
        ));

        // Commit the fraud hash.
        await t.wait(contract.commitFraudHash(fraudHash2, {
            ...overrides,
        }), 'commit fraud hash', errors);
    
        // Wait 10 blocks for fraud finalization.
        await t.increaseBlock(10);

        // Prove malformed block.
        if (!opts.noMalformedBlock) {
            await t.wait(
                contract.proveMalformedBlock(
                    ...proofa,
                    overrides
                ),
                'submit malformed proof',
                errors,
            );
        }

        if (opts.proveDoubleSpend) {

            const args3 = [
                opts.blockReferenced.proof.encodePacked(),
                opts.block.proof.encodePacked(),
            ];
            
            // Generate the fraud hash.
            const fraudHash3 = utils.keccak256(contract.interface.functions.proveDoubleSpend.encode(args3));
        
            // Commit the fraud hash.
            await t.wait(contract.commitFraudHash(fraudHash3, {
                ...overrides,
            }), 'commit fraud hash', errors);
        
            // Wait 10 blocks for fraud finalization.
            await t.increaseBlock(10);
        
            let prevTip = await contract.blockTip();

            const fraudDoubleSpend = await t.wait(contract.proveDoubleSpend(...args3, {
                ...overrides,
            }), 'double spend same deposit', errors);

            if (!fraudDoubleSpend) {
                t.ok(0, 'not ok, no result on fraud double');
                return;
            }

            if (opts.fraud) {
                if (!fraudDoubleSpend.events[0].args) {
                    t.ok(0, 'not ok, no events on double');
                    return;
                }

                t.equal(fraudDoubleSpend.logs.length, 1, 'logs detected');
                t.equalBig(await contract.blockTip(), prevTip.sub(1), 'tip');
                t.equalBig(fraudDoubleSpend.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
            }

            if (!opts.fraud) {
                t.equal(fraudDoubleSpend.logs.length, 0, opts.valid || opts.name);
            }

            return;
        }

        // Generate the fraud hash
        const fraudHash = utils.keccak256(contract.interface.functions.proveInvalidInput.encode(
            [
                opts.blockReferenced.proof.encodePacked(),
                opts.block.proof.encodePacked(),
            ],
        ));
    
        // Commit the fraud hash.
        await t.wait(contract.commitFraudHash(fraudHash, {
            ...overrides,
        }), 'commit fraud hash', errors);
    
        // Wait 10 blocks for fraud finalization.
        await t.increaseBlock(10);

        let prevTip = await contract.blockTip();

        if (opts.valid) {
            const result = await t.wait(
                contract.proveInvalidInput(
                    opts.blockReferenced.proof.encodePacked(),
                    opts.block.proof.encodePacked(),
                    {
                        ...overrides,
                    }
                ),
                'invalid input',
                errors,
            );

            if (!result) {
                t.ok(0, 'not okay ' + opts.valid);
                return;
            }

            if (result.logs.length) {
                console.log(result.logs);
            }

            t.equal(result.logs.length, 0, 'logs detected');
            t.equalBig(await contract.blockTip(), prevTip, opts.valid);
            return;
        }

        if (opts.revert) {
            await t.revert(
                contract.proveInvalidInput(
                    opts.blockReferenced.proof.encodePacked(),
                    opts.block.proof.encodePacked(),
                    {
                        ...overrides,
                    }
                ),
                errors[opts.revert],
                'correct revert ' + opts.revert,
                errors,
            );

            return;
        }
  
        const fraudTx = await t.wait(
            contract.proveInvalidInput(
                opts.blockReferenced.proof.encodePacked(),
                opts.block.proof.encodePacked(),
                {
                    ...overrides,
                }
            ),
            'invalid input',
            errors,
        );

        if (!fraudTx) {
            t.ok(0, 'no fraud tx');
            return;
        }

        if (fraudTx.logs.length) {
            // console.log(fraudTx.logs);
        }

        if (!fraudTx.events[0]) {
            t.ok(0, 'no events');
            return;
        }

        if (!fraudTx.events[0].args) {
            t.ok(0, 'no event args');
            return;
        }

        t.equal(fraudTx.logs.length, 1, 'logs detected');
        t.equalBig(await contract.blockTip(), prevTip.sub(1), 'tip');
        t.equalBig(fraudTx.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
    }



    // Make a block with a bunch of txs in it to point at.
    async function makeBlock(opts = {}) {
        let txs = [];

        for (var i = 0; i < (opts.numTransactions); i++) {
            const txData = [ utils.hexlify(utils.randomBytes(32)) ];
            const transactionData = await tx.Transaction({
                witnesses: [ t.wallets[0] ],
                metadata: [ protocol.metadata.MetadataDeposit({
                    ...deposit.object(),
                }) ],
                data: txData, // The root data.
                inputs: [ protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }) ],
                signatureFeeToken: 0,
                signatureFee: 0,
                outputs: opts.outputs || (opts.outputFn ? opts.outputFn() : null) || [
                    protocol.outputs.OutputTransfer({
                        amount: deposit.object().value
                            .add(i),
                        owner: producer,
                        token: '0x01',
                    }),
                    !opts.withdrawReturn
                        ? protocol.outputs.OutputReturn({
                            data: utils.hexlify(utils.randomBytes(1)),
                        })
                        : protocol.outputs.OutputWithdraw({
                            amount: deposit.object().value
                                .add(i),
                            owner: producer,
                            token: '0x01',
                        }),
                ],
                chainId: 1,
                contract,
            });

            txs.push(transactionData);
        }

        return await produceBlock(
            txs,
            0,
            0,
            {
                transactionIndex: opts.transactionIndex || 0,
                inputOutputIndex: opts.inputOutputIndex || 0,
            });
    }

    async function makeTx(opts = {}) {
        return await produceBlock([
            await tx.Transaction({
                witnesses: [ t.wallets[0] ],
                metadata: [ protocol.metadata.Metadata({
                    blockHeight: opts.blockHeight || 0,
                    rootIndex: 0,
                    transactionIndex: opts.transactionIndex || 0,
                    outputIndex: 0,
                    ...(opts.metadataOverride || {}),
                }) ],
                data: [ utils.emptyBytes32 ], // The root data.
                inputs: opts.inputs || [ protocol.inputs.Input({}) ],
                signatureFeeToken: 0,
                signatureFee: 0,
                outputs: [
                    protocol.outputs.OutputWithdraw({
                        amount: deposit.object().value,
                        owner: producer,
                        token: '0x01',
                    }),
                ],
                chainId: 1,
                contract,
            }),
        ], 0, 0);
    }


    await (async () => {
        // Produce 100 same tx's.
        let txs = [];
        for (var i = 0; i < 100; i++) {
            txs.push(await tx.Transaction({
                witnesses: [ t.wallets[0] ],
                metadata: [ protocol.metadata.Metadata({
                    blockHeight: 0,
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: 0,
                }) ],
                data: [ utils.emptyBytes32 ], // The root data.
                inputs: [ protocol.inputs.Input({}) ],
                signatureFeeToken: 0,
                signatureFee: 0,
                outputs: [
                    protocol.outputs.OutputWithdraw({
                        amount: deposit.object().value,
                        owner: producer,
                        token: '0x01',
                    }),
                ],
                chainId: 1,
                contract,
            }));
        }

        // Produce a block with 100 same tx's.
        const block = await produceBlock(txs, 0, 0);

        // Produce a proofA.
        const txA = block.produceProof({ transactionIndex: 0 });
        const txB = block.produceProof({ transactionIndex: 99 });

        await state({
            blockReferenced: block,
            block: {
                proof: txB,
            },
            noMalformedBlock: true,
            proveDoubleSpend: true,
            fraud: 'double-spend',
            name: 'attempt double spend similar proofs',
        });
        
    })();

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 127,
            numTransactions: 128,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 129, // <-- this is invalid
            }),
            fraud: 'input-transaction-index-overflow',
            name: 'reference overflow',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 99,
            numTransactions: 100,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 99, // <-- this is invalid
            }),
            // fraud: 'empty-transaction',
            valid: 'valid reference',
        });

    })());

    await ((async () => {

        const transactionIndex = 226;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 227,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex,
            }),
            _index: transactionIndex,
            valid: 'simple input proof',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 222,
            numTransactions: 222,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 222, // <-- this is invalid
            }),
            fraud: 'empty-transaction',
            name: 'reference empty leaf past valid 221',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 0,
            numTransactions: 1,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 0, // <-- this is invalid
            }),
            valid: 'valid simple reference',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 1,
            numTransactions: 1,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 1, // <-- this is invalid
            }),
            fraud: 'empty-transaction',
            name: 'reference an empty transaction',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 1,
            numTransactions: 1,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 2, // <-- this is invalid
            }),
            fraud: 'input-transaction-index-overflow',
            name: 'reference past rightmost',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 1,
            numTransactions: 1,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 3, // <-- this is invalid
            }),
            fraud: 'input-transaction-index-overflow',
            name: 'reference past rightmost',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 3,
            numTransactions: 4,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 3, // <-- this is invalid
            }),
            valid: 'valid index 3',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 6,
            numTransactions: 7,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 6, // <-- this is invalid
            }),
            valid: 'valid index 6 of 7',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 10,
            numTransactions: 11,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 10, // <-- this is invalid
            }),
            valid: 'valid index 10 of 11',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 15,
            numTransactions: 11,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 15, // <-- this is invalid
            }),
            fraud: 'empty-transaction',
            name: 'reference last empty leaf in 16 leaf tree',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 15,
            numTransactions: 11,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 16, // <-- this is invalid
            }),
            fraud: 'input-transaction-index-overflow',
            name: 'reference last empty leaf in 16 leaf tree',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 221,
            numTransactions: 222,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 221, // <-- this is invalid
            }),
            valid: 'valid 221 of 222',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 255,
            numTransactions: 222,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 256, // <-- this is invalid
            }),
            fraud: 'input-transaction-index-overflow',
            name: 'reference past rightmost 256 of 255',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 227,
            numTransactions: 227,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 227, // <-- this is invalid
            }),
            noMalformedBlock: true,
            fraud: 'empty-transaction',
            name: 'referenced rightmost empty transaction',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 3,
            numTransactions: 3,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 3, // <-- this is invalid
            }),
            noMalformedBlock: true,
            fraud: 'empty-transaction',
            name: 'referenced beyond rightmost empty transaction',
        });

    })());

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
            inputOutputIndex: 7,
            outputFn: () => [
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value,
                    owner: producer,
                    token: '0x01',
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                metadataOverride: {
                    transactionIndex: 2,
                    outputIndex: 7, // <-- this is invalid
                },
            }),
            fraud: 'input-withdraw',
            name: 'attempt withraw spend at end of outputs',
        });

    })();

    await (async () => {

        const transactionIndex = 99;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 100,
            inputOutputIndex: 0,
            outputFn: () => [
                protocol.outputs.OutputTransfer({
                    amount: deposit.object().value,
                    owner: producer,
                    token: '0x01',
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(1)),
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.InputHTLC({}), // <-- htlc input
                ],
                metadataOverride: {
                    transactionIndex,
                    outputIndex: 0, // <-- this selects an input past overflow
                },
            }),
            fraud: 'input-htlc-type',
            name: 'htlc attempting to spend transfer utxo',
        });

    })();

    await (async () => {

        const transactionIndex = 99;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 100,
            inputOutputIndex: 0,
            outputFn: () => [
                protocol.outputs.OutputHTLC({
                    amount: deposit.object().value,
                    owner: producer,
                    digest: utils.sha256(utils.sha256('0xdeadbeaf')),
                    token: '0x01',
                    expiry: 50000000,
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.InputHTLC({
                        preImage: utils.sha256('0xdeadbeaf'),
                    }),
                ],
                metadataOverride: {
                    transactionIndex,
                    outputIndex: 0,
                },
            }),
            valid: 'spending valid htlc with proper preimage',
        });

    })();

    await (async () => {

        const transactionIndex = 99;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 100,
            inputOutputIndex: 0,
            outputFn: () => [
                protocol.outputs.OutputHTLC({
                    amount: deposit.object().value,
                    owner: producer,
                    expiry: 500000000,
                    digest: utils.keccak256(utils.sha256('0xdeadbeaf')),
                    token: '0x01',
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.InputHTLC({
                        preImage: utils.sha256('0xbeafdead'), // <-- this is invalid
                    }),
                ],
                metadataOverride: {
                    transactionIndex,
                    outputIndex: 0,
                },
            }),
            fraud: 'htlc-preimage',
            name: 'spending htlc with invalid preimage',
        });

    })();

    await (async () => {

        const transactionIndex = 99;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 100,
            inputOutputIndex: 0,
            outputFn: () => [
                protocol.outputs.OutputHTLC({
                    amount: deposit.object().value,
                    owner: producer,
                    expiry: 500000000,
                    digest: utils.keccak256(utils.sha256('0xdeadbeaf')),
                    token: '0x01',
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.InputHTLC({
                        preImage: utils.sha256('0xbeafdead'), // <-- this is invalid
                    }),
                ],
                metadataOverride: {
                    transactionIndex,
                    outputIndex: 0,
                },
            }),
            fraud: 'htlc-preimage',
            name: 'spending htlc with invalid preimage',
        });

    })();

    await (async () => {

        const transactionIndex = 99;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 100,
            inputOutputIndex: 7,
            outputFn: () => [
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputWithdraw({
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputHTLC({
                    amount: deposit.object().value,
                    owner: producer,
                    token: '0x01',
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.Input({}), // <-- transfer input
                ],
                metadataOverride: {
                    transactionIndex,
                    outputIndex: 7, // <-- this selects an HTLC input
                },
            }),
            fraud: 'input-utxo-type',
            name: 'transfer attempting to spend transfer utxo',
        });

    })();

    await (async () => {

        const transactionIndex = 99;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 100,
            inputOutputIndex: 7,
            outputFn: () => [
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputWithdraw({
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
                protocol.outputs.OutputHTLC({
                    amount: deposit.object().value,
                    owner: producer,
                    token: '0x01',
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.Input({}), // <-- transfer input
                ],
                metadataOverride: {
                    transactionIndex,
                    outputIndex: 7, // <-- this selects an htlc
                },
            }),
            fraud: 'input-utxo-type',
            name: 'transfer attempting to spend transfer utxo',
        });

    })();

    await (async () => {

        const transactionIndex = 99;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 100,
            inputOutputIndex: 0,
            outputFn: () => [
                protocol.outputs.OutputHTLC({
                    amount: deposit.object().value,
                    owner: producer,
                    token: '0x01',
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.Input({}), // <-- transfer input
                ],
                metadataOverride: {
                    transactionIndex,
                    outputIndex: 0, // <- this selects an HTLC output
                },
            }),
            fraud: 'input-utxo-type',
            name: 'transfer attempting to spend transfer utxo',
        });

    })();

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
            inputOutputIndex: 0,
            outputsFn: () => [
                protocol.outputs.OutputTransfer({
                    amount: deposit.object().value,
                    owner: producer,
                    token: '0x01',
                }),
                protocol.outputs.OutputReturn({
                    data: utils.hexlify(utils.randomBytes(2)),
                }),
            ],
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                inputs: [
                    protocol.inputs.InputHTLC({ // <-- this is invalid HTLC
                    }),
                ],
                metadataOverride: {
                    transactionIndex: 2,
                    outputIndex: 0, // <-- this selects an input past overflow
                },
            }),
            fraud: 'input-htlc-type',
            name: 'htlc attempting to spend transfer utxo',
        });

    })();

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
            inputOutputIndex: 1,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                metadataOverride: {
                    transactionIndex: 2,
                    outputIndex: 2, // <-- this selects an input past overflow
                },
            }),
            fraud: 'input-output-index-overflow',
            name: 'attempt spend output not there',
        });

    })();

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
            inputOutputIndex: 1, // <-- this selects the return output
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                metadataOverride: {
                    transactionIndex: 2,
                    outputIndex: 1, // <-- this is a return output
                },
            }),
            fraud: 'input-return',
            name: 'attempt return spend',
        });

    })();

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
            withdrawReturn: true, // <-- this creates the withdraw 
            inputOutputIndex: 1, // <-- this selects the withdraw
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                metadataOverride: {
                    transactionIndex: 2,
                    outputIndex: 1, // <-- this is a withdrawl
                },
            }),
            fraud: 'input-withdraw',
            name: 'attempt withdraw spend',
        });

    })();

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
            withdrawReturn: true,
            // inputOutputIndex not selected properly
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                metadataOverride: {
                    transactionIndex: 2,
                    outputIndex: 1, // <-- this is a withdrawl
                },
            }),
            revert: 'output-index-mismatch',
            name: 'attempt withdraw spend',
        });

    })();

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 227,
            numTransactions: 227,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 227, // <-- this is invalid
            }),
            fraud: 'empty-transaction',
            name: 'reference overflow',
        });

    })());

    await ((async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 10,
            numTransactions: 10,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 10, // <-- this is invalid
            }),
            fraud: 'empty-transaction',
            name: 'reference overflow',
        });

    })());

    await (async () => {

        const transactionIndex = 0;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 10,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex,
            }),
            valid: 'simple input proof',
        });

    })();

    await (async () => {

        const transactionIndex = 1;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 227,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex,
            }),
            valid: 'simple input proof',
        });

    })();
    
    await (async () => {

        const transactionIndex = 3;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 4,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex,
            }),
            valid: 'simple input proof',
        });

    })();

    await (async () => {

        const transactionIndex = 6;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 7,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex,
            }),
            valid: 'simple input proof',
        });

    })();

    await (async () => {

        const transactionIndex = 9;

        const blockReferenced = await makeBlock({
            transactionIndex,
            numTransactions: 227,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex,
            }),
            valid: 'simple input proof',
        });

    })();

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 2,
            }),
            valid: 'simple input proof',
        });

    })();

    await (async () => {

        const blockReferenced = await makeBlock({
            transactionIndex: 2,
            numTransactions: 100,
        });

        await state({
            blockReferenced,
            block: await makeTx({
                blockHeight: blockReferenced.height,
                transactionIndex: 2,
            }),
            valid: 'simple input proof',
        });

    })();

});
