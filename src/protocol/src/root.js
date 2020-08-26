const { struct } = require('@fuel-js/struct');
const utils = require('@fuel-js/utils');
const transaction = require('./transaction');

const MAX_ROOT_SIZE = 57600;
const MaxTransactionsInRoot = 2048;
const MIN_ROOT_SIZE = 44;

const RootHeader = struct(`
  address rootProducer,
  bytes32 merkleTreeRoot,
  bytes32 commitmentHash,
  uint256 rootLength,
  uint256 feeToken,
  uint256 fee,
  uint256 transactionType,
  bytes32 signatureHash
`);

const EMPTY_SIGNATURE_HASH = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

const dataFromLog = async (log = {}, contract = {}) => {
  try {
    const transaction = await contract.provider.getTransaction(log.transactionHash);
    return contract.interface.parseTransaction(transaction).args[3];
  } catch (error) {
    throw new utils.ByPassError(error);
  }
};

const decodePacked = (data = '0x') => {
  const dataLength = utils.hexDataLength(data);
  let transactions = [];
  let pos = 0;

  for (;pos < dataLength;) {
    const length = utils.hexToInt(utils.hexDataSub(data, pos, 2)) + 2;

    utils.assert(length > transaction.TransactionSizeMinimum, "transaction-length-underflow");
    utils.assert(length < transaction.TransactionSizeMaximum, "transaction-length-overflow");

    transactions.push(utils.hexDataSub(data, pos, length));
    pos += length;
  }

  utils.assert(pos === dataLength, "net-length-overflow");
  utils.assert(transactions.length > 0, 'transaction-index-underflow');
  utils.assert(transactions.length < MaxTransactionsInRoot, 'transaction-index-overflow');

  return transactions;
};

RootHeader.fromLogs = async function (indexOrRoot, block = {}, contract = {}, transactions = false) {
  try {
    const logs = await contract.provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: contract.address,
      topics: contract.filters.RootCommitted(!block
        ? indexOrRoot
        : block.properties.roots().get()[indexOrRoot]).topics,
    });

    const log = contract.interface.parseLog(logs[0]);

    return new RootHeader({ ...log.values });
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

function merkleTreeRoot(leafs = [], encoding = true) {
  let hashes = leafs.map(v => encoding ? v.keccak256Packed() : v);
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
const encodePacked = transactions;

module.exports = {
  RootHeader,
  Leaf,
  merkleTreeRoot,
  transactions,
  MAX_ROOT_SIZE,
  EMPTY_SIGNATURE_HASH,
  MaxTransactionsInRoot,
  encodePacked,
  decodePacked,
  dataFromLog,
};
