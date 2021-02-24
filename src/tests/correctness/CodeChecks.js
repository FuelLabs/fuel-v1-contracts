/// @dev here via static anylysis we check what codes (revert/fraud) where covered in the tests.
const { test } = require('@fuel-js/environment');
const { errors } = require('../../builds/Fuel.json');
const { resolve } = require('path');
const { readdir } = require('fs').promises;
const readFile = require('fs-readfile-promise');

// Get all files in a folder.
async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

// Error codes.
const errorCodes = Object.keys(errors).filter(name => name.slice(0, 2) !== '0x');

// Checked error codes.
let checkedErrorCodes = {};
let uncheckedCodes = [];

/// @dev Tests basic deposit functonality.
module.exports = test('CodeChecks', async t => {

    // Tests path.
    const testFilePaths = await getFiles('./src/tests');

    for (const testFilePath of testFilePaths) {
        const file = await readFile(testFilePath, 'utf8');

        for (const code of errorCodes) {
            if (file.indexOf(`'${code}'`) !== -1 || file.indexOf(`"${code}"`) !== -1) {
                checkedErrorCodes[code] = [
                    testFilePath,
                ];
            }
        }
    }

    for (const errorCode of errorCodes) {
        if (!checkedErrorCodes[errorCode]) {
            uncheckedCodes.push([errorCode]);
        }
    }

    t.equal(uncheckedCodes.length, 0, 'no-unchecked-codes');

});