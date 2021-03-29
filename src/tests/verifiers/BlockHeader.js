const { test, utils, overrides } = require('@fuel-js/environment');
const { combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const { BlockHeader, RootHeader, merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const protocol = require('@fuel-js/protocol');

module.exports = test('BlockHeader', async t => { try {

  // Construct contract
  async function state (opts = {}) {
    const { useErc20 } = opts;

    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, [
      producer,
      500,
      20,
      20,
      2,
      "Fuel",
      "1.1.0",
      1,
      utils.emptyBytes32
    ]);

    const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
    const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

    let token = utils.emptyAddress;
    let tokenId = '0x00';
    let numTokens = 1;

    // try an ether deposit
    const funnela = await contract.funnel(producer);
    const valuea = utils.bigNumberify(1000);

    if (useErc20 === true) {
      await t.wait(erc20.transfer(funnela, valuea, overrides), 'erc20 transfer');
      token = erc20.address;
      tokenId = '0x01';
      numTokens = 2;
    } else {
      await t.wait(t.wallets[0].sendTransaction({
        ...overrides,
        value: valuea,
        to: funnela,
      }), 'ether to funnel');
    }

    const deposit = new Deposit({
      token: tokenId,
      owner: producer,
      blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
    });
    const etx = await t.wait(contract.deposit(producer, token, overrides),
      'ether deposit', errors);

    if (opts.registeredAddress) {
      await t.wait(contract.commitAddress(producer, overrides),
        'commit address', errors);
    }

    // build a transaction
    const transaction = await tx.Transaction({
      inputs: [tx.InputDeposit({
        witnessReference: 0,
        owner: producer,
      })],
      data: [deposit],
      metadata: [tx.MetadataDeposit(deposit)],
      witnesses: [t.wallets[0]],
      outputs: [tx.OutputTransfer({
        amount: 100,
        token: tokenId,
        owner: producer,
      }), opts.invalidOutputType ?
        tx.OutputTransfer({
          amount: 100,
          token: tokenId,
          owner: producer,
        })
      : tx.OutputWithdraw({
        amount: 500,
        token: opts.invalidTokenId ? '0x04' : tokenId,
        owner: opts.invalidOutputOwner
          ? utils.emptyAddress
          : (opts.registeredAddress ? '0x01' : producer),
      })],
      contract,
    });


    // produce it in a block
    const txs = [transaction];
    const combined = combine(txs);
    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combined),
      rootLength: utils.hexDataLength(combined)
    }));


    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot().get(), 0, 0, combine(txs), overrides),
      'valid submit', errors);
    const header = (new BlockHeader({
      producer,
      height: 1,
      numTokens,
      numAddresses: opts.registeredAddress ? 2 : 1,
      roots: [root.keccak256Packed()],
    }));

    let currentBlock = await t.provider.getBlockNumber();
    let currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [root.keccak256Packed()], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header.properties.blockNumber().set(block.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    // Prove malformed block override.
    async function proveMalformedBlock(...args) {

        // Generate the fraud hash
        const fraudHash = utils.keccak256(contract.interface.functions.proveMalformedBlock.encode(
          [
            ...args
          ],
        ));

        // Commit the fraud hash.
        await t.wait(contract.commitFraudHash(fraudHash, {
          ...overrides,
        }), 'commit fraud hash', errors);

        // Wait 10 blocks for fraud finalization.
        await t.increaseBlock(10);

        // Prove malformed block.
        return contract.proveMalformedBlock(...args, { gasLimit: 4000000 })
    }

    await t.revert(proveMalformedBlock(
      header.encodePacked(),
      header.encodePacked(),
      0,
      '0x'), errors['root-block'], 'root-block', errors);

    await t.revert(proveMalformedBlock(
      root.encodePacked(),
      header.encodePacked(),
      0,
      '0x'), errors['block-commitment'], 'block-commitment', errors);

    await t.revert(proveMalformedBlock(
      header.encodePacked(),
      root.encodePacked(),
      1,
      '0x'), errors['root-index-underflow'], 'root-index-underflow', errors);

    // Increase block to finality
    await t.increaseBlock(await contract.FINALIZATION_DELAY());

    await t.revert(proveMalformedBlock(
      header.encodePacked(),
      header.encodePacked(),
      0,
      '0x'), errors['block-finalized'], 'block-finalized', errors);

    await t.revert(proveMalformedBlock(
      root.encodePacked(),
      header.encodePacked(),
      0,
      '0x'), errors['block-commitment'], 'block-commitment', errors);

    await t.revert(proveMalformedBlock(
      header.encodePacked(),
      root.encodePacked(),
      1,
      '0x'), errors['block-finalized'], 'block-finalized', errors);

    await t.revert(proveMalformedBlock(
      header.encodePacked(),
      root.encodePacked(),
      0,
      '0x'), errors['block-finalized'], 'block-finalized', errors);

    // check height after fraud.
    // produce it in a block
    const txs2 = [protocol.root.Leaf({ data: utils.randomBytes(128) }), protocol.root.Leaf({ data: '0xaa' })];
    const combined2 = combine(txs2);
    const root2 = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs2),
      commitmentHash: utils.keccak256(combined2),
      rootLength: utils.hexDataLength(combined2),
      fee: 1,
    }));

    await t.wait(contract.commitRoot(root2.properties.merkleTreeRoot().get(), 0, 1, combine(txs2), overrides),
      'valid submit', errors);
    const header2 = (new BlockHeader({
      producer,
      height: 2,
      numTokens,
      numAddresses: opts.registeredAddress ? 2 : 1,
      roots: [root2.keccak256Packed()],
    }));

    currentBlock = await t.provider.getBlockNumber();
    currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const block2 = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 2, [root2.keccak256Packed()], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header2.properties.blockNumber().set(block2.events[0].blockNumber);
    header2.properties.previousBlockHash().set(header.keccak256Packed());
    t.equalBig(await contract.blockTip(), 2, 'tip');


    // check height after fraud.
    // produce it in a block
    const txs3 = [protocol.root.Leaf({ data: utils.randomBytes(128) }), protocol.root.Leaf({ data: '0xaa' })];
    const combined3 = combine(txs3);
    const root3 = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs3),
      commitmentHash: utils.keccak256(combined3),
      rootLength: utils.hexDataLength(combined3),
      fee: 1,
    }));

    await t.wait(contract.commitRoot(root3.properties.merkleTreeRoot().get(), 0, 1, combined3, overrides),
      'valid submit', errors);
    const header3 = (new BlockHeader({
      producer,
      height: 3,
      numTokens,
      numAddresses: opts.registeredAddress ? 2 : 1,
      roots: [root3.keccak256Packed()],
    }));

    currentBlock = await t.provider.getBlockNumber();
    currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const block3 = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 3, [root3.keccak256Packed()], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header3.properties.blockNumber().set(block3.events[0].blockNumber);
    header3.properties.previousBlockHash().set(header2.keccak256Packed());
    t.equalBig(await contract.blockTip(), 3, 'tip');

    await t.wait(proveMalformedBlock(
      header2.encodePacked(),
      root2.encodePacked(),
      0,
      combine(txs2)), 'malformed block', errors);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    await t.revert(proveMalformedBlock(
      header3.encodePacked(),
      root3.encodePacked(),
      0,
      combine(txs3)), errors['block-height-overflow'], 'block-height-overflow', errors);
    t.equalBig(await contract.blockTip(), 1, 'tip');

  }


  await state ({ useErc20: false });


} catch (error) { t.error(error, errors); } });
