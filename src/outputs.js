const { struct, chunk, chunkJoin } = require('fuel-common/struct');
const utils = require('fuel-common/utils');

function shiftValue(value) {
  const bn = utils.bigNumberify(value);
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

function packAmount(output) {
  if (output.shift) return {}; // do not pack if shift is present
  const amount = output.amount || 0;
  return shiftValue(amount);
}

// console.log(packAmount({ amount: utils.parseEther('100') }));

function unpackAmount(output) {
  const obj = output.object();
  const shift = (new Array(obj.shift.toNumber())).fill('00').join('');
  return utils.bigNumberify(chunkJoin(output.amount) + shift);
}

const OutputTypes = {
  Transfer: 0,
  Withdraw: 1,
  HTLC: 2,
  Return: 3,
};

const OutputUTXO = struct(
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

const OutputStructs = [OutputUTXO, OutputWithdraw, OutputHTLC, OutputReturn];

module.exports = {
  OutputStructs,
  OutputTypes,
  OutputUTXO,
  OutputWithdraw,
  OutputHTLC,
  OutputReturn,
  packAmount,
  unpackAmount,
  UTXO,
};
