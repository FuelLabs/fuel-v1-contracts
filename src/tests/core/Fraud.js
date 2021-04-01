const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot } = require('@fuel-js/protocol/src/block');
const ReserseAbi = require('../utils/reverse.abi.json');
const ReserseBytecode = require('../utils/reverse.bytecode.js');
const { defaults } = require('../utils/harness');

module.exports = test('Fraud', async t => { try {
    // Construct contract.
    const state = async (leafs, opts = {}) => {
      const producer = t.wallets[0].address;
      const contract = await t.deploy(abi, bytecode, defaults(producer));

      const txs = leafs;
      const merkleRootA = merkleTreeRoot(txs);
      const commitmentHash = utils.keccak256(combine(txs));
      const aroot = (new RootHeader({
        rootProducer: producer,
        merkleTreeRoot: merkleRootA,
        commitmentHash,
        rootLength: utils.hexDataLength(combine(txs)),
      }));

      const reverse = await t.deploy(ReserseAbi, ReserseBytecode, [
        contract.address,
      ]);

      const atx = await t.wait(contract.commitRoot(merkleRootA, 0, 0, combine(txs), overrides),
        'valid submit', errors);
      t.equal(atx.logs.length, 1, 'length');
      t.equalBig(await contract.rootBlockNumberAt(aroot.keccak256Packed()), atx.blockNumber, 'block');
      t.equalBig(atx.events[0].args.root, aroot.keccak256Packed(), 'root');
      t.equalBig(atx.events[0].args.rootProducer, producer, 'producer');
      t.equalBig(atx.events[0].args.merkleTreeRoot, merkleRootA, 'merkleRootA');
      t.equalBig(atx.events[0].args.commitmentHash, commitmentHash, 'commitmentHash');

      // commit block
      t.equalBig(await contract.blockTip(), 0, 'tip');
      const header = (new BlockHeader({
        producer,
        height: 1,
        numTokens: 1,
        numAddresses: 1,
        roots: [aroot.keccak256Packed()],
      }));

      const currentBlock = await t.provider.getBlockNumber();
      const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
      const ctx = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [aroot.keccak256Packed()], {
        ...overrides,
        value: await contract.BOND_SIZE(),
      }), 'commit block', errors);
      header.properties.blockNumber().set(ctx.events[0].blockNumber);
      t.equalBig(await contract.blockTip(), 1, 'tip');

      // submit proof, but block is valid
      const proofa = [header.encodePacked(), aroot.encodePacked(), 0, combine(txs)];

      let txr = null;

      // Generate the fraud hash
      let fraudHash = utils.keccak256(contract.interface.functions.proveMalformedBlock.encode(
        [
          ...proofa
        ],
      ));

      // If invalid fraud commitment hash. 
      if (opts.revert === 'fraud-commitment') { 
        fraudHash = utils.randomBytes(32);
      }

      // Commit the fraud hash.
      if (opts.reverse) {
        await t.wait(reverse.transact(
          contract.interface.functions.commitFraudHash.encode([
            fraudHash,
          ]),
          overrides,
        ), 'submit data');
        t.equalBig(await reverse.result(), 0, 'no error');
      } else {
        await t.wait(contract.commitFraudHash(fraudHash, {
          ...overrides,
        }), 'commit fraud hash', errors);  
      }

      // Wait 10 blocks for fraud finalization, unless we are testing for fraud-commitment-hash.
      if (opts.revert !== 'fraud-commitment-hash') {
        await t.increaseBlock(10);
      }

      t.equalBig(await t.getProvider().getBalance(reverse.address), utils.parseEther('0'), "bal");

      if (opts.reverse) {
        if (opts.nicely) {
          await reverse.attack(
            contract.interface.functions.proveMalformedBlock.encode([
              ...proofa,
            ]),
            overrides,
          );

          t.equalBig(await reverse.result(), 0, 'no error');
          t.equalBig(await t.getProvider().getBalance(reverse.address), utils.parseEther('0.5'), "bal");
          return;
        }

        t.equalBig(await t.getProvider().getBalance(reverse.address), 0, "bal");
        t.equalBig(await reverse.count(), 0, 'commitment');
        await t.wait(reverse.attack(
          contract.interface.functions.proveMalformedBlock.encode([
              ...proofa,
          ]),
          {
            gasLimit: 6000000,
          },
        ), 'fraud');
        t.equalBig(await reverse.count(), 1, 'commitment');
        t.equalBig(await reverse.result(), '0x', 'commitment');
        t.equalBig(await t.getProvider().getBalance(reverse.address), utils.parseEther('0.5'), "bal");
        await t.wait(reverse.attack(
          contract.interface.functions.proveMalformedBlock.encode([
            ...proofa,
          ]),
          {
            gasLimit: 6000000,
          },
        ), 'fraud');
        t.equalBig(await reverse.count(), 1, 'commitment');
        t.equalBig(await reverse.result(), errors['fraud-commitment'], 'commitment');
        t.equalBig(await t.getProvider().getBalance(reverse.address), utils.parseEther('0.5'), "bal");
        await t.wait(reverse.transact(
          contract.interface.functions.proveMalformedBlock.encode([
            ...proofa,
          ]),
          {
            gasLimit: 6000000,
          },
        ), 'fraud');
        t.equalBig(await reverse.count(), 1, 'commitment');
        t.equalBig(await reverse.result(), errors['fraud-commitment'], 'commitment');
        t.equalBig(await t.getProvider().getBalance(reverse.address), utils.parseEther('0.5'), "bal");
        return;
      }

      // if revert code.
      if (opts.revert) {
        // Check revert.
        await t.revert(
            contract.proveMalformedBlock(...proofa, overrides),
            errors[opts.revert],
            opts.revert,
        );

        // Stop here.
        return;
      }

      if (opts.fraud) {
        txr = await t.wait(contract.proveMalformedBlock(...proofa, overrides),
          'submit malformed proof', errors);

        t.equalBig(txr.events[0].args.fraudCode, errors[opts.fraud], opts.fraud);

        t.equalBig(await contract.blockTip(), 0, 'tip');
        return;
      }

      if (!opts.fraud) {
        txr = await t.wait(contract.proveMalformedBlock(...proofa, overrides),
          'submit malformed proof', errors);
        t.equalBig(await contract.blockTip(), 1, 'tip');
      }

      t.ok(txr.gasUsed.lt(2300000), 'gas used');
      t.ok(txr.cumulativeGasUsed.lt(2300000), 'cumu. gas used');
    }

    // Empty tx leaf.
    const emptyTx = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(100))) });
    const invalid = new Leaf({ data: chunk(utils.hexlify(utils.randomBytes(41))) });

    // Chseck for invalid fraud hash submission.
    await state([ emptyTx, invalid ], { reverse: 'fraud-commitment-hash', nicely: true });
    await state([ emptyTx, invalid ], { reverse: 'fraud-commitment-hash' });

    await state([ emptyTx ], { revert: 'fraud-commitment' });
    await state([ emptyTx ], { revert: 'fraud-commitment-hash' });

    // Theory Checks.
    // Unreachable: block-finalized -- should never be reachable due to verifyHeader checks.

} catch (error) { t.error(error, errors); } });
