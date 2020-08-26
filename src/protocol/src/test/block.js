const { test, utils } = require('@fuel-js/environment');
const abi = require('@fuel-js/abi');
const bytecode = require('@fuel-js/bytecode');
const block = require('../block');
const root = require('../root');

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

module.exports = test('block', async t => {

  const blockHeader = block.BlockHeader({
    roots: [utils.keccak256('0xaa'), utils.keccak256('0xbb'), utils.keccak256('0xcc')],
  });
  const rootHeader = { keccak256Packed: () => utils.keccak256('0xbb') };

  t.equal(block.rootIndex(blockHeader, rootHeader), 1, 'root index');

  const producer = t.getWallets()[0].address;
  const contract = await t.deploy(abi.Fuel, bytecode.Fuel, defaults(producer));

  const genesis = await block.BlockHeader.fromLogs(0, contract);

  t.equalBig(genesis.properties.height().get(), 0, 'gen height');

  await t.catch(block.BlockHeader.fromLogs(1, contract), 'block log overflow');

});
