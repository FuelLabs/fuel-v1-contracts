(async () => {

  await require('./constructor');
  await require('./deposit');
  await require('./htlc');
  await require('./withdraw');
  await require('./bondWithdraw');
  await require('./verifyHeader');
  await require('./commitRoot');
  await require('./commitBlock');
  await require('./proveDoubleSpend');
  await require('./proveInvalidSum');
  await require('./proveInvalidInput');
  await require('./proveInvalidWitness');
  await require('./proveInvalidTransaction');
  await require('./proveMalformedBlock');
  await require('./proveInvalidInput');
  await require('./ownedProxy');
  await require('./correctnessChecks');
  await require('./simulation');
  await require('./merkleProof');

})();
