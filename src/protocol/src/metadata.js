const { struct } = require('@fuel-js/struct');
const utils = require('@fuel-js/utils');

const METADATA_MAX = 8;

const Metadata = struct(`
  uint32 blockHeight,
  uint8 rootIndex,
  uint16 transactionIndex,
  uint8 outputIndex
`);

const MetadataDeposit = struct(`
  uint32 token,
  uint32 blockNumber
`);

const MetadataStructs = [Metadata, MetadataDeposit];

const MetadataSize = 8;
const InputDepositType = 1;

function decodePacked(data = '0x', inputs = []) {
  let result = [];
  let index = 0;
  let pos = 0;
  const dataLength = utils.hexDataLength(data);

  for (; pos < dataLength;) {
    const decoder = inputs[index].properties.type().get().eq(InputDepositType)
      ? MetadataDeposit
      : Metadata;
    result.push(decoder.decodePacked(utils.hexDataSub(data, pos)));
    pos += MetadataSize;
    index++;
  }

  utils.assert(pos === dataLength, 'metadata-length-mismatch');
  utils.assert(result.length > 0, 'metadata-underflow');
  utils.assert(result.length === inputs.length, 'metadata-inputs-mismatch');
  utils.assert(result.length <= METADATA_MAX, 'metadata-overflow');

  return result;
}

module.exports = {
  decodePacked,
  Metadata,
  MetadataDeposit,
  MetadataStructs,
  MetadataSize,
  METADATA_MAX,
};
