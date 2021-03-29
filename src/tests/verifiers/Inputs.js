const { test, utils, overrides } = require('@fuel-js/environment');
const { combine, chunkJoin } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const { BlockHeader, RootHeader,
    merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const protocol = require('@fuel-js/protocol');
const { defaults } = require('../utils/harness');
const TransactionProof = require('../utils/transactionProof');

/// @dev Test various complex summing cases with different witness, input, output and metadata configurations.
module.exports = test('Inputs', async t => {

    // Data hashes for input proofs.
    function inputProofsEncode(proofs = [], opts = {}) {
        // Hash the data proofs.
        return proofs.map(proof => proof.properties.rootProducer // If it's a root.
            ? proof.encodePacked() // if it's a root (we encodePacked the TransactionProof.
            : (proof._transactionProof
                ? (opts.exploit ? proof.exploit : proof)._transactionProof.encodePacked() // htlc / transfer
                : proof.encode())); // deposit
    }

    // Data hashes for input proofs.
    function inputProofHashes(proofs = [], opts = {}) {
        // Hash the data proofs.
        return proofs.map(proof => proof.properties.rootProducer // if it's a root.
            ? proof.root.keccak256Packed() // root.
            : (opts.exploit ? proof.exploit : proof).keccak256()); // deposit / htlc / transfer.
    }

    // Encode proofs.
    function inputsFromProofs(proofs = []) {
        // Hash the data proofs.
        return proofs.map(proof => proof.properties.rootProducer // if it's a root.
            ? protocol.inputs.InputRoot({
                witnessReference: proof.witnessReference || 0,
            })
            : (proof.properties.blockNumber
                ? protocol.inputs.InputDeposit({
                    ...proof.object(),
                    witnessReference: proof.witnessReference || 0,
                })
                : (proof.properties.outputType().get().eq(2)
                    ? protocol.inputs.InputHTLC({
                        witnessReference: proof.witnessReference || 0,
                    })
                    : protocol.inputs.Input({
                        witnessReference: proof.witnessReference || 0,
                    })))); // deposit / htlc / transfer.
    }

    // Encode fake metadata, will generate fake metadata.
    function inputProofMetadataGenerate(proofs = []) {
        return proofs.map(proof => (proof.properties.blockNumber && !proof.properties.rootProducer) // if it's a root.
            ? tx.MetadataDeposit({
                // We add the deposit info here.
                ...proof.object(),
            }) // for deposit.
            : tx.Metadata({
                ...(proof.metadata ? proof.metadata : {}),
            })); // for htlc, transfer, root.
    }

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

    // Do ERC20.
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

    // Commit two addresses.
    const commitA = await contract.commitAddress(producer, overrides); // will now be address 1
    await commitA.wait();

    const commitB = await contract.commitAddress(t.wallets[3].address, overrides); // will now be address 2
    await commitB.wait();

    // Producer Funnel.
    const producerFunnel = await contract.funnel(producer);

    const commitC = await contract.commitAddress(producerFunnel, overrides); // will now be address 3
    await commitC.wait();

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
            transactionIndex: 0, // set to zero.
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
        };
    }

    // The max number for overflow checks.
    const maxNum = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

    // Produce 8 blocks for 8 roots to spend.
    const block1 = await produceBlock([], 34000, 0);
    const block2 = await produceBlock([], utils.parseEther('0.00001'), 0);
    const block3 = await produceBlock([], 232, 0);
    const block4 = await produceBlock([], utils.parseEther('0.00023'), 0);
    const block5 = await produceBlock([], 0, 0);
    const block6 = await produceBlock([], utils.parseEther('1'), 0);
    const block7 = await produceBlock([], utils.parseEther('0.0000000001'), 0);
    const block8 = await produceBlock([], 1, 0);
    const block9 = await produceBlock([], utils.parseEther('0.00023'), 1);

    // Produce a referenced transaction from within a block.
    async function produceTransaction(utxo = {}, opts = {}) {
        // Is the UTXO an HTLC.
        const isHTLC = utxo.properties.outputType().get()
            .eq(protocol.outputs.OutputTypes.HTLC);

        // The data used for the transaction.
        let data = [
            block3.root.keccak256Packed(),
        ];
        let metadata = [
            protocol.metadata.Metadata(block3.metadata),
        ];
        let inputs = [
            protocol.inputs.InputRoot(),
        ];
        let proofs = block3.proof.encodePacked();

        // Use a deposit as the input for this transaction.
        if (opts.useDepositInput) {
            data = [ deposit.keccak256() ];
            metadata = [ protocol.metadata.MetadataDeposit({
                ...deposit.object()
            }) ];
            inputs = [
                protocol.inputs.InputDeposit({
                    ...deposit.object(),
                }),
            ];
            proofs = deposit.encode();
        }

        if (opts.useUTXOInput) {
            const inputUtxo = protocol.outputs.UTXO({
                owner: opts.inputUTXOOwner ? utils.emptyAddress : producer,
                amount: utils.parseEther('0.1'),
            });
            data = [ inputUtxo.keccak256() ];
            metadata = [ protocol.metadata.Metadata({
            }) ];
            inputs = [
                protocol.inputs.Input({
                }),
            ];
            proofs = inputUtxo.encode();
        }

        if (opts.useHTLCInput) {
            const inputUtxo = protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: producer,
                amount: utils.parseEther('0.1'),
                expiry: 0,
                returnOwner: producer,
                ...(opts.inputUTXOOverride || {}),
            });
            data = [ inputUtxo.keccak256() ];
            metadata = [ protocol.metadata.Metadata({
            }) ];
            inputs = [
                protocol.inputs.InputHTLC({
                }),
            ];
            proofs = inputUtxo.encode();
        }

        // The inputs and metadata now matter, for complexity sake we will do a root.
        const transactionData = {
            witnesses: [ t.wallets[0] ],
            metadata,
            data, // The root data.
            inputs,
            signatureFeeToken: 0,
            signatureFee: 0,
            outputs: [
                ...(opts.useReturn ? [protocol.outputs.OutputReturn({
                    data: protocol.outputs.OutputTransfer({ // attempt to encode valid output in return..
                        ...utxo.object(),
                        ...(opts.owner ? { owner: opts.owner } : {}),
                        ...(opts.returnOwner ? { returnOwner: opts.returnOwner } : {}),
                    }).encodePacked(),
                })] : []),
                isHTLC
                ? protocol.outputs.OutputHTLC({
                    ...utxo.object(),
                    ...(opts.owner ? { owner: opts.owner } : {}),
                    ...(opts.returnOwner ? { returnOwner: opts.returnOwner } : {}),
                })
                : protocol.outputs.OutputTransfer({
                    ...utxo.object(),
                    ...(opts.owner ? { owner: opts.owner } : {}),
                    ...(opts.returnOwner ? { returnOwner: opts.returnOwner } : {}),
                }),
            ],
            chainId: 1,
            contract,
        };
        let transaction = await tx.Transaction(transactionData);

        // Produce a block with this transaciton inside it.
        const block = await produceBlock([
            transaction,
        ], 0, 0, {
            inputOutputIndex: opts.inputOutputIndex || utxo.properties.outputIndex().get(),
            utxo,
            data: opts.proofData || data,
            inputProofs: proofs,
            addressA: opts.addressA,
            addressB: opts.addressB,
            signatureFee: opts.signatureFee,
            signatureFeeToken: opts.signatureFeeToken,
        });

        // Set the transaction hash id it's included in.
        utxo.properties.transactionHashId().set(transaction.transactionHashId());
        utxo._transactionProof = block.proof;
        utxo.metadata = block.metadata;

        // Assign the witness reference.
        utxo.witnessReference = opts.witnessReference;

        // This provides the nececities for an implicit data exploit vector.
        const invalidImplicitData = [
            utils.keccak256('0xbb'), // <-- this is the implicit data exploit.
        ];

        // Make a copy of this utxo.
        utxo.exploit = protocol.outputs.UTXO({
            ...utxo.object(),
        });

        // Change the exploit proof, make a copy of the tx proof.
        utxo.exploit._transactionProof = TransactionProof._TransactionProof({
            ...block.proof.object(),
            data: invalidImplicitData,
        });

        // Make a tx that is the wrong tx.
        utxo.exploit.transaction = await tx.Transaction({
            ...transactionData, // all tx leaf data remains the same to clears the tx check.
            data: invalidImplicitData,
        });

        // Change the transaction hash id.
        utxo.exploit.properties.transactionHashId()
            .set(utxo.exploit.transaction.transactionHashId());

        // The metadata is the same and correct.
        utxo.exploit.metadata = block.metadata;

        // Return the UTXO proof with attached data.
        return utxo;
    }

    // Construct contract.
    async function state (opts = {}) {
        // Fee.
        const signatureFeeToken = opts.signatureFeeToken || 0;
        const signatureFee = opts.signatureFee || 0;

        // Default outputs.
        const outputs = [
            protocol.outputs.OutputTransfer({
                amount: utils.parseEther('0.43'),
                token: 0,
                owner: producer,
            }),
        ];

        // Build a transaction.
        const transaction = await tx.Transaction({
            witnesses: opts.witnesses || [ t.wallets[0] ],
            metadata: opts.metadata || inputProofMetadataGenerate(opts.inputs),
            data: opts.data || inputProofHashes(opts.inputs),
            inputs: inputsFromProofs(opts.inputs),
            signatureFeeToken,
            signatureFee,
            outputs: opts.outputs || outputs,
            chainId: 1,
            contract,
        });

        // If the witness V value should be set to zero.
        if (opts.nullifyWitness) {
            // Get the current witness.
            const witness = transaction.properties.witnesses().get();

            // Witness set.
            transaction.properties.witnesses().set(
                witness.map(v => '0x00'), // nullify it.
            );
        }

        // Produce this tx into a block.
        const block = await produceBlock(
            [transaction],
            signatureFee,
            signatureFeeToken
        );

        // Submit a withdrawal proof.
        const proof = TransactionProof({
            block: block.block,
            root: block.root,
            transactions: block.txs,
            inputOutputIndex: opts.inputOutputIndex || 0,
            transactionIndex: 0,
            data: opts.data || inputProofHashes(opts.inputs, {
                exploit: opts.exploitImplicitData,
            }),
            signatureFeeToken: opts.proofSignatureFeeToken || signatureFeeToken,
            signatureFee: opts.proofSignatureFee || signatureFee,
            token: opts.token || token,
            inputProofs: chunkJoin(inputProofsEncode(opts.inputs, {
                exploit: opts.exploitImplicitData,
            })),
        });

        // Argument.
        const arg1 = proof.encodePacked();

        // Generate the fraud hash.
        const fraudHash = utils.keccak256(contract.interface.functions.proveInvalidWitness.encode(
            [
                arg1,
            ],
        ));

        // Commit the fraud hash.
        t.equalBig(await contract.blockTip(), block.height, 'previous block tip');

        // Commit fraud hash.
        await t.wait(
            contract.commitFraudHash(fraudHash, {
                ...overrides,
            }),
            'commit fraud hash',
            errors,
        );

        // Wait 10 blocks for fraud finalization.
        await t.increaseBlock(10);

        // Final result of fraud submission.
        let result = null;

        // Now check Revert, Fraud or Valid cases.
        if (opts.revert) {
            // Provie Invalid Sum on Revert.
            result = await t.revert(
                contract.proveInvalidWitness(arg1, /* arg2, */ {
                    ...overrides,
                }),
                errors[opts.revert],
                opts.revert,
            );

            // Check tip.
            t.equalBig(await contract.blockTip(), block.height, 'fraud revert tip');
        }

        if (opts.fraud) {
            t.equalBig(await contract.blockTip(), block.height, 'tip pre fraud');

            result = await t.wait(
                contract.proveInvalidWitness(arg1, /* arg2, */ {
                    ...overrides,
                }),
                opts.name || 'sum as fraud',
                errors,
            );

            t.equalBig(await contract.blockTip(), block.height.sub(1), 'block retracted');

            if (!result) {
                t.ok(0, 'fraud test reverted improperly');
                return;
            }

            if (result.logs && !result.events[0].args) {
                console.log(result.logs);
            }

            if (!result.events || result.logs.length === 0) {
                t.ok(0, 'should be fraud logs');
                return;
            }

            if (!result.events[0].args) {
                t.ok(0, 'no fraud code');
                return;
            }

            t.equalBig(result.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
            return;
        }

        if (!opts.fraud && !opts.revert) {
            result = await t.wait(
                contract.proveInvalidWitness(arg1, /* arg2, */ {
                    ...overrides,
                }),
                opts.valid || 'should be valid',
                errors,
            );
            t.equalBig(await contract.blockTip(), block.height, 'valid tip height');
        }

        if (result) {
            t.ok(result.cumulativeGasUsed.lt(3000000), 'cumulitive gas check');
        }

        // Result events.
        if (result && result.events) {
            t.ok(result.events.length == 0, opts.valid);

            // Check for fraud logs if fraud tell me.
            if (result.events.length > 0 && result.events[0].args) {
                console.log('Fraud code detected', result.events[0].args.fraudCode);
            }
        }

        // Result events.
        if (result && result.logs) {
            t.ok(result.logs.length == 0, opts.valid);

            // Check for fraud logs if fraud tell me.
            if (result.logs.length > 0) {
                console.log('Fraud code detected for case ' + opts.valid + ' with token ' + opts.token, result.logs);
            }
        }
    }

    await state({
        inputs: [
            deposit,
        ],
        data: [ utils.randomBytes(32) ], // <-- this is invalid.
        revert: 'deposit-data',
        valid: 'invalid inner proof data alignment with deposit',
    });

    await state({
        inputs: [
            deposit,
        ],
        nullifyWitness: true, // <--- will nullify witness in tx.
        data: [ utils.randomBytes(32) ], // <-- this is invalid.
        revert: 'deposit-data',
        valid: 'invalid inner proof data alignment with deposit',
    });

    await state({
        inputs: [
            deposit,
        ],
        data: [ utils.randomBytes(32) ], // <-- this is invalid.
        revert: 'deposit-data',
        valid: 'invalid inner proof data alignment with deposit',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), { useUTXOInput: true }),
        ],
        valid: 'proof using utxo for inner proof',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useUTXOInput: true,
                inputUTXOOwner: utils.emptyAddress, // <-- this is invalid
            }),
        ],
        revert: 'transfer-witness-signature',
        name: 'the owner of the inner utxo proof is invalid',
    });
    
    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 5000000000,
                    // returnOwner: utils.emptyAddress, // <-- this is invalid
                },
            }),
        ],
        // revert: 'htlc-witness-signature',
        valid: 'use valid htlc inner proof',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: utils.emptyAddress,
                    expiry: 0,
                    returnOwner: producer,
                },
            }),
        ],
        // revert: 'htlc-witness-signature',
        valid: 'use valid expired htlc inner proof',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 0, // <- expired
                    returnOwner: utils.emptyAddress, // <-- this is invalid
                },
            }),
        ],
        revert: 'htlc-witness-signature',
        valid: 'use valid expired htlc inner proof',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: utils.emptyAddress, // <-- this is invalid
                    expiry: 50000000, // <- expired
                    returnOwner: producer,
                },
            }),
        ],
        revert: 'htlc-witness-signature',
        valid: 'use valid non-expired htlc inner proof',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: utils.emptyAddress, // <-- this is invalid
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
        ],
        revert: 'htlc-witness-signature',
        valid: 'use valid non-expired htlc inner proof',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
        ],
        valid: 'use valid non-expired htlc inner proof',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
        ],
        valid: 'use valid non-expired htlc inner proofs',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                useHTLCInput: true,
                inputUTXOOverride: {
                    owner: producer,
                    expiry: 50000000,
                    returnOwner: producer,
                },
            }),
        ],
        valid: 'use valid non-expired htlc inner proofs',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        proofSignatureFeeToken: 1, // <-- this is invalid
        revert: 'invalid-fee-token',
        name: 'invalid fee token mismatch',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        proofSignatureFee: 500, // <-- this is invalid
        revert: 'invalid-fee',
        name: 'invalid fee token mismatch',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: t.wallets[1].address,
            }), {
                useReturn: true, // <-- use a return output
                inputOutputIndex: 0, // <-- this is invalid, this is a return output.
            }),
        ],
        revert: 'utxo-return',
        valid: 'single second witness',
    });

    await state({
        witnesses: [ { _producer: true }],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        valid: 'single utxo producer',
    });

    await state({
        witnesses: [ { _producer: true }],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), { owner: '0x01' }),
        ],
        valid: 'single utxo producer compressed commit address',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            }), {
                owner: '0x02', // <-- this is invalid
                addressA: producer,
            }),
        ],
        revert: 'owner-equates',
        name: 'single utxo producer compressed commit address',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[1] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: t.wallets[1].address,
            }), { witnessReference: 1 }),
        ],
        valid: 'single second witness',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[1] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: t.wallets[1].address,
            }), {
                witnessReference: 1,
                useDepositInput: true,
            }),
        ],
        valid: 'single second witness with deposit input',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: utils.emptyAddress,
                expiry: 3, // will be expired.
                returnOwner: t.wallets[0].address,
            }), { witnessReference: 1 }),
        ],
        valid: 'single return owner second witness',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: utils.emptyAddress,
                expiry: 3, // will be expired.
                returnOwner: t.wallets[0].address,
            }), {
                witnessReference: 1,
                returnOwner: '0x01', // <-- using committed address
            }),
        ],
        valid: 'committed htlc return address also valid',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: utils.emptyAddress,
                expiry: 3, // will be expired.
                returnOwner: producer,
            }), {
                witnessReference: 1,
                returnOwner: '0x01', // <-- using committed address
                addressB: producer,
            }),
        ],
        valid: 'committed htlc return address valid',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: utils.emptyAddress,
                expiry: 3, // will be expired.
                returnOwner: producerFunnel,
            }), {
                witnessReference: 1,
                returnOwner: '0x03',
                addressB: producer, // <-- this invalid
            }),
        ],
        revert: 'owner-return-equates',
        valid: 'committed htlc return address',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: utils.emptyAddress,
                expiry: 3, // will be expired.
                returnOwner: t.wallets[0].address, // use this witness!
            }), { witnessReference: 1 }),
        ],
        valid: 'single return owner second witness',
    });

    await state({
        witnesses: [ { _caller: true }, t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: producer, // <-- this is invalid
                expiry: 3, // will be expired.
                returnOwner: t.wallets[0].address, // use this witness!
            }), { witnessReference: 1, owner: utils.hexlify(utils.randomBytes(21)) }), // <-- this is invalid
        ],
        revert: 'owner-length-overflow',
    });


    await state({
        witnesses: [ { _producer: true }],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        valid: 'single multi 8 part utxo',
    });

    await state({
        witnesses: [
            { _producer: true }, 
            { _producer: true }, 
            { _producer: true },
            { _producer: true }, 
            { _producer: true }, 
            { _producer: true },
            { _producer: true },
            t.wallets[1],
        ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: t.wallets[1].address,
            }), { witnessReference: 7 }),
        ],
        valid: 'single multi 8 part utxo',
    });

    await state({
        witnesses: [
            { _producer: true }, 
            { _producer: true }, 
            { _producer: true },
            { _producer: true }, 
            { _producer: true }, 
            { _producer: true },
            { _producer: true },
            t.wallets[1],
        ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
            await produceTransaction(protocol.outputs.UTXO({
                owner: t.wallets[1].address,
            }), { witnessReference: 8 }), // <-- this should revert.
        ],
        inputOutputIndex: 7,
        revert: 'index-overflow',
        valid: 'single multi 8 part utxo',
    });

    await state({
        metadata: [
            protocol.metadata.Metadata({}), // <--- this is invalid.
        ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: producer,
            })),
        ],
        revert: 'htlc-output-id',
        name: 'invalid htlc output id',
    });

    await state({
        data: [
            utils.keccak256('0xaa'), // <--- this is invalid.
        ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                outputType: protocol.outputs.OutputTypes.HTLC,
                owner: producer,
            })),
        ],
        revert: 'htlc-data',
        name: 'invalid htlc output id',
    });

    await state({
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        exploitImplicitData: true, // <-- this starts the exploit
        revert: 'root-proof',
        valid: 'attempt data exploit implicit reference attack',
    });

    await state({
        witnesses: [ t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        valid: 'single utxo signature',
    });

    await state({
        witnesses: [ t.wallets[0] ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        valid: 'single utxo signature',
    });

    await state({
        witnesses: [ t.wallets[0] ],
        metadata: [
            protocol.metadata.Metadata({}), // <-- this is invalid.
        ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        revert: 'transfer-output-id',
        name: 'incorrect metadata',
    });

    await state({
        witnesses: [ t.wallets[0] ],
        data: [
            utils.keccak256('0xaa'), // <-- this is invalid.
        ],
        inputs: [
            await produceTransaction(protocol.outputs.UTXO({
                owner: producer,
            })),
        ],
        revert: 'utxo-data',
        name: 'incorrect utxo data',
    });

    await state({
        inputs: [
            (() => {
                const proof = block5.rootTransactionProof;
                proof.properties.rootIndex().set(2); // <-- this is invalid
                return proof;
            })(),
        ],
        revert: 'root-index-underflow',
        name: 'invalid root index not exists',
    });

    // Correct.
    block5.rootTransactionProof.properties.rootIndex().set(0); 

    await state({
        inputs: [
            (() => {
                const proof = block5.rootTransactionProof;
                proof.properties.producer().set(producerFunnel); // <-- this is invalid
                return proof;
            })(),
        ],
        revert: 'block-commitment',
        name: 'invalid block does not exist',
    });

    // Correct.
    block5.rootTransactionProof.properties.producer().set(producer);

    await state({
        data: [
            utils.keccak256('0xaa'), // <--- this is invalid
        ],
        inputs: [
            block5.rootTransactionProof, // root tx proof.
        ],
        revert: 'root-data',
        name: 'invalid root data',
    });

    await state({
        metadata: [
            protocol.metadata.Metadata({
                ...block5.rootTransactionProof.metadata,
                outputIndex: 1, // <--- this is invalid
            }),
        ],
        inputs: [
            block5.rootTransactionProof,
        ],
        revert: 'root-output-id',
        name: 'invalid root metadata',
    });

    await state({
        metadata: [
            protocol.metadata.Metadata({
                ...block5.rootTransactionProof.metadata,
                transactionIndex: 1, // <--- this is invalid
            }),
        ],
        inputs: [
            block5.rootTransactionProof,
        ],
        revert: 'root-output-id',
        name: 'invalid root metadata transactionIndex',
    });

    await state({
        metadata: [
            protocol.metadata.Metadata({
                ...block5.rootTransactionProof.metadata,
                blockHeight: 1, // <--- this is invalid
            }),
        ],
        inputs: [
            block5.rootTransactionProof,
        ],
        revert: 'root-output-id',
        name: 'invalid root metadata blockHeight',
    });

    await state({
        metadata: [
            protocol.metadata.Metadata({
                ...block5.rootTransactionProof.metadata,
                rootIndex: 1, // <--- this is invalid
            }),
        ],
        inputs: [
            block5.rootTransactionProof,
        ],
        revert: 'root-output-id',
        name: 'invalid root metadata rootIndex',
    });

    await state({
        witnesses: [ { _caller: true } ],
        inputs: [
            deposit,
        ],
        valid: 'single deposit caller',
    });

    await state({
        inputs: [
            protocol.deposit.Deposit({
                ...deposit.object(),
                value: 0, // <-- this is invalid
            }),
        ],
        revert: 'deposit-empty',
        name: 'empty deposit value',
    });

    await state({
        inputs: [
            protocol.deposit.Deposit({
                ...deposit.object(),
                value: 45, // <-- this is invalid
            }),
        ],
        revert: 'deposit-value',
        name: 'incorrect deposit value',
    });

    await state({
        metadata: [
            protocol.metadata.MetadataDeposit({
                ...deposit.object(),
            }),
        ],
        inputs: [
            protocol.deposit.Deposit({
                ...deposit.object(),
                blockNumber: 0, // <-- this is invalid
            }),
        ],
        revert: 'deposit-block-number',
        name: 'incorrect deposit block number',
    });

    await state({
        metadata: [
            protocol.metadata.MetadataDeposit({
                ...deposit.object(),
            }),
        ],
        inputs: [
            protocol.deposit.Deposit({
                ...deposit.object(),
                token: 3, // <-- this is invalid
            }),
        ],
        revert: 'deposit-token',
        name: 'incorrect deposit token',
    });

    await state({
        witnesses: [ t.wallets[0] ],
        inputs: [
            deposit,
        ],
        valid: 'single deposit signature',
    });

    await state({
        witnesses: [ t.wallets[0] ],
        inputs: [
            deposit,
            block5.rootTransactionProof, // root tx proof.
        ],
        valid: 'deposit with root signature',
    });

    await state({
        witnesses: [ { _producer: true } ],
        inputs: [
            deposit,
            block5.rootTransactionProof, // root tx proof.
        ],
        valid: 'deposit and root producer',
    });

    await state({
        witnesses: [ { _caller: true } ],
        inputs: [
            deposit,
            block5.rootTransactionProof, // root tx proof.
        ],
        valid: 'deposit root with caller',
    });
});
