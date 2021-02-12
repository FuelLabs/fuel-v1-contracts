const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const { BlockHeader, RootHeader, Leaf, merkleTreeRoot } = require('@fuel-js/protocol2/src/block');
const protocol = require('@fuel-js/protocol2');
const { defaults } = require('../utils/harness');
const DSTokenAbi = require('../utils/dstoken.abi.json');
const DSBytecode = require('../utils/dstoken.bytecode.js');
const DSToken = { abi: DSTokenAbi, bytecode: DSBytecode };

module.exports = test('Withdraw_deep', async t => {
    const minTransactionSize = 44 - 2;
    const maxTransactionSize = 896 - 2; // - 2 for length.

    // Construct contract.
    const state = async (opts = {}) => {
        const producer = t.wallets[0].address;
        const contract = await t.deploy(abi, bytecode, defaults(producer));
        const rootIndex = opts.rootIndex || 0;

        // Total supply.
        const totalSupply = utils.parseEther('1000');
        const erc20 = await t.deploy(DSToken.abi, DSToken.bytecode, [utils.emptyBytes32]);

        const mintTx = await erc20.mint(producer, totalSupply, overrides);
        await mintTx.wait();

        // Token stuff.
        let tokenId = '0x01';
        let numTokens = 2;

        // Try a fuel deposit with ERC20.
        const funnel = await contract.funnel(producer);
        const depositValue = utils.parseEther('21.283000');

        // Do ERC20.
        await t.wait(erc20.transfer(funnel, depositValue, overrides), 'erc20 transfer');

        // Sign with Funnel.
        new protocol.deposit.Deposit({
            token: tokenId,
            owner: producer,
            blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
            value: depositValue,
        });
        await t.wait(
            contract.deposit(producer, erc20.address, overrides),
            'token deposit',
            errors,
        );

        // Do ERC20.
        await t.wait(erc20.transfer(funnel, depositValue, overrides), 'erc20 transfer');

        // Sign with Funnel.
        new protocol.deposit.Deposit({
            token: tokenId,
            owner: producer,
            blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
            value: depositValue,
        });
        await t.wait(
            contract.deposit(producer, erc20.address, overrides),
            'token deposit',
            errors,
        );

        await t.wait(t.wallets[0].sendTransaction({
            ...overrides,
            value: depositValue,
            to: funnel,
        }), 'ether to funnel');

        await t.wait(t.wallets[0].sendTransaction({
            ...overrides,
            value: depositValue,
            to: funnel,
        }), 'ether to funnel');

        await t.wait(
            contract.deposit(producer, utils.emptyAddress, overrides),
            'token deposit',
            errors,
        );
        

    // Test min length.
    const minSizeTx = new Leaf({
        data: chunk(
            utils.hexlify(utils.randomBytes(minTransactionSize))
        ),
    });
    
    const maxNumTxs = 400;
    const txData = [ utils.emptyBytes32 ];
    const transactionData = await protocol.transaction.Transaction({
        witnesses: [ t.wallets[0] ],
        metadata: [ protocol.metadata.MetadataDeposit({
        }) ],
        data: txData, // The root data.
        inputs: [ protocol.inputs.InputDeposit({
        }) ],
        signatureFeeToken: 0,
        signatureFee: 0,
        outputs: [
            protocol.outputs.OutputWithdraw({
                amount: depositValue,
                owner: producer,
                token: '0x01',
            }),
            protocol.outputs.OutputWithdraw({
                amount: depositValue,
                owner: producer,
                token: '0x01',
            }),
            protocol.outputs.OutputWithdraw({
                amount: depositValue,
                owner: producer,
                token: '0x00',
            }),
            protocol.outputs.OutputWithdraw({
                amount: depositValue,
                owner: producer,
                token: '0x00',
            }),
            ...(!opts.fourInputs ? [

                protocol.outputs.OutputWithdraw({
                    amount: depositValue,
                    owner: producer,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: depositValue,
                    owner: producer,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: depositValue,
                    owner: producer,
                    token: '0x00',
                }),
                protocol.outputs.OutputWithdraw({
                    amount: depositValue,
                    owner: producer,
                    token: '0x01',
                }),

            ] : []),
            
        ],
        chainId: 1,
        contract,
    });

      const txs = (new Array(maxNumTxs))
        .fill(minSizeTx)
        .concat(transactionData);
      const token = opts.token || erc20.address;
      const merkleRootA = merkleTreeRoot(txs);
      const commitmentHash = utils.keccak256(combine(txs));
      const numRoots = opts.numRoots || 1;

      let roots = [];
      for (var i = 0; i < numRoots; i++) {
        roots.push(new RootHeader({
          rootProducer: producer,
          merkleTreeRoot: merkleRootA,
          commitmentHash,
          rootLength: utils.hexDataLength(combine(txs)),
          fee: i,
        }));
        const rootTx = await contract.commitRoot(merkleRootA, 0, i, combine(txs), overrides);
        await rootTx.wait();
      }

      const root = roots[rootIndex];

      // commit block
      t.equalBig(await contract.blockTip(), 0, 'tip');
      const header = (new BlockHeader({
        producer,
        height: 1,
        numTokens,
        numAddresses: 1,
        roots: roots.map(_root => _root.keccak256Packed()),
      }));

      const currentBlock = await t.provider.getBlockNumber();
      const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
      const ctx = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, 
        roots.map(_root => _root.keccak256Packed(),
      ), {
        ...overrides,
        value: await contract.BOND_SIZE(),
      }), 'commit block', errors);
      header.properties.blockNumber().set(ctx.events[0].blockNumber);
      t.equalBig(await contract.blockTip(), 1, 'tip');

      // Submit a withdrawal proof.
      const proof = protocol.transaction.TransactionProof({
        block: header,
        root,
        transactions: txs,
        inputOutputIndex: opts.inputOutputIndex || 0,
        transactionIndex: ((opts.override || {}).transactionIndex || 0),
        token,
        rootIndex: opts.prootRootIndex || rootIndex,
        ...(opts.proof || {}),
        override: (opts.override || {}),
        selector: opts.selector || producer,
      });

      // Arguments.
      let arguments = [
        proof.encodePacked(),
      ];
      let method = opts.method || 'withdraw';

      if (opts.finalizationCheck) {
        await t.revert(contract[method](...arguments, {
          ...overrides,
        }), errors['not-finalized'], 'not-finalized');
      }

      // Finalization period.
      if (opts.finalized) {
        await t.increaseBlock(await contract.FINALIZATION_DELAY());
      }

      let preERC20Balance = await erc20.balanceOf(producer);
      let preEtherBalance = await t.getProvider().getBalance(producer);

      if (opts.valid) {
        await t.wait(contract[method](...arguments, {
            ...overrides,
          }), 'submit valid tx', errors);
        t.ok(1, `ok with tx index: ${proof.object().transactionIndex} ${proof.object().rootIndex}`);
      }

      if (opts.erc20BalanceIncrease) {
        t.equalBig(
            await erc20.balanceOf(producer),
            preERC20Balance.add(depositValue),
            'erc20 check',
        );
      }

      if (opts.etherBalanceIncrease) {
        t.equalBig(
            await t.getProvider().getBalance(producer),
            preEtherBalance.add(depositValue),
            'ether check',
        );
      }

      if (opts.revert) {
        // no fraud
        await t.revert(contract[method](...arguments, {
          ...overrides,
        }), errors[opts.revert], opts.revert);
      }

      if (opts.secondWithdrawOutputIndex) {
        preERC20Balance = await erc20.balanceOf(producer);
        preEtherBalance = await t.getProvider().getBalance(producer);

        proof.properties.inputOutputIndex()
            .set(opts.secondWithdrawOutputIndex);
        arguments = [
            proof.encodePacked(),
        ];

        await t.wait(contract[method](...arguments, {
            ...overrides,
          }), 'submit valid tx', errors);
        t.ok(1, `second ok with tx index: ${proof.object().transactionIndex} ${proof.object().rootIndex}`);
      
        if (opts.erc20BalanceIncrease) {
            t.equalBig(
                await erc20.balanceOf(producer),
                preERC20Balance.add(depositValue),
                'erc20 check',
            );
        }

        if (opts.etherBalanceIncrease) {
            t.equalBig(
                await t.getProvider().getBalance(producer),
                preEtherBalance.add(depositValue),
                'ether check',
            );
        }
      }

      if (opts.revert) {
        // no fraud
        await t.revert(contract[method](...arguments, {
          ...overrides,
        }), errors[opts.revert], opts.revert);
        return;
      }

      if (opts.fraud) {
        const fraudTx = await t.wait(contract[method](...arguments, {
          ...overrides,
        }), 'submit fraud transaction', errors);
  
        t.equalBig(await contract.blockTip(), 0, 'tip');

        if (opts.fraud === 'any') {
          t.ok(fraudTx.events[0].args.fraudCode.gt(0), 'fraud exists');
        } else {
          t.equalBig(fraudTx.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
        }
        return;
      }
    }

    await state({
        finalized: true,
        finalizationCheck: true,
        revert: 'root-index-underflow',
        numRoots: 128,
        prootRootIndex: 128, // <-- invalid
        rootIndex: 127,
        override: {
            rootIndex: 128,
        },
        inputOutputIndex: 2,
        token: utils.emptyAddress,
        proof: {
            transactionIndex: 400,
        },
        name: 'attempt successfull withdraw ether',
    });

    await state({
        finalized: true,
        finalizationCheck: true,
        fourInputs: true,
        inputOutputIndex: 4, // <-- overflow
        revert: 'output-position-overflow',
        numRoots: 128,
        rootIndex: 53,
        proof: {
          transactionIndex: 400,
        },
        name: 'attempt overflow output selection',
    });

    await state({
        finalized: true,
        finalizationCheck: true,
        erc20BalanceIncrease: true,
        secondWithdrawOutputIndex: 1,
        revert: 'withdrawal-occured',
        numRoots: 128,
        rootIndex: 0,
        proof: {
          transactionIndex: 400,
        },
        valid: 'valid withdraw',
        name: 'attempt successfull withdraw first root of many',
    });

    await state({
        finalized: true,
        finalizationCheck: true,
        erc20BalanceIncrease: true,
        secondWithdrawOutputIndex: 1,
        revert: 'withdrawal-occured',
        numRoots: 128,
        rootIndex: 53,
        proof: {
          transactionIndex: 400,
        },
        valid: 'valid withdraw',
        name: 'attempt successfull withdraw middle root',
    });

    await state({
      finalized: true,
      finalizationCheck: true,
      erc20BalanceIncrease: true,
      secondWithdrawOutputIndex: 1,
      revert: 'withdrawal-occured',
      numRoots: 128,
      rootIndex: 127,
      proof: {
        transactionIndex: 400,
      },
      valid: 'valid withdraw',
      name: 'attempt successfull withdraw',
    });

    await state({
        finalized: true,
        finalizationCheck: true,
        erc20BalanceIncrease: true,
        secondWithdrawOutputIndex: 7,
        revert: 'withdrawal-occured',
        numRoots: 128,
        rootIndex: 127,
        proof: {
            transactionIndex: 400,
        },
        valid: 'valid withdraw',
        name: 'attempt successfull withdraw',
    });

    await state({
        finalized: true,
        finalizationCheck: true,
        secondWithdrawOutputIndex: 6,
        revert: 'withdrawal-occured',
        numRoots: 128,
        rootIndex: 127,
        inputOutputIndex: 2,
        token: utils.emptyAddress,
        proof: {
            transactionIndex: 400,
        },
        valid: 'valid withdraw',
        name: 'attempt successfull withdraw ether',
    });

    await state({
        finalizationCheck: true,
        revert: 'not-finalized',
        numRoots: 128,
        rootIndex: 127,
        inputOutputIndex: 2,
        token: utils.emptyAddress,
        proof: {
            transactionIndex: 400,
        },
        name: 'attempt successfull withdraw ether',
    });

    await state({
        finalized: true,
        finalizationCheck: true,
        revert: 'transaction-size-minimum',
        numRoots: 128,
        rootIndex: 127,
        inputOutputIndex: 2,
        token: utils.emptyAddress,
        proof: {
            transactionIndex: 401, // <-- invalid
        },
        name: 'attempt successfull withdraw with empty tx',
    });

});
