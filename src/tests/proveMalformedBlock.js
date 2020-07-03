const { test, utils, overrides } = require('@fuel-js/common/environment');
const { struct, chunk, combine } = require('@fuel-js/common/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const { defaults } = require('./harness');
const { _Transaction } = require('@fuel-js/protocol/src/transaction');

module.exports = test('proveMalformedBlock', async t => { try {

    const minTransactionSize = 44;
    const maxTransactionSize = 893;

    // Construct contract
    const state = async (leafs, opts = {}) => {
      const producer = t.wallets[0].address;
      const contract = await t.deploy(abi, bytecode, defaults(producer));

      const txs = leafs;
      const merkleRootA = merkleTreeRoot(txs);
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
      t.equalBig(await contract.blockRoots(aroot.keccak256Packed()), blocka, 'block');
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
      const ctx = await t.wait(contract.commitBlock(0, 1, [aroot.keccak256Packed()], {
        ...overrides,
        value: await contract.BOND_SIZE(),
      }), 'commit block', errors);
      header.properties.ethereumBlockNumber.set(ctx.events[0].blockNumber);
      t.equalBig(await contract.blockTip(), 1, 'tip');

      // submit proof, but block is valid
      const proofa = [header.encodePacked(), aroot.encodePacked(), 0, combine(txs)];

      let txr = null;

      if (opts.fraud) {
        txr = await t.wait(contract.proveMalformedBlock(...proofa, overrides),
          'submit malformed proof', errors);

        t.equalBig(txr.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);

        t.equalBig(await contract.blockTip(), 0, 'tip');
        return;
      }

      if (!opts.fraud) {
        txr = await t.wait(contract.proveMalformedBlock(...proofa, overrides),
          'submit malformed proof', errors);
        t.equalBig(await contract.blockTip(), 1, 'tip');
      }

      t.ok(txr.gasUsed.lt(2000000), 'gas used');
      t.ok(txr.cumulativeGasUsed.lt(2000000), 'cumu. gas used');
    }

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
    const leaves = (new Array(500))
      .fill(0)
      .map(v => emptyTx);

    // state leaves
    await state(leaves);

    // valid 500 leafs, should be 570 eventually
    const maxValidLeafs = (new Array(560))
      .fill(0)
      .map(v => emptyTx);

    // state leaves
    await state(maxValidLeafs);

    // small chunk
    const smallChunk = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(minTransactionSize))) });

    // small chunk leaves
    const smallChunkLeafs = (new Array(560))
      .fill(0)
      .map(v => smallChunk);

    // state leaves
    await state(smallChunkLeafs);

    // big chunk
    const bigChunk = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(maxTransactionSize))) });

    // state leaves
    await state((new Array(60))
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
      const maxLen = 57000;
      let randomSelectedLeaves = [];
      for (const leaf of randomLeaves) {
        const len = leaf.properties.data.get().length
        if ((totalLen + len) <= maxLen) {
          randomSelectedLeaves.push(leaf);
          totalLen += len;
        } else {
          break;
        }
      }

      // random leaves
      await state(randomSelectedLeaves);
    }

    const overflowLeaf = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(1000))) });
    await state([overflowLeaf], { fraud: 'transaction-length-overflow' });
    await state([bigChunk, emptyTx, overflowLeaf, emptyTx], { fraud: 'transaction-length-overflow' });

    const netLengthOverflow = new _Transaction({ length: '0x0100' + utils.hexZeroPad('0x00', 44).slice(2) });
    await state([netLengthOverflow], { fraud: 'net-length-overflow' });
    await state([bigChunk, emptyTx, netLengthOverflow, emptyTx], { fraud: 'net-length-overflow' });


} catch (error) { t.error(error, errors); } });
