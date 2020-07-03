const { test, utils, overrides } = require('@fuel-js/common/environment');
const { chunk, pack, combine } = require('@fuel-js/common/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const block = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');

const defaults = producer => [
  producer,
  20,
  20,
  20,
  utils.parseEther('1.0'),
  "Fuel",
  "1.0.0",
  1,
  utils.emptyBytes32
];

module.exports = {
  defaults,
};
