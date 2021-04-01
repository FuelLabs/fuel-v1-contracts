const { test, utils, overrides, provider } = require('@fuel-js/environment');
const Fuel = require('../../builds/Fuel.json');
const ERC20 = require('../../builds/ERC20.json');
const Revert = require('../../builds/Revert.json');
const protocol = require('@fuel-js/protocol');
const { defaults } = require('../utils/harness');
const ReserseAbi = require('../utils/reverse.abi.json');
const ReserseBytecode = require('../utils/reverse.bytecode.js');

/// @dev Tests basic deposit functonality.
module.exports = test('Deposit', async t => { try {

    // Construct contract.
    const producer = t.wallets[0].address;
    const contract = await t.deploy(Fuel.abi, Fuel.bytecode, defaults(producer));

    // Deploy Token.
    const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
    const token = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

    // Revert token.
    const revertToken = await t.deploy(Revert.abi, Revert.bytecode, []);

    // Check invalid encoding and value underflow.
    await t.revert(contract.deposit(producer, utils.emptyAddress, overrides),
      Fuel.errors['value-underflow'], 'no ether');



    // Try an ether deposit.
    const funnela = await contract.funnel(producer);
    const nullFunnel = await contract.funnel(utils.emptyAddress);
    const valuea = utils.bigNumberify(1000);
    await t.balanceEqual(funnela, 0, 'value');
    await t.wait(t.wallets[0].sendTransaction({
      ...overrides,
      value: valuea,
      to: funnela,
    }), 'ether to funnel');
    await t.balanceEqual(funnela, valuea, 'value');
    const block = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const depositHashId = (new protocol.deposit.Deposit({
      token: 0,
      owner: producer,
      blockNumber: block,
    })).keccak256();
    t.equalBig(await contract.depositAt(producer, 0, block), 0, 'empty deposit lookup');
    const etx = await t.wait(contract.deposit(producer, utils.emptyAddress, overrides),
      'ether deposit', Fuel.errors);
    t.equalBig(await contract.depositAt(producer, 0, block), valuea, 'deposit lookup');

    await t.balanceEqual(funnela, 0, 'value');
    await t.balanceEqual(contract.address, valuea, 'value');
    t.equal(etx.events.length, 1, 'len events');
    t.equal(etx.events[0].event, 'DepositMade', 'event');
    t.equal(etx.events[0].args.owner, producer, 'account');
    t.equalBig(etx.events[0].args.token, 0, 'token');
    t.equalBig(etx.events[0].args.value, valuea, 'value');

    await t.wait(t.wallets[0].sendTransaction({
      ...overrides,
      value: valuea,
      to: nullFunnel,
    }), 'ether to null funnel');

    await t.revert(contract.deposit(utils.emptyAddress, utils.emptyAddress, overrides),
      Fuel.errors['null-owner'], 'null-owner', Fuel.errors);

    // Lets try a token transfer.
    const tokenValue = utils.bigNumberify('0xFFFF');
    t.equalBig(await token.balanceOf(funnela), 0, 'amount');
    await t.wait(token.transfer(funnela, tokenValue, overrides), 'token transfer');
    t.equalBig(await token.balanceOf(funnela), tokenValue, 'amount');
    const blocka = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const tokenDepositHashId = (new protocol.deposit.Deposit({
      token: 1,
      owner: producer,
      blockNumber: blocka,
    })).keccak256();
    t.equalBig(await contract.depositAt(producer, 1, blocka), 0, 'empty deposit lookup');
    const ttx = await t.wait(contract.deposit(producer, token.address, overrides),
      'ether deposit', Fuel.errors);

    t.equalBig(await contract.depositAt(producer, 1, blocka), tokenValue, 'deposit lookup');
    t.equalBig(await token.balanceOf(funnela), 0, 'amount');
    t.equal(ttx.logs.length, 3, 'len events');
    t.equalBig(ttx.events[1].data, tokenValue, 'value');

    t.equal(ttx.events[0].event, 'TokenIndexed', 'event');
    t.equalBig(ttx.events[0].args.id, 1, 'id');
    t.equal(ttx.events[0].args.token, token.address, 'token');

    t.equal(ttx.events[2].event, 'DepositMade', 'event');
    t.equal(ttx.events[2].args.owner, producer, 'account');
    t.equalBig(ttx.events[2].args.token, 1, 'token');
    t.equalBig(ttx.events[2].args.value, tokenValue, 'amount');

    await t.revert(contract.deposit(producer, utils.emptyAddress, overrides),
      Fuel.errors['value-underflow'], 'value underflow', Fuel.errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");

    await t.revert(contract.deposit(producer, token.address, overrides),
      Fuel.errors['balance-underflow'], 'token balance underflow', Fuel.errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");

    await t.revert(contract.deposit(producer, revertToken.address, overrides),
      Fuel.errors['transfer-call'], 'revert transfer balance check', Fuel.errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");

    await t.wait(t.wallets[0].sendTransaction({
      ...overrides,
      value: valuea,
      to: funnela,
    }), 'ether to funnel');

    await t.revert(contract.deposit(producer, token.address, overrides),
      Fuel.errors['ether-first'], 'ether first', Fuel.errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");

    // Send to revert funnel address.
    await t.wait(t.wallets[0].sendTransaction({
      ...overrides,
      value: valuea,
      to: await contract.funnel(revertToken.address),
    }), 'ether to funnel');

    // Send to revert token.
    await t.revert(revertToken.doubleDeposit(
      contract.address,
      revertToken.address,
      utils.emptyAddress,
      overrides,
    ), Revert.errors['per-block'], 'per-block');

    const reverse = await t.deploy(ReserseAbi, ReserseBytecode, [
      contract.address,
    ]);

    const funnelReverse = await contract.funnel(
      reverse.address,
    );

    t.equalBig(await token.balanceOf(funnelReverse), 0, 'amount');

    await t.wait(token.transfer(funnelReverse, tokenValue, overrides), 'token transfer');

    t.equalBig(await token.balanceOf(funnelReverse), tokenValue, 'amount');
    t.equalBig(await token.balanceOf(reverse.address), 0, 'reverse amount');
  
    await t.wait(reverse.attack(
      contract.interface.functions.deposit.encode([
        reverse.address,
        reverse.address,
      ]),
      {
        gasLimit: 6000000,
      },
    ), 'reverse');

    t.equalBig(await token.balanceOf(reverse.address), 0, 'reverse amount');
    t.equalBig(await token.balanceOf(funnelReverse), tokenValue, 'amount');
  
    // Theory check, not reachable with normal testing:
    // 'token-id-max'
    // 'value-funnel'
    // 'value-funnel',
    // 'value-check',
    // 'balance-call',
    // 'balance-check',
    // 'erc20-call-transfer',
    // 'erc20-return-transfer',
    // 'invalid-type'

  } catch (error) { t.error(error, Fuel.errors); } });
