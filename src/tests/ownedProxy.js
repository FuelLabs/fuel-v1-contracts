const { test, utils, overrides } = require('@fuel-js/environment');
const ERC20 = require('../builds/ERC20.json');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const OwnedProxy = require('../builds/OwnedProxy.json');
const { BlockHeader, RootHeader } = require('@fuel-js/protocol/src/block');
const { defaults } = require('./harness');

module.exports = test('owned proxy', async t => {
  // Construct proxy
  const cold = t.wallets[0].address;
  const hot = t.wallets[1].address;
  const hot2 = t.wallets[2].address;
  const proxy = await t.deploy(OwnedProxy.abi, OwnedProxy.bytecode, [hot, cold]);

  await t.wait(proxy.transact(utils.emptyAddress, 0, '0x', overrides),
    'transact cold', OwnedProxy.errors);

  const hotContract = proxy.connect(t.wallets[1]);
  await t.wait(hotContract.transact(utils.emptyAddress, 0, '0x', overrides),
    'transact hot', OwnedProxy.errors);

  await t.revert(hotContract.change(utils.emptyAddress, overrides),
    OwnedProxy.errors['caller-cold'], 'caller-cold', OwnedProxy.errors);

  await t.wait(proxy.change(hot2, overrides),
    'change hot', OwnedProxy.errors);

  await t.revert(hotContract.transact(utils.emptyAddress, 0, '0x', overrides),
    OwnedProxy.errors['caller'], 'caller', OwnedProxy.errors);

  // Construct contract
  const producer = proxy.address;
  const contract = await t.deploy(abi, bytecode, defaults(proxy.address));


  // submit a valid root
  const merkleRootA = utils.emptyBytes32;
  const emptyTxs = utils.randomBytes(1000);
  const blocka = utils.bigNumberify(await t.getBlockNumber()).add(1);
  const aroot = (new RootHeader({
    rootProducer: cold,
    merkleTreeRoot: merkleRootA,
    commitmentHash: utils.keccak256(emptyTxs),
    rootLength: emptyTxs.length,
  })).keccak256Packed();
  const atx = await t.wait(contract.commitRoot(merkleRootA, 0, 0, emptyTxs, overrides),
    'valid submit', errors);
  t.equal(atx.logs.length, 1, 'length');
  t.equalBig(await contract.rootBlockNumberAt(aroot), blocka, 'block');
  t.equalBig(atx.events[0].args.root, aroot, 'root');
  t.equalBig(atx.events[0].args.rootProducer, cold, 'producer');
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

  await t.wait(t.wallets[0].sendTransaction({
    ...overrides,
    value: await contract.BOND_SIZE(),
    to: proxy.address,
  }), 'ether to proxy');
  await t.balanceEqual(proxy.address, await contract.BOND_SIZE(), 'value');

  const currentBlock = await t.provider.getBlockNumber();
  const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;

  const abiCode = contract.interface.functions.commitBlock.encode([
    currentBlock, currentBlockHash, 1, [aroot],
  ]);

  const ctx = await t.wait(proxy.transact(contract.address, await contract.BOND_SIZE(), abiCode, overrides),
    'transact commitBlock', OwnedProxy.errors);

  header.properties.ethereumBlockNumber.set(ctx.events[0].blockNumber);
  t.equalBig(await contract.blockTip(), 1, 'tip');
});
