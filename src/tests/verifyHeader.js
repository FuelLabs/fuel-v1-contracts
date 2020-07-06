const { test, utils, overrides } = require('@fuel-js/common/environment');
const { chunk, pack, combine } = require('@fuel-js/common/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('./harness');

module.exports = test('verifyHeader', async t => { try {

  // Construct contract
  async function state (opts = {}) {
    const { useErc20, attemptDoubleWithdraw } = opts;

    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

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
      outputs: [tx.OutputUTXO({
        amount: 100,
        token: tokenId,
        owner: producer,
      }), opts.invalidOutputType ?
        tx.OutputUTXO({
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
    }, contract);


    // produce it in a block
    const txs = [transaction];
    const combined = combine(txs);
    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combined),
      rootLength: utils.hexDataLength(combined)
    }));


    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot.get(), 0, 0, combine(txs), overrides),
      'valid submit', errors);
    const header = (new BlockHeader({
      producer,
      height: 1,
      numTokens,
      numAddresses: opts.registeredAddress ? 2 : 1,
      roots: [root.keccak256Packed()],
    }));

    const currentBlock = await t.provider.getBlockNumber();
    const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [root.keccak256Packed()], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header.properties.ethereumBlockNumber.set(block.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    // submit a withdrawal proof
    const proof = tx.TransactionProof({
      block: header,
      root,
      indexes: { output: 1 },
      transactions: txs,
      transactionIndex: 0,
      token,
    });


    // verify header
    t.equal(await contract.verifyHeader(
      header.encodePacked(),
      root.encodePacked(),
      0,
      0), true, 'not finalized');

    await t.catch(contract.verifyHeader(
      header.encodePacked(),
      header.encodePacked(),
      0,
      0), 'invalid root');

    await t.catch(contract.verifyHeader(
      root.encodePacked(),
      header.encodePacked(),
      0,
      0), 'invalid block');

    await t.catch(contract.verifyHeader(
      header.encodePacked(),
      root.encodePacked(),
      1,
      0), 'invalid root index');

    await t.catch(contract.verifyHeader(
      header.encodePacked(),
      root.encodePacked(),
      0,
      1), 'finalization');

    // Increase block to finality
    await t.increaseBlock(await contract.FINALIZATION_DELAY());

    t.equal(await contract.verifyHeader(
      header.encodePacked(),
      root.encodePacked(),
      0,
      1), true, 'not finalized');

    await t.catch(contract.verifyHeader(
      header.encodePacked(),
      header.encodePacked(),
      0,
      0), 'invalid root');

    await t.catch(contract.verifyHeader(
      root.encodePacked(),
      header.encodePacked(),
      0,
      0), 'invalid block');

    await t.catch(contract.verifyHeader(
      header.encodePacked(),
      root.encodePacked(),
      1,
      0), 'invalid root index');

    await t.catch(contract.verifyHeader(
      header.encodePacked(),
      root.encodePacked(),
      0,
      0), 'finalization');
  }


  await state ({ useErc20: false });


} catch (error) { t.error(error, errors); } });
