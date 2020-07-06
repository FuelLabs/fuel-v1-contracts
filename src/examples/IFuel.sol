contract IFuel {
  function deposit(address account, address token) external;
  function commitRoot(bytes32 merkleTreeRoot, uint256 token,  uint256 fee, bytes transactions) external;
  function commitBlock(uint32 minimum, uint32 height, bytes32[] roots) external;
  function commitWitness(bytes32 transactionId) external;
  function commitAddress(address addr) external returns (uint256 id);
  function withdraw(bytes proof) external;
  function bondWithdraw(bytes blockHeader) external;

  function proveMalformedBlock(bytes blockHeader, bytes rootHeader,  uint16 rootIndex, bytes transactions) external;
  function proveInvalidTransaction(bytes proof) external;
  function proveInvalidInput(bytes proofA, bytes proofB) external;
  function proveDoubleSpend(bytes proofA, bytes proofB) external;
  function proveInvalidWitness(bytes proof, bytes inputs) external;
  function proveInvalidSum(bytes proof, bytes inputs) external;

  function verifyHeader(bytes blockHeader, bytes root, uint256 rootIndex, uint8 finalization) external view returns (bool);
  function verifyTransaction(bytes proof, uint8 finalization) external view returns (bool);
  function verifyMetadata(bytes8 metadata, bytes proof) external view returns (bool);

  function selectUTXO(bytes proof) external view returns (bytes32 transactionId, uint8 outputIndex, uint8 outputType, address owner, uint256 amount, uint32 token, bytes32 digest, uint256 expiry, address returnOwner);
  function selectOutput(bytes proof) external view returns (bytes output);
  function selectMetadata(bytes proof, uint8 index) external view returns (bytes8 metadata);
  function outputMetadata(bytes proof) external view returns (uint256 id);
  function inputMetadata(bytes proof) external view returns (uint256 id);

  function witnessAt(address account, address blockNumber) external view returns (bytes32 transactionId);
  function funnel(address account) external view returns (address);
  function blockProducer() external view returns (address blockProducer);
  function blockTip() external view  returns (uint256 blockTip);
  function numTokens() external view  returns (uint256 numTokens);
  function tokens(address token) external view  returns (uint256 id);
  function numAddresses() external view  returns (uint256 numAddresses);
  function addressId(address owner) external view  returns (uint256 id);
  function depositAt(address account, uint32 token, uint32 blockNumber) external view  returns (uint256 amount);
  function blockCommitment(uint256 blockNumber) external view  returns (bytes32 blockHash);
  function blockRoots(bytes32 root) external view  returns (uint256 blockNumber);
  function isWithdrawalProcessed(uint256 blockHeight, bytes32 withdrawalHashId) external view returns (bool withdrawn);
  function penalty() external view returns (uint256);

  function BOND_SIZE() external view returns (uint256);
  function MAX_ROOT_SIZE() external view returns (uint256);
  function SUBMISSION_DELAY() external view returns (uint256);
  function FINALIZATION_DELAY() external view returns (uint256);
  function PENALTY_DELAY() external view returns (uint256);

  function name() external view returns (string);
  function version() external view returns (string);

  event BlockCommitted(address producer, uint256 numTokens, uint256 numAddresses, bytes32 indexed previousBlockHash, uint256 indexed height, bytes32[] roots);
  event RootCommitted(bytes32 indexed root, address rootProducer, uint256 feeToken, uint256 fee, uint256 rootLength, bytes32 indexed merkleTreeRoot, bytes32 indexed commitmentHash);
  event FraudCommitted(uint256 indexed previousTip, uint256 indexed currentTip, uint256 indexed fraudCode);
  event AddressIndexed(address indexed owner, uint256 indexed id);
  event TokenIndexed(address indexed token, uint256 indexed id);
  event DepositMade(address indexed account, address indexed token, uint256 amount);
  event WithdrawalMade(address indexed account,address token,uint256 amount,uint256 indexed blockHeight,uint256 rootIndex,bytes32 indexed transactionLeafHash,uint8 outputIndex,bytes32 transactionId);
}
