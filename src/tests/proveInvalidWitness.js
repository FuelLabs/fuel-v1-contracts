const {test, utils, overrides} = require('@fuel-js/environment');
const {chunk, pack, combine} = require('@fuel-js/struct');
const {bytecode, abi, errors} = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const {BlockHeader, RootHeader, Leaf, merkleTreeRoot, transactions, hashes} =
    require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const {Deposit} = require('@fuel-js/protocol/src/deposit');
const {defaults} = require('./harness');

module.exports = test('proveInvalidWitness', async t => {
  try {
    // Construct contract
    async function state(opts = {}) {
      const {useErc20, attemptDoubleWithdraw} = opts;
      const producer = t.wallets[0].address;
      const contract = await t.deploy(abi, bytecode, defaults(producer));

      const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
      const erc20 =
          await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

      let token = utils.emptyAddress;
      let tokenId = '0x00';
      let numTokens = 1;

      // try an ether deposit
      const funnela = await contract.funnel(producer);
      const valuea = utils.bigNumberify(1000);

      if (useErc20 === true) {
        await t.wait(
            erc20.transfer(funnela, valuea, overrides), 'erc20 transfer');
        token = erc20.address;
        tokenId = '0x01';
        numTokens = 2;
      } else {
        await t.wait(
            t.wallets[0].sendTransaction({
              ...overrides,
              value: valuea,
              to: funnela,
            }),
            'ether to funnel');
      }

      const deposit = new Deposit({
        token: tokenId,
        owner: producer,
        blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
        value: valuea,
      });
      const etx = await t.wait(
          contract.deposit(producer, token, overrides), 'ether deposit',
          errors);

      let owner = producer;
      let outputOwner = producer;

      if (opts.funnel) {
        owner = await contract.funnel(producer);
        outputOwner = owner;
      }

      if (opts.commitAddress) {
        await contract.commitAddress(owner, overrides);
        owner = '0x01';
      }

      let specifiedOutputs = [
        tx.OutputTransfer({
          amount: 100,
          token: tokenId,
          owner,
        }),
        tx.OutputWithdraw({
          amount: 500,
          token: tokenId,
          owner: producer,
        })
      ];

      let returnOwner =
          (opts.fraud === 'htlc-owner-return' ? utils.emptyAddress : producer);

      if (opts.htlc) {
        specifiedOutputs = [tx.OutputHTLC({
          amount: 100,
          token: tokenId,
          owner: opts.commitAddress ? (opts.funnel ? owner : producer) : owner,
          digest: utils.emptyBytes32,
          expiry: opts.fraud === 'htlc-owner-return' ? 0 : 50000,
          returnOwner: opts.commitAddress ? (opts.funnel ? owner : producer) :
                                            owner,
        })];
      }

      // build a transaction
      const transaction = await tx.Transaction(
          {
            inputs: [tx.InputDeposit({
              witnessReference: 0,
              owner: producer,
            })],
            witnesses: [t.wallets[0]],
            metadata: [tx.MetadataDeposit(deposit)],
            data: [deposit.keccak256()],
            outputs: specifiedOutputs,
            chainId: 1,
            contract,
          });

      let utxo = new tx.UTXO({
        transactionHashId: transaction.transactionHashId(),
        outputIndex: 0,
        outputType: opts.htlc ? tx.OutputTypes.HTLC : 0,
        amount: 100,
        token: tokenId,
        owner: opts.commitAddress ? (opts.funnel ? outputOwner : producer) :
                                    outputOwner,
        expiry: opts.htlc ? (opts.fraud === 'htlc-owner-return' ? 0 : 50000) :
                            0,
        digest: opts.htlc ? utils.emptyBytes32 : utils.emptyBytes32,
        returnOwner: opts.htlc ?
            (opts.commitAddress ? (opts.funnel ? outputOwner : producer) :
                                  outputOwner) :
            utils.emptyAddress,
      });

      let txInputs = [tx.InputTransfer({
        witnessReference: 0,
      })];

      if (opts.htlc) {
        txInputs = [tx.InputHTLC({
          witnessReference: 0,
          preImage: utils.emptyBytes32,
        })];
      }

      let txMetadata = [tx.Metadata(
          {blockHeight: 1, rootIndex: 0, transactionIndex: 0, outputIndex: 0})];

      let data = [utxo.keccak256()];

      let inputs = null;

      if (opts.revert === 'utxo-data') {
        data = [utils.emptyBytes32];
      }

      if (opts.deposit) {
        txInputs = [tx.InputDeposit({
          witnessReference: 0,
          owner: producer,
        })];
        txMetadata = [tx.MetadataDeposit({
          token: tokenId,
          blockNumber: deposit.properties.blockNumber().get(),
        })];
        data = [deposit.keccak256()];
        inputs = deposit.encode();
      }

      if (opts.revert === 'deposit-token') {
        txInputs = [tx.InputDeposit({
          witnessReference: 0,
          owner: producer,
        })];
        txMetadata = [tx.MetadataDeposit({
          token: '0x02',
          blockNumber: deposit.properties.blockNumber().get(),
        })];
        data = [deposit.keccak256()];
        inputs = deposit.encode();
      }

      if (opts.revert === 'deposit-block-number') {
        txInputs = [tx.InputDeposit({
          witnessReference: 0,
          owner: producer,
        })];
        txMetadata = [tx.MetadataDeposit({
          token: tokenId,
          blockNumber: 0,
        })];

        data = [deposit.keccak256()];
        inputs = deposit.encode();
      }

      if (opts.revert === 'deposit-data') {
        txInputs = [tx.InputDeposit({
          witnessReference: 0,
          owner: producer,
        })];
        txMetadata = [tx.MetadataDeposit({
          token: tokenId,
          blockNumber: deposit.properties.blockNumber().get(),
        })];
        data = [utils.emptyBytes32];
        inputs = deposit.encode();
      }

      let baseWitness0 = t.wallets[0];
      let baseWitness1 = t.wallets[1];

      let txWitnesses = [baseWitness0];

      if (opts.fraud === 'utxo-witness' || opts.fraud === 'htlc-owner-return' ||
          opts.fraud === 'htlc-owner') {
        txWitnesses = [baseWitness1];
      }

      let transactionB = await tx.Transaction(
          {
            override: true,
            inputs: txInputs,
            witnesses: txWitnesses,
            metadata: txMetadata,
            data,
            outputs: [tx.OutputTransfer({
              amount: 100,
              token: tokenId,
              owner: producer,
            })],
            chainId: 1,
            contract,
          });

      if (opts.caller) {
        const txBId = transactionB.transactionHashId();
        const callerTx =
            await contract.commitWitness(txBId, {
              ...overrides,
            });
        const callerWait = await callerTx.wait();
        const blockNum = (callerWait).blockNumber;
        transactionB.witnesses([tx.Caller({
          owner: producer,
          blockNumber: blockNum,
        })]);
        const callerEvent = callerWait.events[0];
        t.equalHex(callerEvent.args.owner, producer, 'caller producer');
        t.equalBig(callerEvent.args.blockNumber, blockNum, 'caller blockNumber');
        t.equalHex(callerEvent.args.transactionId, txBId, 'caller tx Id');

        const otherContract = contract.connect(t.wallets[1]);
        const callerTx2 = await otherContract.commitWitness(
            transactionB.transactionHashId(), {
              ...overrides,
            });

        if (opts.fraud === 'utxo-witness' ||
            opts.fraud === 'htlc-owner-return' || opts.fraud === 'htlc-owner') {
          transactionB.witnesses([tx.Caller({
            owner: t.wallets[1].address,
            blockNumber: (await callerTx2.wait()).blockNumber,
          })]);
        }
      }

      if (opts.producer) {
        transactionB.witnesses([tx.Producer({
          hash: transactionB.transactionHashId(),
        })]);

        if (opts.fraud === 'utxo-witness' ||
            opts.fraud === 'htlc-owner-return' || opts.fraud === 'htlc-owner') {
          transactionB.witnesses([tx.Producer({
            hash: utils.emptyBytes32,
          })]);
        }
      }

      // produce it in a block
      const txs = [transaction, transactionB];
      const root = (new RootHeader({
        rootProducer: producer,
        merkleTreeRoot: merkleTreeRoot(txs),
        commitmentHash: utils.keccak256(combine(txs)),
        rootLength: utils.hexDataLength(combine(txs)),
      }));
      await t.wait(
          contract.commitRoot(
              root.properties.merkleTreeRoot().get(), 0, 0, combine(txs),
              overrides),
          'valid submit', errors);
      const header = (new BlockHeader({
        producer,
        height: 1,
        numTokens,
        numAddresses: opts.commitAddress ? 2 : 1,
        roots: [root.keccak256Packed()],
      }));

      const currentBlock = await t.provider.getBlockNumber();
      const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
      const block = await t.wait(
          contract.commitBlock(currentBlock, currentBlockHash, 1, [root.keccak256Packed()], {
            ...overrides,
            value: await contract.BOND_SIZE(),
          }),
          'commit block', errors);
      header.properties.blockNumber().set(block.events[0].blockNumber);
      t.equalBig(await contract.blockTip(), 1, 'tip');

      // submit a withdrawal proof
      let proof = tx.TransactionProof({
        block: header,
        root,
        rootIndex: 0,
        transactions: txs,
        inputOutputIndex: 0,
        transactionIndex: 1,
        token: opts.commitAddress ? (opts.funnel ? outputOwner : producer) :
                                    outputOwner,
        selector: opts.commitAddress ? (opts.funnel ? outputOwner : producer) :
                                       outputOwner,
      });

      let inputOutputIndex = 0;

      if (opts.revert === 'output-id') {
        inputOutputIndex = 1;
      }

      if (inputs === null) {
        inputs = tx.TransactionProof({
                     block: header,
                     root,
                     rootIndex: 0,
                     transactions: txs,
                     inputOutputIndex,
                     transactionIndex: 0,
                     token: opts.commitAddress ?
                         (opts.funnel ? outputOwner : producer) :
                         outputOwner,
                     selector: opts.commitAddress ?
                         (opts.funnel ? outputOwner : producer) :
                         outputOwner,
                   }).encodePacked();
      }

      if (opts.root) {
        txInputs = [tx.InputRoot({
          witnessReference: 0,
        })];

        txMetadata = [tx.Metadata({
          blockHeight: 1,
          rootIndex: 0,
          transactionIndex: 0,
          outputIndex: 0
        })];

        if (opts.fraud === 'root-witness') {
          txWitnesses = [t.wallets[1]];
        }

        data =
            [opts.revert === 'root-data' ? utils.emptyBytes32 :
                                           root.keccak256Packed()];
        transactionB = await tx.Transaction(
            {
              override: true,
              inputs: txInputs,
              witnesses: txWitnesses,
              metadata: txMetadata,
              data,
              outputs: [tx.OutputTransfer({
                amount: 100,
                token: tokenId,
                owner: producer,
              })],
              chainId: 1,
              contract,
            });

        if (opts.caller) {
          const callerTx3 =
              await contract.commitWitness(transactionB.transactionHashId(), {
                ...overrides,
              });

          transactionB.witnesses([tx.Caller({
            owner: t.wallets[0].address,
            blockNumber: (await callerTx3.wait()).blockNumber,
          })]);

          if (opts.fraud === 'root-witness') {
            transactionB.witnesses([tx.Caller({
              owner: t.wallets[1].address,
              blockNumber: (await callerTx3.wait()).blockNumber,
            })]);
          }
        }

        if (opts.producer) {
          transactionB.witnesses([tx.Producer({
            hash: transactionB.transactionHashId(),
          })]);

          if (opts.fraud === 'root-witness') {
            transactionB.witnesses([tx.Producer({
              hash: utils.emptyBytes32,
            })]);
          }
        }

        const txs2 = [transactionB];

        let signatureFee = 0;
        let signatureFeeToken = 0;

        if (opts.revert === 'invalid-fee') {
          signatureFee = 45;
        }

        if (opts.revert === 'invalid-fee-token') {
          signatureFeeToken = 1;
        }

        const root2 = (new RootHeader({
          rootProducer: producer,
          merkleTreeRoot: merkleTreeRoot(txs2),
          commitmentHash: utils.keccak256(combine(txs2)),
          rootLength: utils.hexDataLength(combine(txs2)),
          feeToken: signatureFeeToken,
          fee: signatureFee,
        }));
        await t.wait(
            contract.commitRoot(
                root2.properties.merkleTreeRoot().get(),
                signatureFeeToken,
                signatureFee,
                combine(txs2),
                overrides),
            'valid submit', errors);

        await t.wait(
            contract.commitBlock(currentBlock, currentBlockHash, 2, [root2.keccak256Packed()], {
              ...overrides,
              value: await contract.BOND_SIZE(),
            }),
            'commit second block', errors);
        t.equalBig(await contract.blockTip(), 2, 'tip');

        proof = tx.TransactionProof({
          block: await BlockHeader.fromLogs(2, contract),
          root: root2,
          rootIndex: 0,
          transactions: txs2,
          inputOutputIndex: 0,
          transactionIndex: 0,
          signatureFeeToken: 0,
          signatureFee: 0,
          token: producer,
        });
      }

      // Generate the fraud hash
      const fraudHash = utils.keccak256(contract.interface.functions.proveInvalidWitness.encode(
        [
          proof.encodePacked(),
          inputs
        ],
      ));

      // Commit the fraud hash.
      await t.wait(contract.commitFraudHash(fraudHash, {
        ...overrides,
      }), 'commit fraud hash', errors);

      // Wait 10 blocks for fraud finalization.
      await t.increaseBlock(10);

      if (opts.fraud) {
        const fraudTx = await t.wait(
            contract.proveInvalidWitness(proof.encodePacked(), inputs, {
              ...overrides,
            }),
            'submit fraud: ' + opts.fraud, errors);

        t.equalBig(await contract.blockTip(), opts.root ? 1 : 0, 'tip');
        t.equalBig(
            fraudTx.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
        return;
      }

      if (opts.revert) {
        await t.revert(
            contract.proveInvalidWitness(proof.encodePacked(), inputs, {
              ...overrides,
            }),
            errors[opts.revert], opts.revert, errors);
        t.equalBig(await contract.blockTip(), opts.root ? 2 : 1, 'tip');
        return;
      }

      await t.wait(
          contract.proveInvalidWitness(proof.encodePacked(), inputs, {
            ...overrides,
          }),
          'no fraud', errors);
      t.equalBig(await contract.blockTip(), opts.root ? 2 : 1, 'tip');
    }

    await state({useErc20: false});
    await state({useErc20: true});

    await state({useErc20: false, funnel: true});
    await state({useErc20: true, funnel: true});

    await state({useErc20: false, commitAddress: true});
    await state({useErc20: true, commitAddress: true});

    await state({useErc20: false, funnel: true, commitAddress: true});
    await state({useErc20: true, funnel: true, commitAddress: true});

    await state({useErc20: false, caller: true});
    await state({useErc20: true, caller: true});

    await state({useErc20: false, producer: true});
    await state({useErc20: true, producer: true});

    await state({useErc20: true, deposit: true});
    await state({useErc20: true, caller: true, deposit: true});
    await state({useErc20: true, producer: true, deposit: true});
    await state({useErc20: true, revert: 'output-id'});
    await state({useErc20: true, revert: 'deposit-token'});
    await state({useErc20: true, revert: 'deposit-block-number'});
    await state({useErc20: true, revert: 'deposit-data'});

    await state({useErc20: true, root: true});
    await state({useErc20: true, caller: true, root: true});
    await state({useErc20: true, root: true, revert: 'root-data'});

    await state({useErc20: true, commitAddress: true, htlc: true});
    await state(
        {useErc20: true, commitAddress: true, caller: true, htlc: true});
    await state(
        {useErc20: true, commitAddress: true, producer: true, htlc: true});
    await state({useErc20: true, commitAddress: true, fraud: 'utxo-witness'});
    await state({
      useErc20: true,
      commitAddress: true,
      root: true,
      fraud: 'root-witness'
    });
    await state({
      useErc20: true,
      commitAddress: true,
      htlc: true,
      fraud: 'htlc-owner-return'
    });
    await state(
        {useErc20: true, commitAddress: true, htlc: true, fraud: 'htlc-owner'});

    await state({useErc20: true, root: true, revert: 'invalid-fee'});
    await state({useErc20: true, root: true, revert: 'invalid-fee-token'});
    await state({useErc20: true, fraud: 'utxo-witness'});
    await state({useErc20: true, root: true, fraud: 'root-witness'});
    await state({useErc20: true, htlc: true, fraud: 'htlc-owner-return'});
    await state({useErc20: true, htlc: true, fraud: 'htlc-owner'});

    await state({useErc20: true, caller: true, fraud: 'utxo-witness'});
    await state(
        {useErc20: true, caller: true, root: true, fraud: 'root-witness'});
    await state(
        {useErc20: true, caller: true, htlc: true, fraud: 'htlc-owner-return'});
    await state(
        {useErc20: true, caller: true, htlc: true, fraud: 'htlc-owner'});

    await state(
        {useErc20: true, funnel: true, caller: true, fraud: 'utxo-witness'});
    await state({
      useErc20: true,
      funnel: true,
      caller: true,
      root: true,
      fraud: 'root-witness'
    });
    await state({
      useErc20: true,
      funnel: true,
      caller: true,
      htlc: true,
      fraud: 'htlc-owner-return'
    });
    await state({
      useErc20: true,
      funnel: true,
      caller: true,
      htlc: true,
      fraud: 'htlc-owner'
    });

    await state({useErc20: true, producer: true, fraud: 'utxo-witness'});
    await state(
        {useErc20: true, producer: true, root: true, fraud: 'root-witness'});
    await state({
      useErc20: true,
      producer: true,
      htlc: true,
      fraud: 'htlc-owner-return'
    });
    await state(
        {useErc20: true, producer: true, htlc: true, fraud: 'htlc-owner'});

  } catch (error) {
    t.error(error, errors);
  }
});
