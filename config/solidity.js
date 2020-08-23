const solc = require('solc');
const read = require('fs-readfile-promise');
const write = require('write');

// target filename
const target = 'target.sol';

(async () => {
  if (!process.env.compile) return;

  const contractName = process.env.compile;
  const path = process.env.file || `./src/${contractName}.sol`;

  const input = {
    language: 'Solidity',
    sources: {
      [target]: {
        content: await read(path, 'utf8'),
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*'],
        },
      },
    },
  };

  try {
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    console.error(output);
  }

  let result = {
    abi: output.contracts[target][contractName].abi,
    bytecode: output.contracts[target][contractName].evm.bytecode.object,
  };

  await write(`./src/builds/${process.env.compile}.json`, JSON.stringify(result, null, 2));

  console.log('Solidity compiling complete.');


  } catch (error) {
    console.error(error);
  }
})();
