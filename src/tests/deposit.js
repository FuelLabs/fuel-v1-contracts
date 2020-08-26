const { test, utils, overrides, provider } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const ERC20 = require('../builds/ERC20.json');
const Revert = require('../builds/Revert.json');
const { Deposit } = require('../protocol/src/deposit');
const { defaults } = require('./harness');

module.exports = test('deposit', async t => { try {

    // Construct contract
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

    // Deploy Token
    const totalSupply = utils.bigNumberify('0xFFFFFFFFF');
    const token = await t.deploy(ERC20.abi, ERC20.bytecode, [producer, totalSupply]);

    const revertToken = await t.deploy(Revert.abi, Revert.bytecode, []);



    // check invalid encoding and value underflow
    await t.revert(contract.deposit(producer, utils.emptyAddress, overrides),
      errors['value-underflow'], 'no ether');



    // try an ether deposit
    const funnela = await contract.funnel(producer);
    const valuea = utils.bigNumberify(1000);
    await t.balanceEqual(funnela, 0, 'value');
    await t.wait(t.wallets[0].sendTransaction({
      ...overrides,
      value: valuea,
      to: funnela,
    }), 'ether to funnel');
    await t.balanceEqual(funnela, valuea, 'value');
    const block = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const depositHashId = (new Deposit({
      token: 0,
      owner: producer,
      blockNumber: block,
    })).keccak256();
    t.equalBig(await contract.depositAt(producer, 0, block), 0, 'empty deposit lookup');
    const etx = await t.wait(contract.deposit(producer, utils.emptyAddress, overrides),
      'ether deposit', errors);
    t.equalBig(await contract.depositAt(producer, 0, block), valuea, 'deposit lookup');
    await t.balanceEqual(funnela, 0, 'value');
    await t.balanceEqual(contract.address, valuea, 'value');
    t.equal(etx.events.length, 1, 'len events');
    t.equal(etx.events[0].event, 'DepositMade', 'event');
    t.equal(etx.events[0].args.owner, producer, 'account');
    t.equalBig(etx.events[0].args.token, 0, 'token');
    t.equalBig(etx.events[0].args.value, valuea, 'value');



    // lets try a token transfer
    const tokenValue = utils.bigNumberify('0xFFFF');
    t.equalBig(await token.balanceOf(funnela), 0, 'amount');
    await t.wait(token.transfer(funnela, tokenValue, overrides), 'token transfer');
    t.equalBig(await token.balanceOf(funnela), tokenValue, 'amount');
    const blocka = utils.bigNumberify(await t.getBlockNumber()).add(1);
    const tokenDepositHashId = (new Deposit({
      token: 1,
      owner: producer,
      blockNumber: blocka,
    })).keccak256();
    t.equalBig(await contract.depositAt(producer, 1, blocka), 0, 'empty deposit lookup');
    const ttx = await t.wait(contract.deposit(producer, token.address, overrides),
      'ether deposit', errors);
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
      errors['value-underflow'], 'value underflow', errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");

    await t.revert(contract.deposit(producer, token.address, overrides),
      errors['balance-underflow'], 'token balance underflow', errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");

    await t.revert(contract.deposit(producer, revertToken.address, overrides),
      errors['balance-check'], 'revert transfer balance check', errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");

    await t.wait(t.wallets[0].sendTransaction({
      ...overrides,
      value: valuea,
      to: funnela,
    }), 'ether to funnel');

    await t.revert(contract.deposit(producer, token.address, overrides),
      errors['ether-first'], 'ether first', errors);

    t.equalBig(0, await provider.getCode(await contract.funnel(producer)), "code check");


  } catch (error) { t.error(error, errors); } });
