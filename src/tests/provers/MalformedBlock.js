const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const { BlockHeader, RootHeader, Leaf, merkleTreeRoot } = require('@fuel-js/protocol2/src/block');
const { defaults } = require('../utils/harness');
const { _Transaction } = require('@fuel-js/protocol2/src/transaction');

module.exports = test('MalformedBlock', async t => { try {
    const minTransactionSize = 44 - 2;
    const maxTransactionSize = 896 - 2; // - 2 for length.

    // Construct contract.
    const state = async (leafs, opts = {}) => {
      const producer = t.wallets[0].address;
      const contract = await t.deploy(abi, bytecode, defaults(producer));

      const txs = leafs;
      const merkleRootA = opts.rootMerkleRoot || merkleTreeRoot(txs);
      const commitmentHash = utils.keccak256(combine(txs));
      const blocka = utils.bigNumberify(await t.getBlockNumber()).add(1);
      const aroot = (new RootHeader({
        rootProducer: producer,
        merkleTreeRoot: merkleRootA,
        commitmentHash,
        rootLength: utils.hexDataLength(combine(txs)),
      }));

      const atx = await t.wait(contract.commitRoot(merkleRootA, 0, 0, combine(txs), overrides),
        'valid submit', errors);
      t.equal(atx.logs.length, 1, 'length');
      t.equalBig(await contract.rootBlockNumberAt(aroot.keccak256Packed()), blocka, 'block');
      t.equalBig(atx.events[0].args.root, aroot.keccak256Packed(), 'root');
      t.equalBig(atx.events[0].args.rootProducer, producer, 'producer');
      t.equalBig(atx.events[0].args.merkleTreeRoot, merkleRootA, 'merkleRootA');
      t.equalBig(atx.events[0].args.commitmentHash, commitmentHash, 'commitmentHash');

      // commit block
      t.equalBig(await contract.blockTip(), 0, 'tip');
      const header = (new BlockHeader({
        producer,
        height: 1,
        numTokens: 1,
        numAddresses: 1,
        roots: [aroot.keccak256Packed()],
      }));

      const currentBlock = await t.provider.getBlockNumber();
      const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
      const ctx = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [aroot.keccak256Packed()], {
        ...overrides,
        value: await contract.BOND_SIZE(),
      }), 'commit block', errors);
      header.properties.blockNumber().set(ctx.events[0].blockNumber);
      t.equalBig(await contract.blockTip(), 1, 'tip');

      // Submit proof, but block is valid.
      const proofa = [
        header.encodePacked(),
        (new RootHeader({
          ...aroot.object(),
          ...(opts.rootOverride || {}), 
        })).encodePacked(),
        0,
        combine(opts.txsOverride || txs),
      ];

      // Transaction.
      let txr = null;

      // Generate the fraud hash.
      const fraudHash = utils.keccak256(contract.interface.functions.proveMalformedBlock.encode(
        [
          ...proofa
        ],
      ));

      // Commit the fraud hash.
      await t.wait(contract.commitFraudHash(fraudHash, {
        ...overrides,
      }), 'commit fraud hash', errors);

      // Wait 10 blocks for fraud finalization.
      await t.increaseBlock(10);

      // Gas limit.
      const gasLimit = 2700000;

      if (opts.revert) {
        await t.revert(contract.proveMalformedBlock(...proofa, overrides),
          errors[opts.revert], opts.revert);
        return;
      }

      if (opts.fraud) {
        txr = await t.wait(contract.proveMalformedBlock(...proofa, overrides),
          'submit malformed proof', errors);

        t.equalBig(txr.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);

        t.ok(txr.cumulativeGasUsed.lt(gasLimit), 'cumulativeGasUsed less than 2.7m');

        t.equalBig(await contract.blockTip(), 0, 'tip');
        return;
      }

      if (!opts.fraud) {
        txr = await t.wait(contract.proveMalformedBlock(...proofa, overrides),
          'submit malformed proof', errors);
        t.equalBig(await contract.blockTip(), 1, 'tip');

        t.ok(txr.cumulativeGasUsed.lt(gasLimit), 'cumulativeGasUsed less than 2.7m');
      }

      t.ok(txr.gasUsed.lt(gasLimit), 'gas used lt 3m');
      t.ok(txr.cumulativeGasUsed.lt(gasLimit), 'cumu. gas used lt 2.7m');
    }

    // Generate FF number values at specific bytelengths.
    function ff(len = 0) {
        return '0x' + (new Array(len))
          .fill(0)
          .map(() => 'ff')
          .join('');
    }

    function zeroFill(len = 0) {
      return '0x' + (new Array(len))
        .fill(0)
        .map(() => '00')
        .join('');
    }

    // Fill smallest with ff.
    await state([ { encodePacked: () => zeroFill(44) } ], {
      fraud: 'transaction-length-underflow',
    });

    // Fill smallest with ff.
    await state([ { encodePacked: () => zeroFill(31000) } ], {
      fraud: 'transaction-length-underflow',
    });

    // Fill smallest with ff.
    await state([ { encodePacked: () => ff(31000) } ], {
      fraud: 'transaction-length-overflow',
    });

    // Fill smallest with ff.
    await state([ { encodePacked: () => ff(44) } ], {
      fraud: 'transaction-length-overflow',
    });

    // Test min length.
    const minSizeTx = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(minTransactionSize))) });

    // Smallest valid block.
    await state([ minSizeTx ]);

    // Test min length.
    const maxSizeTx = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(maxTransactionSize))) });

    // Smallest valid block.
    await state([ maxSizeTx ]);

    // A large array of the smallest tx's.
    const largeArrayOfSmalls = (new Array(697)).fill(minSizeTx);

    // Largest valid block.
    await state(largeArrayOfSmalls);

    // Underflow and overflow leaf example values.
    const overflowLeaf = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(maxTransactionSize + 1))) });
    const underflowLead = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(minTransactionSize - 1))) });

    // Check for net length overflow.
    const netLengthOverflow = new _Transaction({
      length: '0x0100',
      inputs: utils.hexZeroPad('0x00', 44),
    });

    // Underflow leaf at end of large smalls.
    await state(largeArrayOfSmalls.slice(-3).concat(underflowLead), { fraud: 'transaction-length-underflow' });

    // Overflow leaf at end of large smalls.
    await state(largeArrayOfSmalls.slice(-3).concat(overflowLeaf), { fraud: 'transaction-length-overflow' });

    // Overflow leaf at end of large smalls.
    await state(largeArrayOfSmalls.slice(-3).concat(netLengthOverflow), { fraud: 'net-length-overflow' });

    // one leaf
    const emptyTx = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(100))) });

    await state([ emptyTx ]);

    // two leafs
    await state([ emptyTx, emptyTx ]);

    // two leafs
    await state([ emptyTx, emptyTx, emptyTx ]);

    // two leafs
    await state([ emptyTx, emptyTx, emptyTx, emptyTx, emptyTx,
      emptyTx, emptyTx, emptyTx, emptyTx, emptyTx, emptyTx ]);

    // valid 500 leafs
    const leaves = (new Array(150))
      .fill(0)
      .map(v => emptyTx);

    // state leaves
    await state(leaves);

    // valid 500 leafs, should be 570 eventually
    const maxValidLeafs = (new Array(300))
      .fill(0)
      .map(v => emptyTx);

    // state leaves
    await state(maxValidLeafs);

    // small chunk
    const smallChunk = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(minTransactionSize))) });

    // small chunk leaves
    const smallChunkLeafs = (new Array(320))
      .fill(0)
      .map(v => smallChunk);

    // state leaves
    await state(smallChunkLeafs);

    // big chunk
    const bigChunk = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(maxTransactionSize))) });

    // state leaves
    await state((new Array(30))
      .fill(0)
      .map(v => bigChunk));

    function getRandomInt(min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min)) + min;
    }

    // random valid leaf sizes
    t.ok(true, 'running randomization sequence');
    for (var i = 0; i < 1; i++) {
      const randomLeaves = (new Array(2024))
        .fill(0)
        .map(v => new Leaf({
          data: chunk(utils.hexlify(utils.randomBytes(getRandomInt(minTransactionSize, maxTransactionSize))))
        }));

      let totalLen = 0;
      const maxLen = 30000;
      let randomSelectedLeaves = [];
      for (const leaf of randomLeaves) {
        const len = leaf.properties.data().get().length
        if ((totalLen + len) <= maxLen) {
          randomSelectedLeaves.push(leaf);
          totalLen += len;
        } else {
          break;
        }
      }

      // Use random leaves.
      await state(randomSelectedLeaves);
    }

    // Check for overflow.
    await state([overflowLeaf], { fraud: 'transaction-length-overflow' });
    await state([bigChunk, emptyTx, overflowLeaf, emptyTx], { fraud: 'transaction-length-overflow' });

    // Check for underflow.
    await state([emptyTx, underflowLead], { fraud: 'transaction-length-underflow' });
    await state([bigChunk, emptyTx, underflowLead, emptyTx], { fraud: 'transaction-length-underflow' });

    // Check net length overflows.
    await state([netLengthOverflow], { fraud: 'net-length-overflow' });
    await state([bigChunk, emptyTx, netLengthOverflow, emptyTx], { fraud: 'net-length-overflow' });

    await state([emptyTx], {
      revert: 'commitment-hash',
      txsOverride: [emptyTx, emptyTx], // <-- invalid
    });

    await state([emptyTx], {
      fraud: 'merkle-root',
      rootMerkleRoot: utils.hexlify(utils.randomBytes(32)), // <-- invalid
    });
  
    await state([emptyTx, emptyTx, emptyTx], {
      fraud: 'merkle-root',
      rootMerkleRoot: utils.hexlify(utils.randomBytes(32)), // <-- invalid
    });

    await state([emptyTx, emptyTx, emptyTx], {
      fraud: 'merkle-root',
      rootMerkleRoot: utils.emptyBytes32, // <-- invalid
    });

    // Technically unreachable due to tx min size + overflow checks, here for theory checks.
    // 'transaction-index-overflow'

} catch (error) { t.error(error, errors); } });
