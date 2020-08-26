const { test, utils, BN, accounts } = require('@fuel-js/environment');
const outputs = require('../outputs');
const { State } = require('../state');
const { combine } = require('@fuel-js/struct');

module.exports = test('outputs', async t => {

  const invalid = '0x';

  t.throw(() => outputs.decodePacked(invalid), 'inputs-output-underflow');
  t.throw(() => outputs.decodePacked('0xaa'), 'invalid-output-type');
  t.throw(() => outputs.decodePacked('0x00'), "inputs-output-mismatch");

  const valid = outputs.OutputTransfer({
    token: '0x00',
    amount: 50000,
    owner: t.wallets[0].address,
  });

  const encoded = combine([valid, valid, valid]);
  const decoded = outputs.decodePacked(encoded);

  t.equalHex(decoded[0].properties.owner().hex(), t.wallets[0].address, 'owner');
  t.equalHex(decoded[1].properties.owner().hex(), t.wallets[0].address, 'owner');
  t.equalHex(decoded[2].properties.owner().hex(), t.wallets[0].address, 'owner');

  const overflow = combine(new Array(outputs.OUTPUTS_MAX + 1).fill(valid));
  t.throw(() => outputs.decodePacked(overflow), 'inputs-output-overflow');

  const validMax = combine(new Array(outputs.OUTPUTS_MAX).fill(valid));
  t.equal(outputs.decodePacked(validMax).length, 8, 'max');

  const different = [
    outputs.OutputTransfer({
      token: '0x00',
      amount: 50000,
      owner: t.wallets[0].address,
    }),
    outputs.OutputWithdraw({
      token: '0x00',
      amount: 102,
      owner: '0x00',
    }),
    outputs.OutputHTLC({
      token: '0x00',
      amount: 3001,
      owner: t.wallets[0].address,
      digest: utils.emptyBytes32,
      expiry: 48,
    }),
    outputs.OutputReturn({
      data: ['0xaa'],
    }),
  ];
  const differendEncoded = combine(different);

  console.time('decode');
  const differentDecoded = outputs.decodePacked(differendEncoded);
  console.timeEnd('decode');

  t.throws(() => outputs.decodePacked(), 'empty decode packed');

  t.equal(differentDecoded.length, 4, 'len');
  t.equalHex(differentDecoded[2].properties.digest().hex(), utils.emptyBytes32, 'digest');
  t.equalBig(differentDecoded[2].properties.expiry().hex(), 48, 'expiry');
  t.equalBig(differentDecoded[2].properties.amount().hex(), 3001, 'amount');
  t.equalBig(differentDecoded[1].properties.amount().hex(), 102, 'amount');
  const ids = outputs.decodeOwnerIds(different);

  t.equal(outputs.packAmount({ amount: '0x1100' }), {
    shift: 8,
    amount: ['0x11'],
  }, 'shift value');

  t.equal(outputs.packAmount(), { shift: 0, amount: [ '0x00' ] }, 'empty pack amount');

  t.throws(() => outputs.unpackAmount(), 'empty unpack amount');
  t.equalBig(outputs.unpackAmount(outputs.OutputTransfer({})), '0x00');

  t.equalBig(outputs.unpackAmount({
    properties: {
      shift: () => ({ get: () => utils.bigNumberify(0), }),
      amount: () => ({ get: () => ['0x00'], }),
    },
  }), '0x00');

  const state = State({ numTokens: 2 });

  t.equalBig(outputs.decodeToken(outputs.OutputTransfer({}), state), '0x00', 'decode token');
  t.equalBig(outputs.decodeToken(outputs.OutputTransfer({
    token: '0x01',
  }), state), '0x01', 'decode token');
  t.throw(() => outputs.decodeToken(outputs.OutputTransfer({
    token: '0x02',
  }), state), 'output-token-overflow');

  t.throws(() => outputs.decodeAmount(), 'no output amount to decode');
  t.equalBig(outputs.decodeAmount(outputs.OutputTransfer({})), '0x00', 'zero');
  t.equalBig(outputs.decodeAmount(outputs.OutputTransfer({
    amount: '0x01',
  })), '0x01', 'zero');
  t.equalBig(outputs.decodeAmount(outputs.OutputTransfer({
    shift: 8,
    amount: '0x11',
  })), '0x1100', '1100');
  t.throw(() => outputs.decodeAmount(outputs.OutputTransfer({
    shift: 256,
    amount: '0x11',
  })), 'output-shift-overflow');
  t.throw(() => outputs.decodeAmount(outputs.OutputTransfer({
    shift: 233,
    amount: '0x11',
  })), 'output-shift-mod');
  t.throw(() => outputs.decodeAmount(outputs.OutputTransfer({
    shift: -1,
    amount: '0x11',
  })), 'output-shift-underflow');
  t.throw(() => outputs.decodeAmount(outputs.OutputTransfer({
    amount: utils.max_num + '00',
  })), 'amount-length-overflow');
  t.throw(() => outputs.decodeAmount(outputs.OutputTransfer({
    shift: 8,
    amount: utils.max_num,
  })), 'amount-length-shift');

  const state2 = State({
    numAddresses: 4,
  });

  t.throws(() => outputs.decodeOwner(outputs.OutputTransfer({ owner: '0x' }), state2, {}),
    'output-owner-underflow');
  t.throws(() => outputs.decodeReturnOwner(outputs.OutputHTLC({
    owner: utils.max_num,
  }), state2, {}), 'output-owner-overflow');
  t.throws(() => outputs.decodeReturnOwner(outputs.OutputHTLC({
    owner: '0x02',
  }), state2, {}), 'owner-id-undefined');

  const validOwners = { '2': utils.emptyAddress };
  t.equalHex(outputs.decodeReturnOwner(outputs.OutputHTLC({ returnOwner: '0x02' }), state2, validOwners), utils.emptyAddress,
    'decoded address');
  t.equalHex(outputs.decodeReturnOwner(outputs.OutputHTLC({ returnOwner: utils.emptyAddress }), state2, validOwners), utils.emptyAddress,
    'decoded address');

  t.equal(outputs.decodeOwnerIds([
    outputs.OutputHTLC({ returnOwner: '0x02' }),
  ]), ['0x', '0x02'], 'owner ids');

  t.throws(() => outputs.decodeToken(), 'empty decode token');
  t.throws(() => outputs._decodeOwner(), 'empty decode owner');

});
