const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const { BlockHeader, RootHeader } = require('@fuel-js/protocol/src/block');
const { defaults } = require('./harness');

module.exports = test('bondWithdraw', async t => { try {

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


    // commit block
    t.equalBig(await contract.blockTip(), 0, 'tip');
    const header = (new BlockHeader({
      producer,
      height: 1,
      numTokens: 1,
      numAddresses: 1,
      roots: [aroot],
    }));
    const currentBlock = await t.provider.getBlockNumber();
    const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const ctx = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [aroot], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header.properties.ethereumBlockNumber.set(ctx.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');


    await t.revert(contract.bondWithdraw(header.encodePacked(), overrides),
      errors['not-finalized'], 'not finalized', errors);


    // Increase block
    await t.increaseBlock(await contract.FINALIZATION_DELAY());


    const other = contract.connect(t.wallets[1]);
    await t.revert(other.bondWithdraw(header.encodePacked(), overrides),
      errors['caller-producer'], 'caller producer', errors);


    // Attempt Bond Withdraw
    t.equalBig(await contract.blockTip(), 1, 'tip');
    let originalBalance = await t.getBalance(producer);
    await t.balanceEqual(contract.address, await contract.BOND_SIZE(), 'balance');
    const bwtx = await t.wait(contract.bondWithdraw(header.encodePacked(), overrides),
      'withdraw bond', errors);
    await t.balanceEqual(contract.address, 0, 'balance');
    t.equalBig(await contract.blockTip(), 1, 'tip');
    t.equal(bwtx.logs.length, 1, 'length');
    t.equalBig(bwtx.events[0].args.owner, producer, 'owner');
    t.equalBig(bwtx.events[0].args.tokenAddress, 0, 'tokenAddress');
    t.equalBig(bwtx.events[0].args.amount, await contract.BOND_SIZE(), 'amount');
    t.equalBig(bwtx.events[0].args.blockHeight, header.properties.height.get(),
      'blockHeight');
    t.equalBig(bwtx.events[0].args.rootIndex, 0, 'rootIndex');
    t.equalBig(bwtx.events[0].args.transactionLeafHash, 0, 'transactionLeafHash');
    t.equalBig(bwtx.events[0].args.outputIndex, 0, 'outputIndex');
    t.equalBig(bwtx.events[0].args.transactionIndex, 0, 'transactionIndex');


    await t.revert(contract.bondWithdraw(header.encodePacked(), overrides),
      errors['already-withdrawn'], 'already-withdrawn', errors);


} catch (error) { t.error(error, errors); } });
