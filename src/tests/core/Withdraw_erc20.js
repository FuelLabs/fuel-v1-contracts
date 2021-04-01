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
const { BlockHeader, RootHeader, merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const protocol = require('@fuel-js/protocol'); 
const { defaults } = require('../utils/harness');
const TransactionProof = require('../utils/transactionProof');
const DSTokenAbi = require('../utils/dstoken.abi.json');
const DSBytecode = require('../utils/dstoken.bytecode.js');
const DSToken = { abi: DSTokenAbi, bytecode: DSBytecode };

/// @dev Test various complex summing cases with different witness, input, output and metadata configurations.
module.exports = test('Accounting', async t => {

    // Producer.
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

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

    t.equalBig(await t.getProvider().getBalance(contract.address), 0, 'no ether pre block 1');

    // Produce 8 blocks for 8 roots to spend.
    const block1 = await produceBlock([], 34000, 0);


    t.equalBig(await t.getProvider().getBalance(contract.address), utils.parseEther('1.0'), 'ether post block 1');

    t.equalBig(await erc20.balanceOf(contract.address), depositValue, 'balance during operation');

    // The inputs and metadata now matter, for complexity sake we will do a root.
    const txData = [ deposit.keccak256() ];
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
        outputs: [
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x01',
            }),
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x00',
            }),
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x00',
            }),
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x00',
            }),
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x00',
            }),
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x00',
            }),
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x00',
            }),
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                owner: producer,
                token: '0x01',
            }),
        ],
        chainId: 1,
        contract,
    });

    async function produceTxData(last = {}, opts = {}) {
        return await tx.Transaction({
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
            outputs: [
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value.div(2),
                    owner: utils.emptyAddress,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value.div(2),
                    owner: utils.emptyAddress,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value.div(2),
                    owner: utils.emptyAddress,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value.div(2),
                    owner: utils.emptyAddress,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value.div(2),
                    owner: utils.emptyAddress,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value.div(2),
                    owner: utils.emptyAddress,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: deposit.object().value.div(2),
                    owner: utils.emptyAddress,
                    token: '0x00',
                }),
                last,
            ],
            chainId: 1,
            contract,
        });
    }

    const transactionData2 = await produceTxData(
        protocol.outputs.OutputWithdraw({
            amount: deposit.object().value.div(2),
            owner: '0x01',
            token: '0x01',
        }),
    );

    t.equalBig(await t.getProvider().getBalance(contract.address), utils.parseEther('1.0'), 'ether post block 1');

    // Produce a block with this transaciton inside it.
    const block2 = await produceBlock([
        transactionData,
    ], 0, 0, {
        inputOutputIndex: 0,
        data: txData,
        addressA: erc20.address,
        addressB: producer,
        signatureFee: 0,
        signatureFeeToken: 0,
    });

    t.equalBig(await t.getProvider().getBalance(contract.address), utils.parseEther('2.0'), 'ether post block 2');

    // Increase block to finality.
    await t.increaseBlock(await contract.FINALIZATION_DELAY());

    t.equalBig(await erc20.balanceOf(contract.address), depositValue, 'balance before withdraw');

    let preERC20Balance = await erc20.balanceOf(producer);

    // withdraw.
    await t.wait(contract.withdraw(block2.proof.encodePacked(), {
      ...overrides,
    }), 'withdraw ' + token, errors);

    t.equalBig(await erc20.balanceOf(contract.address), deposit.object().value.div(2), 'balance after withdraw in Fuel');

    t.equalBig(await t.getProvider().getBalance(contract.address), utils.parseEther('2.0'), 'ether pre block withdraw 1');

    t.equalBig(await erc20.balanceOf(producer),
        preERC20Balance.add(deposit.object().value.div(2)),
        'balance after withdraw in Fuel');

    // Attempt same withdrawal again.
    await t.revert(
        contract.withdraw(
            block2.proof.encodePacked(),
            t.getOverrides(),
        ),
        errors['withdrawal-occured'],
        'withdrawal-occured',
        errors,
    );

    // Produce a block with this transaciton inside it.
    const block3 = await produceBlock([
        await produceTxData(
            protocol.outputs.OutputWithdraw({
                amount: deposit.object().value.div(2),
                noshift: true, // <-- try with no shift
                owner: '0x01',
                token: '0x01',
            }),
        ),
    ], 0, 0, {
        inputOutputIndex: 7,
        data: txData,
        addressA: erc20.address,
        addressB: producer,
        signatureFee: 0,
        signatureFeeToken: 0,
    });

    // Increase block to finality.
    await t.increaseBlock(await contract.FINALIZATION_DELAY());

    preERC20Balance = await erc20.balanceOf(producer);

    // withdraw.
    await t.wait(contract.withdraw(block3.proof.encodePacked(), {
        ...overrides,
      }), 'withdraw ' + token, errors);

    t.equalBig(await erc20.balanceOf(contract.address), 0, 'balance after withdraw in Fuel');

    t.equalBig(await t.getProvider().getBalance(contract.address), utils.parseEther('3.0'), 'ether pre block withdraw 2');

    t.equalBig(await erc20.balanceOf(producer),
        preERC20Balance.add(deposit.object().value.div(2)),
        'balance after withdraw in Fuel');

    // Attempt same withdrawal again.
    await t.revert(
        contract.withdraw(
            block3.proof.encodePacked(),
            t.getOverrides(),
        ),
        errors['withdrawal-occured'],
        'withdrawal-occured',
        errors,
    );

    async function state(opts = {}) {
        const _block = await produceBlock([
            await produceTxData(
                opts.last || protocol.outputs.OutputWithdraw({
                    amount: deposit.object().amount,
                    owner: '0x01',
                    token: '0x01',
                }),
            ),
        ], 0, 0, {
            inputOutputIndex: 7,
            data: txData,
            addressA: erc20.address,
            addressB: producer,
            signatureFee: 0,
            signatureFeeToken: 0,
            ...opts,
        });

        // Increase block to finality.
        await t.increaseBlock(await contract.FINALIZATION_DELAY());

        // Reverted.
        if (opts.revert) {
            // Check revert.
            await t.revert(
                contract.withdraw(
                    _block.proof.encodePacked(),
                    t.getOverrides(),
                ),
                errors[opts.revert],
                opts.revert,
                errors,
            );

            // Stop.
            return;
        }
    }

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: utils.emptyAddress,
            token: '0x01',
        }),
        addressB: utils.emptyAddress,
        revert: 'null-owner',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x01',
            token: '0x01',
        }),
        addressB: utils.emptyAddress,
        revert: 'output-owner',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x02',
            token: '0x01',
        }),
        addressB: producer,
        revert: 'output-owner',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: utils.emptyAddress,
            token: '0x01',
        }),
        addressB: producer,
        revert: 'output-owner',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x00',
            token: '0x01',
        }),
        addressB: producer,
        revert: 'output-owner',
    });
    
    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x01',
            token: '0x01',
        }),
        addressA: producer, // <-- invalid
        revert: 'token-id',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x01',
            token: '0x01',
        }),
        addressA: utils.emptyAddress, // <-- invalid
        revert: 'token-id',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x01',
            token: '0x00000001',
        }),
        addressA: utils.emptyAddress, // <-- invalid
        revert: 'token-id',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x01',
            token: '0x00000001',
        }),
        addressA: producer, // <-- invalid
        revert: 'token-id',
    });

    await state({
        last: protocol.outputs.OutputWithdraw({
            amount: deposit.object().amount,
            owner: '0x01',
            token: '0x00000001',
        }),
        addressA: producer, // <-- invalid
        revert: 'token-id',
    });
});
