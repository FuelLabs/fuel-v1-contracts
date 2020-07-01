const { test, utils, overrides } = require('fuel-common/environment');
const { chunk, pack, combine } = require('fuel-common/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const block = require('../../block');
const tx = require('../../transaction');
const { Deposit } = require('../../deposit');

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
