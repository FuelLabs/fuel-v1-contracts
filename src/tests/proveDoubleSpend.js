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

module.exports = test('proveDoubleSpend', async t => { try {

  // Construct contract
  async function state ({ useErc20, attemptDoubleWithdraw }) {
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
      value: valuea,
    });
    const etx = await t.wait(contract.deposit(producer, token, overrides),
      'ether deposit', errors);

    // build a transaction
    const transaction = await tx.Transaction({
      inputs: [tx.InputDeposit({
        witnessReference: 0,
        owner: producer,
      })],
      witnesses: [ t.wallets[0] ],
      metadata: [ tx.MetadataDeposit(deposit) ],
      data: [ deposit ],
      outputs: [ tx.OutputTransfer({
        amount: 100,
        token: tokenId,
        owner: producer,
      }), tx.OutputWithdraw({
        amount: 500,
        token: tokenId,
        owner: producer,
      }) ],
      contract,
    });
    const transactionB = await tx.Transaction({
      inputs: [tx.InputDeposit({
        witnessReference: 0,
        owner: producer,
      })],
      witnesses: [ t.wallets[0] ],
      metadata: [ tx.MetadataDeposit(deposit) ],
      data: [ deposit ],
      outputs: [tx.OutputTransfer({
        amount: 100,
        token: tokenId,
        owner: producer,
      }), tx.OutputWithdraw({
        amount: 500,
        token: tokenId,
        owner: producer,
      })],
      contract,
    });


    // produce it in a block
    const txs = [transaction, transactionB];
    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combine(txs)),
      rootLength: utils.hexDataLength(combine(txs)),
    }));
    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot().get(), 0, 0, combine(txs), overrides),
      'valid submit', errors);
    const header = (new BlockHeader({
      producer,
      height: 1,
      numTokens,
      numAddresses: 1,
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
      rootIndex: 0,
      transactions: txs,
      inputOutputIndex: 0,
      transactionIndex: 0,
      token,
    });
    const proofB = tx.TransactionProof({
      block: header,
      root,
      rootIndex: 0,
      transactions: txs,
      inputOutputIndex: 0,
      transactionIndex: 1,
      token,
    });

    // Generate the fraud hash
    const fraudHash = utils.keccak256(contract.interface.functions.proveDoubleSpend.encode(
      [
        proof.encodePacked(),
        proofB.encodePacked(),
      ],
    ));

    // Commit the fraud hash.
    await t.wait(contract.commitFraudHash(fraudHash, {
      ...overrides,
    }), 'commit fraud hash', errors);

    // Wait 10 blocks for fraud finalization.
    await t.increaseBlock(10);

    const fraud = await t.wait(contract.proveDoubleSpend(proof.encodePacked(), proofB.encodePacked(), {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'double spend same deposit', errors);

    t.equalBig(await contract.penalty(), (await contract.PENALTY_DELAY()).add(fraud.blockNumber), 'penalty')
  }


  await state ({ useErc20: false, attemptDoubleWithdraw: true });
  await state ({ useErc20: true, attemptDoubleWithdraw: true });


} catch (error) { t.error(error, errors); } });
