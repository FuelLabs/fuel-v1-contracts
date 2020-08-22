const { struct } = require('@fuel-js/struct');

const State = struct(`
  uint32 numAddresses,
  uint32 numTokens,
  uint32 blockNumber,
  uint32 blockHeight,
  uint32 penalty,
  uint32 transactions,
  uint32 trades
`);

module.exports = {
  State,
};
