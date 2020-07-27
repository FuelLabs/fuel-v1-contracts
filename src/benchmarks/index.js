(async () => {
  try {
    await require('./transactions');
    await require('./minting');
    await require('./subscriptions');
    await require('./burning');
  } catch (error) {
    console.error(error);
  }
})();
