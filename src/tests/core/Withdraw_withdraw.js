const { test, utils, overrides } = require('@fuel-js/environment');
const { combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const Revert = require('../../builds/Revert.json');
const ReserseAbi = require('../utils/reverse.abi.json');
const ReserseBytecode = require('../utils/reverse.bytecode.js');
const { BlockHeader, RootHeader,
    merkleTreeRoot } = require('@fuel-js/protocol2/src/block');
const tx = require('@fuel-js/protocol2/src/transaction');
const { Deposit } = require('@fuel-js/protocol2/src/deposit');
const protocol = require('@fuel-js/protocol2');
const { defaults } = require('../utils/harness');

module.exports = test('Withdraw', async t => { try {

  // Construct contract
  async function state (opts = {}) {
    const { useErc20, attemptDoubleWithdraw } = opts;

    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

    const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
    const erc20 = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

    const revert = await t.deploy(Revert.abi, Revert.bytecode, []);

    const reverse = await t.deploy(ReserseAbi, ReserseBytecode, [
      contract.address,
    ]);

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
        owner: (opts.nullOwner || opts.invalidOutputOwner)
          ? utils.emptyAddress
          : (opts.registeredAddress ? '0x01' : producer),
      }),
      tx.OutputWithdraw({
        amount: 500,
        token: 0, // <-- ether
        owner: revert.address, // <-- null owner.
      }),
      tx.OutputWithdraw({
        amount: 500,
        token: 0, // <-- ether
        owner: reverse.address,
      }),
      ],
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
      inputOutputIndex: opts.reverse ? 3 : (opts.etherTransfer ? 2 : 1),
      transactions: txs,
      transactionIndex: 0,
      token: opts.reverse ? utils.emptyAddress : ((opts.etherTransfer ? utils.emptyAddress : token)),
      selector: opts.reverse ? reverse.address : (opts.nullOwner
        ? utils.emptyAddress
        : (
          opts.etherTransfer
            ? revert.address
            : producer
        )),
    });

    // Increase block to finality
    await t.increaseBlock(await contract.FINALIZATION_DELAY());

    if (opts.etherTransfer) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors['ether-transfer'], 'ether transfer revert on fallback');
      return;
    }

    if (opts.nullOwner) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors['null-owner'], 'null owner');
      return;
    }

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

    if (opts.reverse) {
      t.equalBig(await t.getProvider().getBalance(reverse.address), 0, "bal");
      await t.wait(reverse.attack(
        contract.interface.functions.withdraw.encode([
          proof.encodePacked(),
        ]),
        {
          gasLimit: 6000000,
        },
      ), 'withdraw');
      t.equalBig(await t.getProvider().getBalance(reverse.address), 500, "bal");
      await t.wait(reverse.attack(
        contract.interface.functions.withdraw.encode([
          proof.encodePacked(),
        ]),
        {
          gasLimit: 6000000,
        },
      ), 'withdraw');
      t.equalBig(await t.getProvider().getBalance(reverse.address), 500, "bal");
      return;
    }

    // withdraw
    const withdraw = await t.wait(contract.withdraw(proof.encodePacked(), {
      ...overrides,
    }), 'withdraw ' + token, errors);

    // Check state.
    t.equal(await contract.isWithdrawalProcessed(
      withdraw.events[0].args.blockHeight,
      protocol.withdraw.computeWithdrawId(
        0,
        withdraw.events[0].args.transactionLeafHash,
        withdraw.events[0].args.outputIndex,
      ),
    ), true, 'state check');

    // double withdraw
    if (attemptDoubleWithdraw) {
      await t.revert(contract.withdraw(proof.encodePacked(), {
        ...overrides,
      }), errors['withdrawal-occured'], 'double withdraw prevented for ' + token);
    }
  }

  await state ({ useErc20: true, reverse: true });
  await state ({ useErc20: false, attemptDoubleWithdraw: true });
  await state ({ useErc20: true, attemptDoubleWithdraw: true });
  await state ({ useErc20: true, invalidOutputOwner: true });
  await state ({ useErc20: true, invalidTokenId: true });
  await state ({ useErc20: true, invalidOutputType: true });
  await state ({ useErc20: true, registeredAddress: true });
  await state ({ useErc20: true, nullOwner: true });
  await state ({ useErc20: true, etherTransfer: true });

  // Additional checks for withdraw in Accounting.

} catch (error) { t.error(error, errors); } });
