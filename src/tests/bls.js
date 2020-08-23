const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const { BlockHeader, RootHeader, EMPTY_SIGNATURE_HASH } = require('../protocol/src/block');
const { defaults } = require('./harness');
const mcl = require('../bls/mcl');
const BLS = require('../builds/BLS.json');

module.exports = test('bls', async t => {

    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));
    const blsFraudProver = await t.deploy(BLS.abi, BLS.bytecode, []);

    await mcl.init();
    const keypair = await mcl.newKeyPair();
    const message1 = '0xdeadbeef';
    const signedPayload = mcl.sign(message1, keypair.secret);

    const keypair2 = await mcl.newKeyPair();
    const message2 = '0xbeeffeed';
    const signedPayload2 = mcl.sign(message2, keypair2.secret);
    const aggregated = mcl.aggreagate(signedPayload.signature, signedPayload2.signature);

    const publicKeyHex1 = mcl.g2ToHex(keypair.pubkey);
    const messageHex1 = mcl.g1ToHex(mcl.hashToPoint(message1));
    const signatureHex1 = mcl.g1ToHex(aggregated);

    const message1HashToPoint = await blsFraudProver.hashToPoint(message1);
    t.equalBig(messageHex1[0], message1HashToPoint[0], 'hash to point contract V local');
    t.equalBig(messageHex1[1], message1HashToPoint[1], 'hash to point contract V local');

    const verifySingleResult = await blsFraudProver.verifySingle(
      mcl.g1ToHex(signedPayload.signature),
      mcl.g2ToHex(keypair.pubkey),
      mcl.g1ToHex(mcl.hashToPoint(message1)),
    );

    t.equal(verifySingleResult, true, 'verify single works');

    const verifySingleFalse = await blsFraudProver.verifySingle(
      mcl.g1ToHex(signedPayload2.signature),
      mcl.g2ToHex(keypair.pubkey),
      mcl.g1ToHex(mcl.hashToPoint(message1)),
    );

    t.equal(verifySingleFalse, false, 'verify single false when wrong');

    const verifyAggregate = await blsFraudProver.verifyMultiple(
      mcl.g1ToHex(aggregated),
      [ mcl.g2ToHex(keypair.pubkey), mcl.g2ToHex(keypair2.pubkey) ],
      [ mcl.g1ToHex(mcl.hashToPoint(message1)), mcl.g1ToHex(mcl.hashToPoint(message2)) ],
    );

    t.equal(verifyAggregate, true, 'verify multiple works');

    // mcl.js
    // - test key creation
    // - test key verification

    // Fuel
    // - commitAddress
    // - publicKeyHash
    // - addressId

    // BLSTest
    // - _verifyMultiple

    // FuelPackedStructures
    //  - root
    //  - block

    // BLS contract
    // - publicKeyHash
    // - message1FromRoot

});
