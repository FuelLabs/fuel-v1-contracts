const compile = require('fuel-common/compile');
const fs = require('fs');

if (process.env.compile) {
  // Compile Fuel
  compile({
    in: `./src/contracts/${process.env.compile}.yulp`,
    out: `./src/contracts/builds/${process.env.compile}.json`,
    object: process.env.compile,
    base: './src/contracts',
  })
  .then(() => console.log('Contracts Compiled!'))
  .catch(console.log);
}
