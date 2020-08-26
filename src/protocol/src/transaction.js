const { struct, chunk, pack, combine, chunkJoin } = require('@fuel-js/struct');
const utils = require('@fuel-js/utils');
const inputs = require('./inputs');
const outputs = require('./outputs');
const witness = require('./witness');
const metadata = require('./metadata');

const TransactionSizeMinimum = 44;
const TransactionSizeMaximum = 896;
const MaxReturnDataSize = 512;
const MaxInputs = 8;
const MaxOutputs = 8;

const Unsigned = struct(
  `bytes1[**] inputs,
  bytes1[**] outputs,
  bytes32[*] data,
  uint256 signatureFeeToken,
  uint256 signatureFee`,
  opts => ({ ...opts, inputs: pack(...opts.inputs), outputs: pack(...opts.outputs) }),
);

const PackedTransfer = struct(
  `bytes8 metadata,
  uint32 from,
  uint32 to,
  uint32 transferAmount,
  uint32 changeAmount`
);

const _Transaction = struct(`
  uint16 length,
  bytes8[*] metadata,
  bytes1[**] witnesses,
  bytes1[**] inputs,
  bytes1[**] outputs
`);

async function Transaction(opts = {}, addon = []) {
  try {
    if (!opts.override && (opts.inputs.length !== opts.data.length
          || opts.data.length !== opts.metadata.length)) {
      throw new Error('metadata, inputs, data must be same length');
    }

    // add mechanism for fee here..
    // data not totally right here, detect root in future..
    const unsigned = Unsigned({
      ...opts,
      data: opts.data.map(d => d._isStruct ? d.keccak256() : d),
    });

    // WE OVERRIDE THIS FOR TESTING to 1
    const chainId = 1; // opts.contract ? await witness.chainId(opts.contract) : 0;

    const witnesses = await Promise.all(opts.witnesses.map(v => v.signingKey
        ? witness.Signature(v, unsigned, opts.contract, chainId)
        : Promise.resolve(v)));

    const _leaf = _Transaction({
      metadata: (opts.metadata || []).map(m => m.encodePacked()),
      witnesses: pack(...witnesses),
      ...unsigned.object(),
    }, addon);

    _leaf.witnesses = wits => {
      _leaf.properties.witnesses().set(pack(...wits));
    };
    _leaf.properties.length().set(utils.hexDataLength(_leaf.encodePacked()) - 2);
    _leaf.transactionHashId = () => witness.transactionHashId(unsigned, opts.contract, chainId);
    _leaf.unsigned = () => unsigned;

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
  uint256 blockNumber,
  uint256 numTokens,
  uint256 numAddresses,
  bytes32[**] roots,
  address rootProducer,
  bytes32 merkleTreeRoot,
  bytes32 commitmentHash,
  uint256 rootLength,
  uint256 feeToken,
  uint256 fee,
  uint256 transactionType,
  bytes32 signatureHash,
  uint16 rootIndex,
  bytes32[**] merkleProof,
  uint8 inputOutputIndex,
  uint16 transactionIndex,
  bytes1[**] transaction,
  bytes32[*] data,
  uint256 signatureFeeToken,
  uint256 signatureFee,
  address token,
  address selector
`);

function suffixPadArray(arr = [], pad = 0) {
  const fill = (new Array(pad)).fill('0x00');
  return arr.concat(fill);
}

function TransactionProof({
  block,
  root,
  inputOutputIndex,
  transactions,
  transactionIndex,
  token,
  data,
  pad,
  selector }) {
  const isEmpty = transactionIndex >= transactions.length;
  const transaction = isEmpty ? null : transactions[transactionIndex || 0];
  return new _TransactionProof({
    ...block.object(),
    ...root.object(),
    rootIndex: block.properties.roots().get().indexOf(root.keccak256Packed()),
    merkleProof: merkleProof(transactions, transactionIndex),
    inputOutputIndex,
    transactionIndex,
    transaction: isEmpty ? [] : suffixPadArray(pack(transaction), pad || 0),
    rootLength: utils.hexDataLength(combine(transactions)),
    data: isEmpty
      ? []
      : (data || ((transaction.unsigned().object().data || [])
          .map(d => d._isStruct ? d.keccak256() : d))),
    token,
    selector,
  });
}

function decodePacked(data = '0x') {
  const decoded = _Transaction.decodePacked(data);
  const _inputs = inputs.decodePacked(decoded.properties.inputs().hex());
  const _outputs = outputs.decodePacked(decoded.properties.outputs().hex());
  const _witnesses = witness.decodePacked(decoded.properties.witnesses().hex());
  const _metadata = metadata.decodePacked(decoded.properties.metadata().hex(), _inputs);

  // check input witness references
  for (const input of _inputs) {
    utils.assert(input.properties.witnessReference().get().toNumber()
      < _witnesses.length, 'witness-reference-overflow');
  }

  return {
    decoded,
    inputs: _inputs,
    outputs: _outputs,
    witnesses: _witnesses,
    metadata: _metadata,
  };
}

module.exports = {
  Unsigned,
  Transaction,
  _Transaction,
  _TransactionProof,
  ...metadata,
  ...witness,
  ...inputs,
  ...outputs,
  decodePacked,
  PackedTransfer,
  TransactionProof,
  merkleProof,
  decodePacked,
  TransactionSizeMinimum,
  TransactionSizeMaximum,
  MaxReturnDataSize,
  MaxInputs,
  MaxOutputs,
};
