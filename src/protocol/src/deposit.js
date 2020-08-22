const { struct } = require('@fuel-js/struct');

const Deposit = struct(`
  address owner,
  uint256 token,
  uint256 blockNumber,
  uint256 value
`);

module.exports = {
  Deposit,
};
