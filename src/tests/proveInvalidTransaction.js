const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/common/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('./harness');

module.exports = test('proveInvalidTransaction', async t => { try {

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
      value: valuea,
    });
    const etx = await t.wait(contract.deposit(producer, token, overrides),
      'ether deposit', errors);


    let metadata = [tx.MetadataDeposit(deposit.object())];
    let inputs = [tx.InputDeposit({ witnessReference: 0, owner: producer })];

    if (opts.fraud === 'metadata-size-underflow') {
      metadata = [];
    }

    if (opts.fraud === 'metadata-size-overflow') {
      metadata = (new Array(9)).fill(0).map(v => metadata[0]);
    }

    if (opts.fraud === 'metadata-deposit-height-underflow') {
      metadata = [tx.MetadataDeposit({
        token: tokenId,
        blockNumber: 0,
      })];
    }

    if (opts.fraud === 'metadata-deposit-height-overflow') {
      metadata = [tx.MetadataDeposit({
        token: tokenId,
        blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(3),
      })];
    }

    if (opts.fraud === 'metadata-deposit-token-overflow') {
      metadata = [tx.MetadataDeposit({
        token: '0x02',
        blockNumber: utils.bigNumberify(await t.getBlockNumber()).add(1),
      })];
    }

    if (opts.fraud === 'metadata-height-underflow') {
      metadata = [tx.Metadata({
        blockHeight: 0,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 0,
      })];
      inputs = [tx.Input({})];
    }

    if (opts.fraud === 'metadata-height-overflow') {
      metadata = [tx.Metadata({
        blockHeight: 2,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 0,
      })];
      inputs = [tx.Input({})];
    }

    if (opts.fraud === 'metadata-index-overflow') {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 2048,
        outputIndex: 0,
      })];
      inputs = [tx.Input({})];
    }

    if (opts.fraud === 'metadata-output-overflow') {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 9,
      })];
      inputs = [tx.Input({})];
    }

    let witnesses = [t.wallets[0]];

    if (opts.fraud === 'witnesses-size-underflow') {
      witnesses = [];
    }

    if (opts.fraud === 'witnesses-size-overflow') {
      witnesses = (new Array(20)).fill(0).map(v => t.wallets[0]);
    }

    if (opts.fraud === 'witness-caller-empty') {
      witnesses = [tx.Caller({
        owner: producer,
        blockNumber: '0x00',
      })];
    }

    if (opts.fraud === 'witness-type') {
      const invalidWitness = tx.Caller({
        owner: producer,
        blockNumber: '0x00',
      });
      invalidWitness.properties.type.set('0x03');
      witnesses = [invalidWitness];
    }

    if (opts.fraud === 'witnesses-size-overflow') {
      witnesses = [tx.Caller({
        owner: producer,
        blockNumber: '0x00',
      })];
      witnesses[0].properties.type.set('0x00');
    }

    if (opts.fraud === 'witnesses-index-overflow') {
      witnesses = (new Array(9)).fill(0).map(v => t.wallets[0]);
    }

    if (opts.fraud === 'inputs-size-underflow') {
      inputs = [];
    }

    if (opts.fraud === 'inputs-size-overflow') {
      inputs = (new Array(80)).fill(0).map(v => inputs[0]);
    }

    if (opts.fraud === 'inputs-type-overflow') {
      const invalidInput = tx.Input({});
      invalidInput.properties.type.set('0x05');
      inputs = [invalidInput];
    }

    if (opts.fraud === 'inputs-witness-reference-overflow') {
      const invalidInput = tx.Input({ witnessReference: 1 });
      inputs = [invalidInput];
    }

    if (opts.fraud === 'inputs-index-overflow') {
      inputs = (new Array(9)).fill(0).map(v => inputs[0]);
    }

    if (opts.fraud === 'inputs-size') {
      const invalidInput = tx.Input({});
      invalidInput.properties.type.set('0x01');
      inputs = [invalidInput];
    }


    let outputs = [tx.OutputTransfer({
      amount: 100,
      token: tokenId,
      owner: producer,
    }), tx.OutputWithdraw({
      amount: 500,
      token: tokenId,
      owner: producer,
    })];

    if (opts.fraud === 'outputs-size-underflow') {
      outputs = [];
    }

    if (opts.fraud === 'outputs-size-overflow') {
      outputs = (new Array(40)).fill(0).map(v => inputs[0]);
    }

    if (opts.fraud === 'outputs-token-length-underflow') {
      const invalidOutput = tx.OutputTransfer({
        token: [],
        amount: 45,
        owner: producer,
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-token-length-overflow') {
      const invalidOutput = tx.OutputTransfer({
        token: utils.emptyBytes32 + '00',
        amount: 45,
        owner: producer,
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-token-id-overflow') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x02',
        amount: 45,
        owner: producer,
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-amount-underflow') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x01',
        amount: 0,
        owner: producer,
      });
      invalidOutput.properties.shift.set(1);
      invalidOutput.properties.amount.set([]);
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-amount-mod') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x01',
        amount: 0,
        owner: producer,
      });
      invalidOutput.properties.shift.set(1);
      invalidOutput.properties.amount.set(utils.emptyBytes32);
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-amount-overflow') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x01',
        amount: 0,
        owner: producer,
      });
      invalidOutput.properties.shift.set(8);
      invalidOutput.properties.amount.set(utils.emptyBytes32 + '00');
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-amount-overflow') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x01',
        amount: 45,
        owner: producer,
      });
      invalidOutput.properties.shift.set(8);
      invalidOutput.properties.amount.set(utils.emptyBytes32);
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-owner-underflow') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x01',
        amount: 45,
        owner: [],
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-owner-overflow') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x01',
        amount: 45,
        owner: utils.hexZeroPad('0xaa', 21),
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-owner-id-overflow') {
      const invalidOutput = tx.OutputTransfer({
        token: '0x01',
        amount: 45,
        owner: '0x01',
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-return-owner-underflow') {
      const invalidOutput = tx.OutputHTLC({
        token: '0x01',
        amount: 45,
        owner: producer,
        digest: utils.emptyBytes32,
        returnOwner: [],
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-return-owner-overflow') {
      const invalidOutput = tx.OutputHTLC({
        token: '0x01',
        amount: 45,
        owner: producer,
        digest: utils.emptyBytes32,
        returnOwner: utils.hexZeroPad('0xaa', 21),
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-return-owner-id-overflow') {
      const invalidOutput = tx.OutputHTLC({
        token: '0x01',
        amount: 45,
        owner: producer,
        digest: utils.emptyBytes32,
        returnOwner: '0x01',
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-data-underflow') {
      const invalidOutput = tx.OutputReturn({
        data: [],
      });
      outputs = [invalidOutput, invalidOutput];
    }

    if (opts.fraud === 'outputs-data-overflow') {
      const invalidOutput = tx.OutputReturn({
        data: utils.hexZeroPad('0xaa', 513),
      });
      outputs = [invalidOutput];
    }

    if (opts.fraud === 'outputs-type') {
      const invalidOutput = tx.OutputTransfer({});
      invalidOutput.properties.type.set('0x05');
      outputs = [invalidOutput];
    }

    // build a transaction
    let transaction = await tx.Transaction({
      override: true,
      witnesses,
      metadata,
      data: [deposit],
      inputs,
      outputs,
      contract,
    });

    if (opts.fraud === 'transaction-length') {
      transaction.properties.length.set(45);
    }

    // produce it in a block
    const txs = [transaction];
    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combine(txs)),
      rootLength: utils.hexDataLength(combine(txs)),
    }));
    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot.get(), 0, 0, combine(txs), overrides),
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
    header.properties.ethereumBlockNumber.set(block.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');



    // submit a withdrawal proof
    const proof = tx.TransactionProof({
      block: header,
      root,
      transactions: txs,
      inputOutputIndex: 1,
      transactionIndex: 0,
      token,
    });

    if (opts.fraud) {
      const fraudTx = await t.wait(contract.proveInvalidTransaction(proof.encodePacked(), {
        ...overrides,
      }), 'submit fraud transaction', errors);

      t.equalBig(await contract.blockTip(), 0, 'tip');
      t.equalBig(fraudTx.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
      return;
    }

    // no fraud

    await t.wait(contract.proveInvalidTransaction(proof.encodePacked(), {
      ...overrides,
    }), 'submit valid input transaction', errors);
    t.equalBig(await contract.blockTip(), 1, 'tip');
  }

  await state ({ useErc20: false });
  await state ({ useErc20: true });

  await state ({ useErc20: true, fraud: 'metadata-size-underflow' });
  await state ({ useErc20: true, fraud: 'metadata-size-overflow' });

  await state ({ useErc20: true, fraud: 'witnesses-size-underflow' });
  await state ({ useErc20: true, fraud: 'witnesses-size-overflow' });

  await state ({ useErc20: true, fraud: 'inputs-size-underflow' });
  await state ({ useErc20: true, fraud: 'inputs-size-overflow' });

  await state ({ useErc20: true, fraud: 'transaction-length' });

  await state ({ useErc20: true, fraud: 'inputs-type-overflow' });
  await state ({ useErc20: true, fraud: 'inputs-witness-reference-overflow' });
  await state ({ useErc20: true, fraud: 'inputs-index-overflow' });
  await state ({ useErc20: true, fraud: 'inputs-size' });

  await state ({ useErc20: true, fraud: 'outputs-token-length-underflow' });
  await state ({ useErc20: true, fraud: 'outputs-token-length-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-token-id-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-amount-underflow' });
  await state ({ useErc20: true, fraud: 'outputs-amount-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-amount-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-owner-underflow' });
  await state ({ useErc20: true, fraud: 'outputs-owner-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-owner-id-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-data-underflow' });
  await state ({ useErc20: true, fraud: 'outputs-data-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-return-owner-underflow' });
  await state ({ useErc20: true, fraud: 'outputs-return-owner-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-return-owner-id-overflow' });
  await state ({ useErc20: true, fraud: 'outputs-type' });


  await state ({ useErc20: true, fraud: 'witness-caller-empty' });
  await state ({ useErc20: true, fraud: 'witness-type' });
  await state ({ useErc20: true, fraud: 'witnesses-size-overflow'});
  await state ({ useErc20: true, fraud: 'witnesses-index-overflow' });


  await state ({ useErc20: true, fraud: 'metadata-deposit-height-underflow' });
  await state ({ useErc20: true, fraud: 'metadata-deposit-height-overflow' });
  await state ({ useErc20: true, fraud: 'metadata-deposit-token-overflow' });
  await state ({ useErc20: true, fraud: 'metadata-height-underflow' });
  await state ({ useErc20: true, fraud: 'metadata-height-overflow' });
  await state ({ useErc20: true, fraud: 'metadata-index-overflow' });
  await state ({ useErc20: true, fraud: 'metadata-output-overflow' });


} catch (error) { t.error(error, errors); } });
