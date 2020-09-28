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

module.exports = test('proveInvalidInput', async t => { try {

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



    // build a transaction
    const transaction = await tx.Transaction({
      inputs: [ tx.InputDeposit({
        witnessReference: 0,
        owner: producer,
      }) ],
      metadata: [ tx.MetadataDeposit( deposit.object() ) ],
      witnesses: [ t.wallets[0] ],
      data: [ deposit ],
      outputs: [ tx.OutputTransfer({
        amount: 100,
        token: tokenId,
        owner: producer,
      }), tx.OutputWithdraw({
        amount: 500,
        token: tokenId,
        owner: producer,
      }), tx.OutputReturn({
        data: ['0xaa'],
      }), tx.OutputHTLC({
        amount: 100,
        token: tokenId,
        owner: producer,
        expiry: 100000,
        digest: utils.keccak256(utils.emptyBytes32),
        returnOwner: producer,
      }) ],
      contract,
    });

    let inputs = [ tx.InputTransfer({
      witnessReference: 0,
    }) ];
    let metadata = [ tx.Metadata({
      blockHeight: 1,
      rootIndex: 0,
      transactionIndex: 0,
      outputIndex: 0,
    }) ];

    let proof = null;
    let data = [ utils.emptyBytes32 ];

    if (opts.deposit) {
      inputs = [tx.InputDeposit({
        witnessReference: 0,
        owner: producer,
      })];
      metadata = [tx.MetadataDeposit(deposit.object())];
      proof = deposit.encode();
      data = [deposit];
    }

    if (opts.root) {
      inputs = [tx.InputRoot({
        witnessReference: 0,
      })];
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 0,
      })];
    }

    if (opts.revert === "block-height-mismatch") {
      metadata = [tx.Metadata({
        blockHeight: 0,
      })];
    }

    if (opts.fraud === "input-root-index-overflow") {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 2,
      })];
    }

    if (opts.revert === "root-index-mismatch") {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 1,
      })];
    }

    if (opts.revert === "root-index-mismatch") {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 1,
      })];
    }

    if (opts.fraud === 'input-transaction-index-overflow') {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 2,
      })];
    }

    if (opts.revert === 'transaction-index-mismatch') {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 1,
      })];
    }

    if (opts.fraud === 'empty-transaction') {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 1,
      })];
    }

    if (opts.fraud === 'input-output-index-overflow') {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 4,
      })];
    }

    if (opts.fraud === 'input-withdraw') {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 1,
      })];
    }

    if (opts.fraud === "input-return") {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 2,
      })];
    }

    if (opts.fraud === "input-utxo-type") {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 3,
      })];
    }

    if (opts.htlc) {
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 3,
      })];
      inputs = [tx.InputHTLC({
        preImage: utils.emptyBytes32,
      })];
    }

    if (opts.fraud === "input-htlc-type") {
      inputs = [tx.InputHTLC({
        preImage: utils.emptyBytes32,
      })];
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 0,
      })];
    }

    if (opts.fraud === "htlc-preimage") {
      inputs = [tx.InputHTLC({
        preImage: utils.hexZeroPad('0xaa', 32),
      })];
      metadata = [tx.Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 3,
      })];
    }

    const transactionB = await tx.Transaction({
      inputs,
      metadata,
      witnesses: [ t.wallets[0] ],
      data,
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
    let txs = [transaction, transactionB];

    if (opts.fraud === 'empty-transaction') {
      txs = [transactionB];
    }

    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combine(txs)),
      rootLength: utils.hexDataLength(combine(txs)),
    }));
    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot().get(), 0, 0, combine(txs), overrides),
      'valid submit', errors);

    const root2 = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combine(txs)),
      rootLength: utils.hexDataLength(combine(txs)),
      fee: 500,
    }));
    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot().get(), 0, 500, combine(txs), overrides),
      'valid submit', errors);

    const header = (new BlockHeader({
      producer,
      height: 1,
      numTokens,
      numAddresses: 1,
      roots: [root.keccak256Packed(), root2.keccak256Packed()],
    }));

    const currentBlock = await t.provider.getBlockNumber();
    const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const block = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [root.keccak256Packed(), root2.keccak256Packed()], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    header.properties.blockNumber().set(block.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    if (opts.fraud === 'input-transaction-index-overflow') {
      proof = tx.TransactionProof({
        block: header,
        root,
        rootIndex: 0,
        transactions: txs,
        transactionIndex: 1,
        token,
      }).encodePacked();
    }

    if (opts.fraud === 'empty-transaction') {
      proof = tx.TransactionProof({
        block: header,
        root,
        rootIndex: 0,
        transactions: txs,
        transactionIndex: 1,
        token,
      }).encodePacked();
    }

    // submit a withdrawal proof
    if (proof === null) {
      let outputIndex = (opts.fraud === 'input-withdraw')
        ? 1
        : (opts.fraud === 'input-return'
          ? 2
          : 0);

      if (opts.fraud === "input-utxo-type") {
        outputIndex = 3;
      }

      if (opts.fraud === "input-htlc-type") {
        outputIndex = 0;
      }

      if (opts.fraud === "htlc-preimage") {
        outputIndex = 3;
      }

      if (opts.htlc) {
        outputIndex = 3;
      }

      proof = tx.TransactionProof({
        block: header,
        root,
        rootIndex: 0,
        transactions: txs,
        inputOutputIndex: outputIndex,
        transactionIndex: 0,
        token,
      }).encodePacked();
    }

    const proofB = tx.TransactionProof({
      block: header,
      root,
      rootIndex: 0,
      transactions: txs,
      inputOutputIndex: 0,
      transactionIndex: opts.fraud === 'empty-transaction' ? 0 : 1,
      token,
    });

    /*
    // Generate the fraud hash
    const fraudHash = utils.keccak256(contract.interface.functions.proveInvalidInput.encode(
      [
        proof,
        proofB.encodePacked(),
      ],
    ));

    // Commit the fraud hash.
    await t.wait(contract.commitFraudHash(fraudHash, {
      ...overrides,
    }), 'commit fraud hash', errors);

    // Wait 10 blocks for fraud finalization.
    await t.increaseBlock(11);
    */

    if (opts.revert) {
      await t.revert(contract.proveInvalidInput(proof, proofB.encodePacked(), {
        ...overrides,
      }), errors[opts.revert], opts.revert, errors);
      t.equalBig(await contract.blockTip(), 1, 'tip');
      return;
    }

    if (opts.fraud) {
      const fraudTx = await t.wait(contract.proveInvalidInput(proof, proofB.encodePacked(), {
        ...overrides,
      }), 'invalid input', errors);
      t.equal(fraudTx.logs.length, 1, 'logs detected');
      t.equalBig(fraudTx.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);
      return;
    }

    await t.wait(contract.proveInvalidInput(proof, proofB.encodePacked(), {
      ...overrides,
    }), 'invalid input', errors);
    t.equalBig(await contract.blockTip(), 1, 'tip');
  }


  await state ({ useErc20: false });
  await state ({ useErc20: false, deposit: true });
  await state ({ useErc20: false, root: true });

  await state ({ useErc20: false, revert: "block-height-mismatch" });
  await state ({ useErc20: false, fraud: "input-root-index-overflow" });
  await state ({ useErc20: false, fraud: "input-transaction-index-overflow" });

  await state ({ useErc20: false, fraud: "empty-transaction" });

  await state ({ useErc20: false, revert: "transaction-index-mismatch" });
  await state ({ useErc20: false, fraud: "input-output-index-overflow" });
  await state ({ useErc20: false, fraud: "input-withdraw" });
  await state ({ useErc20: false, fraud: "input-return" });

  await state ({ useErc20: false, htlc: true });
  await state ({ useErc20: false, fraud: "input-utxo-type" });
  await state ({ useErc20: false, fraud: "input-htlc-type" });
  await state ({ useErc20: false, fraud: "htlc-preimage" });


} catch (error) { t.error(error, errors); } });
