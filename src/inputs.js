const { struct } = require('fuel-common/struct');
const utils = require('fuel-common/utils');

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

const InputUTXO = struct(
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

const InputStructs = [InputUTXO, InputDeposit, InputHTLC, InputRoot];

const isDeposit = input => input.object().type === InputTypes.Deposit;

module.exports = {
  InputStructs,
  InputTypes,
  Input,
  InputUTXO,
  InputHTLC,
  InputDeposit,
  InputRoot,
  isDeposit,
};
