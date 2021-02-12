/// @dev Simplified version of tx proof generation for testing purposes.
/// @dev Prove complex transaction to be valid in summing, witness, input checks.
const { utils } = require('@fuel-js/environment');
const { pack, combine, struct } = require('@fuel-js/struct');
const { merkleProof, rightmostIndex, computeTransactionLeaf } = require('@fuel-js/protocol2/src/merkle');

const _TransactionProof = struct(`
    address producer,
    bytes32 previousBlockHash,
    uint256 height,
    uint256 blockNumber,
    uint256 numTokens,
    uint256 numAddresses,
    bytes32[**] roots,
    address rootProducer,
    bytes32 merkleTreeRoot,
    bytes32 commitmentHash,
    uint256 rootLength,
    uint256 feeToken,
    uint256 fee,
    uint16 rootIndex,
    bytes32[**] merkleProof,
    uint8 inputOutputIndex,
    uint16 transactionIndex,
    bytes1[**] transaction,
    bytes32[*] data,
    uint256 signatureFeeToken,
    uint256 signatureFee,
    address token,
    address selector,
    bytes1[**] inputProofs
`);

// Transaction proof builder, simplified.
function TransactionProof({
    block,
    root,
    inputOutputIndex,
    transactions,
    transactionIndex,
    signatureFee,
    signatureFeeToken,
    data,
    token,
    selector,
    inputProofs }) {
    const isEmpty = transactionIndex >= transactions.length;
    const transaction = isEmpty ? null : transactions[transactionIndex || 0];
    let _index = transactionIndex;
    const rightmost = rightmostIndex(transactions);

    // If the tx is empty, we assume rightmost.
    if (transactionIndex > rightmost) {
        _index = rightmost;
    }

    const proof = new _TransactionProof({
        ...block.object(),
        ...root.object(),
        rootIndex: block.properties.roots().get().indexOf(root.keccak256Packed()),
        merkleProof: merkleProof(transactions, _index),
        inputOutputIndex,
        transactionIndex: _index,
        transaction: isEmpty ? [] : pack(transaction),
        signatureFeeToken: signatureFeeToken || root.properties.feeToken().get(),
        signatureFee: signatureFee || root.properties.fee().get(),
        rootLength: utils.hexDataLength(combine(transactions)),
        data: data || [],
        token,
        selector,
        inputProofs: inputProofs || [],
    });

    proof.__leafHash = computeTransactionLeaf(transaction);

    return proof;
}

TransactionProof._TransactionProof = _TransactionProof;

module.exports = TransactionProof;