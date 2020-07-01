const { struct } = require('fuel-common/struct');
const utils = require('fuel-common/utils');
const root = require('./root');

const BlockHeader = struct(`
  address producer,
  bytes32 previousBlockHash,
  uint256 height,
  uint256 ethereumBlockNumber,
  uint256 numTokens,
  uint256 numAddresses,
  bytes32[**] roots
`);

function rootIndex(block, root) {
  return block.properties.roots.get().indexOf(root.keccak256Packed());
}

BlockHeader.fromLogs = async function (height, contract) {
  try {
    const logs = await contract.provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: contract.address,
      topics: contract.filters.BlockCommitted(null, null, null, null, height).topics,
    });

    const log = contract.interface.parseLog(logs[0]);

    return new BlockHeader({ ...log.values, ethereumBlockNumber: logs[0].blockNumber });
  } catch (error) {
    throw new utils.ByPassError(error);
  }
};

const genesis = '0x00';

module.exports = {
  ...root,
  BlockHeader,
  genesis,
  rootIndex,
};
