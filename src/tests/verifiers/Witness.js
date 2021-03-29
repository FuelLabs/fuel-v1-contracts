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
module.exports = test('Witness', async t => {

    // Data hashes for input proofs.
    function inputProofsEncode(proofs = []) {
        // Hash the data proofs.
        return proofs.map(proof => proof.properties.rootProducer // If it's a root.
            ? proof.encodePacked() // if it's a root (we encodePacked the TransactionProof.
            : proof.encode()); // deposit / htlc / transfer / withdraw.
    }

    // Data hashes for input proofs.
    function inputProofHashes(proofs = []) {
        // Hash the data proofs.
        return proofs.map(proof => proof.properties.rootProducer // if it's a root.
            ? proof.root.keccak256Packed() // root.
            : proof.keccak256()); // deposit / htlc / transfer.
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
            : tx.Metadata({})); // for htlc, transfer, root.
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
            inputOutputIndex: 0, // set to zero.
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
            txs,
            feeToken,
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
    const overflowBlock = await produceBlock([], maxNum, 1);

    // Producer Funnel.
    const producerFunnel = await contract.funnel(producer);

    // Construct contract.
    async function state (opts = {}) {
        // Fee.
        const signatureFeeToken = opts.signatureFeeToken || 0;
        const signatureFee = opts.signatureFee || 0;

        // Build a transaction.
        const transaction = await tx.Transaction({
            witnesses: opts.witnesses || [ t.wallets[0] ],
            metadata: inputProofMetadataGenerate(opts.inputs),
            data: opts.data || inputProofHashes(opts.inputs),
            inputs: inputsFromProofs(opts.inputs),
            signatureFeeOutputIndex: opts.signatureFeeOutputIndex,
            signatureFeeToken,
            signatureFee,
            outputs: opts.outputs,
            chainId: 1,
            contract,
        });

        // If nullify the tx witness signature.
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
            opts.rootFee || signatureFee,
            opts.rootFeeToken || signatureFeeToken
        );

        // Submit a withdrawal proof.
        const proof = tx.TransactionProof({
            block: block.block,
            root: block.root,
            transactions: block.txs,
            inputOutputIndex: opts.inputOutputIndex || 0,
            transactionIndex: 0,
            data: opts.proofData || opts.data || inputProofHashes(opts.inputs),
            signatureFeeToken: signatureFeeToken,
            signatureFee: signatureFee,
            token: opts.token || token,
            inputProofs: chunkJoin(inputProofsEncode(opts.inputs)),
        });

        // Argument.
        const arg1 = proof.encodePacked();
        // const arg2 = chunkJoin(inputProofsEncode(opts.inputs));

        // Generate the fraud hash.
        const fraudHash = utils.keccak256(contract.interface.functions.proveInvalidSum.encode(
            [
                arg1,
                // arg2,
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
                contract.proveInvalidSum(arg1, /* arg2, */ {
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
                contract.proveInvalidSum(arg1, /* arg2, */ {
                    ...overrides,
                }),
                opts.name || 'sum as fraud',
                errors,
            );

            if (!result) {
                t.ok(0, 'not ok');
                return;
            }

            if (result && result.logs && !result.events[0].args) {
                console.log(result.logs);
                t.ok(0, 'not ok');
                return;
            }

            t.equalBig(await contract.blockTip(), block.height.sub(1), 'block retracted');
            if (!result.events || result.logs.length === 0) {
                t.ok(0, 'should be fraud logs');
                return;
            }

            t.equalBig(result.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
            return;
        }

        if (!opts.fraud && !opts.revert) {
            result = await t.wait(
                contract.proveInvalidSum(arg1, /* arg2, */ {
                    ...overrides,
                }),
                opts.valid || 'should be valid',
                errors,
            );

            if (!result) {
                t.ok(0, 'not ok');
                return;
            }

            t.equalBig(await contract.blockTip(), block.height, 'valid tip height');
        }

        // No result.
        if (!result) {
            return;
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

    await state ({
        witnesses: [ t.wallets[0] ],
        inputs: [
            protocol.outputs.UTXO({
                outputIndex: 0,
                outputType: 2,
                amount: utils.parseEther('0.43'),
                owner: utils.emptyAddress, // <-- testing this.
                token: 0,
                digest: utils.randomBytes(32),
                expiry: 3,
                returnOwner: utils.emptyAddress, // <-- testing this.
            }),
        ],
        outputs: [
            protocol.outputs.OutputTransfer({
                amount: utils.parseEther('0.43'),
                token: 0,
                owner: producer,
            }),
        ],
        nullifyWitness: true, // <--- will nullify witness in tx.
        revert: 'htlc-witness-signature',
        token: utils.emptyAddress,
        valid: 'htlc return owner caller funnel with invalid null witness',
    });

    await state ({
        witnesses: [ t.wallets[0] ],
        inputs: [
            protocol.outputs.UTXO({
                outputIndex: 0,
                outputType: 2,
                amount: utils.parseEther('0.43'),
                owner: utils.emptyAddress, // <-- testing this.
                token: 0,
                digest: utils.randomBytes(32),
                expiry: 500000,
                returnOwner: utils.emptyAddress, // <-- testing this.
            }),
        ],
        outputs: [
            protocol.outputs.OutputTransfer({
                amount: utils.parseEther('0.43'),
                token: 0,
                owner: producer,
            }),
        ],
        nullifyWitness: true, // <--- will nullify witness in tx.
        revert: 'htlc-witness-signature',
        token: utils.emptyAddress,
        valid: 'htlc return owner caller funnel with invalid null witness',
    });

    await state ({
        witnesses: [ { _caller: true }],
        inputs: [
            block6.rootTransactionProof,
            block6.rootTransactionProof,
            block6.rootTransactionProof,
            block6.rootTransactionProof,
            block6.rootTransactionProof,
            block6.rootTransactionProof,
            block6.rootTransactionProof,
            block6.rootTransactionProof,
        ],
        data: [
            block6.root.keccak256Packed(),
            block6.root.keccak256Packed(),
            block6.root.keccak256Packed(),
            block6.root.keccak256Packed(),
            block6.root.keccak256Packed(),
            block6.root.keccak256Packed(),
            block6.root.keccak256Packed(),
            block6.root.keccak256Packed(),
        ],
        signatureFeeOutputIndex: 0,
        signatureFee: utils.parseEther('0.00001'),
        outputs: [
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
                noshift: true,
            }),
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
            }),
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
            }),
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
            }),
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
            }),
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
            }),
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
            }),
            protocol.outputs.OutputTransfer({
                amount: block6.amount,
                token: 0,
                owner: producer,
            }),
        ],
        valid: 'all proofs valid',
        name: 'many inputs and outputs all valid',
        token: utils.emptyAddress,
    });

    await state ({
        inputs: [
            protocol.outputs.UTXO({
                outputIndex: 0,
                outputType: 2,
                amount: utils.parseEther('0.43'),
                owner: producer,
                token: 0,
                digest: utils.randomBytes(32),
                expiry: 3,
                returnOwner: producer,
            }),
        ],
        signatureFeeOutputIndex: 0,
        signatureFee: 1,
        outputs: [
            protocol.outputs.OutputTransfer({
                noshift: true,
                amount: utils.parseEther('0.43'),
                token: 0,
                owner: producer,
            }),
        ],
        token: utils.emptyAddress,
        valid: 'htlc return owner funnel',
    });

    await state ({
        inputs: [
            protocol.outputs.UTXO({
                outputIndex: 0,
                outputType: 2,
                amount: utils.parseEther('0.43'),
                owner: producer,
                token: 0,
                digest: utils.randomBytes(32),
                expiry: 3,
                returnOwner: producer,
            }),
        ],
        signatureFeeOutputIndex: 0,
        signatureFee: utils.parseEther('0.0002'),
        outputs: [
            protocol.outputs.OutputTransfer({
                noshift: true,
                amount: utils.parseEther('0.43'),
                token: 0,
                owner: producer,
            }),
        ],
        token: utils.emptyAddress,
        valid: 'normal transfer with fee',
    });

    // Try with both tokens.
    for (const _token of [utils.emptyAddress, token]) {
        
        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 0,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: 0,
                    expiry: 0,
                    returnOwner: producer, // <-- should be this one.
                }),
            ],
            data: [utils.hexlify(utils.randomBytes(32))],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'utxo-proof',
            token: _token,
        });

        
        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer, // <-- should be this one.
                }),
            ],
            data: [utils.hexlify(utils.randomBytes(32))],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'htlc-proof',
            token: _token,
        });

        
        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                deposit
            ],
            data: [utils.hexlify(utils.randomBytes(32))],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'deposit-proof',
            token: _token,
        });

        
        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                block1.rootTransactionProof
            ],
            data: [utils.hexlify(utils.randomBytes(32))],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'root-proof',
            token: _token,
        });

        
        await state ({
            witnesses: [ t.wallets[1] ], // <-- this is invalid
            inputs: [
                block1.rootTransactionProof
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'root-witness-signature',
            name: 'invalid root witness check',
            token: _token,
        });

        await state ({
            inputs: [
                block1.rootTransactionProof, // <-- will check this
                deposit,
            ],
            proofData: [ // the data that goes to the proof:
                block1.root.keccak256Packed(),
                utils.hexlify(utils.randomBytes(32)), // <-- this is invalid
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'root-witness-signature',
            name: 'invalid second data with root witness check in provided tx proof',
            token: _token,
        });

        await state ({
            inputs: [
                deposit, // will check this
                block1.rootTransactionProof,
            ],
            proofData: [ // the data that goes to the proof:
                deposit.keccak256(),
                utils.hexlify(utils.randomBytes(32)), // <-- this is invalid
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'deposit-witness-signature',
            name: 'invalid second data with deposit witness check in provided tx proof',
            token: _token,
        });

        let ___utxo_ = protocol.outputs.UTXO({
            outputIndex: 0,
            outputType: 0,
            amount: utils.parseEther('1'),
            owner: producer,
            token: 0,
            digest: utils.randomBytes(32),
            expiry: 3,
            returnOwner: utils.emptyAddress,
        });
        await state ({
            inputs: [
                ___utxo_,
                block1.rootTransactionProof,
            ],
            proofData: [ // the data that goes to the proof:
                ___utxo_.keccak256(),
                utils.hexlify(utils.randomBytes(32)), // <-- this is invalid
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'transfer-witness-signature',
            name: 'invalid second data with utxo witness check in provided tx proof',
            token: _token,
        });

        let ___utxo_htlc = protocol.outputs.UTXO({
            outputIndex: 0,
            outputType: 2, // <-- htlc
            amount: utils.parseEther('1'),
            owner: producer,
            token: 0,
            digest: utils.randomBytes(32),
            expiry: 3, // <-- is expired.
            returnOwner: producer,
        });
        await state ({
            inputs: [
                ___utxo_htlc,
                block1.rootTransactionProof,
            ],
            proofData: [ // the data that goes to the proof:
                ___utxo_htlc.keccak256(),
                utils.hexlify(utils.randomBytes(32)), // <-- this is invalid
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'htlc-witness-signature',
            name: 'invalid second data with htlc witness check in provided tx proof',
            token: _token,
        });
        
        await state ({
            inputs: [
                deposit,
                block1.rootTransactionProof, // <-- will check this
            ],
            proofData: [ // the data that goes to the proof:
                deposit.keccak256(),
                utils.hexlify(utils.randomBytes(32)), // <-- this is invalid
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'deposit-witness-signature',
            name: 'invalid second data with deposit witness check in provided tx proof',
            token: _token,
        });

        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
            ],
            data: [
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                utils.hexlify(utils.randomBytes(32)), // <-- this is invalid
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            revert: 'root-proof',
            token: _token,
            name: 'does it catch the last invalid hash',
        });

        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
                block1.rootTransactionProof,
            ],
            data: [
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
                block1.root.keccak256Packed(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: 0,
                    owner: producer,
                }),
            ],
            valid: 'all proofs valid',
            name: 'many inputs and outputs all valid',
            token: _token,
        });

        
        await state ({
            witnesses: [ { _caller: true }, t.wallets[0], { _producer: true }, t.wallets[1] ],
            inputs: [
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 0,
                        amount: utils.parseEther('2'),
                        owner: t.wallets[1].address,
                        token: 0,
                        digest: 0,
                        expiry: 0,
                        returnOwner: 0,
                    });
                    input.witnessReference = 3;
                    return input;
                })(),
                deposit, // multi-token
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 2,
                        amount: utils.parseEther('1'),
                        owner: producer,
                        token: 0,
                        digest: utils.randomBytes(32),
                        expiry: 3,
                        returnOwner: producerFunnel,
                    });
                    input.witnessReference = 2;
                    return input;
                })(),
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 2,
                        amount: utils.parseEther('2'),
                        owner: producer,
                        token: 0,
                        digest: utils.randomBytes(32),
                        expiry: 500000000,
                        returnOwner: 0,
                    });
                    input.witnessReference = 1;
                    return input;
                })(),
                block2.rootTransactionProof, // root
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 2,
                        amount: utils.parseEther('1'),
                        owner: producer,
                        token: 0,
                        digest: utils.randomBytes(32),
                        expiry: 3,
                        returnOwner: utils.emptyAddress,
                    });
                    input.witnessReference = 0;
                    return input;
                })(),
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 2,
                        amount: utils.parseEther('100000'),
                        owner: producerFunnel,
                        token: tokenId,
                        digest: utils.randomBytes(32),
                        expiry: 3,
                        returnOwner: utils.emptyAddress,
                    });
                    input.witnessReference = 0;
                    return input;
                })(),
                block9.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('1'),
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputHTLC({
                    amount: utils.parseEther('2'),
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputReturn({
                    data: utils.randomBytes(10),
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.properties.value().get()
                        .add(utils.parseEther('100000')),
                    token: tokenId, // <--- second token
                    owner: producer,
                }),
                protocol.outputs.OutputWithdraw({
                    amount: utils.parseEther('1')
                        .add(block2.amount)
                        .add(utils.parseEther('2')), // from the root.
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block9.amount, // from the second root.
                    token: tokenId,
                    owner: producer,
                }),
                protocol.outputs.OutputReturn({
                    data: utils.randomBytes(100),
                }),
            ],
            token: _token,
            valid: `complex summing all types, different witnesses`,
        });

        
        let ____inputs = [
            (() => {
                let input = protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 0,
                    amount: utils.parseEther('2'),
                    owner: t.wallets[1].address,
                    token: 0,
                    digest: 0,
                    expiry: 0,
                    returnOwner: 0,
                });
                input.witnessReference = 3;
                return input;
            })(),
            deposit, // multi-token
            (() => {
                let input = protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('1'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producerFunnel,
                });
                input.witnessReference = 2;
                return input;
            })(),
            (() => {
                let input = protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('2'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 500000000,
                    returnOwner: 0,
                });
                input.witnessReference = 1;
                return input;
            })(),
            block2.rootTransactionProof, // root
            (() => {
                let input = protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('1'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: utils.emptyAddress,
                });
                input.witnessReference = 0;
                return input;
            })(),
            (() => {
                let input = protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('100000'),
                    owner: producerFunnel,
                    token: tokenId,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: utils.emptyAddress,
                });
                input.witnessReference = 0;
                return input;
            })(),
            block9.rootTransactionProof, // root
        ];
        await state ({
            witnesses: [ { _caller: true }, t.wallets[0], { _producer: true }, t.wallets[1] ],
            inputs: ____inputs,
            data: (() => {
                let hashes = inputProofHashes(____inputs);
                hashes[7] = utils.emptyBytes32;
                return hashes;
            })(),
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('1'),
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputHTLC({
                    amount: utils.parseEther('2'),
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputReturn({
                    data: utils.randomBytes(10),
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.properties.value().get()
                        .add(utils.parseEther('100000')),
                    token: tokenId, // <--- second token
                    owner: producer,
                }),
                protocol.outputs.OutputWithdraw({
                    amount: utils.parseEther('1')
                        .add(block2.amount)
                        .add(utils.parseEther('2')), // from the root.
                    token: 0,
                    owner: producer,
                }),
                protocol.outputs.OutputTransfer({
                    amount: block9.amount, // from the second root.
                    token: tokenId,
                    owner: producer,
                }),
                protocol.outputs.OutputReturn({
                    data: utils.randomBytes(100),
                }),
            ],
            token: _token,
            revert: 'root-proof',
        });

        await state ({
            // witnesses: [ { _caller: true }],
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: utils.hexlify(utils.randomBytes(20)), // <-- this invalid
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'htlc-witness-signature',
        });

        await state ({
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: utils.hexlify(utils.randomBytes(20)), // <-- this invalid
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 5000000,
                    returnOwner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'htlc-witness-signature',
        });

        await state ({
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'htlc return owner funnel',
        });

        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer, // <-- testing this.
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'htlc return owner caller funnel',
        });

        await state ({
            witnesses: [ { _producer: true } ],
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer, // <-- testing this.
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'htlc return owner producer funnel',
        });

        await state ({
            witnesses: [ t.wallets[1] ], // <-- this is invalid
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'htlc-witness-signature',
        });

        await state ({
            witnesses: [ t.wallets[1] ], // <-- this is invalid
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 2,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'htlc-witness-signature',
        });

        await state ({
            witnesses: [ t.wallets[1], { _caller: true } ],
            inputs: [
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 2,
                        amount: utils.parseEther('0.43'),
                        owner: producer,
                        token: 0,
                        digest: utils.randomBytes(32),
                        expiry: 3,
                        returnOwner: producer,
                    });
                    input.witnessReference = 1;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'return owner witnessReferece 1 caller',
        });

        await state ({
            witnesses: [ t.wallets[1], { _caller: true } ],
            inputs: [
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 0,
                        amount: utils.parseEther('0.43'),
                        owner: utils.emptyAddress, // <-- this is invalid.
                        token: 0,
                        digest: utils.randomBytes(32),
                        expiry: 0,
                        returnOwner: utils.emptyAddress,
                    });
                    input.witnessReference = 1;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'transfer-witness-signature',
        });

        await state ({
            witnesses: [ t.wallets[1], { _caller: true } ],
            inputs: [
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 0,
                        amount: utils.parseEther('0.43'),
                        owner: producer,
                        token: 0,
                        digest: utils.randomBytes(32),
                        expiry: 0,
                        returnOwner: utils.emptyAddress,
                    });
                    input.witnessReference = 0;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'transfer-witness-signature',
        });

        await state ({
            witnesses: [ { _producer: true } ],
            inputs: [
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 0,
                        amount: utils.parseEther('0.43'),
                        owner: utils.hexlify(utils.randomBytes(20)), // <-- this is invalid
                        token: 0,
                        digest: 0,
                        expiry: 0,
                        returnOwner: utils.emptyAddress,
                    });
                    input.witnessReference = 0;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'transfer-witness-signature',
        });

        await state ({
            witnesses: [ { _producer: true } ],
            inputs: [
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 0,
                        amount: utils.parseEther('0.43'),
                        owner: utils.hexlify(utils.randomBytes(20)), // <-- this is invalid
                        token: 0,
                        digest: 0,
                        expiry: 0,
                        returnOwner: utils.emptyAddress,
                    });
                    input.witnessReference = 0;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'transfer-witness-signature',
        });

        await state ({
            witnesses: [ { _producer: true } ],
            inputs: [
                (() => {
                    let input = deposit;
                    deposit.properties.owner().set(utils.emptyAddress); // <-- this is invalid
                    input.witnessReference = 0;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: deposit.properties.value().get(),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'deposit-witness-signature',
        });

        await state ({
            witnesses: [ { _caller: true } ],
            inputs: [
                (() => {
                    let input = deposit;
                    deposit.properties.owner().set(utils.emptyAddress); // <-- this is invalid
                    input.witnessReference = 0;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: deposit.properties.value().get(),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'deposit-witness-signature',
        });

        await state ({
            witnesses: [ t.wallets[0] ],
            inputs: [
                (() => {
                    let input = deposit;
                    deposit.properties.owner().set(utils.emptyAddress); // <-- this is invalid
                    input.witnessReference = 0;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: deposit.properties.value().get(),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'deposit-witness-signature',
        });

        await state ({
            witnesses: [ t.wallets[1] ], // <-- this is invalid
            inputs: [
                (() => {
                    let input = deposit;
                    deposit.properties.owner().set(producer);
                    input.witnessReference = 0;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: deposit.properties.value().get(),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'deposit-witness-signature',
        });

        await state ({
            witnesses: [ t.wallets[1], { _caller: true } ],
            inputs: [
                (() => {
                    let input = protocol.outputs.UTXO({
                        outputIndex: 0,
                        outputType: 2,
                        amount: utils.parseEther('0.43'),
                        owner: producer,
                        token: 0,
                        digest: utils.randomBytes(32),
                        expiry: 3,
                        returnOwner: utils.emptyAddress, // <-- this is invalid.
                    });
                    input.witnessReference = 1;
                    return input;
                })(),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            revert: 'htlc-witness-signature',
        });

        // Default summing state.
        await state ({
            inputs: [
                protocol.deposit.Deposit({
                    ...deposit.object(),
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: depositValue,
                    token: tokenId,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'deposit-single',
        });

        // Funnel deposit.
        await state ({
            inputs: [
                protocol.deposit.Deposit({
                    ...deposit.object(),
                    owner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: depositValue,
                    token: tokenId,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'deposit-single-funnel',
        });

        // Funnel producer.
        await state ({
            witnesses: [ { _producer: true }],
            inputs: [
                protocol.deposit.Deposit({
                    ...deposit.object(),
                    owner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: depositValue,
                    token: tokenId,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'deposit-single-funnel',
        });

        // Funnel producer.
        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                protocol.deposit.Deposit({
                    ...deposit.object(),
                    owner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: depositValue,
                    token: tokenId,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'caller funnel single deposit',
        });

        // Funnel producer.
        await state ({
            inputs: [
                protocol.deposit.Deposit({
                    ...deposit.object(),
                    owner: producer,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: depositValue,
                    token: tokenId,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'normal witness funnel',
        });

        // 8 In Deposits, 8 Out Deposits.
        await state ({
            inputs: (new Array(8).fill(0).map(() =>
                protocol.deposit.Deposit({
                    ...deposit.object(),
                }),
            )),
            outputs: (new Array(8).fill(0).map(() =>
                protocol.outputs.OutputTransfer({
                    amount: depositValue,
                    token: tokenId,
                    owner: producer,
                }),
            )),
            token: _token,
            valid: '8in8out',
        });

        // Check with 1 root.
        await state ({
            inputs: [
                block1.rootTransactionProof, // root
                block1.rootTransactionProof, // root
                block1.rootTransactionProof, // root
                block1.rootTransactionProof, // root
                block1.rootTransactionProof, // root
                block1.rootTransactionProof, // root
                block1.rootTransactionProof, // root
                block1.rootTransactionProof, // root
            ],
            outputs: (new Array(8).fill(0).map(() =>
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: block1.feeToken,
                    owner: producer,
                }),
            )),
            token: _token,
            valid: '1-in-1out with root',
        });

        // Check with 1 root.
        await state ({
            witnesses: [ t.wallets[0] ],
            inputs: [
                block1.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: block1.feeToken,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'root with signature',
        });

        // Check with 1 root.
        await state ({
            witnesses: [ { _caller: true } ],
            inputs: [
                block1.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: block1.feeToken,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'root with caller',
        });

        // Check with 1 root.
        await state ({
            witnesses: [ { _producer: true } ],
            inputs: [
                block1.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: block1.feeToken,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'root with producer',
        });

        // Check with 8 roots.
        await state ({
            inputs: [
                block1.rootTransactionProof, // root
                block2.rootTransactionProof, // root
                block3.rootTransactionProof, // root
                block4.rootTransactionProof, // root
                block5.rootTransactionProof, // root
                block6.rootTransactionProof, // root
                block7.rootTransactionProof, // root
                block8.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount
                        .add(block2.amount)
                        .add(block3.amount)
                        .add(block4.amount)
                        .add(block5.amount)
                        .add(block6.amount)
                        .add(block7.amount)
                        .add(block8.amount),
                    token: block1.feeToken,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: '8 roots in',
        });

        // Check with 4 roots.
        await state ({
            inputs: [
                block1.rootTransactionProof, // root
                block2.rootTransactionProof, // root
                block3.rootTransactionProof, // root
                block4.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount
                        .add(block2.amount)
                        .add(block3.amount)
                        .add(block4.amount),
                    token: block1.feeToken,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: '4 roots in',
        });

        // Check with state.
        await state ({
            witnesses: [
                { _caller: true },
            ],
            inputs: [
                block1.rootTransactionProof, // root
                block2.rootTransactionProof, // root
                block3.rootTransactionProof, // root
                block4.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount
                        .add(block2.amount)
                        .add(block3.amount)
                        .add(block4.amount),
                    token: block1.feeToken,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'caller 4 roots',
        });

        // Check with producer.
        await state ({
            witnesses: [
                { _producer: true },
            ],
            inputs: [
                block1.rootTransactionProof, // root
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: block1.amount,
                    token: block1.feeToken,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'producer 4 roots',
        });

        
        await state ({
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 0,
                    amount: 1,
                    owner: producer,
                    token: 0,
                    digest: 0,
                    expiry: 0,
                    returnOwner: 0,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: 1,
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'utxo in',
        });
        
        
        await state ({
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 0,
                    amount: 0,
                    owner: producer,
                    token: 0,
                    digest: 0,
                    expiry: 0,
                    returnOwner: 0,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: 0,
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'utxo in zero',
        });

        
        await state ({
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 0,
                    amount: 0,
                    owner: producer,
                    token: 0,
                    digest: 0,
                    expiry: 0,
                    returnOwner: 0,
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: 0,
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: '1 utxo in funnel',
        });

        await state ({
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: protocol.outputs.OutputTypes.HTLC,
                    amount: 0,
                    owner: producer,
                    token: 0,
                    digest: 0,
                    expiry: 0,
                    returnOwner: producer, // <- testing this
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: 0,
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'htlc-in',
        });

        
        await state ({
            inputs: (new Array(8)).fill(0).map(() => 
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 0,
                    amount: 0, // note zero value
                    owner: producer,
                    token: 0,
                    digest: 0,
                    expiry: 0,
                    returnOwner: 0,
                }),
            ),
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: 0,
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: '1 utxo in funnel',
        });

        
        await state ({
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 1,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer, // <-- should be this one.
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'htlc returnOwner witness recovery',
        });

        
        await state ({
            witnesses: [ { _producer: true }],
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 1,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer, // <-- should be this one.
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            token: _token,
            valid: 'htlc returnOwner with producer',
        });

        await state ({
            witnesses: [ { _caller: true }],
            inputs: [
                protocol.outputs.UTXO({
                    outputIndex: 0,
                    outputType: 1,
                    amount: utils.parseEther('0.43'),
                    owner: producer,
                    token: 0,
                    digest: utils.randomBytes(32),
                    expiry: 3,
                    returnOwner: producer, // <-- should be this one.
                }),
            ],
            outputs: [
                protocol.outputs.OutputTransfer({
                    amount: utils.parseEther('0.43'),
                    token: 0,
                    owner: producer,
                }),
            ],
            valid: 'htlc returnOwner with caller',
            token: _token,
        });
    }

});
