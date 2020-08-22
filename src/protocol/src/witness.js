const { struct } = require('@fuel-js/struct');
const utils = require('@fuel-js/utils');
const eip712 = require('./eip712');

const WITNESSES_MAX = 8;

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

function transactionHashId(unsigned, contract, chainId = 1) {
  return eip712.hash({
    transactionHashId: unsigned.keccak256Packed(),
    contract,
    chainId,
  }).hash;
}

async function chainId(contract = {}) {
  try {
    const network = await contract.provider.getNetwork();
    return network.name === 'unknown' ? 0 : network.chainId;
  } catch (error) {
    throw new utils.ByPassError(error);
  }
}

async function Signature(wallet, unsigned, contract, __chainId = 1) {
  try {
    const network = __chainId === null ? await chainId(contract) : {};
    const _chainId = __chainId === null ? network.chainId : __chainId;

    const key = wallet.signingKey ? wallet.signingKey : wallet;
    return _Signature({
      ...utils.splitSignature(await key.signDigest(transactionHashId(unsigned, contract, _chainId))),
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

function recover(witness = {}, transactionHashId = '0x', callers = {}, block = null) {
  switch (witness.properties.type().get().toNumber()) {
    case WitnessTypes.Signature:
      return utils.recoverAddress(transactionHashId, utils.joinSignature(witness.object()));
      break;

    case WitnessTypes.Caller:
      const hash = witness.keccak256();
      utils.assertHexEqual(callers[hash], transactionHashId, 'witness-caller');
      return witness.properties.owner().hex();
      break;

    case WitnessTypes.Producer:
      utils.assert(block, 'witness-producer-block');
      return block.properties.blockProducer().hex();
      break;

    default:
      utils.assert(0, 'invalid-witness-type');
  }
}

function filter(witnesses = [], type = WitnessTypes.Caller) {
  let result = [];

  for (const witness of witnesses) {
    if (witness.properties.type().get().toNumber() === type) {
      result.push(witness);
    }
  }

  return result;
}

function decodePacked(data = '0x') {
  let result = [];
  let pos = 0;

  for (;pos < utils.hexDataLength(data);) {
    let decoder = null;
    const type = parseInt(utils.hexDataSub(data, pos, 1), 16);

    switch (type) {
      case WitnessTypes.Signature:
        decoder = Signature;
        break;

      case WitnessTypes.Caller:
        decoder = Caller;
        break;

      case WitnessTypes.Producer:
        decoder = Producer;
        break;

      default:
        utils.assert(0, 'invalid-witness-type');
    }

    const input = decoder.decodePacked(utils.hexDataSlice(data, pos));
    pos += input.sizePacked();
    result.push(input);
  }

  utils.assert(pos === utils.hexDataLength(data), 'inputs-witness-mismatch');
  utils.assert(result.length > 0, 'inputs-witness-underflow');
  utils.assert(result.length < WITNESSES_MAX, 'inputs-witness-overflow');

  return result;
}

module.exports = {
  WitnessTypes,
  WitnessStructs,
  Producer,
  Caller,
  Signature,
  chainId,
  transactionHashId,
  decodePacked,
  _Signature,
  recover,
  filter,
  WITNESSES_MAX,
};
