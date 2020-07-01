const { struct } = require('fuel-common/struct');
const utils = require('fuel-common/utils');
const eip712 = require('./eip712');

const WitnessTypes = {
  Signature: 0,
  Caller: 1,
  Producer: 2,
};

const _Signature = struct(
  `uint8 type,
  bytes32 r,
  bytes32 s,
  uint8 v`,
  opts => ({ ...opts, type: WitnessTypes.Signature })
);

function transactionHashId(unsigned, contract) {
  return eip712.hash({
    transactionHashId: unsigned.keccak256Packed(),
    contract,
  }).hash;
}

async function Signature(wallet, unsigned, contract) {
  try {
    const key = wallet.signingKey ? wallet.signingKey : wallet;
    return _Signature({
      ...utils.splitSignature(await key.signDigest(transactionHashId(unsigned, contract))),
    });
  } catch (error) {
    throw new utils.ByPassError(error);
  }
}

Object.assign(Signature, _Signature);

const Producer = struct(
  `uint8 type, bytes32 hash`,
  opts => ({ ...opts, type: WitnessTypes.Producer })
);

const Caller = struct(
  `uint8 type,
  address owner,
  uint32 blockNumber`,
  opts => ({ ...opts, type: WitnessTypes.Caller })
);

const WitnessStructs = [Signature, Caller, Producer];

module.exports = {
  WitnessTypes,
  WitnessStructs,
  Producer,
  Caller,
  Signature,
  transactionHashId,
};
