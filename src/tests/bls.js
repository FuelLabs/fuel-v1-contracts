const { test, utils, overrides } = require('@fuel-js/environment');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const { BlockHeader, RootHeader, EMPTY_SIGNATURE_HASH } = require('../protocol/src/block');
const { defaults } = require('./harness');
const mcl = require('../bls/mcl');
const BLS = require('../builds/BLS.json');

function pubKeyAddress(pubkey = []) {
  const pubKeyhash = utils.keccak256('0x' + pubkey.map(v => v.slice(2)).join(''));

  return '0x' + pubKeyhash.slice(10);
}

function addressFromHashAndId(hashAndID = '0x') {
  return hashAndID.slice(0, -8);
}

module.exports = test('bls', async t => {

    // deploy Fuel
    const producer = t.wallets[0].address;
    const contract = await t.deploy(abi, bytecode, defaults(producer));

    // deploy the BLS fraud prover contract
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

    const producerKeys = await mcl.newKeyPair();
    const producerPublicKey = mcl.g2ToHex(producerKeys.pubkey);

    let addressTx = await contract.commitAddress(
      producer,
      producerPublicKey[0],
      producerPublicKey[1],
      producerPublicKey[2],
      producerPublicKey[3],
      t.getOverrides(),
    );
    addressTx = await addressTx.wait();
    const addressTxEvent = addressTx.events[0];

    const knownAddressId = 1;

    function pad32(bn = {}) {
      return utils.hexZeroPad(utils.hexlify(bn), 32);
    }

    t.equal(pad32(addressTxEvent.args.publicKeyA), producerPublicKey[0], 'pubkeya');
    t.equal(pad32(addressTxEvent.args.publicKeyB), producerPublicKey[1], 'pubkeyb');
    t.equal(pad32(addressTxEvent.args.publicKeyC), producerPublicKey[2], 'pubkeyc');
    t.equal(pad32(addressTxEvent.args.publicKeyD), producerPublicKey[3], 'pubkeyd');
    t.equalBig(addressTxEvent.args.id, knownAddressId, 'id');
    t.equalBig(pubKeyAddress(producerPublicKey),
      addressFromHashAndId(addressTxEvent.args.hashAndId), 'pub key address');

    t.equalBig(await contract.publicKeyHash(producer), pubKeyAddress(producerPublicKey),
      'public key address from contract');
    t.equalBig(await contract.addressId(producer), knownAddressId,
      'address ID from contract');

    t.equal(await contract.publicKeyHash(producer),
      await blsFraudProver.publicKeyHash(producerPublicKey), 'bls pub key address matches Fuel');

    /*
    bytes32 merkleTreeRoot, uint256 token,
      uint256 fee, bytes transactions, uint8 transactionType, bytes signatures
      */

    // try multiple signatures
    const signatures = [
      mcl.g1ToHex(signedPayload.signature),
      mcl.g1ToHex(signedPayload2.signature),
    ];

    function signaturesToBytes(hexSignatures = []) {
      return '0x' + hexSignatures.map(sig => sig[0].slice(2) + sig[1].slice(2)).join('');
    }

    // attempt committing a root with a series of signatures, single first than multiple after
    let rootTx = await contract.commitRoot(
      utils.emptyBytes32,
      0,
      0,
      utils.hexZeroPad('0x00', 500),
      1,
      signaturesToBytes(signatures),
      t.getOverrides(),
    );
    rootTx = await rootTx.wait();

    t.equal(rootTx.events[0].args.signatureHash, await blsFraudProver.signatureHash(signatures),
      'signature hash in fraud prover is the same in Fuel');

    // t.equal(await blsFraudProver.signatureHash(), await

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
