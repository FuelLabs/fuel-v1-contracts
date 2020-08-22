const { test, utils, BN, accounts } = require('@fuel-js/environment');
const root = require('../root');
const transaction = require('../transaction');
const abi = require('@fuel-js/abi');
const bytecode = require('@fuel-js/bytecode');

// defaults
const defaults = (producer, bondSize = utils.parseEther('1.0')) => [
  producer,
  20,
  20,
  20,
  bondSize,
  "Fuel",
  "1.0.0",
  1,
  utils.emptyBytes32
];

module.exports = test('root', async t => {

  t.throw(() => root.decodePacked('0x'), "transaction-index-underflow");
  t.throw(() => root.decodePacked('0x002a'), "transaction-length-underflow");
  t.throw(() => root.decodePacked('0x0044'), 'hex-data-overflow');

  const normal = root.Leaf({ data: utils.randomBytes(400) });

  t.equalHex(normal.encodePacked(), root.decodePacked(normal.encodePacked())[0], 'single');

  const packed = root.encodePacked([normal, normal, normal]);
  const decoded = root.decodePacked(packed);

  t.equalHex(decoded[0], normal.encodePacked(), 'check');
  t.equalHex(decoded[1], normal.encodePacked(), 'check');
  t.equalHex(decoded[2], normal.encodePacked(), 'check');
  t.equalBig(decoded.length, 3, 'length');

  const valid = root.Leaf({ data: utils.randomBytes(160) });
  const validPacked = root.encodePacked((new Array(root.MaxTransactionsInRoot - 1)).fill(valid));
  const decodeValidPacked = root.decodePacked(validPacked);

  const overflowPacked = root.encodePacked((new Array(root.MaxTransactionsInRoot)).fill(valid));

  t.throw(() => root.decodePacked(overflowPacked), 'transaction-index-overflow');

  const producer = t.getWallets()[0].address;
  const contract = await t.deploy(abi.Fuel, bytecode.Fuel, defaults(producer));

  const merkleRoot = utils.emptyBytes32;
  const fee = 0;
  const feeToken = 0;
  const transactions = utils.hexZeroPad('0x00', 350);

  let rootTx = await contract.commitRoot(merkleRoot, feeToken, fee, transactions, t.getOverrides());
  rootTx = await rootTx.wait();

  await t.catch(root.dataFromLog(), 'empty data from log');
  t.equal(await root.dataFromLog(rootTx.logs[0], contract), transactions, 'data from log');

  // RootHeader.fromLogs = async function (indexOrRoot, block = {}, contract = {}, transactions = false)

  const header = await root.RootHeader.fromLogs(rootTx.events[0].args.root, null, contract, false);

  t.equal(header.keccak256Packed(), rootTx.events[0].args.root, 'root header correct');

  await t.catch(root.RootHeader.fromLogs(utils.emptyBytes32, null, {
    provider: {
      getLogs: () => { throw new Error('err') },
    },
  }, false), 'check throw');

  const headerFromIndex = await root.RootHeader.fromLogsByIndex(0, {
    properties: {
      roots: () => ({
        get: () => [
          rootTx.events[0].args.root,
        ],
      }),
    },
  }, contract, false);

  t.equal(headerFromIndex.keccak256Packed(), rootTx.events[0].args.root, 'headerFromIndex header correct');

  const fromHash = await root.RootHeader.fromLogsByHash(rootTx.events[0].args.root, contract, false);

  t.equal(fromHash.keccak256Packed(), rootTx.events[0].args.root, 'fromHash header correct');

});
