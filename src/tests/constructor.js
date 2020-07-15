const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const block = require('@fuel-js/protocol/src/block');
const { defaults } = require('./harness.js');

module.exports = test('constructor', async t => { try {

  t.ok(utils.hexDataLength(bytecode) < 24100, 'contract-bytecode-size-check');

  const state = async (contract, producer, params) => {
    let blockTip = utils.bigNumberify(0);
    let numTokens = utils.bigNumberify(1);
    let numAddresses = utils.bigNumberify(1);

    const logs = await t.logs(contract);

    t.equal(logs.length, 3, 'length');

    t.equal(logs[0].name, 'TokenIndexed', 'name');
    t.equalBig(logs[0].values.token, utils.emptyAddress, 'token');
    t.equalBig(logs[0].values.id, 0, 'id');

    t.equal(logs[1].name, 'AddressIndexed', 'name');
    t.equalBig(logs[1].values.owner, utils.emptyAddress, 'owner');
    t.equalBig(logs[1].values.id, 0, 'id');

    t.equal(logs[2].name, 'BlockCommitted', 'name');
    t.equalBig(logs[2].values.producer, producer, 'producer');
    t.equalHex(logs[2].values.previousBlockHash, utils.emptyBytes32, 'previous');
    t.equalBig(logs[2].values.height, 0, 'height');
    t.equalBig(logs[2].values.numTokens, numTokens, 'tokens');
    t.equalBig(logs[2].values.numAddresses, numAddresses, 'addresses');
    t.equal(logs[2].values.roots.length, 0, 'roots');

    t.equalBig(await contract.operator(), producer, 'producer');
    t.equalBig(await contract.blockTip(), blockTip, 'tip');
    t.equalBig(await contract.numTokens(), numTokens, 'numTokens');
    t.equalBig(await contract.numAddresses(), numAddresses, 'numTokens');
    t.equalBig(await contract.tokenId(utils.emptyAddress), 0, 'ether address');
    t.equalBig(await contract.numAddresses(), 1, 'num addresses');
    t.equalBig(await contract.addressId(utils.emptyAddress), 0, 'empty address');
    t.equalBig(await contract.depositAt(utils.emptyAddress, 0, 0), 0, 'empty deposit');
    t.equalBig(await contract.blockCommitment(0), block.genesis, 'genesis');
    t.equalBig(await contract.rootBlockNumberAt(utils.emptyBytes32), 0, 'empty root');
    t.equal(await contract.isWithdrawalProcessed(0, utils.emptyBytes32), false, 'empty withdrawal');
    t.equalBig(await contract.SUBMISSION_DELAY(), params[2], 'SUBMISSION_DELAY');
    t.equalBig(await contract.MAX_ROOT_SIZE(), 57600, 'MAX_ROOT_SIZE');
    t.equalBig(await contract.BOND_SIZE(), params[4], 'BOND_SIZE');
    t.equalBig(await contract.FINALIZATION_DELAY(), params[1], 'FINALIZATION_DELAY'); // 1 week
    t.equalBig(await contract.PENALTY_DELAY(), params[3], 'PENALTY_DELAY'); // 1 week
    t.equal(await contract.name(), params[5], 'name');
    t.equal(await contract.version(), params[6], 'version');

    await t.revert(t.wallets[0].sendTransaction({ to: contract.address, data: '0xaa' }),
      errors['invalid-signature'], 'invalid signature');
  };

  // Construct contract
  const producerA = t.wallets[0].address;
  const contractA = await t.deploy(abi, bytecode, defaults(producerA));

  await state(contractA, producerA, defaults(producerA));
  await t.increaseTime(100);
  await state(contractA, producerA, defaults(producerA));
  await t.increaseBlock(5);
  await state(contractA, producerA, defaults(producerA));

  // empty producer deployment
  const producerB = utils.emptyAddress;
  const contractB = await t.deploy(abi, bytecode, defaults(producerB));

  await state(contractB, producerB, defaults(producerB));
  await t.increaseTime(100);
  await state(contractB, producerB, defaults(producerB));
  await t.increaseBlock(5);
  await state(contractB, producerB, defaults(producerB));

  const nameOverflow = defaults(utils.emptyAddress);
  nameOverflow[5] = "fskljfdskjldfskjlfdsjkfsdjksdklsdfklkjfdskjlfsdklfds";
  try {
    await t.deploy(abi, bytecode, nameOverflow);
    t.equal(0, 1, "invalid deployment");
  } catch (error) {
    t.equal(typeof error, "object", "invalid deployment");
  }

  const versionOverflow = defaults(utils.emptyAddress);
  versionOverflow[6] = "fskljfdskjldfskjlfdsjkfsdjksdklsdfklkjfdskjlfsdklfds";
  try {
    await t.deploy(abi, bytecode, versionOverflow);
    t.equal(0, 1, "invalid deployment");
  } catch (error) {
    t.equal(typeof error, "object", "invalid deployment");
  }

} catch (error) { t.error(error, errors); } });
