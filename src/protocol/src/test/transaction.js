const { test, utils, BN, accounts } = require('@fuel-js/environment');
const transaction = require('../transaction');
const inputs = require('../inputs');
const outputs = require('../outputs');
const metadata = require('../metadata');
const witness = require('../witness');
const root = require('../root');
const { combine } = require('@fuel-js/struct');

module.exports = test('transaction', async t => {

  const valid = await transaction.Transaction({
    inputs: [
      inputs.InputTransfer({}),
      inputs.InputTransfer({}),
      inputs.InputDeposit({}),
      inputs.InputTransfer({}),
      inputs.InputTransfer({}),
      inputs.InputTransfer({}),
      inputs.InputTransfer({}),
      inputs.InputTransfer({ witnessReference: 0 }),
    ],
    data: [
      utils.emptyBytes32,
      utils.emptyBytes32,
      utils.emptyBytes32,
      utils.emptyBytes32,
      utils.emptyBytes32,
      utils.emptyBytes32,
      utils.emptyBytes32,
      utils.emptyBytes32,
    ],
    outputs: [
      outputs.OutputTransfer({
        token: '0x00',
        amount: 50000,
        owner: t.wallets[0].address,
      }),
      outputs.OutputWithdraw({
        token: '0x00',
        amount: 102,
        owner: '0x00',
      }),
      outputs.OutputHTLC({
        token: '0x00',
        amount: 3001,
        owner: t.wallets[0].address,
        digest: utils.emptyBytes32,
        expiry: 48,
      }),
      outputs.OutputReturn({
        data: ['0xaa'],
      }),
    ],
    metadata: [
      metadata.Metadata({}),
      metadata.Metadata({}),
      metadata.MetadataDeposit({}),
      metadata.Metadata({}),
      metadata.Metadata({ blockHeight: 4 }),
      metadata.Metadata({}),
      metadata.Metadata({}),
      metadata.Metadata({}),
    ],
    witnesses: [
      witness._Signature({ v: 21 }),
    ],
  });

  const encoded = valid.encodePacked();
  const decoded = transaction.decodePacked(encoded);

  t.equalBig(decoded.metadata[4].properties.blockHeight().hex(), 4, 'metadata-check');
  t.equalBig(decoded.outputs[1].properties.amount().hex(), 102, 'amount-check');
  t.equalBig(decoded.witnesses[0].properties.v().hex(), 21, 'witness-version');
  t.equalBig(decoded.inputs[7].properties.witnessReference().hex(), 0, 'witness-reference');

});
