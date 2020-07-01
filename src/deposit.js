const { struct } = require('fuel-common/struct');

const Deposit = struct(`
  address owner,
  uint256 token,
  uint256 blockNumber,
  uint256 value
`);

module.exports = {
  Deposit,
};
