const { struct } = require('fuel-common/struct');
const utils = require('fuel-common/utils');

const RootHeader = struct(`
  address rootProducer,
  bytes32 merkleTreeRoot,
  bytes32 commitmentHash,
  uint256 rootLength,
  uint256 feeToken,
  uint256 fee
`);

const decodePacked = async (log, contract) => {
  try {
    const transaction = await contract.provider.getTransaction(log.transactionHash);
    const data = contract.interface.parseTransaction(transaction).args[3];
    let transactions = [];

    for (let pos = 0; pos < utils.hexDataLength(data);) {
      const length = utils.hexToInt(utils.hexDataSub(data, pos, 2)) + 2;
      transactions.push(utils.hexDataSub(data, pos, length));
      pos += length;
    }

    return transactions;
  } catch (error) {
    throw new utils.ByPassError(error);
  }
};

RootHeader.fromLogs = async function (indexOrRoot, block, contract, transactions = false) {
  try {
    const logs = await contract.provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: contract.address,
      topics: contract.filters.RootCommitted(!block
        ? indexOrRoot
        : block.properties.roots.get()[indexOrRoot]).topics,
    });

    const log = contract.interface.parseLog(logs[0]);
    const addon = transactions ? { transactions: await decodePacked(logs[0], contract) } : {};
    return new RootHeader({ ...log.values }, addon);
  } catch (error) {
    throw new utils.ByPassError(error);
  }
};

RootHeader.fromLogsByIndex = async function (index, block, contract, transactions = false) {
  return RootHeader.fromLogs(index, block, contract, transactions);
};

RootHeader.fromLogsByHash = async function (hash, contract, transactions = false) {
  return RootHeader.fromLogs(hash, null, contract, transactions);
};

function merkleTreeRoot(leafs) {
  let hashes = leafs.map(v => v.keccak256Packed());
  let swap = [];

  for (var i = 0; hashes.length > 0; i++) {
    const hash = hashes[i];

    if (hashes.length % 2 > 0) {
      hashes.push(utils.emptyBytes32);
    }

    for (var z = 0; z < hashes.length; z += 2) {
      swap.push(utils.keccak256(hashes[z] + hashes[z + 1].slice(2)));
    }

    hashes = swap;
    swap = [];

    if (hashes.length < 2) {
      break;
    }
  }

  return hashes[0];
}

const Leaf = struct('bytes1[**] data');
const transactions = leafs => '0x' + leafs.map(v => v.encodePacked().slice(2)).join('');

module.exports = {
  RootHeader,
  Leaf,
  merkleTreeRoot,
  transactions,
};
