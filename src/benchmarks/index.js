(async () => {
  try {
    await require('./burning');

    /*
    await require('./transactions');
    await require('./minting');
    await require('./subscriptions');
    */
  } catch (error) {
    console.error(error);
  }
})();
