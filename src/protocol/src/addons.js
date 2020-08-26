const { struct } = require('@fuel-js/struct');
const metadata = require('./metadata');
const inputs = require('./inputs');

const UTXO = struct(`
  uint64 timestamp,
  uint32 blockHeight,
  uint8 rootIndex,
  uint32 transactionIndex,
  uint32 outputIndex,
  uint32 blockNumber
`);

const Deposit = struct(`
  uint64 timestamp,
  bytes32 transactionHash
`);

const BlockHeader = struct(`
  uint64 timestamp,
  bytes32 transactionHash
`);

const RootHeader = struct(`
  uint64 timestamp,
  address blockProducer,
  uint32 rightmostIndex,
  uint32 blockHeight,
  uint32 blockNumber,
  uint8 rootIndex,
  bytes32 transactionHash
`);

const Transaction = struct(`
  bytes1[] transaction,
  uint32 blockHeight,
  uint8 rootIndex,
  uint32 transactionIndex,
  uint8 inputsLength,
  uint8 outputsLength,
  uint8 witnessesLength,
  uint32 blockNumber,
  uint64 timestamp,
  bytes32[] data,
  uint32 signatureFeeToken,
  uint256 signatureFee,
  bytes32[] spendableOutputs
`);

const Commitment = struct(`
  uint64 startTimestamp,
  uint64 startNonce,
  bytes32 startTransactionId,
  uint64 endTimestamp,
  uint64 endNonce,
  bytes32 endTransactionId,
  uint32 blockHeight,
  uint32 blockNumber,
  bytes32 transactionHash,
  bytes32[] roots
`);

function metadataFromProofs(_inputs = [], proofs = []) {
  let result = [];

  for (var i = 0; i < _inputs.length; i++) {
    if (_inputs[i].properties.type().get().toNumber() === inputs.InputTypes.Deposit) {
      result.push(metadata.MetadataDeposit(proofs[i].object()));
    } else if (_inputs[i].properties.type().get().toNumber() === inputs.InputTypes.Root) {
      result.push(metadata.Metadata(RootHeader(proofs[i].getAddon().object()).object()));
    } else {
      result.push(metadata.Metadata(UTXO(proofs[i].getAddon().object()).object()));
    }
  }

  return result;
}

module.exports = {
  UTXO,
  RootHeader,
  BlockHeader,
  Deposit,
  Transaction,
  Commitment,
  metadataFromProofs,
};
