/// @dev Prove complex transaction to be valid in summing, witness, input checks.
const { test, utils, overrides } = require('@fuel-js/environment');
const { combine, chunkJoin } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');

/// @notice Random number util.
function rand(min, max) {
    return Math.floor(Math.random() * max) + min;
}

// The plan is to do 6 transactions, 1 deposit, 1 root.
// Than we run this valid transaction through all the fraud proofs.
// This ensures more execution correctness.
module.exports = test('DoubleSpend', async t => {

    // State a sequence for testing.
    async function state (stateOpts = {}) {
        // Deploy an instance of Fuel.
        const producer = t.wallets[0].address;
        const contract = await t.deploy(abi, bytecode, [
            producer,
            1000,
            20,
            20,
            utils.parseEther('1.0'),
            "Fuel",
            "1.1.0",
            1,
            utils.emptyBytes32
        ]);

        // Create a token.
        const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
        const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

        let token = utils.emptyAddress;
        let tokenId = '0x00';
        let numTokens = 1;
        const funnela = await contract.funnel(producer);
        const valuea = utils.bigNumberify(1000);

        // Transfer for a deposit.
        await t.wait(erc20.transfer(funnela, valuea, overrides), 'erc20 transfer');
        token = erc20.address;
        tokenId = '0x01';
        numTokens = 2;

        // Create a deposit, also adding this token type 1.
        const deposit = new Deposit({
            token: tokenId,
            owner: producer,
            blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
            value: valuea,
        });
        await t.wait(contract.deposit(producer, token, overrides),
            'ether deposit', errors);

        // Commit addresses.
        await t.wait(contract.commitAddress(producer, overrides),
            'commit addresses', errors);
        await t.wait(contract.commitAddress(t.wallets[1].address, overrides),
            'commit addresses', errors);

        // Specify the owners in question here.
        const owners = {
            '0': utils.emptyAddress,
            '1': producer,
            '2': t.wallets[1].address,
        };

        // Resolve data to the owner address.
        function resolveOwner(data = 0) {
            let ownerId = data.toHexString
                ? data.toNumber()
                : data;

            // If it's an address, return it.
            if (typeof ownerId === 'string' && utils.hexDataLength(ownerId) == 20) {
                return ownerId;
            }

            // If it's a 20 byte address, than pack and return.
            if (Array.isArray(ownerId) && ownerId.length === 20) {
                return chunkJoin(ownerId);
            }

            // If it's a 4 byte identifier.
            if (Array.isArray(ownerId) && ownerId.length <= 8) {
                ownerId = utils.bigNumberify(chunkJoin(ownerId)).toNumber();
            }

            // Return resolved owner address.
            return owners[ownerId];
        }

        // Make a transaction in it's own root and block.
        async function make (opts = {}) {
            // Output index to specify.
            let outputIndex = opts.outputIndex || 0;

            // Sepcify the outputs.
            let outputs = opts.outputs || [
                tx.OutputTransfer({
                    token: '0x01',
                    owner: '0x00',
                    amount: utils.parseEther('10032.00'),
                }),
            ];

            // This is a referenced transaction.
            // So we don't care about it being *real*, just valid outputs.
            let transaction = await tx.Transaction({
                override: true,
                witnesses: [
                    t.wallets[0],
                    { _caller: true },
                    { _producer: true },
                ],
                metadata: [
                    stateOpts.mainMetadata0
                        ? stateOpts.mainMetadata0
                        : tx.Metadata({
                            rootIndex: 0,
                        }),
                    tx.Metadata({
                        rootIndex: 1,
                    }),
                    tx.Metadata({
                        rootIndex: 2,
                    }),
                    tx.Metadata({
                        rootIndex: 3,
                    }),
                    tx.Metadata({
                        rootIndex: 4,
                    }),
                    tx.Metadata({
                        rootIndex: 5,
                    }),
                    tx.Metadata({
                        rootIndex: 6,
                    }),
                    stateOpts.mainMetadata7 
                        ? stateOpts.mainMetadata7
                        : tx.Metadata({
                            rootIndex: 7,
                        }),
                ],
                data: [
                    utils.hexlify(utils.randomBytes(32)),
                    utils.hexlify(utils.randomBytes(32)),
                    utils.hexlify(utils.randomBytes(32)),
                    utils.hexlify(utils.randomBytes(32)),
                    utils.hexlify(utils.randomBytes(32)),
                    utils.hexlify(utils.randomBytes(32)),
                    utils.hexlify(utils.randomBytes(32)),
                    utils.hexlify(utils.randomBytes(32)),
                ],
                inputs: [
                    tx.Input({
                        witnessReference: 0,
                    }),
                    tx.Input({
                        witnessReference: 1,
                    }),
                    tx.Input({
                        witnessReference: 2,
                    }),
                    tx.Input({
                        witnessReference: 0,
                    }),
                    tx.Input({
                        witnessReference: 1,
                    }),
                    tx.Input({
                        witnessReference: 2,
                    }),
                    tx.Input({
                        witnessReference: 0,
                    }),
                    tx.InputDeposit({
                        owner: producer,
                    }),
                ],
                outputs,
                chainId: 1,
                contract,
            });

            // Construct a fake leaf.
            const fakeLeaf = Leaf({
                data: utils.hexZeroPad('0xaa', rand(120, 140)),
            });

            // Max number of tx's per root.
            const maxTx = 120;

            // Select a transaction index between 0 and 195.
            const transactionIndex = rand(0, maxTx);

            // Produce a set of fake leafs based upon the transaction index.
            const fakeLeafs = (new Array(transactionIndex))
                .fill(fakeLeaf);
            const fakeLeafsSuffix = (new Array(maxTx - transactionIndex))
                .fill(fakeLeaf);

            // Produce a seperate root with this transaction.
            const txs = [...fakeLeafs, transaction, ...fakeLeafsSuffix];
            const root = (new RootHeader({
                rootProducer: producer,
                merkleTreeRoot: merkleTreeRoot(txs),
                commitmentHash: utils.keccak256(combine(txs)),
                rootLength: utils.hexDataLength(combine(txs)),
            }));
            await t.wait(contract.commitRoot(root.properties.merkleTreeRoot().get(), 0, 0, combine(txs), overrides),
                'valid submit', errors);

            // Max roots.
            const maxRoots = 128;
            const rootIndex = rand(0, 17);

            // Add a bunch of fake roots.
            let fakeRoots = [];

            // generate a set of fake roots.
            for (let i = 0; i < rootIndex; i++) {
                const fakeRootFee = i + 1;
                const fakeRoot = (new RootHeader({
                    rootProducer: producer,
                    merkleTreeRoot: merkleTreeRoot(txs),
                    commitmentHash: utils.keccak256(combine(txs)),
                    rootLength: utils.hexDataLength(combine(txs)),
                    fee: fakeRootFee,
                }));
                await t.wait(contract.commitRoot(
                    root.properties.merkleTreeRoot().get(),
                    0,
                    fakeRootFee,
                    combine(txs),
                    overrides),
                    'submit fake root', errors);

                // Add to fake roots.
                fakeRoots.push(fakeRoot.keccak256Packed());
            }

            // The fuel block tip.
            const blockTip = (await contract.blockTip()).add(1);

            // Roots.
            const roots = [...fakeRoots, root.keccak256Packed()];

            // Produce a block header with this transaction.
            const header = (new BlockHeader({
                producer,
                height: blockTip,
                numTokens,
                numAddresses: 3,
                roots,
            }));

            // Produce a block with this transaction.
            const currentBlock = await t.provider.getBlockNumber();
            const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
            const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, blockTip, roots, {
                ...overrides,
                value: await contract.BOND_SIZE(),
            }), 'commit block', errors);
            header.properties.blockNumber().set(block.events[0].blockNumber);
            header.properties.previousBlockHash().set(block.events[0].args.previousBlockHash);

            const inputOutputIndex = stateOpts.mainMetadata7 
                ? 7
                : (typeof stateOpts.prevIndexSelector === "number" ? stateOpts.prevIndexSelector : outputIndex);

            // Produce the proof for this transaction.
            let proof = tx.TransactionProof({
                block: header,
                root,
                transactions: txs,
                inputOutputIndex,
                transactionIndex: transactionIndex,
                token,
            });

            // Select the otput in question.
            let output = outputs[outputIndex];

            // Is HTLC.
            const isHTLC = output.properties.type().get()
                .eq(tx.OutputTypes.HTLC);

            // UTXO Proof.
            let utxo = tx.UTXO({
                transactionHashId: transaction.transactionHashId(),
                outputIndex,
                outputType: output.properties.type().get().toNumber(),
                amount: tx.decodeAmount(output),
                token: output.properties.token().get(),
                owner: resolveOwner(output.properties.owner().get()),
                digest: isHTLC ? output.properties.digest().get() : utils.hexZeroPad('0x00', 32),
                expiry: isHTLC ? output.properties.expiry().get() : 0,
                returnOwner: isHTLC 
                    ? resolveOwner(output.properties.returnOwner().get())
                    : utils.emptyAddress,
            });

            // Return the proof, root, block, transaction etc.
            return {
                metadata: tx.Metadata({
                    blockHeight: header.properties.height().get(),
                    rootIndex: rootIndex,
                    transactionIndex: transactionIndex,
                    outputIndex: outputIndex,
                }),
                rootIndex,
                amount: utxo.properties.amount().get(),
                output,
                proof,
                utxo,
                root,
                block: header,
                transaction,
                transactions: txs,
            };
        }

        /// @notice This will transform a tx proof into a witness proof.
        /// @dev Will change proof.token and proof.selector to utxo owner etc.
        /// @return Will return the proof in question.
        function setTxOwnerAndReturnOwner(tx) {
            // Set proof to full address UTXO owner / return owner.
            tx.proof.properties.token()
                .set(tx.utxo.properties.owner().get());
            tx.proof.properties.selector()
                .set(tx.utxo.properties.returnOwner().get());
            return tx.proof;
        }

        // Producer funnel address.
        const producerFunnelAddress = await contract
            .funnel(producer);

        // Amount values for the outputs.
        const defaultOutputAmounts = [
            rand(0, 500000),
            '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
            utils.hexlify(utils.randomBytes(20)),
            utils.parseEther(String(rand(0, 800))),
            utils.parseEther('2348972348.0918239871178'),
            utils.parseEther('0'),
            utils.parseEther('10032.00'),
        ];

        // These are the default outputs to use accross referenced txs.
        let defaultPreImage = utils.hexZeroPad('0xdeadbeef', 32);
        let defaultOuputs = [
            tx.OutputTransfer({
                noshift: true,
                token: '0x01',
                owner: producer,
                amount: defaultOutputAmounts[0],
            }),
            tx.OutputWithdraw({
                token: '0x01',
                owner: producerFunnelAddress,
                amount: defaultOutputAmounts[1],
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: producer,
                amount: defaultOutputAmounts[2],
            }),
            tx.OutputReturn({
               data: '0xdeadbeef',
            }),
            tx.OutputHTLC({
                token: '0x01',
                owner: producer,
                digest: utils.hexlify(utils.sha256(defaultPreImage)),
                returnOwner: '0x01',
                expiry: 30000,
                amount: defaultOutputAmounts[3],
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: '0x01',
                amount: defaultOutputAmounts[4],
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: '0x01',
                amount: defaultOutputAmounts[5],
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: producer,
                amount: defaultOutputAmounts[6],
            }),
        ];

        // Produce the 6 transactions to reference.
        const tx0 = await make({
            outputIndex: 2,
            outputs: defaultOuputs,
        });
        const tx1 = await make({ // htlc
            outputIndex: 4,
            outputs: defaultOuputs,
        });
        const tx2 = await make({
            outputIndex: 5,
            outputs: defaultOuputs,
        });
        const tx3 = await make({
            outputIndex: 6,
            outputs: defaultOuputs,
        });
        const tx4 = await make({
            outputIndex: 7,
            outputs: defaultOuputs,
        });
        const tx5 = await make({
            outputIndex: 0,
            outputs: defaultOuputs,
        });
        const tx6 = { // Root from tx4
            metadata: tx.Metadata({
                blockHeight: tx4.block.properties.height().get(),
                rootIndex: tx4.rootIndex,
            }),
            root: tx4.root,
            proof: tx4.proof,
            amount: tx4.root.properties.fee().get()
                .mul(tx4.root.properties.rootLength().get()),
        };
        const tx7 = {  // Deposit
            metadata: tx.MetadataDeposit({
                blockNumber: deposit.properties.blockNumber().get(),
                token: deposit.properties.token().get(),
            }),
            proof: deposit,
            amount: deposit.properties.value().get(),
        };

        // Make inputs come from a finalized block.
        if (stateOpts.withFinalizedInputs) {
            await t.increaseBlock(await contract.FINALIZATION_DELAY());
        }

        // Produce a Root.
        let txMainData = [
            tx0.utxo.keccak256(),
            tx1.utxo.keccak256(),
            tx2.utxo.keccak256(),
            tx3.utxo.keccak256(),
            tx4.utxo.keccak256(),
            tx5.utxo.keccak256(),
            tx6.root.keccak256Packed(), // root
            tx7.proof.keccak256(), // deposit
        ];

        // The signature and root fee for the target tx.
        let txMainFee = utils.parseEther('0.0000012');

        // The main transaction.
        let transactionMain = await tx.Transaction({
            override: true,
            witnesses: [
                t.wallets[0],
                { _caller: true },
                { _producer: true },
            ],
            metadata: [
                stateOpts.mainMetadata0
                    ? stateOpts.mainMetadata0
                    : tx0.metadata,
                tx1.metadata,
                tx2.metadata,
                tx3.metadata,
                tx4.metadata,
                tx5.metadata,
                tx6.metadata,
                stateOpts.mainMetadata7 
                    ? stateOpts.mainMetadata7
                    : tx7.metadata,
            ],
            data: txMainData,
            inputs: [
                tx.Input(),
                tx.InputHTLC({
                    witnessReference: 1,
                    preImage: defaultPreImage,
                }),
                tx.Input(),
                tx.Input({
                    witnessReference: 1,
                }),
                tx.Input({
                    witnessReference: 2,
                }),
                tx.Input(),
                tx.InputRoot({
                    witnessReference: 2,
                }),
                tx.InputDeposit({
                    owner: producer,
                }),
            ],
            signatureFeeToken: 1,
            signatureFee: txMainFee,
            signatureFeeOutputIndex: 0,
            outputs: [
                tx.OutputTransfer({
                    noshift: true,
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx0.amount,
                }),
                tx.OutputWithdraw({
                    token: '0x01',
                    owner: producer,
                    amount: tx1.amount,
                }),
                tx.OutputHTLC({
                    token: '0x01',
                    owner: '0x00',
                    amount: tx2.amount,
                    expiry: 70000,
                    digest: utils.sha256('0xdeadbeaf'),
                    returnOwner: utils.emptyAddress,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: producer,
                    amount: tx3.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: '0x01',
                    amount: tx4.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: '0x02',
                    amount: tx5.amount.add(tx6.amount),
                }),
                tx.OutputReturn({
                    data: utils.randomBytes(45),
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: producer,
                    amount: tx7.amount,
                }),
            ],
            chainId: 1,
            contract,
        });

        // Produce a seperate root with this transaction.
        const txsMain = [transactionMain];
        const rootMain = (new RootHeader({
            rootProducer: producer,
            merkleTreeRoot: merkleTreeRoot(txsMain),
            commitmentHash: utils.keccak256(combine(txsMain)),
            rootLength: utils.hexDataLength(combine(txsMain)),
            feeToken: 1,
            fee: txMainFee,
        }));
        await t.wait(contract.commitRoot(
            rootMain.properties.merkleTreeRoot().get(),
            1,
            txMainFee,
            combine(txsMain),
            overrides),
            'valid submit', errors);

        // The fuel block tip.
        let blockTip = (await contract.blockTip()).add(1);

        // Produce a block header with this transaction.
        const headerMain = (new BlockHeader({
            producer,
            height: blockTip,
            numTokens,
            numAddresses: 3,
            roots: [rootMain.keccak256Packed()],
        }));

        // Specify the main root index.
        const mainRootIndex = 0;

        // Produce a block with this transaction.
        const currentBlock = await t.provider.getBlockNumber();
        const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
        const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, blockTip, [rootMain.keccak256Packed()], {
            ...overrides,
            value: await contract.BOND_SIZE(),
        }), 'commit block', errors);
        headerMain.properties.blockNumber().set(block.events[0].blockNumber);
        headerMain.properties.previousBlockHash().set(block.events[0].args.previousBlockHash);

        // Produce the proof for this transaction.
        let proofMain = tx.TransactionProof({
            block: headerMain,
            root: rootMain,
            transactions: txsMain,
            rootIndex: mainRootIndex,
            inputOutputIndex: stateOpts.mainMetadata7 
                ? 7 : (typeof stateOpts.mainIndexSelector === "number"
                        ? stateOpts.mainIndexSelector : 0),
            transactionIndex: 0,
            token,
        });

        // A fraud commitment sequence.
        async function commitFraudProof(fn = '', args = []) {
            // Generate the fraud hash.
            const fraudHash = utils.keccak256(contract.interface.functions[fn].encode(
                args,
            ));

            // Commit the fraud hash.
            await t.wait(contract.commitFraudHash(fraudHash, {
            ...overrides,
            }), 'commit fraud hash', errors);

            // Wait 10 blocks for fraud finalization.
            await t.increaseBlock(10);

            // Get block tip before submission.
            blockTip = await contract.blockTip();

            if (stateOpts.revert) {
                await t.revert(
                    contract[fn](
                        ...args, {
                        ...overrides,
                    }),
                    errors[stateOpts.revert],
                    stateOpts.revert,
                    errors,
                );
                t.equalBig(await contract.blockTip(), blockTip, 'block tip check');
                return;
            }

            // Submit a prove invalid transaction, ensure no tip has changed.
            const fraudTx = await t.wait(contract[fn](
                ...args, {
                ...overrides,
            }), `prove ${fn} using invalid tx`, errors);
            t.equalBig(await contract.blockTip(), blockTip.sub(1), 'block tip check');

            // Ensure the gas per each fraud proof is less than 400k.
            t.ok(fraudTx.cumulativeGasUsed.lte(3000000), 'fraud gas limit');

            // No fraud logs.
            if (fraudTx.events.length <= 0) {
                t.ok(0, 'no fraud detected');
                return;
            }

            // Check fraud code.
            t.equalHex(
                errors[stateOpts.fraud],
                fraudTx.events[0].args.fraudCode,
                stateOpts.fraud,
            );

            // If any events, log them.
            if (fraudTx && fraudTx.events.length && fraudTx.events[0].args) {
                console.log('Detected', errors[fraudTx.events[0].args.fraudCode]);

                if (fraudTx.events[1]) {
                    console.log(fn, fraudTx.events[1]);
                }
            }
        }

        if (stateOpts.revert === 'input-id') {
            await commitFraudProof(
                'proveDoubleSpend',
                [
                    tx0.proof.encodePacked(),
                    tx0.proof.encodePacked(), // <-- this is invalid, same id.
                ],
            );
            return;
        }

        if (stateOpts.mainMetadata7) {
            await commitFraudProof(
                'proveDoubleSpend',
                [
                    tx5.proof.encodePacked(),
                    proofMain.encodePacked(),
                ],
            );
        }

        if (stateOpts.mainMetadata0) {
            await commitFraudProof(
                'proveDoubleSpend',
                [
                    tx0.proof.encodePacked(),
                    proofMain.encodePacked(),
                ],
            );
        }
    }

    // Double spend complex Transfer.
    await state({
        mainMetadata0: tx.Metadata({}),
        mainIndexSelector: 0,
        prevIndexSelector: 0,
        revert: 'input-id',
    });

    // Double spend complex Deposit.
    await state({
        mainMetadata7: tx.MetadataDeposit({
            blockNumber: 10,
            token: 1,
        }),
        fraud: 'double-spend',
    });

    // Double spend complex Transfer.
    await state({
        mainMetadata0: tx.Metadata({}),
        mainIndexSelector: 0,
        prevIndexSelector: 0,
        fraud: 'double-spend',
    });
});