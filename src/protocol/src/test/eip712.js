const { test, utils } = require('@fuel-js/environment');
const eip712 = require('../eip712');
const sigUtil = require('eth-sig-util');
// require('regenerator-runtime');

module.exports = test('eip712', async t => {

    const txData = '0x00100000000000000000000000000000000000420001011006058d15e1762814744454ffbca8f134e81b292c6200c5cbe0c283f200010100084af0a763bb1c006414744454ffbca8f134e81b292c6200c5cbe0c283f2081092c8a81313513a6bdbeabd729250947fa0fec0d72700c4816d41872764bd83165c1646e3113a833a6d4ffeb069ca11a0f8ebb0dd45b602f7fc1ede3ea579bc1c49901d45fb43185910addc361f6742ae1d6bfcfeff7b174393744c25f68b0a2c37b3e403d32067f9010216b35f64e616bb6f5a0255d22584aa72da739f74452e25ab4fe4db10a22f63b035140d1cf16b37294e7339a0012dc75c500e9f582d2ebf0c5357ea0362603400b7d52495770a4f7f4ccf5ceb45e288d8586b1c6e75309962fa42dd24173ea78426cdef741aeacc9ecff34c46f5f7c92b042041a83734da920c546f8a5fc49d4126e5f7606c4c3a08b29f0c9d47f4e190df4859ba3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

    const { typedData, hash } = eip712.hash({
      transactionHashId: utils.keccak256(txData),
      unsigned: { encodePacked: () => txData, keccak256Packed: () => utils.keccak256(txData) },
      contract: { address: utils.emptyAddress },
      chainId: 3,
    });
    const utilHash = '0x' + sigUtil.TypedDataUtils.sign(typedData).toString('hex');

    /*
    await window.web3.currentProvider.enable();

    web3.currentProvider.sendAsync({
    	jsonrpc: "2.0",
    	method: "eth_signTypedData_v4",
      params: [
        '0x744454FFbca8f134E81B292C6200c5cbE0c283F2',
        JSON.stringify(typedData),
      ]
    	}, function (err, result) {
    		if (err) {
    			console.error(err);
    		}

        console.log('recover', utils.recoverAddress(hash, result.result));

    		console.log(result);
    	});

    console.log('mine', hash, utilHash);
    */

});
