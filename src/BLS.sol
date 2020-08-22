// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

contract BLSLibrary {
    // Field order
    uint256 constant N = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Negated genarator of G2
    uint256 constant nG2x1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant nG2x0 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant nG2y1 = 17805874995975841540914202342111839520379459829704422454583296818431106115052;
    uint256 constant nG2y0 = 13392588948715843804641432497768002650278120570034223513918757245338268106653;

    uint256 constant FIELD_MASK = 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant SIGN_MASK = 0x8000000000000000000000000000000000000000000000000000000000000000;
    uint256 constant ODD_NUM = 0x8000000000000000000000000000000000000000000000000000000000000000;

    function verifySingle(
        uint256[2] memory signature,
        uint256[4] memory pubkey,
        uint256[2] memory message
    ) internal view returns (bool) {
        uint256[12] memory input = [
            signature[0],
            signature[1],
            nG2x1,
            nG2x0,
            nG2y1,
            nG2y0,
            message[0],
            message[1],
            pubkey[1],
            pubkey[0],
            pubkey[3],
            pubkey[2]
        ];
        uint256[1] memory out;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 8, input, 384, out, 0x20)
            switch success
                case 0 {
                    invalid()
                }
        }
        require(success, "");
        return out[0] != 0;
    }

    function verifyMultiple(
        uint256[2] memory signature,
        uint256[4][] memory pubkeys,
        uint256[2][] memory messages
    ) internal view returns (bool) {
        uint256 size = pubkeys.length;
        require(size > 0, "BLS: number of public key is zero");
        require(
            size == messages.length,
            "BLS: number of public keys and messages must be equal"
        );
        uint256 inputSize = (size + 1) * 6;
        uint256[] memory input = new uint256[](inputSize);
        input[0] = signature[0];
        input[1] = signature[1];
        input[2] = nG2x1;
        input[3] = nG2x0;
        input[4] = nG2y1;
        input[5] = nG2y0;
        for (uint256 i = 0; i < size; i++) {
            input[i * 6 + 6] = messages[i][0];
            input[i * 6 + 7] = messages[i][1];
            input[i * 6 + 8] = pubkeys[i][1];
            input[i * 6 + 9] = pubkeys[i][0];
            input[i * 6 + 10] = pubkeys[i][3];
            input[i * 6 + 11] = pubkeys[i][2];
        }
        uint256[1] memory out;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(
                sub(gas(), 2000),
                8,
                add(input, 0x20),
                mul(inputSize, 0x20),
                out,
                0x20
            )
            switch success
                case 0 {
                    invalid()
                }
        }
        require(success, "");
        return out[0] != 0;
    }

    function hashToPoint(bytes memory data)
        internal
        view
        returns (uint256[2] memory p)
    {
        return mapToPoint(keccak256(data));
    }

    function mapToPoint(bytes32 _x)
        internal
        view
        returns (uint256[2] memory p)
    {
        uint256 x = uint256(_x) % N;
        uint256 y;
        bool found = false;
        while (true) {
            y = mulmod(x, x, N);
            y = mulmod(y, x, N);
            y = addmod(y, 3, N);
            (y, found) = sqrt(y);
            if (found) {
                p[0] = x;
                p[1] = y;
                break;
            }
            x = addmod(x, 1, N);
        }
    }

    function isValidPublicKey(uint256[4] memory publicKey)
        internal
        pure
        returns (bool)
    {
        if (
            (publicKey[0] >= N) ||
            (publicKey[1] >= N) ||
            (publicKey[2] >= N || (publicKey[3] >= N))
        ) {
            return false;
        } else {
            return isOnCurveG2(publicKey);
        }
    }

    function isValidSignature(uint256[2] memory signature)
        internal
        pure
        returns (bool)
    {
        if ((signature[0] >= N) || (signature[1] >= N)) {
            return false;
        } else {
            return isOnCurveG1(signature);
        }
    }

    function pubkeyToUncompresed(
        uint256[2] memory compressed,
        uint256[2] memory y
    ) internal pure returns (uint256[4] memory uncompressed) {
        uint256 desicion = compressed[0] & SIGN_MASK;
        require(
            desicion == ODD_NUM || y[0] & 1 != 1,
            "BLS: bad y coordinate for uncompressing key"
        );
        uncompressed[0] = compressed[0] & FIELD_MASK;
        uncompressed[1] = compressed[1];
        uncompressed[2] = y[0];
        uncompressed[3] = y[1];
    }

    function signatureToUncompresed(uint256 compressed, uint256 y)
        internal
        pure
        returns (uint256[2] memory uncompressed)
    {
        uint256 desicion = compressed & SIGN_MASK;
        require(
            desicion == ODD_NUM || y & 1 != 1,
            "BLS: bad y coordinate for uncompressing key"
        );
        return [compressed & FIELD_MASK, y];
    }

    function isValidCompressedPublicKey(uint256[2] memory publicKey)
        internal
        view
        returns (bool)
    {
        uint256 x0 = publicKey[0] & FIELD_MASK;
        uint256 x1 = publicKey[1];
        if ((x0 >= N) || (x1 >= N)) {
            return false;
        } else if ((x0 == 0) && (x1 == 0)) {
            return false;
        } else {
            return isOnCurveG2([x0, x1]);
        }
    }

    function isValidCompressedSignature(uint256 signature)
        internal
        view
        returns (bool)
    {
        uint256 x = signature & FIELD_MASK;
        if (x >= N) {
            return false;
        } else if (x == 0) {
            return false;
        }
        return isOnCurveG1(x);
    }

    function isOnCurveG1(uint256[2] memory point)
        internal
        pure
        returns (bool _isOnCurve)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let t0 := mload(point)
            let t1 := mload(add(point, 32))
            let t2 := mulmod(t0, t0, N)
            t2 := mulmod(t2, t0, N)
            t2 := addmod(t2, 3, N)
            t1 := mulmod(t1, t1, N)
            _isOnCurve := eq(t1, t2)
        }
    }

    function isOnCurveG1(uint256 x) internal view returns (bool _isOnCurve) {
        bool callSuccess;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let t0 := x
            let t1 := mulmod(t0, t0, N)
            t1 := mulmod(t1, t0, N)
            t1 := addmod(t1, 3, N)

            let freemem := mload(0x40)
            mstore(freemem, 0x20)
            mstore(add(freemem, 0x20), 0x20)
            mstore(add(freemem, 0x40), 0x20)
            mstore(add(freemem, 0x60), t1)
            // (N - 1) / 2 = 0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            mstore(
                add(freemem, 0x80),
                0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            )
            // N = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            mstore(
                add(freemem, 0xA0),
                0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            )
            callSuccess := staticcall(
                sub(gas(), 2000),
                5,
                freemem,
                0xC0,
                freemem,
                0x20
            )
            _isOnCurve := eq(1, mload(freemem))
        }
    }

    function isOnCurveG2(uint256[4] memory point)
        internal
        pure
        returns (bool _isOnCurve)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // x0, x1
            let t0 := mload(point)
            let t1 := mload(add(point, 32))
            // x0 ^ 2
            let t2 := mulmod(t0, t0, N)
            // x1 ^ 2
            let t3 := mulmod(t1, t1, N)
            // 3 * x0 ^ 2
            let t4 := add(add(t2, t2), t2)
            // 3 * x1 ^ 2
            let t5 := addmod(add(t3, t3), t3, N)
            // x0 * (x0 ^ 2 - 3 * x1 ^ 2)
            t2 := mulmod(add(t2, sub(N, t5)), t0, N)
            // x1 * (3 * x0 ^ 2 - x1 ^ 2)
            t3 := mulmod(add(t4, sub(N, t3)), t1, N)

            // x ^ 3 + b
            t0 := addmod(
                t2,
                0x2b149d40ceb8aaae81be18991be06ac3b5b4c5e559dbefa33267e6dc24a138e5,
                N
            )
            t1 := addmod(
                t3,
                0x009713b03af0fed4cd2cafadeed8fdf4a74fa084e52d1852e4a2bd0685c315d2,
                N
            )

            // y0, y1
            t2 := mload(add(point, 64))
            t3 := mload(add(point, 96))
            // y ^ 2
            t4 := mulmod(addmod(t2, t3, N), addmod(t2, sub(N, t3), N), N)
            t3 := mulmod(shl(1, t2), t3, N)

            // y ^ 2 == x ^ 3 + b
            _isOnCurve := and(eq(t0, t4), eq(t1, t3))
        }
    }

    function isOnCurveG2(uint256[2] memory x)
        internal
        view
        returns (bool _isOnCurve)
    {
        bool callSuccess;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // x0, x1
            let t0 := mload(add(x, 0))
            let t1 := mload(add(x, 32))
            // x0 ^ 2
            let t2 := mulmod(t0, t0, N)
            // x1 ^ 2
            let t3 := mulmod(t1, t1, N)
            // 3 * x0 ^ 2
            let t4 := add(add(t2, t2), t2)
            // 3 * x1 ^ 2
            let t5 := addmod(add(t3, t3), t3, N)
            // x0 * (x0 ^ 2 - 3 * x1 ^ 2)
            t2 := mulmod(add(t2, sub(N, t5)), t0, N)
            // x1 * (3 * x0 ^ 2 - x1 ^ 2)
            t3 := mulmod(add(t4, sub(N, t3)), t1, N)
            // x ^ 3 + b
            t0 := add(
                t2,
                0x2b149d40ceb8aaae81be18991be06ac3b5b4c5e559dbefa33267e6dc24a138e5
            )
            t1 := add(
                t3,
                0x009713b03af0fed4cd2cafadeed8fdf4a74fa084e52d1852e4a2bd0685c315d2
            )

            // is non residue ?
            t0 := addmod(mulmod(t0, t0, N), mulmod(t1, t1, N), N)
            let freemem := mload(0x40)
            mstore(freemem, 0x20)
            mstore(add(freemem, 0x20), 0x20)
            mstore(add(freemem, 0x40), 0x20)
            mstore(add(freemem, 0x60), t0)
            // (N - 1) / 2 = 0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            mstore(
                add(freemem, 0x80),
                0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            )
            // N = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            mstore(
                add(freemem, 0xA0),
                0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            )
            callSuccess := staticcall(
                sub(gas(), 2000),
                5,
                freemem,
                0xC0,
                freemem,
                0x20
            )
            _isOnCurve := eq(1, mload(freemem))
        }
    }

    function isNonResidueFP(uint256 e)
        internal
        view
        returns (bool isNonResidue)
    {
        bool callSuccess;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let freemem := mload(0x40)
            mstore(freemem, 0x20)
            mstore(add(freemem, 0x20), 0x20)
            mstore(add(freemem, 0x40), 0x20)
            mstore(add(freemem, 0x60), e)
            // (N - 1) / 2 = 0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            mstore(
                add(freemem, 0x80),
                0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            )
            // N = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            mstore(
                add(freemem, 0xA0),
                0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            )
            callSuccess := staticcall(
                sub(gas(), 2000),
                5,
                freemem,
                0xC0,
                freemem,
                0x20
            )
            isNonResidue := eq(1, mload(freemem))
        }
        require(callSuccess, "BLS: isNonResidueFP modexp call failed");
        return !isNonResidue;
    }

    function isNonResidueFP2(uint256[2] memory e)
        internal
        view
        returns (bool isNonResidue)
    {
        uint256 a = addmod(mulmod(e[0], e[0], N), mulmod(e[1], e[1], N), N);
        bool callSuccess;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let freemem := mload(0x40)
            mstore(freemem, 0x20)
            mstore(add(freemem, 0x20), 0x20)
            mstore(add(freemem, 0x40), 0x20)
            mstore(add(freemem, 0x60), a)
            // (N - 1) / 2 = 0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            mstore(
                add(freemem, 0x80),
                0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3
            )
            // N = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            mstore(
                add(freemem, 0xA0),
                0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            )
            callSuccess := staticcall(
                sub(gas(), 2000),
                5,
                freemem,
                0xC0,
                freemem,
                0x20
            )
            isNonResidue := eq(1, mload(freemem))
        }
        require(callSuccess, "BLS: isNonResidueFP2 modexp call failed");
        return !isNonResidue;
    }

    function sqrt(uint256 xx) internal view returns (uint256 x, bool hasRoot) {
        bool callSuccess;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let freemem := mload(0x40)
            mstore(freemem, 0x20)
            mstore(add(freemem, 0x20), 0x20)
            mstore(add(freemem, 0x40), 0x20)
            mstore(add(freemem, 0x60), xx)
            // (N + 1) / 4 = 0xc19139cb84c680a6e14116da060561765e05aa45a1c72a34f082305b61f3f52
            mstore(
                add(freemem, 0x80),
                0xc19139cb84c680a6e14116da060561765e05aa45a1c72a34f082305b61f3f52
            )
            // N = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            mstore(
                add(freemem, 0xA0),
                0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
            )
            callSuccess := staticcall(
                sub(gas(), 2000),
                5,
                freemem,
                0xC0,
                freemem,
                0x20
            )
            x := mload(freemem)
            hasRoot := eq(xx, mulmod(x, x, N))
        }
        require(callSuccess, "BLS: sqrt modexp call failed");
    }
}

// Fuel Interface
abstract contract IFuel {
  function verifyHeader(
    bytes calldata blockHeader,
    bytes calldata root,
    uint256 rootIndex,
    uint8 assertFinalized
  ) external virtual view returns (bool);

  function rootHash(
    bytes calldata rootHeader
  ) external virtual view returns (bytes32 hash);

  function blockHash(
    bytes calldata blockHeader
  ) external virtual view returns (bytes32 hash);

  function publicKeyHash(
    address owner
  ) external virtual view returns (bytes32 hash);
}

contract FuelPackedStructures {
  struct RootHeader {
    address producer;
    uint256 fee;
    uint32 feeToken;
    uint8 transactionType;
    uint32 rootLength;
    bytes32 merkleRoot;
    bytes32 commitmentHash;
    bytes32 signatureHash;
  }

  struct BlockHeader {
    address producer;
    bytes32 previousBlockHash;
    uint256 height;
    uint256 blockNumber;
    uint256 numTokens;
    uint256 numAddresses;
    bytes32[] roots;
  }

  function unpackRootHeader(bytes memory rootHeader) internal view returns (RootHeader memory result) {
  }

  function unpackBlockHeader(bytes memory blockHeader) internal view returns (BlockHeader memory result) {
  }
}

contract BLS is BLSLibrary, FuelPackedStructures {
  // fuelContract => blockHash => fraudulent or not
  mapping(address => mapping(bytes32 => bool)) public isBlockFraudulent;

  // if a chunk of transactions valid within a specific block hash => root => valid or not
  mapping(address => mapping(bytes32 => mapping(uint8 => mapping(uint8 => bool)))) public isChunkValid;

  // constant finalization assertions
  uint8 constant NOT_FINALIZED = 1;

  // The number of transacitons per chunk
  uint8 constant chunkSize = 32;

  // The size in bytes of each transaction
  uint8 constant transactionSize = 24;

  // assert or it's fraud and record fraud in state forever..
  function assertOrFraud(bool assertion, address fuelContract, bytes32 blockHash, string memory message) internal {
    if (!assertion) {
      isBlockFraudulent[fuelContract][blockHash] = true;

      // for testing, comment out below for production
      require(false, message);

      // stop all execution from this point
      assembly { stop() }
    }
  }

  // public key hash
  function publicKeyHash(uint256[4] memory publicKey) public pure returns (bytes32 hash) {
    bytes32 keyHash = keccak256(abi.encodePacked(publicKey));

    // trim off the last 4 bytes and return it
    assembly {
      let free := mload(0x40)
      mstore(free, keyHash)

      // 28 byte hash, 4 * 8 = 32
      hash := shl(32, shr(32, keyHash))
    }
  }

  function message1FromRoot(RootHeader memory _root) internal pure returns (uint256 message1) {
    // get token and fee from the root for use in packing during assembly
    uint256 token = _root.feeToken;
    uint256 fee = _root.fee;

    // assemble the second message for the transaction
    assembly {
      let free := mload(0x40)
      mstore(free, token)
      mstore(add(free, 32), fee)
      message1 := mload(add(free, 28))
    }
  }

  // will be able to determine if this root of a block had invalid aggregate signatures
  function proveMalformedAggregateSignature(
    address fuelContract,
    bytes memory blockHeader,
    bytes memory rootHeader,
    uint256 rootIndex,
    uint256 chunkIndex,
    bytes memory transactions,
    uint256[2][] memory signatures,
    uint256[4][] memory publicKeys) public {

    // id the header verified
    require(IFuel(fuelContract).verifyHeader(blockHeader, rootHeader, rootIndex, NOT_FINALIZED));

    // calculate the hashes for each of these
    // bytes32 rootHash = IFuel(fuelContract).rootHash(rootHeader);
    bytes32 blockHash = IFuel(fuelContract).blockHash(blockHeader);

    // unpack the root and block header
    // BlockHeader memory _block = unpackBlockHeader(blockHeader);
    RootHeader memory _root = unpackRootHeader(rootHeader);

    // ensure the transactions data provided is correct
    require(keccak256(transactions) == _root.commitmentHash, 'commitment-hash');

    // chunk index overflow
    require(signatures.length > chunkIndex, 'chunk-index-overflow');

    // chunk index overflow
    require(publicKeys.length == chunkSize, 'public-keys-not-chunk-size');

    // check signatures are normal valid signatures here..
    // loop thorugh all and check with BLS library they are at least on the right curve etc..
    // require signatures is eq to root hash signatures
    // require(keccak256(abi.encodePacked(signatures)) == _root.signatureHash, 'signature-hash');

    // check length
    assertOrFraud(transactions.length % (chunkSize * transactionSize) == 0,
      fuelContract,
      blockHash,
      'transaction-length-not-chunk-tx-size');

    // check length
    assertOrFraud(transactions.length % transactionSize == 0,
      fuelContract,
      blockHash,
      'transaction-length-not-tx-size');

    // start a new messages array
    uint256[2][] memory messages = new uint256[2][](32);
    uint256 message1 = message1FromRoot(_root);

    // iterate over transactions
    for (uint256 transactionIndex = chunkIndex * chunkSize;
      transactionIndex < (chunkIndex * chunkSize) + chunkSize;
      transactionIndex += 1) {
      // setup the first message, i.e. 24 byte transaction payload
      uint256 message0;

      // assembly
      assembly {
        // 32 - 24 = 8
        // 8 * 8 = 64
        // grab the 24 byte transaction from transactions memory
        message0 := shr(64, shl(64, mload(add(mload(transactions), mul(transactionIndex, transactionSize)))))
      }

      // this is also where we would check the public key against the hash provided..
      // we do this by calling the fuel contract

      // set messages for this transaction index
      messages[transactionIndex][0] = message0;
      messages[transactionIndex][1] = message1;
    }

    // verify
    bool chunkVerified = verifyMultiple(
      signatures[chunkIndex],
      publicKeys,
      messages
    );

    // chunk verified
    assertOrFraud(!chunkVerified,
      fuelContract,
      blockHash,
      'block-invalid-chunk');
  }

  // is a specific block at a specific fuel contract fraudulent
  function isBlockFraudulant(bytes32 blockHash) public view returns (bool isFraudulent) {
    isFraudulent = isBlockFraudulent[msg.sender][blockHash];
  }

  // is the specified root hash valid, i.e. all transactions within this specific root
  function verifyTransactionChunkValid(
    bytes32 blockHash,
    uint8 rootIndex,
    uint8 chunkIndex
  ) public view returns (bool isValid) {
    // return the valid root
    isValid = isChunkValid[msg.sender][blockHash][rootIndex][chunkIndex];

    // require the root is valid, otherwise revert
    require(isValid);
  }
}
