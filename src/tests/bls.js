const { test, utils, overrides } = require('@fuel-js/environment');
const struct = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const { BlockHeader, RootHeader, EMPTY_SIGNATURE_HASH } = require('../protocol/src/block');
const root = require('../protocol/src/root');
const { PackedTransfer, TransactionProof, _TransactionProof, Metadata, decodePacked } = require('../protocol/src/transaction');
const { defaults } = require('./harness');
const mcl = require('../bls/mcl');
const BLS = require('../builds/BLS.json');
const FuelUtil = require('../builds/FuelUtil.json');

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

    // Fuel util contract
    const fuelUtil = await t.deploy(FuelUtil.abi, FuelUtil.bytecode, defaults(
      producer,
      utils.parseEther('1.0')
    ));

    // deploy the BLS fraud prover contract
    const blsFraudProver = await t.deploy(BLS.abi, BLS.bytecode, [fuelUtil.address]);

    const contract = await t.deploy(abi, bytecode, defaults(
      producer,
      utils.parseEther('1.0'),
      blsFraudProver.address,
    ));

    // fraud prover address is correct from Fuel contract
    t.equalHex(await contract.BLS_FRAUD_PROVER(), blsFraudProver.address, 'bls fraud prover address');

    // init MCL for BLS aggregate signatures
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

    t.equalBig(await blsFraudProver.chunkIndexFromTransactionIndex(0), 0, 'chunk index');
    t.equalBig(await blsFraudProver.chunkIndexFromTransactionIndex(32), 1, 'chunk index');
    t.equalBig(await blsFraudProver.chunkIndexFromTransactionIndex(33), 1, 'chunk index');
    t.equalBig(await blsFraudProver.chunkIndexFromTransactionIndex(64), 2, 'chunk index');
    t.equalBig(await blsFraudProver.chunkIndexFromTransactionIndex(65), 2, 'chunk index');

    // build a valid packed transfer
    const packedTransfer = PackedTransfer({
      metadata: Metadata({
        blockHeight: 1,
        rootIndex: 0,
        transactionIndex: 0,
        outputIndex: 0,
      }).encodePacked(),
      from: '0x00000001',
      to: '0x00000001',
      transferAmount: '0xffffffff',
      changeAmount: '0xdddddddd',
    });

    // transacitons
    const transactions = (new Array(32)).fill(packedTransfer);

    // Message
    const rootFee = 0;
    const rootFeeToken = 0;
    const packedTransactionMessage = utils.abi.encode(
      ['bytes32', 'uint256', 'uint256'],
      [
        utils.hexZeroPad(packedTransfer.encodePacked(), 32),
        rootFee,
        rootFeeToken,
      ],
    );

    // sign the packed transfer
    const signatureData = mcl.sign(packedTransactionMessage, producerKeys.secret);

    // aggregate signatures, than return hex values
    const aggregateSignatures = [ mcl.g1ToHex((new Array(32))
      .fill(signatureData.signature)
      .reduce((acc, sig) => {
        // if no acc, return the first signature to start
        if (!acc) {
          return sig;
        }

        // than accumulate each aggregate signature together
        return mcl.aggreagate(acc, sig);
      }, null)) ];

    const chunkSize = 32;
    const transactionSize = 24;

    const combinedTransactions = struct.combine(transactions);

    // ensure the packed data has the right size specifications
    t.equal(utils.hexDataLength(combinedTransactions) % (chunkSize * transactionSize), 0,
      'correct packed size');

    // valid packed root
    const validPackedRoot = new root.RootHeader({
      rootProducer: producer,
      merkleTreeRoot: root.merkleTreeRoot(transactions, true),
      commitmentHash: utils.keccak256(combinedTransactions),
      rootLength: utils.hexDataLength(combinedTransactions),
      feeToken: utils.emptyBytes32,
      fee: 0,
      transactionType: 1,
      signatureHash: utils.keccak256(signaturesToBytes(aggregateSignatures)),
    });

    let commitRoot = await contract.commitRoot(
      validPackedRoot.properties.merkleTreeRoot().hex(),
      rootFee,
      rootFeeToken,
      combinedTransactions,
      1,
      signaturesToBytes(aggregateSignatures),
      t.getOverrides(),
    );
    commitRoot = await commitRoot.wait();

    const commitRootEvent = commitRoot.events[0].args;

    t.equal(commitRootEvent.signatureHash, validPackedRoot.properties.signatureHash().hex(), 'signatureHash');
    t.equal(commitRootEvent.commitmentHash, validPackedRoot.properties.commitmentHash().hex(), 'commitmentHash');

    const aggregateSignatureVerified = await blsFraudProver.verifyMultiple(
      aggregateSignatures[0],
      (new Array(32)).fill(mcl.g2ToHex(producerKeys.pubkey)),
      (new Array(32)).fill(mcl.g1ToHex(mcl.hashToPoint(packedTransactionMessage))),
    );

    t.ok(aggregateSignatureVerified, 'aggregate signature verified');

    const validBlock = (new BlockHeader({
      producer,
      height: 1,
      roots: [validPackedRoot.keccak256Packed()],
      numTokens: 1,
      numAddresses: 2,
    }));

    const currentBlock = await t.provider.getBlockNumber();
    const currentBlockHash = (await t.provider.getBlock(currentBlock)).hash;
    const ctx = await t.wait(contract.commitBlock(currentBlock, currentBlockHash, 1, [validPackedRoot.keccak256Packed()], {
      ...overrides,
      value: await contract.BOND_SIZE(),
    }), 'commit block', errors);
    validBlock.properties.blockNumber().set(ctx.events[0].blockNumber);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    // check block hash and root hash calculations
    t.equal(await fuelUtil.rootHash(validPackedRoot.encodePacked()),
      validPackedRoot.keccak256Packed(), 'rootHash');
    t.equal(await fuelUtil.blockHash(validBlock.encodePacked()),
      validBlock.keccak256Packed(), 'blockHash');

    // verify root header
    const verifyHeader = await contract
      .verifyHeader(validBlock.encodePacked(), validPackedRoot.encodePacked(), 0, 0);
    t.ok(verifyHeader, 'header data is verified');

    const decodeRootCheck = await blsFraudProver.decodeRoot(
      validPackedRoot.encodePacked(),
    );

    const rootAsObject = validPackedRoot.object();
    const keysRoot = Object.keys(rootAsObject);
    for (const keyRoot of keysRoot) {
      t.equalBig(rootAsObject[keyRoot], decodeRootCheck[keyRoot], 'root decode check ' + keyRoot);
    }

    await blsFraudProver.proveMalformedAggregateSignature(
      contract.address,
      validBlock.encodePacked(),
      validPackedRoot.encodePacked(),
      0,
      0,
      combinedTransactions,
      (new Array(32)).fill(producer), // normal ethereum addresses
      (new Array(32)).fill(producerPublicKey),
      aggregateSignatures,
      t.getOverrides(),
    );

    t.ok(await blsFraudProver.verifyTransactionValid(contract.address, validBlock.keccak256Packed(), 0, 0), 'transaction valid check');
    t.ok(await blsFraudProver.verifyTransactionValid(contract.address, validBlock.keccak256Packed(), 0, 1), 'transaction valid check');
    t.ok(await blsFraudProver.verifyTransactionValid(contract.address, validBlock.keccak256Packed(), 0, 31), 'transaction valid check');
    t.catch(blsFraudProver.verifyTransactionValid(contract.address, validBlock.keccak256Packed(), 0, 32), 'transaction valid check');

    const packedTransferTxProof = TransactionProof({
      block: validBlock,
      root: validPackedRoot,
      transactions,
      inputOutputIndex: 0,
      transactionIndex: 0,
      data: [ utils.emptyBytes32 ],
      pad: 400,
      token: utils.emptyAddress,
      selector: producer,
    });

    const expandedTransactionTxProof = _TransactionProof.decodePacked(
      await fuelUtil.expandPackedTransfer(packedTransferTxProof.encodePacked()),
    );

    const expandedTx = expandedTransactionTxProof.properties.transaction().hex();
    const expandedTxDecoded = decodePacked(expandedTx);

    // submit proof, but block is valid
    const proofa = [validBlock.encodePacked(), validPackedRoot.encodePacked(), 0, combinedTransactions];
    txr = await t.wait(contract.proveMalformedBlock(...proofa, overrides),
      'submit malformed proof', errors);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    const fraudTx = await t.wait(contract.proveInvalidTransaction(packedTransferTxProof.encodePacked(), {
      ...overrides,
    }), 'submit valid input transaction', errors);
    t.equalBig(await contract.blockTip(), 1, 'tip');

    if (fraudTx.logs.length) {
      console.log(fraudTx.logs[0].topics);
    }

    if (fraudTx.events.length) {
      console.log(fraudTx.events[0].args);
    }

    // Publish a block with 32 compressed txs
    // verifyHeader
    // verifyMerkleProof, add merkleTreeRoot to FuelUtil, ensure merkle proof correctness with fixed lengths
    //

    // Fuel
    // - verifyHeader
    // - rootHash
    // - blockHash

    // FuelPackedStructures
    //  - root
    //  - block
});
