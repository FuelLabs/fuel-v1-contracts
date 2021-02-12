const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot } = require('@fuel-js/protocol2/src/block');
const tx = require('@fuel-js/protocol2/src/transaction');
const { Deposit } = require('@fuel-js/protocol2/src/deposit');
const { defaults } = require('../utils/harness');

/// @dev try various valid and invalid merkle proofs.
module.exports = test('MerkleProof', async t => { try {
  const maxTxs = 160;

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

    // Fake leafs.
    const fakeLeaf = new Leaf({
      data: chunk(utils.hexlify(utils.randomBytes(120))),
    });

    const transactionIndex = opts.transactionIndex || 0;

    const startFill = (new Array(transactionIndex))
      .fill(fakeLeaf);
    const endFill = (new Array(maxTxs - transactionIndex))
      .fill(fakeLeaf);

    // produce it in a block
    let txs = [...startFill, transaction, ...endFill];
    const combined = combine(txs);
    const root = (new RootHeader({
      rootProducer: producer,
      merkleTreeRoot: merkleTreeRoot(txs),
      commitmentHash: utils.keccak256(combined),
      rootLength: utils.hexDataLength(combined)
    }));

    await t.wait(contract.commitRoot(root.properties.merkleTreeRoot().get(), 0, 0, combine(txs), overrides),
      'valid submit ' + transactionIndex, errors);
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

    // Forse some incorrect merkle construction, should revert.
    if (opts.revert === 'invalid-merkle-root') {
      // Place the wrong leafs with the right tx index.
      const startFill = (new Array(transactionIndex))
        .fill(new Leaf({
          data: chunk(utils.hexlify(utils.randomBytes(120))),
        }));
      const endFill = (new Array(maxTxs - transactionIndex))
        .fill(new Leaf({
          data: chunk(utils.hexlify(utils.randomBytes(120))),
        }));

      txs = [
        ...startFill,
        transaction,
        ...endFill,
      ];
    }

    // submit a withdrawal proof
    const proof = tx.TransactionProof({
      block: header,
      root,
      inputOutputIndex: 1,
      transactions: txs,
      transactionIndex,
      token,
      selector: producer,
    });

    // Increase block to finality
    await t.increaseBlock(await contract.FINALIZATION_DELAY());

    // If revert is present, go for it.
    if (opts.revert) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors[opts.revert], opts.revert);
      return;
    }

    // withdraw
    const withdraw = await t.wait(contract.withdraw(proof.encodePacked(), {
      ...overrides,
    }), 'withdraw ' + token + ' index: ' + transactionIndex, errors);
  }

  await state ({ useErc20: true });
  await state ({ useErc20: true, registeredAddress: true });

  // 0 - 20
  for (var i = 0; i < maxTxs; i += 1) {
    await state ({
      useErc20: true,
      transactionIndex: i,
    });
  }

  // 0 - max; every even
  for (var i = 0; i < maxTxs; i += 2) {
    await state ({
      useErc20: true,
      transactionIndex: i,
    });
  }

  // 0 - max, every odd
  for (var i = 0; i < maxTxs; i += 3) {
    await state ({
      useErc20: true, 
      transactionIndex: i,
      revert: 'invalid-merkle-root',
    });
  }

  // Formal Verification Checks:
  // Unreachable: tree-height-overflow -- theory check.

} catch (error) { t.error(error, errors); } });
