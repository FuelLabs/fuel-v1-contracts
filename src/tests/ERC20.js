const { test, utils, deploy, wallets, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/ERC20.json');

module.exports = test('ERC20', async t => {

  // Construct contract
  const owner = wallets[0].address;
  const totalSupply = utils.bigNumberify('0xFFFFFFFFFFFF');
  const contract = await deploy(abi, bytecode, [owner, totalSupply]);



  // Check owner balance
  t.equalBig(await contract.balanceOf(owner), totalSupply, 'owner balance');
  t.equalBig(await contract.balanceOf(wallets[1].address), 0, 'other balance');



  // Attempt Simple Transfer
  const value = utils.bigNumberify('0xFF');
  const txa = await t.wait(contract.transfer(wallets[1].address, value, overrides), 'transfer');
  t.equalBig(await contract.balanceOf(owner), totalSupply.sub(value), 'owner balance');
  t.equalBig(await contract.balanceOf(wallets[1].address), value, 'other balance');
  t.equal(txa.events[0].event, 'Transfer', 'event');
  t.equalHex(txa.events[0].args[0], wallets[0].address, 'source');
  t.equalHex(txa.events[0].args[1], wallets[1].address, 'destination');
  t.equalBig(txa.events[0].args[2], value, 'value');



  // Attempt Simple Transfer
  const txb = await t.wait(contract.transfer(wallets[1].address, value, overrides), 'transfer');
  t.equalBig(await contract.balanceOf(owner), totalSupply.sub(value.mul(2)), 'owner balance');
  t.equalBig(await contract.balanceOf(wallets[1].address), value.mul(2), 'other balance');
  t.equal(txb.events[0].event, 'Transfer', 'event');
  t.equalHex(txb.events[0].args[0], wallets[0].address, 'source');
  t.equalHex(txb.events[0].args[1], wallets[1].address, 'destination');
  t.equalBig(txb.events[0].args[2], value, 'value');



  // Attempt Zero Transfer
  const txe = await t.wait(contract.transfer(wallets[1].address, 0, overrides), 'transfer');
  t.equalBig(await contract.balanceOf(owner), totalSupply.sub(value.mul(2)), 'owner balance');
  t.equalBig(await contract.balanceOf(wallets[1].address), value.mul(2), 'other balance');
  t.equal(txe.events[0].event, 'Transfer', 'event');
  t.equalHex(txe.events[0].args[0], wallets[0].address, 'source');
  t.equalHex(txe.events[0].args[1], wallets[1].address, 'destination');
  t.equalBig(txe.events[0].args[2], 0, 'value');



  // Attempt Overflow Transfer
  await t.revert(contract
    .transfer(wallets[1].address, totalSupply.sub(value.mul(2)).add(1), overrides),
    errors["insufficient-balance"],
    'overflow');



  // Attempt Simple Transfer
  const other = contract.connect(wallets[1]);
  const txc = await t.wait(other.transfer(wallets[2].address, value, overrides), 'transfer');
  t.equalBig(await other.balanceOf(wallets[1].address), value.mul(1), 'other balance');
  t.equalBig(await other.balanceOf(wallets[2].address), value.mul(1), 'another balance');
  t.equal(txc.events[0].event, 'Transfer', 'event');
  t.equalHex(txc.events[0].args[0], wallets[1].address, 'source');
  t.equalHex(txc.events[0].args[1], wallets[2].address, 'destination');
  t.equalBig(txc.events[0].args[2], value, 'value');

});
