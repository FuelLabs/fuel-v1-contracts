const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const OwnedProxy = require('../../builds/OwnedProxy.json');
const { BlockHeader, RootHeader } = require('@fuel-js/protocol2/src/block');
const { defaults } = require('../utils/harness');
const ethers = require('ethers');
const multisigAbi = require('../utils/multisig.abi.json');
const multisigBytecode = require('../utils/multisig.bytecode.js');

module.exports = test('OwnedProxy', async t => {
    // Construct proxy
    const cold = t.wallets[0].address;
    const coldWallet = t.wallets[0];
    const hot = t.wallets[1].address;
    const hot2 = t.wallets[2].address;
    const proxy = await t.deploy(OwnedProxy.abi, OwnedProxy.bytecode, [hot, cold]);

    const coldProxy = proxy.connect(coldWallet);
    await t.wait(coldProxy.setTarget(utils.emptyAddress, overrides),
      'set target', OwnedProxy.errors);

    await t.wait(proxy.transact(utils.emptyAddress, 0, '0x', overrides),
      'transact cold', OwnedProxy.errors);

    const hotContract = proxy.connect(t.wallets[1]);
    await t.wait(hotContract.transact(utils.emptyAddress, 0, '0x', overrides),
      'transact hot', OwnedProxy.errors);

    await t.revert(hotContract.change(utils.emptyAddress, overrides),
      OwnedProxy.errors['caller-cold'], 'caller-cold', OwnedProxy.errors);

    await t.revert(hotContract.setTarget(utils.emptyAddress, overrides),
      OwnedProxy.errors['caller-cold'], 'caller-cold', OwnedProxy.errors);

    await t.wait(proxy.change(hot2, overrides),
      'change hot', OwnedProxy.errors);

    await t.revert(hotContract.transact(utils.emptyAddress, 0, '0x', overrides),
      OwnedProxy.errors['caller'], 'caller', OwnedProxy.errors);

    // Construct contract
    const producer = proxy.address;
    const contract = await t.deploy(abi, bytecode, defaults(proxy.address));

    // Change hot back to 1.
    await t.wait(proxy.change(hot, overrides),
      'change hot', OwnedProxy.errors);

    // Set target to contract Fuel.
    await t.wait(coldProxy.setTarget(contract.address, overrides),
      'set target', OwnedProxy.errors);

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

    const ctx = await t.wait(hotContract.transact(contract.address, await contract.BOND_SIZE(), abiCode, overrides),
      'transact commitBlock', OwnedProxy.errors);

    header.properties.blockNumber().set(ctx.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    // multisig tests.

    const MultiSigFactory = new ethers.ContractFactory(
      multisigAbi,
      multisigBytecode,
      t.wallets[1],
    );

    let multisig = await MultiSigFactory.deploy(
      [t.wallets[1].address],
      1,
      utils.parseEther('1.0'),
      t.getOverrides(),
    );

    multisig = multisig.connect(t.wallets[1]);

    await multisig.deployTransaction.wait();

    const proxy2 = await t.deploy(
      OwnedProxy.abi,
      OwnedProxy.bytecode,
      [hot, multisig.address],
    );

    t.equalBig(await t.getProvider().getStorageAt(
      proxy2.address, 
      1,
    ), 0, 'no target');

    const tx = await multisig.submitTransaction(
      proxy2.address,
      '0',
      '0x776d1a010000000000000000000000007c5fcccd3c94faf14a3a9391a7c52b734ac9fbd2',
      t.getOverrides(),
    );

    await tx.wait();

    t.equalBig(await t.getProvider().getStorageAt(
      proxy2.address, 
      1,
    ), '0x7c5fcccd3c94faf14a3a9391a7c52b734ac9fbd2', 'no target set');

    t.equalBig(await t.getProvider().getStorageAt(
      proxy2.address, 
      0,
    ), hot, 'hot before');

    const tx2 = await multisig.submitTransaction(
      proxy2.address,
      '0',
      '0x1e77933e0000000000000000000000003e947a271a37ae7b59921c57be0a3246ee0d887c',
      t.getOverrides(),
    );

    await tx2.wait();

    t.equalBig(await t.getProvider().getStorageAt(
      proxy2.address, 
      0,
    ), '0x3e947a271a37ae7b59921c57be0a3246ee0d887c', 'hot after');
    
});
