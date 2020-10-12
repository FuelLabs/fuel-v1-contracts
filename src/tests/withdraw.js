const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('./harness');

module.exports = test('withdraw', async t => { try {

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

    const currentBlock = await t.provider.getBlockNumber();
    const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [root.keccak256Packed()], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header.properties.blockNumber().set(block.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    // submit a withdrawal proof
    const proof = tx.TransactionProof({
      block: header,
      root,
      inputOutputIndex: 1,
      transactions: txs,
      transactionIndex: 0,
      token,
      selector: producer,
    });




    // Increase block to finality
    await t.increaseBlock(await contract.FINALIZATION_DELAY());


    if (opts.invalidOutputOwner) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors['output-owner'], 'output owner check');
      return;
    }

    if (opts.invalidTokenId) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors['token-id'], 'token id');
      return;
    }

    if (opts.invalidOutputType) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors['output-type'], 'output type');
      return;
    }


    // withdraw
    const withdraw = await t.wait(contract.withdraw(proof.encodePacked(), {
      ...overrides,
    }), 'withdraw ' + token, errors);



    // double withdraw
    if (attemptDoubleWithdraw) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors['withdrawal-occured'], 'double withdraw prevented for ' + token);
    }
  }


  await state ({ useErc20: false, attemptDoubleWithdraw: true });
  await state ({ useErc20: true, attemptDoubleWithdraw: true });
  await state ({ useErc20: true, invalidOutputOwner: true });
  await state ({ useErc20: true, invalidTokenId: true });
  await state ({ useErc20: true, invalidOutputType: true });
  await state ({ useErc20: true, registeredAddress: true });


} catch (error) { t.error(error, errors); } });
