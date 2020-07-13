const { compile } = require('@fuel-js/environment');
const fs = require('fs');

if (process.env.compile) {
  // Compile Fuel
  compile({
    in: `./src/${process.env.compile}.yulp`,
    out: `./src/builds/${process.env.compile}.json`,
    object: process.env.compile,
    base: './src',
  })
  .then(() => console.log('Contracts Compiled!'))
  .catch(console.log);
}
