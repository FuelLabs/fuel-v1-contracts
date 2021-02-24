const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const { BlockHeader, RootHeader, Leaf, merkleTreeRoot } = require('@fuel-js/protocol2/src/block');
const protocol = require('@fuel-js/protocol2');
const { defaults } = require('../utils/harness');

module.exports = test('TransactionProof', async t => {
    const minTransactionSize = 44 - 2;
    const maxTransactionSize = 896 - 2; // - 2 for length.

    // Construct contract.
    const state = async (opts = {}) => {
      const producer = t.wallets[0].address;
      const contract = await t.deploy(abi, bytecode, defaults(producer));
      const rootIndex = opts.rootIndex || 0;

      const txs = opts.txs;
      const token = 0;
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
        numTokens: 1,
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
        inputOutputIndex: 1,
        transactionIndex: ((opts.override || {}).transactionIndex || 0),
        token,
        rootIndex,
        ...(opts.proof || {}),
        override: (opts.override || {}),
      });

      // Arguments.
      let arguments = [
        proof.encodePacked(),
      ];
      let method = opts.method || 'proveInvalidTransaction';

      // Use two proofs.
      if (opts.twoProofs) {
        arguments = [
          proof.encodePacked(),
          proof.encodePacked(),
        ];
      }

      // Generate the fraud hash
      const fraudHash = utils.keccak256(contract.interface.functions[method].encode(
        arguments,
      ));

      // Commit the fraud hash.
      await t.wait(contract.commitFraudHash(fraudHash, {
        ...overrides,
      }), 'commit fraud hash', errors);

      // Wait 10 blocks for fraud finalization.
      await t.increaseBlock(10);

      // Finalization period.
      if (opts.finalized) {
        await t.increaseBlock(await contract.FINALIZATION_DELAY());
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

      // no fraud
      await t.wait(contract[method](...arguments, {
        ...overrides,
      }), 'submit valid input transaction', errors);

      t.equalBig(await contract.blockTip(), 1, 'tip');
    }

    // Test min length.
    const minSizeTx = new Leaf({
        data: chunk(
            utils.hexlify(utils.randomBytes(minTransactionSize))
        ),
    });
    const maxNumTxs = 697;

    // A large array of the smallest tx's.
    const largeArrayOfSmalls = (new Array(maxNumTxs))
      .fill(minSizeTx);

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-fee',
      method: 'proveDoubleSpend',
      twoProofs: true,
      proof: {
        transactionIndex: 500,
      },
      override: {
        signatureFee: '0xaa', // <-- this is invalid
      },
      name: 'ensure DoubleSpend have tx proof validation',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-fee',
      method: 'proveInvalidSum',
      proof: {
        transactionIndex: 500,
      },
      override: {
        signatureFee: '0xaa', // <-- this is invalid
      },
      name: 'ensure InvalidSum have tx proof validation',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-fee',
      twoProofs: true,
      method: 'proveInvalidInput',
      proof: {
        transactionIndex: 500,
      },
      override: {
        signatureFee: '0xaa', // <-- this is invalid
      },
      name: 'ensure InvalidInput have tx proof validation',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-fee',
      method: 'proveInvalidWitness',
      proof: {
        transactionIndex: 500,
      },
      override: {
        signatureFee: '0xaa', // <-- this is invalid
      },
      name: 'ensure InvalidWitness have tx proof validation',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-fee',
      method: 'withdraw',
      finalized: true,
      proof: {
        transactionIndex: 500,
      },
      override: {
        signatureFee: '0xaa', // <-- this is invalid
      },
      name: 'ensure withdraw have tx proof validation',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-fee-token',
      override: {
        signatureFeeToken: '0x01',
      },
      name: 'invalid signature fee token alignment',
    });
    
    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-fee',
      override: {
        signatureFee: '0x01',
      },
      name: 'invalid signature fee alignment',
    });

    // Smallest valid block.
    await state({
      txs: largeArrayOfSmalls,
      fraud: 'any',
      proof: {
        transactionIndex: 0, // selects invalid leaf
      },
      name: 'fraud at zero index',
    });

    // Last.
    await state({
      txs: largeArrayOfSmalls,
      fraud: 'any',
      proof: {
        transactionIndex: 696, // selects invalid leaf
      },
      name: 'fraud at widest non-empty leaf',
    });

    // Last.
    await state({
      txs: largeArrayOfSmalls,
      revert: 'transaction-size-minimum',
      proof: {
        transactionIndex: maxNumTxs, // <-- invalid
      },
      name: 'revert b/c empty leaf past rightmost filled',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'index-overflow',
      proof: {
        transactionIndex: 400,
        inputOutputIndex: 8, // <-- invalid.
      },
      name: 'index overflow',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'root-index-underflow',
      numRoots: 1,
      override: {
        rootIndex: 1, // <-- invalid
      },
      name: 'invalid root selection',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'block-commitment',
      override: {
        height: 2, // <-- invalid
      },
      name: 'invalid root selection',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-merkle-root',
      override: {
        merkleProof: [
          utils.hexlify(utils.randomBytes(32)), // <-- invalid
        ],
      },
      name: 'invalid merkle proof',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-merkle-root',
      override: {
        merkleProof: [
          ...protocol.transaction.merkleProof(
            largeArrayOfSmalls,
            500,
          ).splice(0, -2), // <-- invalid popped off bottom leaf
        ],
      },
      name: 'invalid merkle proof end leaf',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-merkle-root',
      override: {
        merkleProof: [
          ...(protocol.transaction.merkleProof(
            largeArrayOfSmalls,
            500,
          ).splice(2, 1)), // <-- removed part of proof
        ],
      },
      name: 'invalid merkle proof spliced middle',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'invalid-merkle-root',
      override: {
        merkleProof: [
          ...protocol.transaction.merkleProof(
            largeArrayOfSmalls,
            500,
          ),
          ...protocol.transaction.merkleProof(
            largeArrayOfSmalls,
            500,
          ), // <-- removed part of proof
        ],
      },
      name: 'too many leafs also not valid',
    });

    await state({
      txs: largeArrayOfSmalls,
      revert: 'tree-height-overflow',
      override: {
        merkleProof: (new Array(256)).fill(0)
          .map(v => utils.keccak256('0xaa')), // <-- invalid,
      },
      name: 'leafs overflow',
    });

    await state({
      txs: largeArrayOfSmalls,
      numRoots: 128,
      rootIndex: 0,
      override: {
        rootIndex: 128, // <-- this is invalid
      },
      revert: 'root-index-underflow',
      name: '128 roots, empty leaf past rightmost',
    });

    await state({
      txs: largeArrayOfSmalls,
      numRoots: 128,
      rootIndex: 127, // <-- highest root
      override: {
        transactionIndex: 697, // rightmost overflow
      },
      revert: 'transaction-size-minimum',
      name: '128 roots, empty leaf past rightmost',
    });

    await state({
      txs: largeArrayOfSmalls,
      numRoots: 128,
      rootIndex: 127, // <-- highest root
      override: {
        transactionIndex: 696, // rightmost index
      },
      fraud: 'any',
      name: 'leafs overflow',
    });


});
