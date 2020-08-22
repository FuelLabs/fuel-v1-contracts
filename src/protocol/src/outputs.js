const { struct, chunk, chunkJoin } = require('@fuel-js/struct');
const utils = require('@fuel-js/utils');

const OUTPUTS_MAX = 8;

function shiftValue(value = 0) {
  const bn = utils.bigNumberify(value || 0);
  let amount = chunk(bn.toHexString());
  let shift = 0;

  if (bn.eq(0)) {
    return { shift: 0, amount: ['0x00'] };
  }

  for (var i = amount.length - 1; i >= 0; i--) {
    if (amount[i] === '0x00') {
      shift += 8;
    } else {
      break;
    }
  }

  return {
    shift,
    amount: amount.slice(0, shift ? -1 * (shift / 8) : amount.length),
  };
}

function packAmount(output = {}) {
  if (output.shift) return {};
  return shiftValue(output.amount);
}

function unpackAmount(output = {}) {
  const shift = (new Array(output.properties.shift().get().toNumber())).fill('00').join('');
  const value = output.properties.amount().get();
  return utils.bigNumberify(chunkJoin(Array.isArray(value) ? value : [value.toHexString()]) + shift);
}

const OutputTypes = {
  Transfer: 0,
  Withdraw: 1,
  HTLC: 2,
  Return: 3,
};

const OutputTransfer = struct(
  `uint8 type,
  bytes1[*] token,
  uint8 shift,
  uint8[*] amount,
  bytes1[*] owner`,
  opts => ({ ...opts, ...packAmount(opts), type: OutputTypes.Transfer })
);

const OutputWithdraw = struct(
  `uint8 type,
  bytes1[*] token,
  uint8 shift,
  uint8[*] amount,
  bytes1[*] owner`,
  opts => ({ ...opts, ...packAmount(opts), type: OutputTypes.Withdraw })
);

const OutputHTLC = struct(
  `uint8 type,
  bytes1[*] token,
  uint8 shift,
  uint8[*] amount,
  bytes1[*] owner,
  bytes32 digest,
  uint32 expiry,
  bytes1[*] returnOwner`,
  opts => ({ ...opts, ...packAmount(opts), type: OutputTypes.HTLC })
);

const OutputReturn = struct(
  `uint8 type,
  bytes1[**] data`,
  opts => ({ ...opts, ...packAmount(opts), type: OutputTypes.Return })
);

const UTXO = struct(`
  bytes32 transactionHashId,
  uint8 outputIndex,
  uint8 outputType,
  address owner,
  uint256 amount,
  uint32 token,
  bytes32 digest,
  uint256 expiry,
  address returnOwner
`);

const OutputStructs = [OutputTransfer, OutputWithdraw, OutputHTLC, OutputReturn];

function decodePacked(data = '0x') {
  let result = [];
  let pos = 0;
  const dataLength = utils.hexDataLength(data);

  for (;pos < dataLength;) {
    let decoder = null;
    const type = parseInt(utils.hexDataSub(data, pos, 1), 16);

    switch (type) {
      case OutputTypes.Transfer:
        decoder = OutputTransfer;
        break;

      case OutputTypes.Withdraw:
        decoder = OutputWithdraw;
        break;

      case OutputTypes.HTLC:
        decoder = OutputHTLC;
        break;

      case OutputTypes.Return:
        decoder = OutputReturn;
        break;

      default:
        utils.assert(0, 'invalid-output-type');
    }

    const input = decoder.decodePacked(utils.hexDataSub(data, pos));
    pos += input.sizePacked();
    result.push(input);
  }

  utils.assert(pos === utils.hexDataLength(data), 'inputs-output-mismatch');
  utils.assert(result.length > 0, 'inputs-output-underflow');
  utils.assert(result.length <= OUTPUTS_MAX, 'inputs-output-overflow');

  return result;
}

function decodeToken(output = {}, state = {}) {
  const numeric = utils.bigNumberify(output.properties.token().hex());

  utils.assert(numeric.gte(0), 'output-token-underflow');
  utils.assert(numeric.lt(state.properties.numTokens().get()), 'output-token-overflow');

  return numeric;
}

function decodeAmount(output = {}) {
  const shift = output.properties.shift().get().toNumber();

  utils.assert(shift >= 0, 'output-shift-underflow');
  utils.assert(shift % 8 === 0, 'output-shift-mod');
  utils.assert(shift < 256, 'output-shift-overflow');

  const amount = output.properties.amount().hex();
  const amountLength = utils.hexDataLength(amount);

  utils.assert(amountLength > 0, 'amount-length-underflow');
  utils.assert(amountLength <= 32, 'amount-length-overflow');
  utils.assert((amountLength * 8) + shift <= 256, 'amount-length-shift');

  const zeros = (new Array(shift ? (shift / 8) : 0)).fill('00').join('');
  return utils.bigNumberify(amount + zeros);
}

function _decodeOwner(_owner = [], _return = false, state = {}, owners = {}) {
  let owner = utils.hexlify(_owner);
  const ownerLength = utils.hexDataLength(owner);
  const message = _return ? '-return' : '';

  utils.assert(ownerLength > 0, 'output-owner-underflow' + message);
  utils.assert(ownerLength <= 20, 'output-owner-overflow' + message);

  if (ownerLength < 20) {
    owner = parseInt(owner, 16);
    utils.assert(owner >= 0, 'owner-id-underflow' + message);
    utils.assert(state.properties.numAddresses().get().gt(owner), 'owner-id-overflow' + message);
    utils.assert(owners[owner], 'owner-id-undefined' + message);
    return owners[owner];
  }

  return owner;
}

function decodeOwner(output = {}, state = {}, owners = {}) {
  return _decodeOwner(output.properties.owner().hex(), false, state, owners);
}

function decodeReturnOwner(output = {}, state = {}, owners = {}) {
  return _decodeOwner(output.properties.returnOwner().hex(), false, state, owners);
}

function decodeOwnerIds(outputs = []) {
  let result = [];

  outputs.forEach(output => {
    if (output.properties.type().get().eq(OutputTypes.Return)) return;
    const owner = output.properties.owner().hex();
    if (utils.hexDataLength(owner) === 20) return;
    result.push(owner);

    if (!output.properties.type().get().eq(OutputTypes.HTLC)) return;
    const returnOwner = output.properties.returnOwner().hex();
    if (utils.hexDataLength(returnOwner) === 20) return;
    result.push(returnOwner);
  });

  return [...new Set(result)];
}

module.exports = {
  shiftValue,
  OutputStructs,
  OutputTypes,
  OutputTransfer,
  OutputWithdraw,
  OutputHTLC,
  OutputReturn,
  packAmount,
  unpackAmount,
  _decodeOwner,
  OUTPUTS_MAX,
  UTXO,
  decodePacked,
  decodeToken,
  decodeAmount,
  decodeOwner,
  decodeReturnOwner,
  decodeOwnerIds,
};
