const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const { RootHeader } = require('@fuel-js/protocol/src/block');
const { defaults } = require('./harness');

module.exports = test('commitRoot', async t => { try {

    // Construct contract
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));



    // submit a valid root
    const merkleRootA = utils.emptyBytes32;
    const emptyTxs = utils.randomBytes(1000);
    const blocka = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const aroot = new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleRootA,
      commitmentHash: utils.keccak256(emptyTxs),
      rootLength: utils.hexDataLength(utils.hexlify(emptyTxs)),
    });

    const atx = await t.wait(contract.commitRoot(merkleRootA, 0, 0, emptyTxs, overrides),
      'valid submit', errors);
    t.equal(atx.logs.length, 1, 'length');
    t.equalBig(await contract.rootBlockNumberAt(aroot.keccak256Packed()), blocka, 'block');
    t.equalBig(atx.events[0].args.root, aroot.keccak256Packed(), 'root');
    t.equalBig(atx.events[0].args.rootProducer, producer, 'producer');
    t.equalBig(atx.events[0].args.merkleTreeRoot, merkleRootA, 'merkleRootA');
    t.equalBig(atx.events[0].args.commitmentHash, utils.keccak256(emptyTxs), 'commitmentHash');

    const rootFromBlock = await RootHeader.fromLogs(aroot.keccak256Packed(), null, contract);
    const _root = rootFromBlock.object();
    t.equalBig(_root.rootProducer, producer, 'producer');
    t.equalBig(_root.merkleTreeRoot, merkleRootA, 'merkleRootA');
    t.equalBig(_root.commitmentHash, utils.keccak256(emptyTxs), 'commitmentHash');
    t.equalBig(rootFromBlock.keccak256Packed(), aroot.keccak256Packed(), 'root');


    // attempt from contract
    const proxy = await t.deploy(Proxy.abi, Proxy.bytecode, []);
    await t.revert(t.wallets[0].sendTransaction({
      ...overrides,
      to: proxy.address,
      data: utils.hexZeroPad(contract.address, 32)
        + contract.interface.functions.commitRoot.sighash.slice(2)
        + utils.hexZeroPad(contract.address, 32).slice(2),
    }), Proxy.errors['proxy-call-failed'], 'failed proxy call');



    // check large root overflow
    const overflowBytes = utils.randomBytes((await contract.MAX_ROOT_SIZE()).add(256).toNumber());
    await t.revert(contract.commitRoot(merkleRootA, 0, 0, overflowBytes, overrides),
      errors['root-size-overflow'], 'root-size-overflow');



    // root already exists
    await t.revert(contract.commitRoot(merkleRootA, 0, 0, emptyTxs, overrides),
      errors['root-already-exists'], 'root-already-exists');




    // second root
    const merkleRootB = utils.emptyBytes32;
    const emptyTxsB = utils.randomBytes(1000);
    const blockb = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const broot = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleRootB,
      commitmentHash: utils.keccak256(emptyTxsB),
      rootLength: utils.hexDataLength(utils.hexlify(emptyTxsB))
    })).keccak256Packed();
    const btx = await t.wait(contract.commitRoot(merkleRootB, 0, 0, emptyTxsB, overrides),
      'valid submit', errors);
    t.equal(btx.logs.length, 1, 'length');
    t.equalBig(await contract.rootBlockNumberAt(broot), blockb, 'block');
    t.equalBig(btx.events[0].args.root, broot, 'root');
    t.equalBig(btx.events[0].args.rootProducer, producer, 'producer');
    t.equalBig(btx.events[0].args.merkleTreeRoot, merkleRootB, 'merkleRootA');
    t.equalBig(btx.events[0].args.commitmentHash, utils.keccak256(emptyTxsB), 'commitmentHash');


} catch (error) { t.error(error, errors); } });
