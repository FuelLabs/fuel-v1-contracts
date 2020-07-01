const { struct, chunk, pack, combine, chunkJoin } = require('fuel-common/struct');
const utils = require('fuel-common/utils');
const inputs = require('./inputs');
const outputs = require('./outputs');
const witness = require('./witness');
const metadata = require('./metadata');

const Unsigned = struct(
  `bytes1[**] inputs,
  bytes1[**] outputs,
  bytes32[*] data,
  uint256 signatureFeeToken,
  uint256 signatureFee`,
  opts => ({ ...opts, inputs: pack(...opts.inputs), outputs: pack(...opts.outputs) }),
);

const _Transaction = struct(`
  uint16 length,
  bytes8[*] metadata,
  bytes1[**] witnesses,
  bytes1[**] inputs,
  bytes1[**] outputs
`);

function decodeTyped(data, structs) {
  const type = utils.hexToInt(utils.hexDataSub(data, 0, 1));
  if (type >= structs.length) throw new Error('invalid-type');
  return structs[type].decodePacked(data);
}

function decodeTypedArray(data, structs) {
  let result = [];
  for (let pos = 0; pos < utils.hexDataLength(data);) {
    const decoded = decodeTyped(utils.hexDataSlice(data, pos), structs);
    const length = utils.hexDataLength(decoded.encodePacked());
    result.push(decoded);
    pos += length;
  }
  return result;
}

function decodePacked(data) {
  const decoded = _Transaction.decodePacked(data).object();
  const _inputs = decodeTypedArray(chunkJoin(decoded.inputs), inputs.InputStructs);

  return {
    length: decoded.length,
    inputs: _inputs,
    outputs: decodeTypedArray(chunkJoin(decoded.outputs), outputs.OutputStructs),
    witnesses: decodeTypedArray(chunkJoin(decoded.witnesses), witness.WitnessStructs),
    metadata: metadata.decodePackedArray(_inputs, chunkJoin(decoded.metadata), inputs),
  };
}

async function Transaction(opts = {}, contract) {
  try {
    if (!opts.override && (opts.inputs.length !== opts.data.length
          || opts.data.length !== opts.metadata.length)) {
      throw new Error('metadata, inputs, data must be same length');
    }

    const unsigned = Unsigned({
      ...opts,
      data: opts.data.map(d => d._isStruct ? d.keccak256() : d),
    });

    const witnesses = await Promise.all(opts.witnesses.map(v => v.signingKey
        ? witness.Signature(v, unsigned, contract)
        : Promise.resolve(v)));

    const _leaf = _Transaction({
      metadata: (opts.metadata || []).map(m => m.encodePacked()),
      witnesses: pack(...witnesses),
      ...unsigned.object(),
    }, { unsigned });

    _leaf.witnesses = wits => {
      _leaf.properties.witnesses.set(pack(...wits));
    };
    _leaf.properties.length.set(utils.hexDataLength(_leaf.encodePacked()) - 2);
    _leaf.transactionHashId = () => witness.transactionHashId(unsigned, contract);

    return _leaf;
  } catch (error) {
    throw new utils.ByPassError(error);
  }
}

Object.assign(Transaction, _Transaction);

function merkleProof(leafs, transactionIndex, returnLeftish = false) {
  let hashes = leafs.map(leaf => leaf.keccak256Packed());

  if (hashes.length % 2 > 0) {
    hashes.push(utils.emptyBytes32);
  }

  let oppositeLeafHash = hashes[transactionIndex];
  let masterHash = oppositeLeafHash;
  let swap = [];
  let proof = [];
  let leftish = false;

  for (var i = 0; hashes.length > 0; i++) {
    if (hashes.length % 2 > 0) {
      hashes.push(utils.emptyBytes32);
    }

    for (var z = 0; z < hashes.length; z += 2) {
      let depthHash = utils.keccak256(hashes[z]
          + hashes[z + 1].slice(2));

      if (hashes[z] === masterHash) {
        proof.push(hashes[z + 1]);
        masterHash = depthHash;

        if (z < hashes.length) {
          leftish = true;
        }
      }

      if (hashes[z + 1] === masterHash) {
        proof.push(hashes[z]);
        masterHash = depthHash;
      }

      swap.push(depthHash);
    }

    hashes = swap;
    swap = [];

    if (hashes.length < 2) {
      break;
    }
  }

  return returnLeftish ? { leftish, proof } : proof;
}

const _TransactionProof = struct(`
  address producer,
  bytes32 previousBlockHash,
  uint256 height,
  uint256 ethereumBlockNumber,
  uint256 numTokens,
  uint256 numAddresses,
  bytes32[**] roots,
  address rootProducer,
  bytes32 merkleTreeRoot,
  bytes32 commitmentHash,
  uint256 rootLength,
  uint256 feeToken,
  uint256 fee,
  uint16 rootIndex,
  bytes32[**] merkleProof,
  uint8 input,
  uint8 output,
  uint16 transactionIndex,
  bytes1[**] transaction,
  bytes32[*] data,
  uint256 signatureFeeToken,
  uint256 signatureFee,
  address token,
  address selector
`);

function TransactionProof({
  block,
  root,
  indexes,
  transactions,
  transactionIndex,
  token,
  selector }) {
  const isEmpty = transactionIndex >= transactions.length;
  const transaction = isEmpty ? null : transactions[transactionIndex || 0];
  return new _TransactionProof({
    ...block.object(),
    ...root.object(),
    rootIndex: block.properties.roots.get().indexOf(root.keccak256Packed()),
    merkleProof: merkleProof(transactions, transactionIndex),
    ...(indexes || {}),
    transactionIndex,
    transaction: isEmpty ? [] : pack(transaction),
    rootLength: utils.hexDataLength(combine(transactions)),
    data: isEmpty ? [] : (transaction.addon.unsigned.object().data || []).map(d => d._isStruct ? d.keccak256() : d),
    token,
    selector,
  });
}

module.exports = {
  Unsigned,
  Transaction,
  _Transaction,
  ...metadata,
  ...witness,
  ...inputs,
  ...outputs,
  decodePacked,
  TransactionProof,
  merkleProof,
};
