/// @dev Prove complex transaction to be valid in summing, witness, input checks.
const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, pack, combine, chunkJoin } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('./harness');

// The plan is to do 6 transactions, 1 deposit, 1 root.
// Than we run this valid transaction through all the fraud proofs.
// This ensures more execution correctness.
module.exports = test('proveComplex', async t => {

    // State a sequence for testing.
    async function state (opts = {}) {
        // Deploy an instance of Fuel.
        const producer = t.wallets[0].address;
        const contract = await t.deploy(abi, bytecode, [
            producer,
            1000,
            20,
            20,
            utils.parseEther('1.0'),
            "Fuel",
            "1.0.0",
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
            // Output index to specify
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
                ],
                metadata: [
                    tx.Metadata({
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
                    tx.Metadata({
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
                    tx.Input(),
                    tx.Input(),
                    tx.Input(),
                    tx.Input(),
                    tx.Input(),
                    tx.Input(),
                    tx.Input(),
                    tx.Input(),
                ],
                outputs,
                contract,
            });

            // Produce a seperate root with this transaction.
            const txs = [transaction];
            const root = (new RootHeader({
                rootProducer: producer,
                merkleTreeRoot: merkleTreeRoot(txs),
                commitmentHash: utils.keccak256(combine(txs)),
                rootLength: utils.hexDataLength(combine(txs)),
            }));
            await t.wait(contract.commitRoot(root.properties.merkleTreeRoot().get(), 0, 0, combine(txs), overrides),
                'valid submit', errors);

            // The fuel block tip.
            const blockTip = (await contract.blockTip()).add(1);

            // Produce a block header with this transaction.
            const header = (new BlockHeader({
                producer,
                height: blockTip,
                numTokens,
                numAddresses: 3,
                roots: [root.keccak256Packed()],
            }));

            // Produce a block with this transaction.
            const currentBlock = await t.provider.getBlockNumber();
            const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
            const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, blockTip, [root.keccak256Packed()], {
                ...overrides,
                value: await contract.BOND_SIZE(),
            }), 'commit block', errors);
            header.properties.blockNumber().set(block.events[0].blockNumber);
            header.properties.previousBlockHash().set(block.events[0].args.previousBlockHash);

            // Produce the proof for this transaction.
            let proof = tx.TransactionProof({
                block: header,
                root,
                transactions: txs,
                inputOutputIndex: outputIndex,
                transactionIndex: 0,
                token,
            });

            // Select the otput in question.
            let output = outputs[outputIndex];

            // Is HTLC.
            const isHTLC = output.properties.type().get().eq(tx.OutputTypes.HTLC);

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
                    rootIndex: 0,
                    transactionIndex: 0,
                    outputIndex: outputIndex,
                }),
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

        // These are the default outputs to use accross referenced txs.
        let defaultPreImage = utils.hexZeroPad('0xdeadbeef', 32);
        let defaultOuputs = [
            tx.OutputTransfer({
                token: '0x01',
                owner: producer,
                amount: utils.parseEther('10032.00'),
            }),
            tx.OutputWithdraw({
                token: '0x01',
                owner: producer,
                amount: utils.parseEther('10032.00'),
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: producer,
                amount: utils.parseEther('10032.00'),
            }),
            tx.OutputReturn({
               data: '0xdeadbeef',
            }),
            tx.OutputHTLC({
                token: '0x01',
                owner: producer,
                digest: utils.hexlify(utils.keccak256(defaultPreImage)),
                returnOwner: '0x01',
                expiry: 300,
                amount: utils.parseEther('10032.00'),
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: producer,
                amount: utils.parseEther('10032.00'),
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: producer,
                amount: utils.parseEther('10032.00'),
            }),
            tx.OutputTransfer({
                token: '0x01',
                owner: producer,
                amount: utils.parseEther('10032.00'),
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
                rootIndex: 0,
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
        let transactionMain = await tx.Transaction({
            override: true,
            witnesses: [
                t.wallets[0],
            ],
            metadata: [
                tx0.metadata,
                tx1.metadata,
                tx2.metadata,
                tx3.metadata,
                tx4.metadata,
                tx5.metadata,
                tx6.metadata,
                tx7.metadata,
            ],
            data: txMainData,
            inputs: [
                tx.Input(),
                tx.InputHTLC({
                    preImage: defaultPreImage,
                }),
                tx.Input(),
                tx.Input(),
                tx.Input(),
                tx.Input(),
                tx.InputRoot(),
                tx.InputDeposit({
                    owner: producer,
                }),
            ],
            outputs: [
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx0.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx1.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx2.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx3.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx4.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx5.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx6.amount,
                }),
                tx.OutputTransfer({
                    token: '0x01',
                    owner: utils.emptyAddress,
                    amount: tx7.amount,
                }),
            ],
            contract,
        });

        // Produce a seperate root with this transaction.
        const txsMain = [transactionMain];
        const rootMain = (new RootHeader({
            rootProducer: producer,
            merkleTreeRoot: merkleTreeRoot(txsMain),
            commitmentHash: utils.keccak256(combine(txsMain)),
            rootLength: utils.hexDataLength(combine(txsMain)),
        }));
        await t.wait(contract.commitRoot(
            rootMain.properties.merkleTreeRoot().get(),
            0,
            0,
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
            inputOutputIndex: 0,
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

            // Submit a prove invalid transaction, ensure no tip has changed.
            const fraudTx = await t.wait(contract[fn](
                ...args, {
                ...overrides,
            }), `prove ${fn} using valid tx`, errors);
            t.equalBig(await contract.blockTip(), blockTip, 'tip');

            // If any events, log them.
            if (fraudTx && fraudTx.events.length) {
                console.log(fraudTx.events[0], fraudTx.events[0].args);

                if (fraudTx.events[1]) {
                    console.log(fraudTx.events[1]);
                }
            }
        }

        // Prove Invalid Tx is Valid.
        await commitFraudProof(
            'proveInvalidTransaction',
            [
                proofMain.encodePacked(),
            ],
        );

        // Try input 0.
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx0.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx0.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );

        // Try input 1.
        proofMain.properties.inputOutputIndex().set(1);
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx1.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx1.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );

        // Try input 2.
        proofMain.properties.inputOutputIndex().set(2);
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx2.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx2.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );

        // Try input 3.
        proofMain.properties.inputOutputIndex().set(3);
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx3.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx3.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );

        // Try input 4.
        proofMain.properties.inputOutputIndex().set(4);
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx4.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx4.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );

        // Try input 5.
        proofMain.properties.inputOutputIndex().set(5);
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx5.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx5.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );

        // Try input 6.
        proofMain.properties.inputOutputIndex().set(6);
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx6.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx6.proof.encodePacked(),
                proofMain.encodePacked(),
            ],
        );

        // Try input 7.
        proofMain.properties.inputOutputIndex().set(7);
        await commitFraudProof(
            'proveInvalidInput',
            [
                tx7.proof.encode(), // deposit encode
                proofMain.encodePacked(),
            ],
        );
        await commitFraudProof(
            'proveDoubleSpend',
            [
                tx3.proof.encodePacked(),
                tx6.proof.encodePacked(),
            ],
        );

        // Check witness for all inputs.
        for (var inputIndex = 0; inputIndex < 8; inputIndex++) {
            proofMain.properties.inputOutputIndex().set(inputIndex);
            proofMain.properties.token()
                .set(producer);
            proofMain.properties.selector()
                .set(producer);

            await commitFraudProof(
                'proveInvalidWitness',
                [
                    proofMain.encodePacked(),
                    chunkJoin([
                        setTxOwnerAndReturnOwner(tx0).encodePacked(),
                        setTxOwnerAndReturnOwner(tx1).encodePacked(),
                        setTxOwnerAndReturnOwner(tx2).encodePacked(),
                        setTxOwnerAndReturnOwner(tx3).encodePacked(),
                        setTxOwnerAndReturnOwner(tx4).encodePacked(),
                        setTxOwnerAndReturnOwner(tx5).encodePacked(),
                        tx6.proof.encodePacked(), // root
                        tx7.proof.encode(), // deposit
                    ]),
                ],
            );
        }

        // Check Invalid Sum for all inputs.
        proofMain.properties.token()
            .set(erc20.address);
        await commitFraudProof(
            'proveInvalidSum',
            [
                proofMain.encodePacked(),
                chunkJoin([
                    tx0.utxo.encode(),
                    tx1.utxo.encode(),
                    tx2.utxo.encode(),
                    tx3.utxo.encode(),
                    tx4.utxo.encode(),
                    tx5.utxo.encode(),
                    tx6.root.encodePacked(), // root
                    tx7.proof.encode(), // deposit
                ]),
            ],
        );

    }

    // Empty state.
    await state();
    
});