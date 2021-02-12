(async () => {

  // External Contracts.
  await require('./external/HTLC');
  await require('./external/OwnedProxy');
  await require('./external/ERC20');

  // Core functionality.
  await require('./core/Deposit');
  await require('./core/Block_commitBlock');
  await require('./core/Address_commitAddress');
  await require('./core/Fuel_constructor');
  await require('./core/Root_commitRoot');
  await require('./core/Witness_commitWitness');
  await require('./core/Withdraw_withdraw');
  await require('./core/Withdraw_erc20');
  await require('./core/Withdraw_deep');
  await require('./core/Withdraw_bondWithdraw');
  await require('./core/Fraud');

  // Correctness of operations and Code checks.
  await require('./correctness/CodeChecks');
  await require('./correctness/Simulation');
  await require('./correctness/Accounting');
  await require('./correctness/CorrectnessChecks');

  // Fraud Proving.
  await require('./provers/DoubleSpend');
  await require('./provers/InvalidSum');
  await require('./provers/InvalidInput');
  await require('./provers/InvalidWitness');
  await require('./provers/InvalidTransaction');
  await require('./provers/MalformedBlock');
  await require('./provers/InvalidInput');
  await require('./provers/DoubleSpend_complex');
  await require('./provers/DoubleSpend_fuzz');
  await require('./provers/InvalidTransaction_complex');
  await require('./provers/InvalidTransaction_fuzz');
  await require('./provers/InvalidInput_complex');

  // Proof Verification.
  await require('./verifiers/BlockHeader');
  await require('./verifiers/MerkleProof');
  await require('./verifiers/TransactionProof');
  await require('./verifiers/Data');
  await require('./verifiers/Inputs');

})();
