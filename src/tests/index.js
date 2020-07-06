(async () => {

  await require('./constructor');
  await require('./deposit');
  await require('./withdraw');
  await require('./bondWithdraw');
  await require('./verifyHeader');
  await require('./commitRoot');
  await require('./proveDoubleSpend');
  await require('./proveInvalidSum');
  await require('./proveInvalidInput');
  await require('./proveInvalidWitness');
  await require('./proveInvalidTransaction');
  await require('./proveMalformedBlock');
  await require('./proveInvalidInput');

})();
