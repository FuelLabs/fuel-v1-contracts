const block = require('./block');
const deposit = require('./deposit');
const inputs = require('./inputs');
const metadata = require('./metadata');
const outputs = require('./outputs');
const root = require('./root');
const transaction = require('./transaction');
const witness = require('./witness');
const state = require('./state');
const addons = require('./addons');
const eip712 = require('./eip712');

module.exports = {
  block,
  deposit,
  metadata,
  inputs,
  outputs,
  root,
  transaction,
  witness,
  state,
  addons,
  eip712,
};
