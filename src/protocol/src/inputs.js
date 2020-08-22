const { struct } = require('@fuel-js/struct');
const utils = require('@fuel-js/utils');

const INPUTS_MAX = 8;

const InputTypes = {
  Transfer: 0,
  Deposit: 1,
  HTLC: 2,
  Root: 3,
};

const Input = struct(
  `uint8 type, uint8 witnessReference`,
  opts => ({ ...opts, type: InputTypes.Transfer })
);

const InputTransfer = struct(
  `uint8 type, uint8 witnessReference`,
  opts => ({ ...opts, type: InputTypes.Transfer })
);

const InputHTLC = struct(
  `uint8 type, uint8 witnessReference, bytes32 preImage`,
  opts => ({ ...opts, type: InputTypes.HTLC })
);

const InputDeposit = struct(
  `uint8 type, uint8 witnessReference, address owner`,
  opts => ({ ...opts, type: InputTypes.Deposit })
);

const InputRoot = struct(
  `uint8 type, uint8 witnessReference`,
  opts => ({ ...opts, type: InputTypes.Root })
);

const InputStructs = [InputTransfer, InputDeposit, InputHTLC, InputRoot];

const isDeposit = _input => {
  return _input.object().type === InputTypes.Deposit;
};

function decodePacked(data = '0x') {
  let result = [];
  let pos = 0;

  for (;pos < utils.hexDataLength(data);) {
    let decoder = null;
    const kind = parseInt(utils.hexDataSub(data, pos, 1), 16);

    switch (kind) {
      case InputTypes.Transfer:
        decoder = InputTransfer;
        break;

      case InputTypes.Deposit:
        decoder = InputDeposit;
        break;

      case InputTypes.HTLC:
        decoder = InputHTLC;
        break;

      case InputTypes.Root:
        decoder = InputRoot;
        break;

      default:
        utils.assert(0, 'invalid-input-type');
    }

    const input = decoder.decodePacked(utils.hexDataSub(data, pos));
    pos += input.sizePacked();
    result.push(input);
  }

  utils.assert(pos === utils.hexDataLength(data), 'inputs-length-mismatch');
  utils.assert(result.length > 0, 'inputs-length-underflow');
  utils.assert(result.length <= INPUTS_MAX, 'inputs-length-overflow');

  return result;
}

module.exports = {
  InputStructs,
  InputTypes,
  Input,
  InputTransfer,
  InputHTLC,
  InputDeposit,
  InputRoot,
  isDeposit,
  decodePacked,
  INPUTS_MAX,
};
