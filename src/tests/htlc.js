const { test, utils, overrides } = require('@fuel-js/common/environment');
const ERC20 = require('../builds/ERC20.json');
const HTLC = require('../builds/HTLC.json');
const { defaults } = require('./harness');

module.exports = test('htlc', async t => {
  // Construct contract
  const producer = t.wallets[0].address;
  const contract = await t.deploy(HTLC.abi, HTLC.bytecode, [producer]);

  // Deploy Token
  const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
  const token = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

  // attempt create HTLC
  const amount = 500;
  const etherToken = utils.emptyAddress;
  const preImage = utils.emptyBytes32;
  const digest = utils.keccak256(preImage);
  const expiry = (await t.provider.getBlockNumber()) + 50000;

  // tx send liquidity

  await t.balanceEqual(contract.address, 0, 'value');
  await t.wait(t.wallets[0].sendTransaction({
    ...overrides,
    value: amount,
    to: contract.address,
  }), 'ether to lp');
  await t.balanceEqual(contract.address, amount, 'value');

  // register htlc
  t.equalBig(await contract.locked(etherToken), 0, 'locked');
  const regTx = await t.wait(contract.register(producer,
    etherToken,
    digest,
    expiry,
    amount, overrides), 'register', HTLC.errors);
  const hash = regTx.events[0].args.hash;
  const registered = await contract.registered(hash);
  t.equalBig(await contract.locked(etherToken), amount, 'locked');
  await t.balanceEqual(contract.address, amount, 'value');
  t.ok(registered, 'is registered');

  // release this
  const release = await t.wait(contract.release(producer,
    etherToken,
    digest,
    expiry,
    amount, preImage, overrides), 'release', HTLC.errors);
  const registeredReleased = await contract.registered(hash);
  t.equalBig(await contract.locked(etherToken), 0, 'locked');
  await t.balanceEqual(contract.address, 0, 'value');
  t.ok(!registeredReleased, 'released properly');

  t.equalBig(await token.balanceOf(contract.address), 0, 'balance erc20');
  const transfer = await t.wait(token.transfer(contract.address, amount, overrides), 'transfer erc20');

  t.equalBig(await contract.locked(token.address), 0, 'locked');
  t.equalBig(await token.balanceOf(contract.address), amount, 'balance erc20');
  const regTx2 = await t.wait(contract.register(producer,
    token.address,
    digest,
    expiry,
    amount, overrides), 'register erc20', HTLC.errors);
  t.equalBig(await contract.locked(token.address), amount, 'locked');
  t.equalBig(await token.balanceOf(contract.address), amount, 'balance erc20');

  const release2 = await t.wait(contract.release(producer,
    token.address,
    digest,
    expiry,
    amount, preImage, overrides), 'release', HTLC.errors);
  t.equalBig(await contract.locked(token.address), 0, 'locked');
  t.equalBig(await token.balanceOf(contract.address), 0, 'balance erc20');
});
