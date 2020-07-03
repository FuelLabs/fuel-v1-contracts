const { test, utils, overrides } = require('@fuel-js/common/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const { BlockHeader, RootHeader } = require('@fuel-js/protocol/block');
const { defaults } = require('./harness.js');

module.exports = test('commitBlock', async t => { try {

    // Construct contract
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));



    // submit a valid root
    const merkleRootA = utils.emptyBytes32;
    const emptyTxs = utils.randomBytes(1000);
    const blocka = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const aroot = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleRootA,
      commitmentHash: utils.keccak256(emptyTxs),
      rootLength: emptyTxs.length,
    })).keccak256Packed();
    const atx = await t.wait(contract.commitRoot(merkleRootA, 0, 0, emptyTxs, overrides),
      'valid submit', errors);
    t.equal(atx.logs.length, 1, 'length');
    t.equalBig(await contract.blockRoots(aroot), blocka, 'block');
    t.equalBig(atx.events[0].args.root, aroot, 'root');
    t.equalBig(atx.events[0].args.rootProducer, producer, 'producer');
    t.equalBig(atx.events[0].args.merkleTreeRoot, merkleRootA, 'merkleRootA');
    t.equalBig(atx.events[0].args.commitmentHash, utils.keccak256(emptyTxs), 'commitmentHash');


    // commit block
    t.equalBig(await contract.blockTip(), 0, 'tip');
    const header = (new BlockHeader({
      producer,
      height: 1,
      roots: [aroot],
      numTokens: 1,
      numAddresses: 1,
    }));

    const ctx = await t.wait(contract.commitBlock(0, 1, [aroot], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header.properties.ethereumBlockNumber.set(ctx.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    t.equal(ctx.logs.length, 1, 'length');
    t.equalBig(ctx.events[0].args.producer, producer, 'producer');
    t.equalBig(ctx.events[0].args.previousBlockHash, 0, 'previousBlockHash');
    t.equalBig(ctx.events[0].args.height, 1, 'merkleRootA');
    t.equalRLP(ctx.events[0].args.roots, [aroot], 'roots');

    t.equal(await contract.blockCommitments(1), header.keccak256Packed(), 'commitment')

    // commit block
    const croot = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleRootA,
      commitmentHash: utils.keccak256(emptyTxs),
      rootLength: emptyTxs.length,
    })).keccak256Packed();
    await t.wait(contract.commitRoot(merkleRootA, 0, 0, emptyTxs, overrides),
      'valid submit', errors);

    const invalidHeader = (new BlockHeader({
      producer,
      height: 1,
      previousBlockHash: header.keccak256Packed(),
      roots: [croot],
      numTokens: 1,
      numAddresses: 1,
    })).encodePacked();
    await t.revert(contract.commitBlock(0, 1, [croot], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), errors['block-height'], 'block-height', errors);
    t.equalBig(await contract.blockTip(), 1, 'tip');


    // bond value
    const invalidHeader2 = (new BlockHeader({
      producer,
      height: 2,
      roots: [croot],
      previousBlockHash: header.keccak256Packed(),
      numTokens: 1,
      numAddresses: 1,
    })).encodePacked();
    await t.revert(contract.commitBlock(0, 2, [croot], {
      ...overrides,
      value: utils.bigNumberify(await contract.BOND_SIZE()).sub(1),
    }), errors['bond-value'], 'bond-value');
    t.equalBig(await contract.blockTip(), 1, 'tip');



    // roots length underflow
    const invalidHeader3 = (new BlockHeader({
      producer,
      height: 2,
      roots: [],
      previousBlockHash: header.keccak256Packed(),
      numTokens: 1,
      numAddresses: 1,
    })).encodePacked();
    await t.revert(contract.commitBlock(0, 2, [], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), errors['roots-length-underflow'], 'roots-length-underflow');
    t.equalBig(await contract.blockTip(), 1, 'tip');



    // roots length overflow
    const overflowRoots = (new Array(257)).fill(0).map(v => utils.randomBytes(32));
    const invalidHeader4 = (new BlockHeader({
      producer,
      height: 2,
      roots: overflowRoots,
      previousBlockHash: header.keccak256Packed(),
      numTokens: 1,
      numAddresses: 1,
    })).encodePacked();
    await t.revert(contract.commitBlock(0, 2, overflowRoots, {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), errors['roots-length-overflow'], 'roots-length-overflow');
    t.equalBig(await contract.blockTip(), 1, 'tip');



    // roots length overflow
    const invalidHeader5 = (new BlockHeader({
      producer,
      height: 2,
      roots: [utils.emptyBytes32],
      previousBlockHash: header.keccak256Packed(),
      numTokens: 1,
      numAddresses: 1,
    })).encodePacked();
    await t.revert(contract.commitBlock(0, 2, [utils.emptyBytes32], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), errors["root-existance"], "root-existance");
    t.equalBig(await contract.blockTip(), 1, 'tip');




    // roots length overflow
    const other = contract.connect(t.wallets[1]);
    const invalidHeader6 = (new BlockHeader({
      producer: t.wallets[1].address,
      height: 2,
      roots: [croot],
      previousBlockHash: header.keccak256Packed(),
      numTokens: 1,
      numAddresses: 1,
    })).encodePacked();
    await t.revert(other.commitBlock(0, 2, [croot], {
      ...overrides,
      value: await other.BOND_SIZE(),
    }), errors["caller-producer"], "caller-producer");
    t.equalBig(await contract.blockTip(), 1, 'tip');



    header.properties.ethereumBlockNumber.set(ctx.events[0].blockNumber);
    const header2 = (new BlockHeader({
      producer,
      height: 2,
      roots: [croot],
      previousBlockHash: header.keccak256Packed(),
      numTokens: 1,
      numAddresses: 1,
    }));
    const cvtx = await t.wait(contract.commitBlock(0, 2, [croot], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    t.equalBig(await contract.blockTip(), 2, 'tip');

    t.equal(cvtx.logs.length, 1, 'length');
    t.equalBig(cvtx.events[0].args.producer, producer, 'producer');
    t.equalBig(cvtx.events[0].args.previousBlockHash, header.keccak256Packed(), 'previousBlockHash');
    t.equalBig(cvtx.events[0].args.height, 2, 'height');
    t.equalRLP(cvtx.events[0].args.roots, [aroot], 'roots');



    // second root
    const merkleRootB = utils.emptyBytes32;
    const emptyTxsB = utils.randomBytes(1000);
    const producerB = t.wallets[1].address;
    const blockb = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const broot = (new RootHeader({
      rootProducer: producerB,
      merkleTreeRoot: merkleRootB,
      commitmentHash: utils.keccak256(emptyTxsB),
      rootLength: emptyTxsB.length,
    })).keccak256Packed();
    const btx = await t.wait(other.commitRoot(merkleRootB, 0, 0, emptyTxsB, overrides),
      'valid submit', errors);
    t.equal(btx.logs.length, 1, 'length');
    t.equalBig(await other.blockRoots(broot), blockb, 'block');
    t.equalBig(btx.events[0].args.root, broot, 'root');
    t.equalBig(btx.events[0].args.rootProducer, producerB, 'producer');
    t.equalBig(btx.events[0].args.merkleTreeRoot, merkleRootB, 'merkleRootA');
    t.equalBig(btx.events[0].args.commitmentHash, utils.keccak256(emptyTxsB), 'commitmentHash');



    // valid commit block from other non producer user
    await t.increaseBlock(await other.SUBMISSION_DELAY());
    header2.properties.ethereumBlockNumber.set(cvtx.events[0].blockNumber);
    const header3 = (new BlockHeader({
      producer: producerB,
      height: 3,
      roots: [broot],
      previousBlockHash: header2.keccak256Packed(),
      numTokens: 1,
      numAddresses: 1,
    })).encodePacked();
    const etx = await t.wait(other.commitBlock(0, 3, [broot], {
      ...overrides,
      value: await other.BOND_SIZE(),
    }), 'commit block', errors);
    t.equalBig(await contract.blockTip(), 3, 'tip');
    t.equal(etx.logs.length, 1, 'length');
    t.equalBig(etx.events[0].args.producer, producerB, 'producer');
    t.equalBig(etx.events[0].args.previousBlockHash, header2.keccak256Packed(), 'previousBlockHash');
    t.equalBig(etx.events[0].args.height, 3, 'merkleRootA');
    t.equalRLP(etx.events[0].args.roots, [broot], 'roots');

} catch (error) { t.error(error, errors); } });
