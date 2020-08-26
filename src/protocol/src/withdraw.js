const { struct } = require('@fuel-js/struct');

const WithdrawProof = struct(
  `uint256 rootIndex,
  bytes32 transactionLeafHash,
  uint256 outputIndex`
);

const Withdraw = struct(`address account,
  address tokenAddress,
  uint256 amount,
  uint256 blockHeight,
  uint256 rootIndex,
  bytes32 transactionLeafHash,
  uint8 outputIndex,
  uint256 transactionIndex`);

module.exports = {
  WithdrawProof,
  Withdraw,
};
