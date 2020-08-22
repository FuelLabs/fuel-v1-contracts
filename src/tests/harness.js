const { test, utils, overrides } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const block = require('../protocol/src/block');
const tx = require('../protocol/src/transaction');
const { Deposit } = require('../protocol/src/deposit');

const defaults = (producer, bondSize = utils.parseEther('1.0')) => [
  producer,
  20,
  20,
  20,
  bondSize,
  "Fuel",
  "1.0.0",
  1,
  utils.emptyBytes32,
  utils.emptyAddress,
];

module.exports = {
  defaults,
};
