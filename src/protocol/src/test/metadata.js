const { test, utils } = require('@fuel-js/environment');
const struct = require('@fuel-js/struct');
const metadata = require('../metadata');
const inputs = require('../inputs');

module.exports = test('metadata', async t => {

  t.throw(() => metadata.decodePacked(), 'metadata-underflow');
  t.throw(() => metadata.decodePacked('0x'), 'metadata-underflow');

  const txMetadata = [
    metadata.Metadata(),
  ];
  const txInputs = [
    inputs.Input(),
  ];

  const single = metadata.decodePacked(struct.combine(txMetadata), txInputs);

  t.equal(single.length, 1, 'single length');

  const txMetadata2 = [
    metadata.Metadata(),
    metadata.MetadataDeposit(),
  ];
  const txInputs2 = [
    inputs.Input(),
    inputs.InputDeposit(),
  ];

  const double = metadata.decodePacked(struct.combine(txMetadata2), txInputs2);

  t.equal(double.length, 2, 'double length');

  const txMetadataFull = [
    metadata.Metadata(),
    metadata.MetadataDeposit(),
    metadata.Metadata(),
    metadata.MetadataDeposit(),
    metadata.Metadata(),
    metadata.MetadataDeposit(),
    metadata.Metadata(),
    metadata.MetadataDeposit(),
  ];
  const txInputsFull = [
    inputs.Input(),
    inputs.InputDeposit(),
    inputs.Input(),
    inputs.InputDeposit(),
    inputs.Input(),
    inputs.InputDeposit(),
    inputs.Input(),
    inputs.InputDeposit(),
  ];

  const full = metadata.decodePacked(struct.combine(txMetadataFull), txInputsFull);

  t.equal(full.length, 8, 'double length');

});
