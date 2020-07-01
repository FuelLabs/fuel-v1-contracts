const { struct } = require('fuel-common/struct');
const utils = require('fuel-common/utils');

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

function decodePackedArray(_inputs, data, inputs) {
  let result = [];
  let index = 0;

  for (let pos = 0; pos < utils.hexDataLength(data);) {
    const decoder = inputs.isDeposit(_inputs[index]) ? MetadataDeposit : Metadata;
    result.push(decoder.decodePacked(data));
    pos += MetadataSize;
    index++;
  }

  return result;
}

module.exports = {
  decodePackedArray,
  Metadata,
  MetadataDeposit,
  MetadataStructs,
  MetadataSize,
};
