(async () => {
  await require('./inputs');
  await require('./outputs');
  await require('./root');
  await require('./transaction');
  await require('./witness');
  await require('./block');
  await require('./addons');
  await require('./eip712');
  await require('./witness');
  await require('./withdraw');
  await require('./state');
  await require('./metadata');
})();
