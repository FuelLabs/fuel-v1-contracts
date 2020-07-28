(async () => {
  try {
    // await require('./get');
    // await require('./subscriptions');
    await require('./transactions');
    // await require('./minting');
    // await require('./burning');
  } catch (error) {
    console.error(error);
  }
})();
