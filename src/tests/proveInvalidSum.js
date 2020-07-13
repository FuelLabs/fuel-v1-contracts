const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, pack, combine, chunkJoin } = require('@fuel-js/common/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('./harness');

module.exports = test('proveInvalidSum', async t => { try {

  // Construct contract
  async function state ({ useErc20, attemptSpendOverflow }) {
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

    const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
    const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

    let token = utils.emptyAddress;
    let tokenId = '0x00';
    let numTokens = 1;
    const approxTxSize = 207; // root fee
    const fee = 1; // root fee

    // try an ether deposit
    const funnela = await contract.funnel(producer);
    const valuea = utils.bigNumberify(1000 + approxTxSize);

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

    const outputs = [
      deposit,
      tx.UTXO({
        transactionHashId: utils.emptyBytes32,
        outputIndex: 0,
        outputType: 0,
        amount: 100,
        token: tokenId,
        owner: producer,
      }),
      tx.UTXO({
        transactionHashId: utils.emptyBytes32,
        outputIndex: 0,
        outputType: 0,
        amount: 100,
        token: tokenId,
        owner: producer,
      }),
    ];

    // build a transaction
    const transaction = await tx.Transaction({
      witnesses: [ t.wallets[0] ],
      metadata: [
        tx.MetadataDeposit(deposit.object()),
        tx.Metadata({}),
        tx.Metadata({}),
      ],
      data: outputs.map(v => v.keccak256()),
      inputs: [
        tx.InputDeposit({
          owner: producer,
        }),
        tx.InputTransfer({}),
        tx.InputTransfer({}),
      ],
      outputs: [tx.OutputTransfer({
        amount: 100,
        token: tokenId,
        owner: producer,
      }), tx.OutputTransfer({
        amount: attemptSpendOverflow ? 101 : 100,
        token: tokenId,
        owner: producer,
      }), tx.OutputWithdraw({
        amount: 1000,
        token: tokenId,
        owner: producer,
      })],
      contract,
    });

    // produce it in a block
    const txs = [transaction];
    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combine(txs)),
      rootLength: utils.hexDataLength(combine(txs)),
      feeToken: tokenId,
      fee,
    }));
    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot.get(), tokenId, fee,
      combine(txs), overrides),
      'valid submit', errors);
    const header = new BlockHeader({
      producer,
      height: 1,
      numTokens,
      numAddresses: 1,
      roots: [root.keccak256Packed()],
    });

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
      transactions: txs,
      inputOutputIndex: 0,
      transactionIndex: 0,
      token,
    });

    const arg1 = proof.encodePacked();
    const arg2 = chunkJoin(outputs.map(v => v.encode()));

    if (!attemptSpendOverflow) {
      const invalidSum = await t.wait(contract.proveInvalidSum(arg1, arg2, {
        ...overrides,
      }), 'double spend same deposit not overflow', errors);
      t.equalBig(await contract.blockTip(), 1, 'tip');
      t.equal(invalidSum.logs.length, 0, 'no logs');
    }

    if (attemptSpendOverflow) {
      const fraud = await t.wait(contract.proveInvalidSum(arg1, arg2, {
        ...overrides,
      }), 'double spend same deposit overflow', errors);
      t.equalBig(await contract.blockTip(), 0, 'tip');
      t.equal(fraud.logs.length, 1, 'logs detected');
      t.equalBig(fraud.events[0].args.fraudCode, errors['sum'], 'root');
      t.equalBig(fraud.events[0].args.previousTip, 1, 'producer');
      t.equalBig(fraud.events[0].args.currentTip, 0, 'merkleRootA');
    }
  }

  await state ({ useErc20: false });
  await state ({ useErc20: true });
  await state ({ useErc20: false, attemptSpendOverflow: true });
  await state ({ useErc20: true, attemptSpendOverflow: true });


} catch (error) { t.error(error, errors); } });
