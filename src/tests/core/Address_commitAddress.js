const { test, overrides } = require('@fuel-js/environment');
const { bytecode, abi } = require('../../builds/Fuel.json');
const { defaults } = require('../utils/harness.js');

/// @dev Some additional witness commitment checks.
module.exports = test('Address_commitAddress', async t => {

    // Construct contract.
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

    t.equalBig(await contract.addressId(producer), 0, 'empty address');
    t.equalBig(await contract.numAddresses(), 1, 'num addresses');

    // Test for already-witnessed
    await t.wait(contract.commitAddress(
        producer,
        overrides,
    ));

    t.equalBig(await contract.addressId(producer), 1, 'empty address');
    t.equalBig(await contract.numAddresses(), 2, 'num addresses');

    t.equalBig(await contract.addressId(producer), 1, 'empty address');
    t.equalBig(await contract.numAddresses(), 2, 'num addresses');

    // Test for already-witnessed
    await t.wait(contract.commitAddress(
        producer,
        overrides,
    ));

    t.equalBig(await contract.addressId(producer), 1, 'empty address');
    t.equalBig(await contract.numAddresses(), 2, 'num addresses');

 });
