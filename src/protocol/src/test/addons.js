const { test, utils } = require('@fuel-js/environment');
const addons = require('../addons');
const inputs = require('../inputs');
const outputs = require('../outputs');
const root = require('../root');
const deposit = require('../deposit');

module.exports = test('addons', async t => {

  t.ok(addons, 'addons available');

  const txInputs = [
    inputs.InputTransfer({}),
    inputs.InputRoot({}),
    inputs.InputDeposit({}),
  ];
  const txProofs = [
    outputs.UTXO({}, null, addons.UTXO),
    root.RootHeader({}, null, addons.RootHeader),
    deposit.Deposit({
      blockNumber: 2,
    }),
  ];

  txProofs[0].setAddon(addons.UTXO({
    blockHeight: 4,
  }));
  txProofs[1].setAddon(addons.RootHeader({
    blockHeight: 3,
  }));

  const empty = addons.metadataFromProofs();
  t.ok(empty, 'empty');

  const metadata = addons.metadataFromProofs(txInputs, txProofs);

  t.equal(metadata.length, 3, 'length');
  t.equalBig(metadata[0].properties.blockHeight().get(), 4, 'utxo check');
  t.equalBig(metadata[1].properties.blockHeight().get(), 3, 'root check');
  t.equalBig(metadata[2].properties.blockNumber().get(), 2, 'deposit check');

});
