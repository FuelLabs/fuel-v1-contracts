const utils = require('fuel-common/utils');

// @description EIP712 typed structures
const types = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "contract", type: "address" },
  ],
  Transaction: [
    { name: "transaction", type: "bytes" },
  ],
};

// @description domain typehash
const DomainStruct = utils.keccak256(utils.solidityPack(
  ['string'], ['EIP712Domain(string name,string version,uint256 chainId,address contract)']
));

// @description Registration hash
const TransactionStruct = utils.keccak256(utils.solidityPack(
  // ...types.Transaction.map(v => `${v.name} ${v.type}`)
  ['string'], ['Transaction(bytes transaction)']
));

// @description default options
const defaults = ['Fuel', '1.0.0', 1];

// @description domain hash creation
function eip712Domain(opts) {
  // @descript EIP712 Domain Data
  const data = {
    name: defaults[0],
    version: defaults[1],
    chainId: defaults[2],
    ...opts,
  };

  // @description EIP712 Domain Hash
  const hash = utils.keccak256(utils.abi.encode(
    ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'], [
      DomainStruct,
      utils.keccak256(utils.solidityPack(['string'], [data.name])), // name
      utils.keccak256(utils.solidityPack(['string'], [data.version])), // version 1
      data.chainId, // chain id homestead (mainnet)
      data.contract, // salt
    ]
  ));

  return { hash, data };
}

// @description produce hash from EIP712 message
function hash({ transactionHashId, contract }) {
  // compute domain hash
  const domain = eip712Domain({ contract: contract.address });

  // produce registration hash
  const TransactionHash = utils.keccak256(utils.abi.encode(
    ['bytes32', 'bytes32'],
    [
      TransactionStruct,
      transactionHashId,
    ],
  ));

  // release hash
  const release = utils.keccak256(utils.solidityPack(
    ['string', 'bytes32', 'bytes32'], [
      "\x19\x01",
      domain.hash,
      TransactionHash,
    ],
  ));

  // message
  const message = {
    transactionHashId,
    contract: contract.address,
  };

  // Return typed data object
  const typedData = { types, domain: domain.data, primaryType: "Transaction", message };

  // return compliance hashes, typeData structure for MM, and registration hash
  return { typedData, hash: release, message: TransactionHash };
}

module.exports = {
  hash,
  types,
  eip712Domain,
  TransactionStruct,
  DomainStruct,
  defaults,
};
