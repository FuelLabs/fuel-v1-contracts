const { utils } = require('@fuel-js/environment');

const defaults = (producer, bondSize = utils.parseEther('1.0')) => [
  producer,
  20,
  20,
  20,
  bondSize,
  "Fuel",
  "1.1.0",
  1,
  utils.emptyBytes32
];

module.exports = {
  defaults,
};
