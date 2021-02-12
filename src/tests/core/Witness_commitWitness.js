const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../../builds/Fuel.json');
const Revert = require('../../builds/Revert.json');
const { defaults } = require('../utils/harness.js');

/// @dev Some additional witness commitment checks.
module.exports = test('Witness_commitWitness', async t => {

    // Construct contract.
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

    // A random tx hash.
    const txHash = utils.randomBytes(32);

    // Commit witness. 
    const revertContract = await t.deploy(
        Revert.abi,
        Revert.bytecode,
        [],
    );

    // Commit witness.
    let commitTx = await contract.commitWitness(txHash, {
        ...overrides,
    });

    // Commit witness.
    t.ok(await commitTx.wait(), 'commit witness');

    // Test for already-witnessed
    await t.revert(
        revertContract.doubleCommitWitnesss(
            contract.address,
            txHash,
            overrides,
        ),
        Revert.errors['already-witnessed'],
        'already-witnessed',
        Revert.errors,
    );

    await t.revert(
        contract.commitWitness(txHash, {
            ...overrides,
            value: 1,
        }),
        errors['not-payable'],
        'not-payable',
        errors,
    );

 });
