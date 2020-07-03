object "Fuel"   {
  code {
  function lte(x, y) -> result {
    if or(lt(x, y), eq(x, y)) {
      result := 0x01
    }
  }
  
  function neq(x, y) -> result {
    result := iszero(eq(x, y))
  }
  
        function safeAdd(x, y) -> z {
          z := add(x, y)
          require(or(eq(z, x), gt(z, x)), 0)
        }
        
        function safeSub(x, y) -> z {
          z := sub(x, y)
          require(or(eq(z, x), lt(z, x)), 0)
        }
        
        function safeMul(x, y) -> z {
          if gt(y, 0) {
            z := mul(x, y)
            require(eq(div(z, y), x), 0)
          }
        }
        
          function safeDiv(x, y) -> z {
            require(gt(y, 0), 0)
            z := div(x, y)
          }
          
function require(arg, message) {
  if lt(arg, 1) {
    mstore(0, message)
    revert(0, 32)
  }
}

function mslice(position, length) -> result {
  result := div(mload(position), exp(2, sub(256, mul(length, 8))))
}


function Constructor.name(pos) -> res {
  res := mslice(Constructor.name.position(pos), 32)
}



function Constructor.name.position(_pos) -> _offset {
  
      
        function Constructor.name.position._chunk0(pos) -> __r {
          __r := 0xa0
        }
      
        function Constructor.name.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.name.position._chunk0(_pos), add(Constructor.name.position._chunk1(_pos), 0))
    
}



function Constructor.blockProducer.position(_pos) -> _offset {
  
      
        function Constructor.blockProducer.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Constructor.blockProducer.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.blockProducer.position._chunk0(_pos), add(Constructor.blockProducer.position._chunk1(_pos), 0))
    
}



function Constructor.finalizationDelay.position(_pos) -> _offset {
  
      
        function Constructor.finalizationDelay.position._chunk0(pos) -> __r {
          __r := 0x20
        }
      
        function Constructor.finalizationDelay.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.finalizationDelay.position._chunk0(_pos), add(Constructor.finalizationDelay.position._chunk1(_pos), 0))
    
}



function Constructor.submissionDelay.position(_pos) -> _offset {
  
      
        function Constructor.submissionDelay.position._chunk0(pos) -> __r {
          __r := 0x40
        }
      
        function Constructor.submissionDelay.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.submissionDelay.position._chunk0(_pos), add(Constructor.submissionDelay.position._chunk1(_pos), 0))
    
}



function Constructor.penaltyDelay.position(_pos) -> _offset {
  
      
        function Constructor.penaltyDelay.position._chunk0(pos) -> __r {
          __r := 0x60
        }
      
        function Constructor.penaltyDelay.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.penaltyDelay.position._chunk0(_pos), add(Constructor.penaltyDelay.position._chunk1(_pos), 0))
    
}



function Constructor.bondSize.position(_pos) -> _offset {
  
      
        function Constructor.bondSize.position._chunk0(pos) -> __r {
          __r := 0x80
        }
      
        function Constructor.bondSize.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.bondSize.position._chunk0(_pos), add(Constructor.bondSize.position._chunk1(_pos), 0))
    
}



function Constructor.version(pos) -> res {
  res := mslice(Constructor.version.position(pos), 32)
}



function Constructor.version.position(_pos) -> _offset {
  
      
        function Constructor.version.position._chunk0(pos) -> __r {
          __r := 0xc0
        }
      
        function Constructor.version.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.version.position._chunk0(_pos), add(Constructor.version.position._chunk1(_pos), 0))
    
}



function Constructor.blockProducer(pos) -> res {
  res := mslice(Constructor.blockProducer.position(pos), 32)
}



function Constructor.genesis(pos) -> res {
  res := mslice(Constructor.genesis.position(pos), 32)
}



function Constructor.genesis.position(_pos) -> _offset {
  
      
        function Constructor.genesis.position._chunk0(pos) -> __r {
          __r := 0x0100
        }
      
        function Constructor.genesis.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.genesis.position._chunk0(_pos), add(Constructor.genesis.position._chunk1(_pos), 0))
    
}



function Constructor.chainId.position(_pos) -> _offset {
  
      
        function Constructor.chainId.position._chunk0(pos) -> __r {
          __r := 0xe0
        }
      
        function Constructor.chainId.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.chainId.position._chunk0(_pos), add(Constructor.chainId.position._chunk1(_pos), 0))
    
}


    

    let Constructor.abi := 0x00

    

    function Constructor.copy(pos) {
      codecopy(pos, safeSub(codesize(), 416), 416)
    }

    function Constructor.verify(pos) {
      let nameLen := mload(Constructor.name(0))
      let versionLen := mload(Constructor.version(0))

      require(and(gt(nameLen, 0), lte(nameLen, 32)), "name-length")
      require(and(gt(versionLen, 0), lte(versionLen, 32)), "version-length")
    }

    function Constructor.name.copy(cpos, pos) {
      let len := mload(Constructor.name(cpos))
      let val := mload(safeAdd(Constructor.name(cpos), 32))
      mstore(pos, 32) mstore(add(pos,32), len) mstore(add(pos,64), val)
    }

    function Constructor.name.hash(pos) -> hash {
      hash := keccak256(safeAdd(safeAdd(pos, 256), 64), mload(Constructor.name(pos)))
    }

    function Constructor.version.copy(cpos, pos) {
      let len := mload(Constructor.version(cpos))
      let val := mload(safeAdd(Constructor.version(cpos), 32))
      mstore(pos, 32) mstore(add(pos,32), len) mstore(add(pos,64), val)
    }

    function Constructor.version.hash(pos) -> hash {
      hash := keccak256(safeAdd(safeAdd(pos, 320), 64), mload(Constructor.version(pos)))
    }
  
    

    function mappingKey(storageIndex, key) -> storageKey {
        mstore(0, storageIndex) mstore(add(0,32), key)
        storageKey := keccak256(0, 64)
    }

    function mappingKey2(storageIndex, key, key2) -> storageKey {
        mstore(0, storageIndex) mstore(add(0,32), key) mstore(add(0,64), key2)
        storageKey := keccak256(0, 96)
    }

    function mappingKey3(storageIndex, key, key2, key3) -> storageKey {
        mstore(0, storageIndex) mstore(add(0,32), key) mstore(add(0,64), key2) mstore(add(0,96), key3)
        storageKey := keccak256(0, 128)
    }
  
    

    function numTokens() -> num {
      num := sload(2)
    }

    function tokenId(addr) -> id {
      id := sload(mappingKey(7, addr))
    }

    function indexToken(addr, id) {
      sstore(mappingKey(7, addr), id)
      sstore(2, safeAdd(id, 1))
      log3(0, 0,
          0x73c163cd50614894c0ab5238e0e9a17a39bbc4a6c5dc6a2cac9dd95f319f1c48,
          addr,
          id)
    }

    function commitToken(addr) -> id {
      id := tokenId(addr)

      if and(neq(addr, 0), iszero(id)) {
        id := numTokens()
        indexToken(addr, id)
      }
    }
  
    

    function numAddresses() -> num {
      num := sload(8)
    }

    function addresses(owner) -> id {
      id := sload(mappingKey(9, owner))
    }

    function indexAddress(addr, id) {
      sstore(mappingKey(9, addr), id)
      sstore(8, safeAdd(id, 1))
      log3(0, 0,
          0xa9434c943c361e848a4336c1b7068a71a438981cb3ad555c21a0838f3d5b5f53,
          addr,
          id)
    }

    function commitAddress(addr) -> id {
      id := addresses(addr)

      if and(neq(addr, 0), iszero(id)) {
        id := numAddresses()
        indexAddress(addr, id)
      }
    }
  
    // Constants
    
    
    

    // Copy constructor arguments to memory, verify construction
    Constructor.copy(0)
    Constructor.verify(0)
    let blockProducer := Constructor.blockProducer(0)
    let genesis := Constructor.genesis(0)

    // Index the Ether and Null Address
    indexToken(0, 0)
    indexAddress(0, 0)

    // Genesis Block Log
    mstore(0, blockProducer) mstore(add(0,32), 1) mstore(add(0,64), 1) mstore(add(0,96), 128) mstore(add(0,128), 0)
    log3(0, 160,
      0x2521e5f2f7ee2cc8938e535746c063cc841d508a3036af3032bea136cad013a9,
      0, 0)

    // Commit genesis block
    sstore(mappingKey(1, 0), genesis)

    // Add extra data for block producer
    let dataSize := safeAdd(datasize("Runtime"), 416)

    // Goto runtime
    datacopy(0, dataoffset("Runtime"), dataSize)
    return(0, dataSize)
  }
  object "Runtime" 
     {
    code {
  function gte(x, y) -> result {
    if or(gt(x, y), eq(x, y)) {
      result := 0x01
    }
  }
  
  function lte(x, y) -> result {
    if or(lt(x, y), eq(x, y)) {
      result := 0x01
    }
  }
  
  function neq(x, y) -> result {
    result := iszero(eq(x, y))
  }
  
        function safeAdd(x, y) -> z {
          z := add(x, y)
          require(or(eq(z, x), gt(z, x)), 0)
        }
        
        function safeSub(x, y) -> z {
          z := sub(x, y)
          require(or(eq(z, x), lt(z, x)), 0)
        }
        
        function safeMul(x, y) -> z {
          if gt(y, 0) {
            z := mul(x, y)
            require(eq(div(z, y), x), 0)
          }
        }
        
          function safeDiv(x, y) -> z {
            require(gt(y, 0), 0)
            z := div(x, y)
          }
          
function require(arg, message) {
  if lt(arg, 1) {
    mstore(0, message)
    revert(0, 32)
  }
}

function mslice(position, length) -> result {
  result := div(mload(position), exp(2, sub(256, mul(length, 8))))
}


function Constructor.name(pos) -> res {
  res := mslice(Constructor.name.position(pos), 32)
}



function Constructor.name.position(_pos) -> _offset {
  
      
        function Constructor.name.position._chunk0(pos) -> __r {
          __r := 0xa0
        }
      
        function Constructor.name.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.name.position._chunk0(_pos), add(Constructor.name.position._chunk1(_pos), 0))
    
}



function Constructor.blockProducer.position(_pos) -> _offset {
  
      
        function Constructor.blockProducer.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Constructor.blockProducer.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.blockProducer.position._chunk0(_pos), add(Constructor.blockProducer.position._chunk1(_pos), 0))
    
}



function Constructor.finalizationDelay.position(_pos) -> _offset {
  
      
        function Constructor.finalizationDelay.position._chunk0(pos) -> __r {
          __r := 0x20
        }
      
        function Constructor.finalizationDelay.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.finalizationDelay.position._chunk0(_pos), add(Constructor.finalizationDelay.position._chunk1(_pos), 0))
    
}



function Constructor.submissionDelay.position(_pos) -> _offset {
  
      
        function Constructor.submissionDelay.position._chunk0(pos) -> __r {
          __r := 0x40
        }
      
        function Constructor.submissionDelay.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.submissionDelay.position._chunk0(_pos), add(Constructor.submissionDelay.position._chunk1(_pos), 0))
    
}



function Constructor.penaltyDelay.position(_pos) -> _offset {
  
      
        function Constructor.penaltyDelay.position._chunk0(pos) -> __r {
          __r := 0x60
        }
      
        function Constructor.penaltyDelay.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.penaltyDelay.position._chunk0(_pos), add(Constructor.penaltyDelay.position._chunk1(_pos), 0))
    
}



function Constructor.bondSize.position(_pos) -> _offset {
  
      
        function Constructor.bondSize.position._chunk0(pos) -> __r {
          __r := 0x80
        }
      
        function Constructor.bondSize.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.bondSize.position._chunk0(_pos), add(Constructor.bondSize.position._chunk1(_pos), 0))
    
}



function Constructor.version(pos) -> res {
  res := mslice(Constructor.version.position(pos), 32)
}



function Constructor.version.position(_pos) -> _offset {
  
      
        function Constructor.version.position._chunk0(pos) -> __r {
          __r := 0xc0
        }
      
        function Constructor.version.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.version.position._chunk0(_pos), add(Constructor.version.position._chunk1(_pos), 0))
    
}



function RootHeader.keccak256(pos) -> _hash {
  _hash := keccak256(pos, RootHeader.size(pos))
}



function RootHeader.size(pos) -> _offset {
  _offset := sub(RootHeader.offset(pos), pos)
}



function RootHeader.offset(pos) -> _offset {
  _offset := RootHeader.fee.offset(pos)
}



function RootHeader.fee.offset(pos) -> _offset {
_offset := add(RootHeader.fee.position(pos), 32)
}



function RootHeader.fee.position(_pos) -> _offset {
  
      
        function RootHeader.fee.position._chunk0(pos) -> __r {
          __r := 0x94
        }
      
        function RootHeader.fee.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(RootHeader.fee.position._chunk0(_pos), add(RootHeader.fee.position._chunk1(_pos), 0))
    
}



function RootHeader.producer.position(_pos) -> _offset {
  
      
        function RootHeader.producer.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function RootHeader.producer.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(RootHeader.producer.position._chunk0(_pos), add(RootHeader.producer.position._chunk1(_pos), 0))
    
}



function RootHeader.merkleTreeRoot.position(_pos) -> _offset {
  
      
        function RootHeader.merkleTreeRoot.position._chunk0(pos) -> __r {
          __r := 0x14
        }
      
        function RootHeader.merkleTreeRoot.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(RootHeader.merkleTreeRoot.position._chunk0(_pos), add(RootHeader.merkleTreeRoot.position._chunk1(_pos), 0))
    
}



function RootHeader.commitmentHash.position(_pos) -> _offset {
  
      
        function RootHeader.commitmentHash.position._chunk0(pos) -> __r {
          __r := 0x34
        }
      
        function RootHeader.commitmentHash.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(RootHeader.commitmentHash.position._chunk0(_pos), add(RootHeader.commitmentHash.position._chunk1(_pos), 0))
    
}



function RootHeader.length.position(_pos) -> _offset {
  
      
        function RootHeader.length.position._chunk0(pos) -> __r {
          __r := 0x54
        }
      
        function RootHeader.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(RootHeader.length.position._chunk0(_pos), add(RootHeader.length.position._chunk1(_pos), 0))
    
}



function RootHeader.feeToken.position(_pos) -> _offset {
  
      
        function RootHeader.feeToken.position._chunk0(pos) -> __r {
          __r := 0x74
        }
      
        function RootHeader.feeToken.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(RootHeader.feeToken.position._chunk0(_pos), add(RootHeader.feeToken.position._chunk1(_pos), 0))
    
}



function Constructor.finalizationDelay(pos) -> res {
  res := mslice(Constructor.finalizationDelay.position(pos), 32)
}



function Constructor.blockProducer(pos) -> res {
  res := mslice(Constructor.blockProducer.position(pos), 32)
}



function Constructor.submissionDelay(pos) -> res {
  res := mslice(Constructor.submissionDelay.position(pos), 32)
}



function Constructor.bondSize(pos) -> res {
  res := mslice(Constructor.bondSize.position(pos), 32)
}



function BlockHeader.keccak256(pos) -> _hash {
  _hash := keccak256(pos, BlockHeader.size(pos))
}



function BlockHeader.size(pos) -> _offset {
  _offset := sub(BlockHeader.offset(pos), pos)
}



function BlockHeader.offset(pos) -> _offset {
  _offset := BlockHeader.roots.offset(pos)
}



function BlockHeader.roots.offset(pos) -> _offset {
_offset := add(BlockHeader.roots.position(pos), mul(BlockHeader.roots.length(pos), 32))
}



function BlockHeader.roots.length(pos) -> res {
  res := mslice(BlockHeader.roots.length.position(pos), 2)
}



function BlockHeader.roots.length.position(_pos) -> _offset {
  
      
        function BlockHeader.roots.length.position._chunk0(pos) -> __r {
          __r := 0xb4
        }
      
        function BlockHeader.roots.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.roots.length.position._chunk0(_pos), add(BlockHeader.roots.length.position._chunk1(_pos), 0))
    
}



function BlockHeader.producer.position(_pos) -> _offset {
  
      
        function BlockHeader.producer.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function BlockHeader.producer.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.producer.position._chunk0(_pos), add(BlockHeader.producer.position._chunk1(_pos), 0))
    
}



function BlockHeader.previousBlockHash.position(_pos) -> _offset {
  
      
        function BlockHeader.previousBlockHash.position._chunk0(pos) -> __r {
          __r := 0x14
        }
      
        function BlockHeader.previousBlockHash.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.previousBlockHash.position._chunk0(_pos), add(BlockHeader.previousBlockHash.position._chunk1(_pos), 0))
    
}



function BlockHeader.height.position(_pos) -> _offset {
  
      
        function BlockHeader.height.position._chunk0(pos) -> __r {
          __r := 0x34
        }
      
        function BlockHeader.height.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.height.position._chunk0(_pos), add(BlockHeader.height.position._chunk1(_pos), 0))
    
}



function BlockHeader.ethereumBlockNumber.position(_pos) -> _offset {
  
      
        function BlockHeader.ethereumBlockNumber.position._chunk0(pos) -> __r {
          __r := 0x54
        }
      
        function BlockHeader.ethereumBlockNumber.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.ethereumBlockNumber.position._chunk0(_pos), add(BlockHeader.ethereumBlockNumber.position._chunk1(_pos), 0))
    
}



function BlockHeader.numTokens.position(_pos) -> _offset {
  
      
        function BlockHeader.numTokens.position._chunk0(pos) -> __r {
          __r := 0x74
        }
      
        function BlockHeader.numTokens.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.numTokens.position._chunk0(_pos), add(BlockHeader.numTokens.position._chunk1(_pos), 0))
    
}



function BlockHeader.numAddresses.position(_pos) -> _offset {
  
      
        function BlockHeader.numAddresses.position._chunk0(pos) -> __r {
          __r := 0x94
        }
      
        function BlockHeader.numAddresses.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.numAddresses.position._chunk0(_pos), add(BlockHeader.numAddresses.position._chunk1(_pos), 0))
    
}



function BlockHeader.roots.position(_pos) -> _offset {
  
      
        function BlockHeader.roots.position._chunk0(pos) -> __r {
          __r := 0xb6
        }
      
        function BlockHeader.roots.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(BlockHeader.roots.position._chunk0(_pos), add(BlockHeader.roots.position._chunk1(_pos), 0))
    
}



function BlockHeader.height(pos) -> res {
  res := mslice(BlockHeader.height.position(pos), 32)
}



function BlockHeader.previousBlockHash(pos) -> res {
  res := mslice(BlockHeader.previousBlockHash.position(pos), 32)
}



function BlockHeader.ethereumBlockNumber(pos) -> res {
  res := mslice(BlockHeader.ethereumBlockNumber.position(pos), 32)
}



function BlockHeader.roots(pos, i) -> res {
  res := mslice(add(BlockHeader.roots.position(pos),
    mul(i, 32)), 32)
}

function BlockHeader.roots.slice(pos) -> res {
  res := mslice(BlockHeader.roots.position(pos),
    BlockHeader.roots.length(pos))
}



function Constructor.chainId(pos) -> res {
  res := mslice(Constructor.chainId.position(pos), 32)
}



function Constructor.chainId.position(_pos) -> _offset {
  
      
        function Constructor.chainId.position._chunk0(pos) -> __r {
          __r := 0xe0
        }
      
        function Constructor.chainId.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Constructor.chainId.position._chunk0(_pos), add(Constructor.chainId.position._chunk1(_pos), 0))
    
}



function Signature.type(pos) -> res {
  res := mslice(Signature.type.position(pos), 1)
}



function Signature.type.position(_pos) -> _offset {
  
      
        function Signature.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Signature.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Signature.type.position._chunk0(_pos), add(Signature.type.position._chunk1(_pos), 0))
    
}



function Signature.size(pos) -> _offset {
  _offset := sub(Signature.offset(pos), pos)
}



function Signature.offset(pos) -> _offset {
  _offset := Signature.v.offset(pos)
}



function Signature.v.offset(pos) -> _offset {
_offset := add(Signature.v.position(pos), 1)
}



function Signature.v.position(_pos) -> _offset {
  
      
        function Signature.v.position._chunk0(pos) -> __r {
          __r := 0x41
        }
      
        function Signature.v.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Signature.v.position._chunk0(_pos), add(Signature.v.position._chunk1(_pos), 0))
    
}



function Signature.r.position(_pos) -> _offset {
  
      
        function Signature.r.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function Signature.r.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Signature.r.position._chunk0(_pos), add(Signature.r.position._chunk1(_pos), 0))
    
}



function Signature.s.position(_pos) -> _offset {
  
      
        function Signature.s.position._chunk0(pos) -> __r {
          __r := 0x21
        }
      
        function Signature.s.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Signature.s.position._chunk0(_pos), add(Signature.s.position._chunk1(_pos), 0))
    
}



function Caller.size(pos) -> _offset {
  _offset := sub(Caller.offset(pos), pos)
}



function Caller.offset(pos) -> _offset {
  _offset := Caller.blockNumber.offset(pos)
}



function Caller.blockNumber.offset(pos) -> _offset {
_offset := add(Caller.blockNumber.position(pos), 4)
}



function Caller.blockNumber.position(_pos) -> _offset {
  
      
        function Caller.blockNumber.position._chunk0(pos) -> __r {
          __r := 0x15
        }
      
        function Caller.blockNumber.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Caller.blockNumber.position._chunk0(_pos), add(Caller.blockNumber.position._chunk1(_pos), 0))
    
}



function Caller.type.position(_pos) -> _offset {
  
      
        function Caller.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Caller.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Caller.type.position._chunk0(_pos), add(Caller.type.position._chunk1(_pos), 0))
    
}



function Caller.owner.position(_pos) -> _offset {
  
      
        function Caller.owner.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function Caller.owner.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Caller.owner.position._chunk0(_pos), add(Caller.owner.position._chunk1(_pos), 0))
    
}



function Producer.size(pos) -> _offset {
  _offset := sub(Producer.offset(pos), pos)
}



function Producer.offset(pos) -> _offset {
  _offset := Producer.hash.offset(pos)
}



function Producer.hash.offset(pos) -> _offset {
_offset := add(Producer.hash.position(pos), 32)
}



function Producer.hash.position(_pos) -> _offset {
  
      
        function Producer.hash.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function Producer.hash.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Producer.hash.position._chunk0(_pos), add(Producer.hash.position._chunk1(_pos), 0))
    
}



function Producer.type.position(_pos) -> _offset {
  
      
        function Producer.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Producer.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Producer.type.position._chunk0(_pos), add(Producer.type.position._chunk1(_pos), 0))
    
}



function Signature.v(pos) -> res {
  res := mslice(Signature.v.position(pos), 1)
}



function Signature.r(pos) -> res {
  res := mslice(Signature.r.position(pos), 32)
}



function Signature.s(pos) -> res {
  res := mslice(Signature.s.position(pos), 32)
}



function Input.type(pos) -> res {
  res := mslice(Input.type.position(pos), 1)
}



function Input.type.position(_pos) -> _offset {
  
      
        function Input.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Input.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Input.type.position._chunk0(_pos), add(Input.type.position._chunk1(_pos), 0))
    
}



function Output.amount.position(_pos) -> _offset {
  
      
        function Output.amount.position._chunk0(pos) -> __r {
          __r := 0x04
        }
      
        function Output.amount.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function Output.amount.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(Output.amount.position._chunk1(pos), 0)), 1), 1)
        }
      

      _offset := add(Output.amount.position._chunk0(_pos), add(Output.amount.position._chunk1(_pos), add(Output.amount.position._chunk2(_pos), 0)))
    
}



function Output.type.position(_pos) -> _offset {
  
      
        function Output.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Output.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Output.type.position._chunk0(_pos), add(Output.type.position._chunk1(_pos), 0))
    
}



function Output.token.length.position(_pos) -> _offset {
  
      
        function Output.token.length.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function Output.token.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Output.token.length.position._chunk0(_pos), add(Output.token.length.position._chunk1(_pos), 0))
    
}



function Output.token.position(_pos) -> _offset {
  
      
        function Output.token.position._chunk0(pos) -> __r {
          __r := 0x02
        }
      
        function Output.token.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Output.token.position._chunk0(_pos), add(Output.token.position._chunk1(_pos), 0))
    
}



function Output.token.length(pos) -> res {
  res := mslice(Output.token.length.position(pos), 1)
}



function Output.amount.shift.position(_pos) -> _offset {
  
      
        function Output.amount.shift.position._chunk0(pos) -> __r {
          __r := 0x02
        }
      
        function Output.amount.shift.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function Output.amount.shift.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(Output.amount.shift.position._chunk1(pos), 0)), 1), 1)
        }
      

      _offset := add(Output.amount.shift.position._chunk0(_pos), add(Output.amount.shift.position._chunk1(_pos), add(Output.amount.shift.position._chunk2(_pos), 0)))
    
}



function Output.amount.length.position(_pos) -> _offset {
  
      
        function Output.amount.length.position._chunk0(pos) -> __r {
          __r := 0x03
        }
      
        function Output.amount.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function Output.amount.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(Output.amount.length.position._chunk1(pos), 0)), 1), 1)
        }
      

      _offset := add(Output.amount.length.position._chunk0(_pos), add(Output.amount.length.position._chunk1(_pos), add(Output.amount.length.position._chunk2(_pos), 0)))
    
}



function Output.amount.shift(pos) -> res {
  res := mslice(Output.amount.shift.position(pos), 1)
}



function Output.amount.length(pos) -> res {
  res := mslice(Output.amount.length.position(pos), 1)
}



function Output.type(pos) -> res {
  res := mslice(Output.type.position(pos), 1)
}



function Output.size(pos) -> _offset {
  _offset := sub(Output.offset(pos), pos)
}



function Output.offset(pos) -> _offset {
  _offset := Output.owner.offset(pos)
}



function Output.owner.offset(pos) -> _offset {
_offset := add(Output.owner.position(pos), mul(Output.owner.length(pos), 1))
}



function Output.owner.length(pos) -> res {
  res := mslice(Output.owner.length.position(pos), 1)
}



function Output.owner.length.position(_pos) -> _offset {
  
      
        function Output.owner.length.position._chunk0(pos) -> __r {
          __r := 0x04
        }
      
        function Output.owner.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function Output.owner.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(Output.owner.length.position._chunk1(pos), 0)), 1), 1)
        }
      
        function Output.owner.length.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(Output.owner.length.position._chunk2(pos), 0))), 1), 1)
        }
      

      _offset := add(Output.owner.length.position._chunk0(_pos), add(Output.owner.length.position._chunk1(_pos), add(Output.owner.length.position._chunk2(_pos), add(Output.owner.length.position._chunk3(_pos), 0))))
    
}



function Output.owner.position(_pos) -> _offset {
  
      
        function Output.owner.position._chunk0(pos) -> __r {
          __r := 0x05
        }
      
        function Output.owner.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function Output.owner.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(Output.owner.position._chunk1(pos), 0)), 1), 1)
        }
      
        function Output.owner.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(Output.owner.position._chunk2(pos), 0))), 1), 1)
        }
      

      _offset := add(Output.owner.position._chunk0(_pos), add(Output.owner.position._chunk1(_pos), add(Output.owner.position._chunk2(_pos), add(Output.owner.position._chunk3(_pos), 0))))
    
}



function OutputHTLC.size(pos) -> _offset {
  _offset := sub(OutputHTLC.offset(pos), pos)
}



function OutputHTLC.offset(pos) -> _offset {
  _offset := OutputHTLC.returnOwner.offset(pos)
}



function OutputHTLC.returnOwner.offset(pos) -> _offset {
_offset := add(OutputHTLC.returnOwner.position(pos), mul(OutputHTLC.returnOwner.length(pos), 1))
}



function OutputHTLC.returnOwner.length(pos) -> res {
  res := mslice(OutputHTLC.returnOwner.length.position(pos), 1)
}



function OutputHTLC.returnOwner.length.position(_pos) -> _offset {
  
      
        function OutputHTLC.returnOwner.length.position._chunk0(pos) -> __r {
          __r := 0x29
        }
      
        function OutputHTLC.returnOwner.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.returnOwner.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.returnOwner.length.position._chunk1(pos), 0)), 1), 1)
        }
      
        function OutputHTLC.returnOwner.length.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(OutputHTLC.returnOwner.length.position._chunk2(pos), 0))), 1), 1)
        }
      
        function OutputHTLC.returnOwner.length.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x04, add(pos, add(mul(mslice(add(0x01, add(pos, 0)), 1), 1), add(OutputHTLC.returnOwner.length.position._chunk3(pos), 0)))), 1), 1)
        }
      

      _offset := add(OutputHTLC.returnOwner.length.position._chunk0(_pos), add(OutputHTLC.returnOwner.length.position._chunk1(_pos), add(OutputHTLC.returnOwner.length.position._chunk2(_pos), add(OutputHTLC.returnOwner.length.position._chunk3(_pos), add(OutputHTLC.returnOwner.length.position._chunk4(_pos), 0)))))
    
}



function OutputHTLC.type.position(_pos) -> _offset {
  
      
        function OutputHTLC.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function OutputHTLC.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(OutputHTLC.type.position._chunk0(_pos), add(OutputHTLC.type.position._chunk1(_pos), 0))
    
}



function OutputHTLC.token.length.position(_pos) -> _offset {
  
      
        function OutputHTLC.token.length.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function OutputHTLC.token.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(OutputHTLC.token.length.position._chunk0(_pos), add(OutputHTLC.token.length.position._chunk1(_pos), 0))
    
}



function OutputHTLC.token.position(_pos) -> _offset {
  
      
        function OutputHTLC.token.position._chunk0(pos) -> __r {
          __r := 0x02
        }
      
        function OutputHTLC.token.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(OutputHTLC.token.position._chunk0(_pos), add(OutputHTLC.token.position._chunk1(_pos), 0))
    
}



function OutputHTLC.token.length(pos) -> res {
  res := mslice(OutputHTLC.token.length.position(pos), 1)
}



function OutputHTLC.amount.shift.position(_pos) -> _offset {
  
      
        function OutputHTLC.amount.shift.position._chunk0(pos) -> __r {
          __r := 0x02
        }
      
        function OutputHTLC.amount.shift.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.amount.shift.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.amount.shift.position._chunk1(pos), 0)), 1), 1)
        }
      

      _offset := add(OutputHTLC.amount.shift.position._chunk0(_pos), add(OutputHTLC.amount.shift.position._chunk1(_pos), add(OutputHTLC.amount.shift.position._chunk2(_pos), 0)))
    
}



function OutputHTLC.amount.length.position(_pos) -> _offset {
  
      
        function OutputHTLC.amount.length.position._chunk0(pos) -> __r {
          __r := 0x03
        }
      
        function OutputHTLC.amount.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.amount.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.amount.length.position._chunk1(pos), 0)), 1), 1)
        }
      

      _offset := add(OutputHTLC.amount.length.position._chunk0(_pos), add(OutputHTLC.amount.length.position._chunk1(_pos), add(OutputHTLC.amount.length.position._chunk2(_pos), 0)))
    
}



function OutputHTLC.amount.position(_pos) -> _offset {
  
      
        function OutputHTLC.amount.position._chunk0(pos) -> __r {
          __r := 0x04
        }
      
        function OutputHTLC.amount.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.amount.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.amount.position._chunk1(pos), 0)), 1), 1)
        }
      

      _offset := add(OutputHTLC.amount.position._chunk0(_pos), add(OutputHTLC.amount.position._chunk1(_pos), add(OutputHTLC.amount.position._chunk2(_pos), 0)))
    
}



function OutputHTLC.amount.length(pos) -> res {
  res := mslice(OutputHTLC.amount.length.position(pos), 1)
}



function OutputHTLC.owner.length.position(_pos) -> _offset {
  
      
        function OutputHTLC.owner.length.position._chunk0(pos) -> __r {
          __r := 0x04
        }
      
        function OutputHTLC.owner.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.owner.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.owner.length.position._chunk1(pos), 0)), 1), 1)
        }
      
        function OutputHTLC.owner.length.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(OutputHTLC.owner.length.position._chunk2(pos), 0))), 1), 1)
        }
      

      _offset := add(OutputHTLC.owner.length.position._chunk0(_pos), add(OutputHTLC.owner.length.position._chunk1(_pos), add(OutputHTLC.owner.length.position._chunk2(_pos), add(OutputHTLC.owner.length.position._chunk3(_pos), 0))))
    
}



function OutputHTLC.owner.position(_pos) -> _offset {
  
      
        function OutputHTLC.owner.position._chunk0(pos) -> __r {
          __r := 0x05
        }
      
        function OutputHTLC.owner.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.owner.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.owner.position._chunk1(pos), 0)), 1), 1)
        }
      
        function OutputHTLC.owner.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(OutputHTLC.owner.position._chunk2(pos), 0))), 1), 1)
        }
      

      _offset := add(OutputHTLC.owner.position._chunk0(_pos), add(OutputHTLC.owner.position._chunk1(_pos), add(OutputHTLC.owner.position._chunk2(_pos), add(OutputHTLC.owner.position._chunk3(_pos), 0))))
    
}



function OutputHTLC.owner.length(pos) -> res {
  res := mslice(OutputHTLC.owner.length.position(pos), 1)
}



function OutputHTLC.digest.position(_pos) -> _offset {
  
      
        function OutputHTLC.digest.position._chunk0(pos) -> __r {
          __r := 0x05
        }
      
        function OutputHTLC.digest.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.digest.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.digest.position._chunk1(pos), 0)), 1), 1)
        }
      
        function OutputHTLC.digest.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(OutputHTLC.digest.position._chunk2(pos), 0))), 1), 1)
        }
      
        function OutputHTLC.digest.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x04, add(pos, add(mul(mslice(add(0x01, add(pos, 0)), 1), 1), add(OutputHTLC.digest.position._chunk3(pos), 0)))), 1), 1)
        }
      

      _offset := add(OutputHTLC.digest.position._chunk0(_pos), add(OutputHTLC.digest.position._chunk1(_pos), add(OutputHTLC.digest.position._chunk2(_pos), add(OutputHTLC.digest.position._chunk3(_pos), add(OutputHTLC.digest.position._chunk4(_pos), 0)))))
    
}



function OutputHTLC.expiry.position(_pos) -> _offset {
  
      
        function OutputHTLC.expiry.position._chunk0(pos) -> __r {
          __r := 0x25
        }
      
        function OutputHTLC.expiry.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.expiry.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.expiry.position._chunk1(pos), 0)), 1), 1)
        }
      
        function OutputHTLC.expiry.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(OutputHTLC.expiry.position._chunk2(pos), 0))), 1), 1)
        }
      
        function OutputHTLC.expiry.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x04, add(pos, add(mul(mslice(add(0x01, add(pos, 0)), 1), 1), add(OutputHTLC.expiry.position._chunk3(pos), 0)))), 1), 1)
        }
      

      _offset := add(OutputHTLC.expiry.position._chunk0(_pos), add(OutputHTLC.expiry.position._chunk1(_pos), add(OutputHTLC.expiry.position._chunk2(_pos), add(OutputHTLC.expiry.position._chunk3(_pos), add(OutputHTLC.expiry.position._chunk4(_pos), 0)))))
    
}



function OutputHTLC.returnOwner.position(_pos) -> _offset {
  
      
        function OutputHTLC.returnOwner.position._chunk0(pos) -> __r {
          __r := 0x2a
        }
      
        function OutputHTLC.returnOwner.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function OutputHTLC.returnOwner.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x01, add(OutputHTLC.returnOwner.position._chunk1(pos), 0)), 1), 1)
        }
      
        function OutputHTLC.returnOwner.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(OutputHTLC.returnOwner.position._chunk2(pos), 0))), 1), 1)
        }
      
        function OutputHTLC.returnOwner.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x04, add(pos, add(mul(mslice(add(0x01, add(pos, 0)), 1), 1), add(OutputHTLC.returnOwner.position._chunk3(pos), 0)))), 1), 1)
        }
      

      _offset := add(OutputHTLC.returnOwner.position._chunk0(_pos), add(OutputHTLC.returnOwner.position._chunk1(_pos), add(OutputHTLC.returnOwner.position._chunk2(_pos), add(OutputHTLC.returnOwner.position._chunk3(_pos), add(OutputHTLC.returnOwner.position._chunk4(_pos), 0)))))
    
}



function OutputReturn.size(pos) -> _offset {
  _offset := sub(OutputReturn.offset(pos), pos)
}



function OutputReturn.offset(pos) -> _offset {
  _offset := OutputReturn.data.offset(pos)
}



function OutputReturn.data.offset(pos) -> _offset {
_offset := add(OutputReturn.data.position(pos), mul(OutputReturn.data.length(pos), 1))
}



function OutputReturn.data.length(pos) -> res {
  res := mslice(OutputReturn.data.length.position(pos), 2)
}



function OutputReturn.data.length.position(_pos) -> _offset {
  
      
        function OutputReturn.data.length.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function OutputReturn.data.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(OutputReturn.data.length.position._chunk0(_pos), add(OutputReturn.data.length.position._chunk1(_pos), 0))
    
}



function OutputReturn.type.position(_pos) -> _offset {
  
      
        function OutputReturn.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function OutputReturn.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(OutputReturn.type.position._chunk0(_pos), add(OutputReturn.type.position._chunk1(_pos), 0))
    
}



function OutputReturn.data.position(_pos) -> _offset {
  
      
        function OutputReturn.data.position._chunk0(pos) -> __r {
          __r := 0x03
        }
      
        function OutputReturn.data.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(OutputReturn.data.position._chunk0(_pos), add(OutputReturn.data.position._chunk1(_pos), 0))
    
}



function Output.token.slice(pos) -> res {
  res := mslice(Output.token.position(pos), Output.token.length(pos))
}



function Output.owner.slice(pos) -> res {
  res := mslice(Output.owner.position(pos), Output.owner.length(pos))
}



function OutputHTLC.returnOwner.slice(pos) -> res {
  res := mslice(OutputHTLC.returnOwner.position(pos), OutputHTLC.returnOwner.length(pos))
}



function TransactionProof.token(pos) -> res {
  res := mslice(TransactionProof.token.position(pos), 20)
}



function TransactionProof.token.position(_pos) -> _offset {
  
      
        function TransactionProof.token.position._chunk0(pos) -> __r {
          __r := 0x01b5
        }
      
        function TransactionProof.token.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.token.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.token.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.token.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.token.position._chunk2(pos), 0))), 2), 32)
        }
      
        function TransactionProof.token.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x0172, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(TransactionProof.token.position._chunk3(pos), 0)))), 2), 1)
        }
      
        function TransactionProof.token.position._chunk5(pos) -> __r {
          __r := mul(mslice(add(0x0174, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(mul(mslice(add(0x016c, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), 0))), 2), 32), add(TransactionProof.token.position._chunk4(pos), 0))))), 1), 32)
        }
      

      _offset := add(TransactionProof.token.position._chunk0(_pos), add(TransactionProof.token.position._chunk1(_pos), add(TransactionProof.token.position._chunk2(_pos), add(TransactionProof.token.position._chunk3(_pos), add(TransactionProof.token.position._chunk4(_pos), add(TransactionProof.token.position._chunk5(_pos), 0))))))
    
}



function TransactionProof.blockProducer.position(_pos) -> _offset {
  
      
        function TransactionProof.blockProducer.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function TransactionProof.blockProducer.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.blockProducer.position._chunk0(_pos), add(TransactionProof.blockProducer.position._chunk1(_pos), 0))
    
}



function TransactionProof.previousBlockHash.position(_pos) -> _offset {
  
      
        function TransactionProof.previousBlockHash.position._chunk0(pos) -> __r {
          __r := 0x14
        }
      
        function TransactionProof.previousBlockHash.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.previousBlockHash.position._chunk0(_pos), add(TransactionProof.previousBlockHash.position._chunk1(_pos), 0))
    
}



function TransactionProof.blockHeight.position(_pos) -> _offset {
  
      
        function TransactionProof.blockHeight.position._chunk0(pos) -> __r {
          __r := 0x34
        }
      
        function TransactionProof.blockHeight.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.blockHeight.position._chunk0(_pos), add(TransactionProof.blockHeight.position._chunk1(_pos), 0))
    
}



function TransactionProof.ethereumBlockNumber.position(_pos) -> _offset {
  
      
        function TransactionProof.ethereumBlockNumber.position._chunk0(pos) -> __r {
          __r := 0x54
        }
      
        function TransactionProof.ethereumBlockNumber.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.ethereumBlockNumber.position._chunk0(_pos), add(TransactionProof.ethereumBlockNumber.position._chunk1(_pos), 0))
    
}



function TransactionProof.numTokens.position(_pos) -> _offset {
  
      
        function TransactionProof.numTokens.position._chunk0(pos) -> __r {
          __r := 0x74
        }
      
        function TransactionProof.numTokens.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.numTokens.position._chunk0(_pos), add(TransactionProof.numTokens.position._chunk1(_pos), 0))
    
}



function TransactionProof.numAddresses.position(_pos) -> _offset {
  
      
        function TransactionProof.numAddresses.position._chunk0(pos) -> __r {
          __r := 0x94
        }
      
        function TransactionProof.numAddresses.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.numAddresses.position._chunk0(_pos), add(TransactionProof.numAddresses.position._chunk1(_pos), 0))
    
}



function TransactionProof.roots.length.position(_pos) -> _offset {
  
      
        function TransactionProof.roots.length.position._chunk0(pos) -> __r {
          __r := 0xb4
        }
      
        function TransactionProof.roots.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.roots.length.position._chunk0(_pos), add(TransactionProof.roots.length.position._chunk1(_pos), 0))
    
}



function TransactionProof.roots.position(_pos) -> _offset {
  
      
        function TransactionProof.roots.position._chunk0(pos) -> __r {
          __r := 0xb6
        }
      
        function TransactionProof.roots.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionProof.roots.position._chunk0(_pos), add(TransactionProof.roots.position._chunk1(_pos), 0))
    
}



function TransactionProof.roots.length(pos) -> res {
  res := mslice(TransactionProof.roots.length.position(pos), 2)
}



function TransactionProof.rootProducer.position(_pos) -> _offset {
  
      
        function TransactionProof.rootProducer.position._chunk0(pos) -> __r {
          __r := 0xb6
        }
      
        function TransactionProof.rootProducer.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.rootProducer.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.rootProducer.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.rootProducer.position._chunk0(_pos), add(TransactionProof.rootProducer.position._chunk1(_pos), add(TransactionProof.rootProducer.position._chunk2(_pos), 0)))
    
}



function TransactionProof.merkleTreeRoot.position(_pos) -> _offset {
  
      
        function TransactionProof.merkleTreeRoot.position._chunk0(pos) -> __r {
          __r := 0xca
        }
      
        function TransactionProof.merkleTreeRoot.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.merkleTreeRoot.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.merkleTreeRoot.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.merkleTreeRoot.position._chunk0(_pos), add(TransactionProof.merkleTreeRoot.position._chunk1(_pos), add(TransactionProof.merkleTreeRoot.position._chunk2(_pos), 0)))
    
}



function TransactionProof.commitmentHash.position(_pos) -> _offset {
  
      
        function TransactionProof.commitmentHash.position._chunk0(pos) -> __r {
          __r := 0xea
        }
      
        function TransactionProof.commitmentHash.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.commitmentHash.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.commitmentHash.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.commitmentHash.position._chunk0(_pos), add(TransactionProof.commitmentHash.position._chunk1(_pos), add(TransactionProof.commitmentHash.position._chunk2(_pos), 0)))
    
}



function TransactionProof.rootLength.position(_pos) -> _offset {
  
      
        function TransactionProof.rootLength.position._chunk0(pos) -> __r {
          __r := 0x010a
        }
      
        function TransactionProof.rootLength.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.rootLength.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.rootLength.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.rootLength.position._chunk0(_pos), add(TransactionProof.rootLength.position._chunk1(_pos), add(TransactionProof.rootLength.position._chunk2(_pos), 0)))
    
}



function TransactionProof.feeToken.position(_pos) -> _offset {
  
      
        function TransactionProof.feeToken.position._chunk0(pos) -> __r {
          __r := 0x012a
        }
      
        function TransactionProof.feeToken.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.feeToken.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.feeToken.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.feeToken.position._chunk0(_pos), add(TransactionProof.feeToken.position._chunk1(_pos), add(TransactionProof.feeToken.position._chunk2(_pos), 0)))
    
}



function TransactionProof.fee.position(_pos) -> _offset {
  
      
        function TransactionProof.fee.position._chunk0(pos) -> __r {
          __r := 0x014a
        }
      
        function TransactionProof.fee.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.fee.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.fee.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.fee.position._chunk0(_pos), add(TransactionProof.fee.position._chunk1(_pos), add(TransactionProof.fee.position._chunk2(_pos), 0)))
    
}



function TransactionProof.rootIndex.position(_pos) -> _offset {
  
      
        function TransactionProof.rootIndex.position._chunk0(pos) -> __r {
          __r := 0x016a
        }
      
        function TransactionProof.rootIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.rootIndex.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.rootIndex.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.rootIndex.position._chunk0(_pos), add(TransactionProof.rootIndex.position._chunk1(_pos), add(TransactionProof.rootIndex.position._chunk2(_pos), 0)))
    
}



function TransactionProof.merkleProof.length.position(_pos) -> _offset {
  
      
        function TransactionProof.merkleProof.length.position._chunk0(pos) -> __r {
          __r := 0x016c
        }
      
        function TransactionProof.merkleProof.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.merkleProof.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.merkleProof.length.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.merkleProof.length.position._chunk0(_pos), add(TransactionProof.merkleProof.length.position._chunk1(_pos), add(TransactionProof.merkleProof.length.position._chunk2(_pos), 0)))
    
}



function TransactionProof.merkleProof.position(_pos) -> _offset {
  
      
        function TransactionProof.merkleProof.position._chunk0(pos) -> __r {
          __r := 0x016e
        }
      
        function TransactionProof.merkleProof.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.merkleProof.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.merkleProof.position._chunk1(pos), 0)), 2), 32)
        }
      

      _offset := add(TransactionProof.merkleProof.position._chunk0(_pos), add(TransactionProof.merkleProof.position._chunk1(_pos), add(TransactionProof.merkleProof.position._chunk2(_pos), 0)))
    
}



function TransactionProof.merkleProof.length(pos) -> res {
  res := mslice(TransactionProof.merkleProof.length.position(pos), 2)
}



function TransactionProof.input.position(_pos) -> _offset {
  
      
        function TransactionProof.input.position._chunk0(pos) -> __r {
          __r := 0x016e
        }
      
        function TransactionProof.input.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.input.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.input.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.input.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.input.position._chunk2(pos), 0))), 2), 32)
        }
      

      _offset := add(TransactionProof.input.position._chunk0(_pos), add(TransactionProof.input.position._chunk1(_pos), add(TransactionProof.input.position._chunk2(_pos), add(TransactionProof.input.position._chunk3(_pos), 0))))
    
}



function TransactionProof.output.position(_pos) -> _offset {
  
      
        function TransactionProof.output.position._chunk0(pos) -> __r {
          __r := 0x016f
        }
      
        function TransactionProof.output.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.output.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.output.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.output.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.output.position._chunk2(pos), 0))), 2), 32)
        }
      

      _offset := add(TransactionProof.output.position._chunk0(_pos), add(TransactionProof.output.position._chunk1(_pos), add(TransactionProof.output.position._chunk2(_pos), add(TransactionProof.output.position._chunk3(_pos), 0))))
    
}



function TransactionProof.transactionIndex.position(_pos) -> _offset {
  
      
        function TransactionProof.transactionIndex.position._chunk0(pos) -> __r {
          __r := 0x0170
        }
      
        function TransactionProof.transactionIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.transactionIndex.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.transactionIndex.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.transactionIndex.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.transactionIndex.position._chunk2(pos), 0))), 2), 32)
        }
      

      _offset := add(TransactionProof.transactionIndex.position._chunk0(_pos), add(TransactionProof.transactionIndex.position._chunk1(_pos), add(TransactionProof.transactionIndex.position._chunk2(_pos), add(TransactionProof.transactionIndex.position._chunk3(_pos), 0))))
    
}



function TransactionProof.transaction.length.position(_pos) -> _offset {
  
      
        function TransactionProof.transaction.length.position._chunk0(pos) -> __r {
          __r := 0x0172
        }
      
        function TransactionProof.transaction.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.transaction.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.transaction.length.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.transaction.length.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.transaction.length.position._chunk2(pos), 0))), 2), 32)
        }
      

      _offset := add(TransactionProof.transaction.length.position._chunk0(_pos), add(TransactionProof.transaction.length.position._chunk1(_pos), add(TransactionProof.transaction.length.position._chunk2(_pos), add(TransactionProof.transaction.length.position._chunk3(_pos), 0))))
    
}



function TransactionProof.transaction.position(_pos) -> _offset {
  
      
        function TransactionProof.transaction.position._chunk0(pos) -> __r {
          __r := 0x0174
        }
      
        function TransactionProof.transaction.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.transaction.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.transaction.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.transaction.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.transaction.position._chunk2(pos), 0))), 2), 32)
        }
      

      _offset := add(TransactionProof.transaction.position._chunk0(_pos), add(TransactionProof.transaction.position._chunk1(_pos), add(TransactionProof.transaction.position._chunk2(_pos), add(TransactionProof.transaction.position._chunk3(_pos), 0))))
    
}



function TransactionProof.transaction.length(pos) -> res {
  res := mslice(TransactionProof.transaction.length.position(pos), 2)
}



function TransactionProof.data.length.position(_pos) -> _offset {
  
      
        function TransactionProof.data.length.position._chunk0(pos) -> __r {
          __r := 0x0174
        }
      
        function TransactionProof.data.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.data.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.data.length.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.data.length.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.data.length.position._chunk2(pos), 0))), 2), 32)
        }
      
        function TransactionProof.data.length.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x0172, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(TransactionProof.data.length.position._chunk3(pos), 0)))), 2), 1)
        }
      

      _offset := add(TransactionProof.data.length.position._chunk0(_pos), add(TransactionProof.data.length.position._chunk1(_pos), add(TransactionProof.data.length.position._chunk2(_pos), add(TransactionProof.data.length.position._chunk3(_pos), add(TransactionProof.data.length.position._chunk4(_pos), 0)))))
    
}



function TransactionProof.data.position(_pos) -> _offset {
  
      
        function TransactionProof.data.position._chunk0(pos) -> __r {
          __r := 0x0175
        }
      
        function TransactionProof.data.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.data.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.data.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.data.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.data.position._chunk2(pos), 0))), 2), 32)
        }
      
        function TransactionProof.data.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x0172, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(TransactionProof.data.position._chunk3(pos), 0)))), 2), 1)
        }
      

      _offset := add(TransactionProof.data.position._chunk0(_pos), add(TransactionProof.data.position._chunk1(_pos), add(TransactionProof.data.position._chunk2(_pos), add(TransactionProof.data.position._chunk3(_pos), add(TransactionProof.data.position._chunk4(_pos), 0)))))
    
}



function TransactionProof.data.length(pos) -> res {
  res := mslice(TransactionProof.data.length.position(pos), 1)
}



function TransactionProof.signatureFeeToken.position(_pos) -> _offset {
  
      
        function TransactionProof.signatureFeeToken.position._chunk0(pos) -> __r {
          __r := 0x0175
        }
      
        function TransactionProof.signatureFeeToken.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.signatureFeeToken.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.signatureFeeToken.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.signatureFeeToken.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.signatureFeeToken.position._chunk2(pos), 0))), 2), 32)
        }
      
        function TransactionProof.signatureFeeToken.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x0172, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(TransactionProof.signatureFeeToken.position._chunk3(pos), 0)))), 2), 1)
        }
      
        function TransactionProof.signatureFeeToken.position._chunk5(pos) -> __r {
          __r := mul(mslice(add(0x0174, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(mul(mslice(add(0x016c, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), 0))), 2), 32), add(TransactionProof.signatureFeeToken.position._chunk4(pos), 0))))), 1), 32)
        }
      

      _offset := add(TransactionProof.signatureFeeToken.position._chunk0(_pos), add(TransactionProof.signatureFeeToken.position._chunk1(_pos), add(TransactionProof.signatureFeeToken.position._chunk2(_pos), add(TransactionProof.signatureFeeToken.position._chunk3(_pos), add(TransactionProof.signatureFeeToken.position._chunk4(_pos), add(TransactionProof.signatureFeeToken.position._chunk5(_pos), 0))))))
    
}



function TransactionProof.signatureFee.position(_pos) -> _offset {
  
      
        function TransactionProof.signatureFee.position._chunk0(pos) -> __r {
          __r := 0x0195
        }
      
        function TransactionProof.signatureFee.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.signatureFee.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.signatureFee.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.signatureFee.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.signatureFee.position._chunk2(pos), 0))), 2), 32)
        }
      
        function TransactionProof.signatureFee.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x0172, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(TransactionProof.signatureFee.position._chunk3(pos), 0)))), 2), 1)
        }
      
        function TransactionProof.signatureFee.position._chunk5(pos) -> __r {
          __r := mul(mslice(add(0x0174, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(mul(mslice(add(0x016c, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), 0))), 2), 32), add(TransactionProof.signatureFee.position._chunk4(pos), 0))))), 1), 32)
        }
      

      _offset := add(TransactionProof.signatureFee.position._chunk0(_pos), add(TransactionProof.signatureFee.position._chunk1(_pos), add(TransactionProof.signatureFee.position._chunk2(_pos), add(TransactionProof.signatureFee.position._chunk3(_pos), add(TransactionProof.signatureFee.position._chunk4(_pos), add(TransactionProof.signatureFee.position._chunk5(_pos), 0))))))
    
}



function TransactionProof.selector(pos) -> res {
  res := mslice(TransactionProof.selector.position(pos), 20)
}



function TransactionProof.selector.position(_pos) -> _offset {
  
      
        function TransactionProof.selector.position._chunk0(pos) -> __r {
          __r := 0x01c9
        }
      
        function TransactionProof.selector.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionProof.selector.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0xb4, add(TransactionProof.selector.position._chunk1(pos), 0)), 2), 32)
        }
      
        function TransactionProof.selector.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x016c, add(pos, add(TransactionProof.selector.position._chunk2(pos), 0))), 2), 32)
        }
      
        function TransactionProof.selector.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x0172, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(TransactionProof.selector.position._chunk3(pos), 0)))), 2), 1)
        }
      
        function TransactionProof.selector.position._chunk5(pos) -> __r {
          __r := mul(mslice(add(0x0174, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), add(mul(mslice(add(0x016c, add(pos, add(mul(mslice(add(0xb4, add(pos, 0)), 2), 32), 0))), 2), 32), add(TransactionProof.selector.position._chunk4(pos), 0))))), 1), 32)
        }
      

      _offset := add(TransactionProof.selector.position._chunk0(_pos), add(TransactionProof.selector.position._chunk1(_pos), add(TransactionProof.selector.position._chunk2(_pos), add(TransactionProof.selector.position._chunk3(_pos), add(TransactionProof.selector.position._chunk4(_pos), add(TransactionProof.selector.position._chunk5(_pos), 0))))))
    
}



function TransactionProof.output(pos) -> res {
  res := mslice(TransactionProof.output.position(pos), 1)
}



function OutputHTLC.digest(pos) -> res {
  res := mslice(OutputHTLC.digest.position(pos), 32)
}



function OutputHTLC.expiry(pos) -> res {
  res := mslice(OutputHTLC.expiry.position(pos), 4)
}



function UTXO.keccak256(pos) -> _hash {
  _hash := keccak256(pos, UTXO.size(pos))
}



function UTXO.size(pos) -> _offset {
  _offset := sub(UTXO.offset(pos), pos)
}



function UTXO.offset(pos) -> _offset {
  _offset := UTXO.returnOwner.offset(pos)
}



function UTXO.returnOwner.offset(pos) -> _offset {
_offset := add(UTXO.returnOwner.position(pos), 32)
}



function UTXO.returnOwner.position(_pos) -> _offset {
  
      
        function UTXO.returnOwner.position._chunk0(pos) -> __r {
          __r := 0x0100
        }
      
        function UTXO.returnOwner.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.returnOwner.position._chunk0(_pos), add(UTXO.returnOwner.position._chunk1(_pos), 0))
    
}



function UTXO.transactionHashId.position(_pos) -> _offset {
  
      
        function UTXO.transactionHashId.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function UTXO.transactionHashId.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.transactionHashId.position._chunk0(_pos), add(UTXO.transactionHashId.position._chunk1(_pos), 0))
    
}



function UTXO.outputIndex.position(_pos) -> _offset {
  
      
        function UTXO.outputIndex.position._chunk0(pos) -> __r {
          __r := 0x20
        }
      
        function UTXO.outputIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.outputIndex.position._chunk0(_pos), add(UTXO.outputIndex.position._chunk1(_pos), 0))
    
}



function UTXO.outputType.position(_pos) -> _offset {
  
      
        function UTXO.outputType.position._chunk0(pos) -> __r {
          __r := 0x40
        }
      
        function UTXO.outputType.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.outputType.position._chunk0(_pos), add(UTXO.outputType.position._chunk1(_pos), 0))
    
}



function UTXO.owner.position(_pos) -> _offset {
  
      
        function UTXO.owner.position._chunk0(pos) -> __r {
          __r := 0x60
        }
      
        function UTXO.owner.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.owner.position._chunk0(_pos), add(UTXO.owner.position._chunk1(_pos), 0))
    
}



function UTXO.amount.position(_pos) -> _offset {
  
      
        function UTXO.amount.position._chunk0(pos) -> __r {
          __r := 0x80
        }
      
        function UTXO.amount.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.amount.position._chunk0(_pos), add(UTXO.amount.position._chunk1(_pos), 0))
    
}



function UTXO.token.position(_pos) -> _offset {
  
      
        function UTXO.token.position._chunk0(pos) -> __r {
          __r := 0xa0
        }
      
        function UTXO.token.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.token.position._chunk0(_pos), add(UTXO.token.position._chunk1(_pos), 0))
    
}



function UTXO.digest.position(_pos) -> _offset {
  
      
        function UTXO.digest.position._chunk0(pos) -> __r {
          __r := 0xc0
        }
      
        function UTXO.digest.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.digest.position._chunk0(_pos), add(UTXO.digest.position._chunk1(_pos), 0))
    
}



function UTXO.expiry.position(_pos) -> _offset {
  
      
        function UTXO.expiry.position._chunk0(pos) -> __r {
          __r := 0xe0
        }
      
        function UTXO.expiry.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(UTXO.expiry.position._chunk0(_pos), add(UTXO.expiry.position._chunk1(_pos), 0))
    
}



function TransactionProof.feeToken(pos) -> res {
  res := mslice(TransactionProof.feeToken.position(pos), 32)
}



function TransactionProof.rootLength(pos) -> res {
  res := mslice(TransactionProof.rootLength.position(pos), 32)
}



function TransactionProof.fee(pos) -> res {
  res := mslice(TransactionProof.fee.position(pos), 32)
}



function TransactionLeaf.inputs.length.position(_pos) -> _offset {
  
      
        function TransactionLeaf.inputs.length.position._chunk0(pos) -> __r {
          __r := 0x05
        }
      
        function TransactionLeaf.inputs.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionLeaf.inputs.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x02, add(TransactionLeaf.inputs.length.position._chunk1(pos), 0)), 1), 8)
        }
      
        function TransactionLeaf.inputs.length.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(TransactionLeaf.inputs.length.position._chunk2(pos), 0))), 2), 1)
        }
      

      _offset := add(TransactionLeaf.inputs.length.position._chunk0(_pos), add(TransactionLeaf.inputs.length.position._chunk1(_pos), add(TransactionLeaf.inputs.length.position._chunk2(_pos), add(TransactionLeaf.inputs.length.position._chunk3(_pos), 0))))
    
}



function TransactionLeaf.length.position(_pos) -> _offset {
  
      
        function TransactionLeaf.length.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function TransactionLeaf.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionLeaf.length.position._chunk0(_pos), add(TransactionLeaf.length.position._chunk1(_pos), 0))
    
}



function TransactionLeaf.metadata.length.position(_pos) -> _offset {
  
      
        function TransactionLeaf.metadata.length.position._chunk0(pos) -> __r {
          __r := 0x02
        }
      
        function TransactionLeaf.metadata.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionLeaf.metadata.length.position._chunk0(_pos), add(TransactionLeaf.metadata.length.position._chunk1(_pos), 0))
    
}



function TransactionLeaf.metadata.position(_pos) -> _offset {
  
      
        function TransactionLeaf.metadata.position._chunk0(pos) -> __r {
          __r := 0x03
        }
      
        function TransactionLeaf.metadata.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(TransactionLeaf.metadata.position._chunk0(_pos), add(TransactionLeaf.metadata.position._chunk1(_pos), 0))
    
}



function TransactionLeaf.metadata.length(pos) -> res {
  res := mslice(TransactionLeaf.metadata.length.position(pos), 1)
}



function TransactionLeaf.witnesses.length.position(_pos) -> _offset {
  
      
        function TransactionLeaf.witnesses.length.position._chunk0(pos) -> __r {
          __r := 0x03
        }
      
        function TransactionLeaf.witnesses.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionLeaf.witnesses.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x02, add(TransactionLeaf.witnesses.length.position._chunk1(pos), 0)), 1), 8)
        }
      

      _offset := add(TransactionLeaf.witnesses.length.position._chunk0(_pos), add(TransactionLeaf.witnesses.length.position._chunk1(_pos), add(TransactionLeaf.witnesses.length.position._chunk2(_pos), 0)))
    
}



function TransactionLeaf.witnesses.position(_pos) -> _offset {
  
      
        function TransactionLeaf.witnesses.position._chunk0(pos) -> __r {
          __r := 0x05
        }
      
        function TransactionLeaf.witnesses.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionLeaf.witnesses.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x02, add(TransactionLeaf.witnesses.position._chunk1(pos), 0)), 1), 8)
        }
      

      _offset := add(TransactionLeaf.witnesses.position._chunk0(_pos), add(TransactionLeaf.witnesses.position._chunk1(_pos), add(TransactionLeaf.witnesses.position._chunk2(_pos), 0)))
    
}



function TransactionLeaf.witnesses.length(pos) -> res {
  res := mslice(TransactionLeaf.witnesses.length.position(pos), 2)
}



function TransactionProof.signatureFee.offset(pos) -> _offset {
_offset := add(TransactionProof.signatureFee.position(pos), 32)
}



function TransactionLeaf.witnesses.offset(pos) -> _offset {
_offset := add(TransactionLeaf.witnesses.position(pos), mul(TransactionLeaf.witnesses.length(pos), 1))
}



function Input.witnessReference(pos) -> res {
  res := mslice(Input.witnessReference.position(pos), 1)
}



function Input.witnessReference.position(_pos) -> _offset {
  
      
        function Input.witnessReference.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function Input.witnessReference.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Input.witnessReference.position._chunk0(_pos), add(Input.witnessReference.position._chunk1(_pos), 0))
    
}



function TransactionProof.input(pos) -> res {
  res := mslice(TransactionProof.input.position(pos), 1)
}



function TransactionLeaf.inputs.position(_pos) -> _offset {
  
      
        function TransactionLeaf.inputs.position._chunk0(pos) -> __r {
          __r := 0x07
        }
      
        function TransactionLeaf.inputs.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionLeaf.inputs.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x02, add(TransactionLeaf.inputs.position._chunk1(pos), 0)), 1), 8)
        }
      
        function TransactionLeaf.inputs.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(TransactionLeaf.inputs.position._chunk2(pos), 0))), 2), 1)
        }
      

      _offset := add(TransactionLeaf.inputs.position._chunk0(_pos), add(TransactionLeaf.inputs.position._chunk1(_pos), add(TransactionLeaf.inputs.position._chunk2(_pos), add(TransactionLeaf.inputs.position._chunk3(_pos), 0))))
    
}



function TransactionLeaf.inputs.offset(pos) -> _offset {
_offset := add(TransactionLeaf.inputs.position(pos), mul(TransactionLeaf.inputs.length(pos), 1))
}



function TransactionLeaf.inputs.length(pos) -> res {
  res := mslice(TransactionLeaf.inputs.length.position(pos), 2)
}



function TransactionLeaf.metadata(pos, i) -> res {
  res := mslice(add(TransactionLeaf.metadata.position(pos),
    mul(i, 8)), 8)
}

function TransactionLeaf.metadata.slice(pos) -> res {
  res := mslice(TransactionLeaf.metadata.position(pos),
    TransactionLeaf.metadata.length(pos))
}



function TransactionLeaf.outputs.position(_pos) -> _offset {
  
      
        function TransactionLeaf.outputs.position._chunk0(pos) -> __r {
          __r := 0x09
        }
      
        function TransactionLeaf.outputs.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionLeaf.outputs.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x02, add(TransactionLeaf.outputs.position._chunk1(pos), 0)), 1), 8)
        }
      
        function TransactionLeaf.outputs.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(TransactionLeaf.outputs.position._chunk2(pos), 0))), 2), 1)
        }
      
        function TransactionLeaf.outputs.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x05, add(pos, add(mul(mslice(add(0x02, add(pos, 0)), 1), 8), add(TransactionLeaf.outputs.position._chunk3(pos), 0)))), 2), 1)
        }
      

      _offset := add(TransactionLeaf.outputs.position._chunk0(_pos), add(TransactionLeaf.outputs.position._chunk1(_pos), add(TransactionLeaf.outputs.position._chunk2(_pos), add(TransactionLeaf.outputs.position._chunk3(_pos), add(TransactionLeaf.outputs.position._chunk4(_pos), 0)))))
    
}



function TransactionLeaf.outputs.length.position(_pos) -> _offset {
  
      
        function TransactionLeaf.outputs.length.position._chunk0(pos) -> __r {
          __r := 0x07
        }
      
        function TransactionLeaf.outputs.length.position._chunk1(pos) -> __r {
          __r := pos
        }
      
        function TransactionLeaf.outputs.length.position._chunk2(pos) -> __r {
          __r := mul(mslice(add(0x02, add(TransactionLeaf.outputs.length.position._chunk1(pos), 0)), 1), 8)
        }
      
        function TransactionLeaf.outputs.length.position._chunk3(pos) -> __r {
          __r := mul(mslice(add(0x03, add(pos, add(TransactionLeaf.outputs.length.position._chunk2(pos), 0))), 2), 1)
        }
      
        function TransactionLeaf.outputs.length.position._chunk4(pos) -> __r {
          __r := mul(mslice(add(0x05, add(pos, add(mul(mslice(add(0x02, add(pos, 0)), 1), 8), add(TransactionLeaf.outputs.length.position._chunk3(pos), 0)))), 2), 1)
        }
      

      _offset := add(TransactionLeaf.outputs.length.position._chunk0(_pos), add(TransactionLeaf.outputs.length.position._chunk1(_pos), add(TransactionLeaf.outputs.length.position._chunk2(_pos), add(TransactionLeaf.outputs.length.position._chunk3(_pos), add(TransactionLeaf.outputs.length.position._chunk4(_pos), 0)))))
    
}



function TransactionLeaf.outputs.offset(pos) -> _offset {
_offset := add(TransactionLeaf.outputs.position(pos), mul(TransactionLeaf.outputs.length(pos), 1))
}



function TransactionLeaf.outputs.length(pos) -> res {
  res := mslice(TransactionLeaf.outputs.length.position(pos), 2)
}



function TransactionProof.ethereumBlockNumber(pos) -> res {
  res := mslice(TransactionProof.ethereumBlockNumber.position(pos), 32)
}



function TransactionProof.transactionIndex(pos) -> res {
  res := mslice(TransactionProof.transactionIndex.position(pos), 2)
}



function TransactionProof.rootIndex(pos) -> res {
  res := mslice(TransactionProof.rootIndex.position(pos), 2)
}



function TransactionProof.blockHeight(pos) -> res {
  res := mslice(TransactionProof.blockHeight.position(pos), 32)
}



function TransactionLeaf.metadata.offset(pos) -> _offset {
_offset := add(TransactionLeaf.metadata.position(pos), mul(TransactionLeaf.metadata.length(pos), 8))
}



function Caller.owner(pos) -> res {
  res := mslice(Caller.owner.position(pos), 20)
}



function Caller.blockNumber(pos) -> res {
  res := mslice(Caller.blockNumber.position(pos), 4)
}



function TransactionProof.blockProducer(pos) -> res {
  res := mslice(TransactionProof.blockProducer.position(pos), 20)
}



function Producer.hash(pos) -> res {
  res := mslice(Producer.hash.position(pos), 32)
}



function TransactionProof.transaction.keccak256(pos) -> _hash {
  _hash := keccak256(TransactionProof.transaction.position(pos),
    mul(TransactionProof.transaction.length(pos),
          TransactionProof.transaction.size()))
}



function TransactionProof.transaction.size() -> _size {
  _size := 1
}



function TransactionProof.merkleTreeRoot(pos) -> res {
  res := mslice(TransactionProof.merkleTreeRoot.position(pos), 32)
}



function BlockHeader.producer(pos) -> res {
  res := mslice(BlockHeader.producer.position(pos), 20)
}



function Constructor.penaltyDelay(pos) -> res {
  res := mslice(Constructor.penaltyDelay.position(pos), 32)
}



function InputDeposit.owner(pos) -> res {
  res := mslice(InputDeposit.owner.position(pos), 20)
}



function InputDeposit.owner.position(_pos) -> _offset {
  
      
        function InputDeposit.owner.position._chunk0(pos) -> __r {
          __r := 0x02
        }
      
        function InputDeposit.owner.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(InputDeposit.owner.position._chunk0(_pos), add(InputDeposit.owner.position._chunk1(_pos), 0))
    
}



function InputDeposit.type.position(_pos) -> _offset {
  
      
        function InputDeposit.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function InputDeposit.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(InputDeposit.type.position._chunk0(_pos), add(InputDeposit.type.position._chunk1(_pos), 0))
    
}



function InputDeposit.witnessReference.position(_pos) -> _offset {
  
      
        function InputDeposit.witnessReference.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function InputDeposit.witnessReference.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(InputDeposit.witnessReference.position._chunk0(_pos), add(InputDeposit.witnessReference.position._chunk1(_pos), 0))
    
}



function RootHeader.commitmentHash(pos) -> res {
  res := mslice(RootHeader.commitmentHash.position(pos), 32)
}



function RootHeader.merkleTreeRoot(pos) -> res {
  res := mslice(RootHeader.merkleTreeRoot.position(pos), 32)
}



function MetadataDeposit.blockNumber(pos) -> res {
  res := mslice(MetadataDeposit.blockNumber.position(pos), 4)
}



function MetadataDeposit.blockNumber.position(_pos) -> _offset {
  
      
        function MetadataDeposit.blockNumber.position._chunk0(pos) -> __r {
          __r := 0x04
        }
      
        function MetadataDeposit.blockNumber.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(MetadataDeposit.blockNumber.position._chunk0(_pos), add(MetadataDeposit.blockNumber.position._chunk1(_pos), 0))
    
}



function MetadataDeposit.token.position(_pos) -> _offset {
  
      
        function MetadataDeposit.token.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function MetadataDeposit.token.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(MetadataDeposit.token.position._chunk0(_pos), add(MetadataDeposit.token.position._chunk1(_pos), 0))
    
}



function MetadataDeposit.token(pos) -> res {
  res := mslice(MetadataDeposit.token.position(pos), 4)
}



function TransactionProof.numTokens(pos) -> res {
  res := mslice(TransactionProof.numTokens.position(pos), 32)
}



function Metadata.blockHeight(pos) -> res {
  res := mslice(Metadata.blockHeight.position(pos), 4)
}



function Metadata.blockHeight.position(_pos) -> _offset {
  
      
        function Metadata.blockHeight.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Metadata.blockHeight.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Metadata.blockHeight.position._chunk0(_pos), add(Metadata.blockHeight.position._chunk1(_pos), 0))
    
}



function Metadata.rootIndex(pos) -> res {
  res := mslice(Metadata.rootIndex.position(pos), 1)
}



function Metadata.rootIndex.position(_pos) -> _offset {
  
      
        function Metadata.rootIndex.position._chunk0(pos) -> __r {
          __r := 0x04
        }
      
        function Metadata.rootIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Metadata.rootIndex.position._chunk0(_pos), add(Metadata.rootIndex.position._chunk1(_pos), 0))
    
}



function Metadata.transactionIndex(pos) -> res {
  res := mslice(Metadata.transactionIndex.position(pos), 2)
}



function Metadata.transactionIndex.position(_pos) -> _offset {
  
      
        function Metadata.transactionIndex.position._chunk0(pos) -> __r {
          __r := 0x05
        }
      
        function Metadata.transactionIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Metadata.transactionIndex.position._chunk0(_pos), add(Metadata.transactionIndex.position._chunk1(_pos), 0))
    
}



function Metadata.outputIndex(pos) -> res {
  res := mslice(Metadata.outputIndex.position(pos), 1)
}



function Metadata.outputIndex.position(_pos) -> _offset {
  
      
        function Metadata.outputIndex.position._chunk0(pos) -> __r {
          __r := 0x07
        }
      
        function Metadata.outputIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Metadata.outputIndex.position._chunk0(_pos), add(Metadata.outputIndex.position._chunk1(_pos), 0))
    
}



function TransactionProof.numAddresses(pos) -> res {
  res := mslice(TransactionProof.numAddresses.position(pos), 32)
}



function TransactionLeaf.size(pos) -> _offset {
  _offset := sub(TransactionLeaf.offset(pos), pos)
}



function TransactionLeaf.offset(pos) -> _offset {
  _offset := TransactionLeaf.outputs.offset(pos)
}



function TransactionLeaf.length(pos) -> res {
  res := mslice(TransactionLeaf.length.position(pos), 2)
}



function InputHTLC.preImage.keccak256(pos) -> _hash {
  _hash := keccak256(InputHTLC.preImage.position(pos),
    InputHTLC.preImage.size())
}



function InputHTLC.preImage.position(_pos) -> _offset {
  
      
        function InputHTLC.preImage.position._chunk0(pos) -> __r {
          __r := 0x02
        }
      
        function InputHTLC.preImage.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(InputHTLC.preImage.position._chunk0(_pos), add(InputHTLC.preImage.position._chunk1(_pos), 0))
    
}



function InputHTLC.type.position(_pos) -> _offset {
  
      
        function InputHTLC.type.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function InputHTLC.type.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(InputHTLC.type.position._chunk0(_pos), add(InputHTLC.type.position._chunk1(_pos), 0))
    
}



function InputHTLC.witnessReference.position(_pos) -> _offset {
  
      
        function InputHTLC.witnessReference.position._chunk0(pos) -> __r {
          __r := 0x01
        }
      
        function InputHTLC.witnessReference.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(InputHTLC.witnessReference.position._chunk0(_pos), add(InputHTLC.witnessReference.position._chunk1(_pos), 0))
    
}



function InputHTLC.preImage.size() -> _size {
  _size := 32
}



function TransactionProof.data(pos, i) -> res {
  res := mslice(add(TransactionProof.data.position(pos),
    mul(i, 32)), 32)
}

function TransactionProof.data.slice(pos) -> res {
  res := mslice(TransactionProof.data.position(pos),
    TransactionProof.data.length(pos))
}



function TransactionProof.size(pos) -> _offset {
  _offset := sub(TransactionProof.offset(pos), pos)
}



function TransactionProof.offset(pos) -> _offset {
  _offset := TransactionProof.selector.offset(pos)
}



function TransactionProof.selector.offset(pos) -> _offset {
_offset := add(TransactionProof.selector.position(pos), 20)
}



function Deposit.token(pos) -> res {
  res := mslice(Deposit.token.position(pos), 32)
}



function Deposit.token.position(_pos) -> _offset {
  
      
        function Deposit.token.position._chunk0(pos) -> __r {
          __r := 0x20
        }
      
        function Deposit.token.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Deposit.token.position._chunk0(_pos), add(Deposit.token.position._chunk1(_pos), 0))
    
}



function Deposit.owner.position(_pos) -> _offset {
  
      
        function Deposit.owner.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function Deposit.owner.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Deposit.owner.position._chunk0(_pos), add(Deposit.owner.position._chunk1(_pos), 0))
    
}



function Deposit.blockNumber(pos) -> res {
  res := mslice(Deposit.blockNumber.position(pos), 32)
}



function Deposit.blockNumber.position(_pos) -> _offset {
  
      
        function Deposit.blockNumber.position._chunk0(pos) -> __r {
          __r := 0x40
        }
      
        function Deposit.blockNumber.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Deposit.blockNumber.position._chunk0(_pos), add(Deposit.blockNumber.position._chunk1(_pos), 0))
    
}



function Deposit.keccak256(pos) -> _hash {
  _hash := keccak256(pos, Deposit.size(pos))
}



function Deposit.size(pos) -> _offset {
  _offset := sub(Deposit.offset(pos), pos)
}



function Deposit.offset(pos) -> _offset {
  _offset := Deposit.value.offset(pos)
}



function Deposit.value.offset(pos) -> _offset {
_offset := add(Deposit.value.position(pos), 32)
}



function Deposit.value.position(_pos) -> _offset {
  
      
        function Deposit.value.position._chunk0(pos) -> __r {
          __r := 0x60
        }
      
        function Deposit.value.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(Deposit.value.position._chunk0(_pos), add(Deposit.value.position._chunk1(_pos), 0))
    
}



function Deposit.owner(pos) -> res {
  res := mslice(Deposit.owner.position(pos), 32)
}



function WithdrawalProof.keccak256(pos) -> _hash {
  _hash := keccak256(pos, WithdrawalProof.size(pos))
}



function WithdrawalProof.size(pos) -> _offset {
  _offset := sub(WithdrawalProof.offset(pos), pos)
}



function WithdrawalProof.offset(pos) -> _offset {
  _offset := WithdrawalProof.outputIndex.offset(pos)
}



function WithdrawalProof.outputIndex.offset(pos) -> _offset {
_offset := add(WithdrawalProof.outputIndex.position(pos), 32)
}



function WithdrawalProof.outputIndex.position(_pos) -> _offset {
  
      
        function WithdrawalProof.outputIndex.position._chunk0(pos) -> __r {
          __r := 0x40
        }
      
        function WithdrawalProof.outputIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(WithdrawalProof.outputIndex.position._chunk0(_pos), add(WithdrawalProof.outputIndex.position._chunk1(_pos), 0))
    
}



function WithdrawalProof.rootIndex.position(_pos) -> _offset {
  
      
        function WithdrawalProof.rootIndex.position._chunk0(pos) -> __r {
          __r := 0x00
        }
      
        function WithdrawalProof.rootIndex.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(WithdrawalProof.rootIndex.position._chunk0(_pos), add(WithdrawalProof.rootIndex.position._chunk1(_pos), 0))
    
}



function WithdrawalProof.transactionLeafHash.position(_pos) -> _offset {
  
      
        function WithdrawalProof.transactionLeafHash.position._chunk0(pos) -> __r {
          __r := 0x20
        }
      
        function WithdrawalProof.transactionLeafHash.position._chunk1(pos) -> __r {
          __r := pos
        }
      

      _offset := add(WithdrawalProof.transactionLeafHash.position._chunk0(_pos), add(WithdrawalProof.transactionLeafHash.position._chunk1(_pos), 0))
    
}



function UTXO.owner(pos) -> res {
  res := mslice(UTXO.owner.position(pos), 32)
}



function UTXO.token(pos) -> res {
  res := mslice(UTXO.token.position(pos), 32)
}



function UTXO.amount(pos) -> res {
  res := mslice(UTXO.amount.position(pos), 32)
}



function Deposit.value(pos) -> res {
  res := mslice(Deposit.value.position(pos), 32)
}


    

    let Constructor.abi := 0x00

    

    function Constructor.copy(pos) {
      codecopy(pos, safeSub(codesize(), 416), 416)
    }

    function Constructor.verify(pos) {
      let nameLen := mload(Constructor.name(0))
      let versionLen := mload(Constructor.version(0))

      require(and(gt(nameLen, 0), lte(nameLen, 32)), "name-length")
      require(and(gt(versionLen, 0), lte(versionLen, 32)), "version-length")
    }

    function Constructor.name.copy(cpos, pos) {
      let len := mload(Constructor.name(cpos))
      let val := mload(safeAdd(Constructor.name(cpos), 32))
      mstore(pos, 32) mstore(add(pos,32), len) mstore(add(pos,64), val)
    }

    function Constructor.name.hash(pos) -> hash {
      hash := keccak256(safeAdd(safeAdd(pos, 256), 64), mload(Constructor.name(pos)))
    }

    function Constructor.version.copy(cpos, pos) {
      let len := mload(Constructor.version(cpos))
      let val := mload(safeAdd(Constructor.version(cpos), 32))
      mstore(pos, 32) mstore(add(pos,32), len) mstore(add(pos,64), val)
    }

    function Constructor.version.hash(pos) -> hash {
      hash := keccak256(safeAdd(safeAdd(pos, 320), 64), mload(Constructor.version(pos)))
    }
  
    

    function calldata.copy() {
      calldatacopy(1024, 0, calldatasize())
    }

    function calldata.signature() -> sig {
      sig := mslice(1024, 4)
    }

    function calldata.word(index) -> word {
      word := mload(safeAdd(safeAdd(1024, 4), safeMul(index, 32)))
    }

    function abi.offset(offset) -> position {
      position := safeAdd(offset, safeAdd(36, 1024))
    }

    function abi.length(offset) -> length {
      length := mload(safeAdd(offset, safeAdd(4, 1024)))
    }

    function return.word(word) {
      mstore(0, word)
      return(0, 32)
    }

    function calldata.offset() -> offset {
      offset := safeAdd(1024, calldatasize())
    }
  
    

    function mappingKey(storageIndex, key) -> storageKey {
        mstore(0, storageIndex) mstore(add(0,32), key)
        storageKey := keccak256(0, 64)
    }

    function mappingKey2(storageIndex, key, key2) -> storageKey {
        mstore(0, storageIndex) mstore(add(0,32), key) mstore(add(0,64), key2)
        storageKey := keccak256(0, 96)
    }

    function mappingKey3(storageIndex, key, key2, key3) -> storageKey {
        mstore(0, storageIndex) mstore(add(0,32), key) mstore(add(0,64), key2) mstore(add(0,96), key3)
        storageKey := keccak256(0, 128)
    }
  
    

    function numTokens() -> num {
      num := sload(2)
    }

    function tokenId(addr) -> id {
      id := sload(mappingKey(7, addr))
    }

    function indexToken(addr, id) {
      sstore(mappingKey(7, addr), id)
      sstore(2, safeAdd(id, 1))
      log3(0, 0,
          0x73c163cd50614894c0ab5238e0e9a17a39bbc4a6c5dc6a2cac9dd95f319f1c48,
          addr,
          id)
    }

    function commitToken(addr) -> id {
      id := tokenId(addr)

      if and(neq(addr, 0), iszero(id)) {
        id := numTokens()
        indexToken(addr, id)
      }
    }
  
    
    

    

    function roots(root) -> blockNumber {
      blockNumber := sload(mappingKey(3, root))
    }

    function clearRoot(root) {
      sstore(mappingKey(3, root), 0)
    }

    function commitRoot(merkleTreeRoot, commitmentHash, length, token, fee) {
      // Require caller/msg.sender is not a contract
      require(eq(origin(), caller()), 0x01)
      require(eq(extcodesize(caller()), 0), 0x02)

      // Calldata Max size enforcement (4m / 68)
      require(gte(length, 44), 0x03) // TransactionSizeMinimum
      require(lte(calldatasize(), safeAdd(57600, mul32(6))), 0x04)

      // Ensure token is value
      require(gte(token, 0), 0x05)
      require(lt(token, numTokens()), 0x06)

      // Build transaction root
      mstore(0, caller()) mstore(add(0,32), merkleTreeRoot) mstore(add(0,64), commitmentHash) mstore(add(0,96), length) mstore(add(0,128), token) mstore(add(0,160), fee)
      let root := RootHeader.keccak256(12)

      // Transaction Roots
      let rootBlockNumber := sload(mappingKey(3, root))

      // Require this transactions blob cannot already exist
      require(eq(rootBlockNumber, 0), 0x07)

      // Set Block Tx Roots is Block Number
      sstore(mappingKey(3, root), number())

      // Store caller in data..
      mstore(0, caller()) mstore(add(0,32), token) mstore(add(0,64), fee) mstore(add(0,96), length)
      log4(0, mul32(4), 0xcedb4993325661af27ac77872d7b5433cef3ca1036245c261019fd999310dee3,
        root, merkleTreeRoot, commitmentHash)
    }
  
    

    function numAddresses() -> num {
      num := sload(8)
    }

    function addresses(owner) -> id {
      id := sload(mappingKey(9, owner))
    }

    function indexAddress(addr, id) {
      sstore(mappingKey(9, addr), id)
      sstore(8, safeAdd(id, 1))
      log3(0, 0,
          0xa9434c943c361e848a4336c1b7068a71a438981cb3ad555c21a0838f3d5b5f53,
          addr,
          id)
    }

    function commitAddress(addr) -> id {
      id := addresses(addr)

      if and(neq(addr, 0), iszero(id)) {
        id := numAddresses()
        indexAddress(addr, id)
      }
    }
  
    
    let Not_Finalized := 0x00
    let Finalized := 0x01
    

    

    function FINALIZATION_DELAY() -> delay {
      Constructor.copy(0)
      delay := Constructor.finalizationDelay(0)
    }

    function blockTip() -> blockNumber {
      blockNumber := sload(6)
    }

    function blockCommitments(blockNumber) -> blockHash {
      blockHash := sload(mappingKey(1, blockNumber))
    }

    function getPenalty() -> blockNumber {
      blockNumber := sload(0)
    }

    function setPenalty(delay) {
      sstore(0, safeAdd(number(), delay))
    }

    function commitBlock(minimum, height, rootsLength, rootsPosition) {
      let _blockTip := blockTip()
      let previousBlockHash := blockCommitments(safeSub(height, 1))

      // block tip check
      require(gt(number(), minimum), 0x08)

      // min height
      require(eq(height, safeAdd(_blockTip, 1)), 0x09)

      // Require at least one root submission
      require(gt(rootsLength, 0), 0x0a)

      // Require at least one root submission
      require(lte(rootsLength, 128), 0x0b)

      // get the operator
      Constructor.copy(0)
      let producer := Constructor.blockProducer(0)
      let submissionDelay := Constructor.submissionDelay(0)
      let activePenalty := getPenalty()

      // Require value be bond size
      require(eq(callvalue(), Constructor.bondSize(0)), 0x0c)

      // Root index
      for { let rootIndex := 0 } lt(rootIndex, rootsLength) { rootIndex := safeAdd(rootIndex, 1) } {
        let rootHash := mload(safeAdd(rootsPosition, safeMul(rootIndex, 32)))
        let rootBlockNumber := roots(rootHash)

        require(gt(rootBlockNumber, 0), 0x0d)

        if and(lt(number(), safeAdd(rootBlockNumber, submissionDelay)), gt(number(), activePenalty)) {
          require(eq(caller(), producer), 0x0e)
        }

        clearRoot(rootHash)
      }

      // Build a BlockHeader
      mstore(safeSub(rootsPosition, 34), numAddresses())
      mstore(safeSub(rootsPosition, 66), numTokens())
      mstore(safeSub(rootsPosition, 98), number())
      mstore(safeSub(rootsPosition, 130), height)
      mstore(safeSub(rootsPosition, 162), previousBlockHash)
      mstore(safeSub(rootsPosition, 194), caller())
      sstore(mappingKey(1, height),
        BlockHeader.keccak256(safeSub(rootsPosition, 182)))

      // block height
      sstore(6, height)

      // build log out of calldata
      mstore(safeSub(rootsPosition, 160), caller())
      mstore(safeSub(rootsPosition, 128), numTokens())
      mstore(safeSub(rootsPosition, 96), numAddresses())
      mstore(safeSub(rootsPosition, 64), 128)
      mstore(safeSub(rootsPosition, 32), rootsLength)
      log3(safeSub(rootsPosition, 160), safeAdd(160, mul32(rootsLength)),
        0x2521e5f2f7ee2cc8938e535746c063cc841d508a3036af3032bea136cad013a9,
          previousBlockHash,
          height)
    }
  
    let No_Root := 0x00

    function verifyHeader(blockHeader, root, rootIndex, assertFinalized) {
      // Select BlockHeight from Memory
      let blockHeight := BlockHeader.height(blockHeader)

      // Transaction Roots Length
      let rootsLength := BlockHeader.roots.length(blockHeader)

      // Assert Block is not Genesis
      require(gt(blockHeight, 0),
          0x0f)

      // Assert Block Height is Valid (i.e. before tip)
      require(lte(blockHeight, blockTip()),
          0x10)

      // Assert Previous Block Hash
      require(eq(
          blockCommitments(safeSub(blockHeight, 1)),
          BlockHeader.previousBlockHash(blockHeader)),
          0x11)

      // Transactions roots length underflow
      require(gt(rootsLength, 0),
          0x0a)

      // Transactions roots length underflow
      require(lte(rootsLength, 128),
          0x0b)

      // Assert Block Commitment Exists
      require(eq(blockCommitments(blockHeight), BlockHeader.keccak256(blockHeader)),
          0x12)

      // Copy Code to Memory
      Constructor.copy(0)
      let finalizationDelay := Constructor.finalizationDelay(0)

      // If requested, Assert Block is Finalized
      if eq(assertFinalized, 1) {
        require(gte(
          number(),
          safeAdd(BlockHeader.ethereumBlockNumber(blockHeader), finalizationDelay)
        ), 0x13)
      }

      // If requested, Assert Block is Not Finalized
      if lt(assertFinalized, 1) {
        require(lt(
          number(), // ethereumBlockNumber
          safeAdd(BlockHeader.ethereumBlockNumber(blockHeader), finalizationDelay)
        ), 0x14)
      }

      // if transaction root is present, validate it
      if gt(root, 0) {
        // Assert root index is not overflowing
        require(lt(rootIndex, rootsLength),
            0x15)

        // Assert root invalid overflow
        require(lt(rootsLength, 128),
            0x16)

        // Assert transaction root index is correct!
        require(eq(
            RootHeader.keccak256(root),
            BlockHeader.roots(blockHeader, rootIndex)),
            0x17)
      }
    }
  
    
    

    function eip712.domain() -> EIP712Domain {
      Constructor.copy(0)
      let chainId := Constructor.chainId(0)
      let nameHash := Constructor.name.hash(0)
      let versionHash := Constructor.version.hash(0)
      mstore(0, 0xbe1f30900ea0b603c03bc6ce517b4795fbdb08cc0b4b6e316e19199becde9754) mstore(add(0,32), nameHash) mstore(add(0,64), versionHash) mstore(add(0,96), chainId) mstore(add(0,128), address())
      EIP712Domain := keccak256(0, safeMul(5, 32))
    }

    function eip712.transaction(unsignedHashId) -> EIP712Transaction {
      mstore(0, 0xcfa11514192b8d3d6bcda9639281831e60687a67997d39912c7eb7a7a8041ad3) mstore(add(0,32), unsignedHashId)
      EIP712Transaction := keccak256(0, 64)
    }

    function eip712(unsignedHashId) -> hashId {
      let EIP712Transaction := eip712.transaction(unsignedHashId)
      let EIP712Domain := eip712.domain()
      mstore(0, 0x1901) mstore(add(0,32), EIP712Domain) mstore(add(0,64), EIP712Transaction)
      hashId := keccak256(30, 66)
    }
  
    

    

    

    function metadataId(metadata) -> id {
      id := mslice(metadata, 8)
    }
  
    

    

    

    

    function witnesses(owner, blockNumber) -> hashId {
      hashId := sload(mappingKey2(10, owner, blockNumber))
    }

    function commitWitness(hashId) {
      require(eq(witnesses(caller(), number()), 0), 0x18)
      sstore(mappingKey2(10, caller(), number()), hashId)
    }

    function witnessSize(witness) -> size {
      switch Signature.type(witness)

      case 0 {
        size := Signature.size(witness)
      }

      case 1 {
        size := Caller.size(witness)
      }

      case 2 {
        size := Producer.size(witness)
      }

      default { // avoid infinite loops
        size := 66
      }
    }

    function ecrecover(digestHash, witness) -> account {
      mstore(0, digestHash)
      mstore(32, Signature.v(witness))
      mstore(64, Signature.r(witness))
      mstore(96, Signature.s(witness))

      let result := call(3000, 1, 0, 0, 128, 128, 32) // 4 chunks, return at 128
      require(gt(result, 0), 0x19)
      account := mload(128)
    }
  
    

    

    

    

    function inputSize(input) -> size {
      switch Input.type(input)

      case 2 {
        size := 34 // InputHTLC.size(input)
      }

      case 1 {
        size := 22 // InputHTLC.size(input)
      }

      default {
        size := 2 // Input.size(input)
      }
    }

    function inputKeccak256(input) -> hash {
      hash := keccak256(input, inputSize(input))
    }
  
    

    

    

    

    

    function outputAmount(output) -> amount {
      let pos := Output.amount.position(output)
      let shift := Output.amount.shift(output)
      let len := Output.amount.length(output)

      require(lte(len, 32), "amount-length-overflow")
      require(lte(shift, 256), "amount-shift-overflow")
      require(lte(safeAdd(shift, safeMul(len, 8)), 256), "amount-overflow")

      amount := shl(shift, mslice(pos, len))
    }

    function outputSize(output) -> size {
      switch Output.type(output)

      case 0 {
        size := Output.size(output)
      }

      case 1 {
        size := Output.size(output)
      }

      case 2 {
        size := OutputHTLC.size(output)
      }

      case 3 {
        size := OutputReturn.size(output)
      }

      default { // avoid infinite loops
        size := 20
      }
    }

    function outputToken(output) -> id {
      id := Output.token.slice(output)
    }

    function ownerEquates(output, owner) -> result {
      let len := Output.owner.length(output)

      require(gt(len, 0), 0x1a)
      require(lte(len, 20), 0x1b)

      switch len

      case 20 { // address
        result := or(
          eq(Output.owner.slice(output), owner),
          eq(Output.owner.slice(output), calculateFunnelAddress(owner))
        )
      }

      default { // id
        let id := Output.owner.slice(output)
        result := or(
          eq(id, addresses(owner)),
          eq(id, addresses(calculateFunnelAddress(owner)))
        )
      }
    }

    function ownerReturnEquates(output, owner) -> result {
      let len := OutputHTLC.returnOwner.length(output)

      require(gt(len, 0), 0x1a)
      require(lte(len, 20), 0x1b)

      switch len

      case 20 { // address
        result := or(
          eq(OutputHTLC.returnOwner.slice(output), owner),
          eq(OutputHTLC.returnOwner.slice(output), calculateFunnelAddress(owner))
        )
      }

      default { // id
        let id := OutputHTLC.returnOwner.slice(output)
        result := or(
          eq(id, addresses(owner)),
          eq(id, addresses(calculateFunnelAddress(owner)))
        )
      }
    }
  
    
    
    
    
    

    

    

    function TransactionProof.UTXO.assign(proof, pos) {
      let output := selectOutput(proof)

      // we do this after to ensure hashing is okay
      require(neq(Output.type(output), 3),
        0x1c)

      // we do this after to ensure hashing is okay
      require(ownerEquates(output, TransactionProof.token(proof)),
        0x1d)

      // we do this after as the funnel address calc uses memory
      if eq(Output.type(output), 2) {
        require(ownerReturnEquates(output, TransactionProof.selector(proof)),
          0x1e)
      }

      mstore(pos,
        transactionHashId(proof)) mstore(add(pos,32),
        TransactionProof.output(proof)) mstore(add(pos,64),
        Output.type(output)) mstore(add(pos,96),
        TransactionProof.token(proof)) mstore(add(pos,128),
        outputAmount(output)) mstore(add(pos,160),
        Output.token.slice(output)) mstore(add(pos,192),
        0) mstore(add(pos,224), 0) mstore(add(pos,256), 0) // digest, expiry return witness

      if eq(Output.type(output), 2) {
        mstore(safeAdd(pos, 192), OutputHTLC.digest(output))
        mstore(safeAdd(pos, 224), OutputHTLC.expiry(output))
        mstore(safeAdd(pos, 256), TransactionProof.selector(proof))
      }
    }

    function TransactionProof.UTXO.keccak256(proof) -> hash {
      // Assign utxo to memory
      TransactionProof.UTXO.assign(proof, 0)

      // hash utxo
      hash := UTXO.keccak256(0)
    }

    function TransactionProof.block(proof) -> pos {
      pos := TransactionProof.blockProducer.position(proof)
    }

    function TransactionProof.root(proof) -> pos {
      pos := TransactionProof.rootProducer.position(proof)
    }

    // ABI Encoded Structures (Non-Tight Packed/Rolled)

    function rootFee(proof, token) -> sum {
      if eq(TransactionProof.feeToken(proof), token) {
        sum := safeMul(TransactionProof.rootLength(proof), TransactionProof.fee(proof))
      }
    }

    function transactionHashId(proof) -> hash {
      let leaf := TransactionProof.transaction.position(proof)
      let start := TransactionLeaf.inputs.length.position(leaf)
      let end := TransactionProof.signatureFee.offset(proof)
      hash := eip712(keccak256(start, safeSub(end, start)))
    }

    function TransactionProof.witness(proof, index) -> pos {
      let leaf := TransactionProof.transaction.position(proof)
      pos := TransactionLeaf.witnesses.position(leaf)

      for {} gt(index, 0) {} {
        pos := safeAdd(pos, witnessSize(pos))
        index := safeSub(index, 1)
      }

      require(lt(pos, TransactionLeaf.witnesses.offset(leaf)), 0x1f)
    }

    function TransactionProof.input.witness(proof) -> pos {
      let index := Input.witnessReference(selectInput(proof))
      pos := TransactionProof.witness(proof, index)
    }

    function selectInput(proof) -> pos {
      let leaf := TransactionProof.transaction.position(proof)
      let index := TransactionProof.input(proof)
      pos := TransactionLeaf.inputs.position(leaf)

      require(lt(index, 8), 0x20)

      for {} gt(index, 0) {} {
        pos := safeAdd(pos, inputSize(pos))
        index := safeSub(index, 1)
      }

      require(lt(pos, TransactionLeaf.inputs.offset(leaf)), 0x21)
    }

    function inputMetadataId(proof) -> id {
      let leaf := TransactionProof.transaction.position(proof)
      let index := TransactionProof.input(proof)
      id := TransactionLeaf.metadata(leaf, index)
    }

    function selectOutput(proof) -> pos {
      let leaf := TransactionProof.transaction.position(proof)
      let index := TransactionProof.output(proof)
      pos := TransactionLeaf.outputs.position(leaf)

      require(lt(index, 8), 0x22)

      for {} gt(index, 0) {} {
        pos := safeAdd(pos, outputSize(pos))
        index := safeSub(index, 1)
      }

      require(lt(pos, TransactionLeaf.outputs.offset(leaf)), 0x23)
    }

    function outputExpired(input, proof) -> result {
      let output := selectOutput(input)
      let blockNumber := TransactionProof.ethereumBlockNumber(proof)
      result := gt(blockNumber, OutputHTLC.expiry(output))
    }

    function witnessesLength(leaf) -> len {
      let pos := TransactionLeaf.witnesses.position(leaf)
      let end := TransactionLeaf.witnesses.offset(leaf)

      for {} lt(pos, end) {} {
        pos := safeAdd(pos, witnessSize(pos))
        len := safeAdd(len, 1)
      }
    }

    function inputsLength(leaf) -> len {
      let pos := TransactionLeaf.inputs.position(leaf)
      let end := TransactionLeaf.inputs.offset(leaf)

      for {} lt(pos, end) {} {
        pos := safeAdd(pos, inputSize(pos))
        len := safeAdd(len, 1)
      }
    }

    function TransactionProof.outputs.length(proof) -> len {
      let leaf := TransactionProof.transaction.position(proof)
      let pos := TransactionLeaf.outputs.position(leaf)
      let end := TransactionLeaf.outputs.offset(leaf)

      for {} lt(pos, end) {} {
        pos := safeAdd(pos, outputSize(pos))
        len := safeAdd(len, 1)
      }
    }

    function inputId(proof) -> id {
      mstore(4, TransactionProof.input(proof))
      mstore(2, TransactionProof.transactionIndex(proof))
      mstore(1, TransactionProof.rootIndex(proof))
      mstore(0, TransactionProof.blockHeight(proof))
      id := mslice(28, 8)
    }

    function outputId(proof) -> id {
      mstore(4, TransactionProof.output(proof))
      mstore(2, TransactionProof.transactionIndex(proof))
      mstore(1, TransactionProof.rootIndex(proof))
      mstore(0, TransactionProof.blockHeight(proof))
      id := mslice(28, 8)
    }

    function selectMetadata(proof, index) -> pos {
      let leaf := TransactionProof.transaction.position(proof)
      pos := TransactionLeaf.metadata.position(leaf)

      require(lt(index, 8), 0x20)

      for {} gt(index, 0) {} {
        pos := safeAdd(pos, 8)
        index := safeSub(index, 1)
      }

      require(lt(pos, TransactionLeaf.metadata.offset(leaf)), 0x21)
    }

    function recoverFromWitness(witness, proof) -> addr {
      switch Signature.type(witness)

      case 0 {
        addr := ecrecover(transactionHashId(proof), witness)
      }

      case 1 {
        addr := Caller.owner(witness)

        if neq(witnesses(addr, Caller.blockNumber(witness)), transactionHashId(proof)) {
          addr := 0
        }
      }

      case 2 {
        addr := TransactionProof.blockProducer(proof)

        if neq(Producer.hash(witness), transactionHashId(proof)) {
          addr := 0
        }
      }

      default { require(0, 0x24) }
    }

    function TransactionProof.input.recoverWitness(proof) -> addr {
      let witness := TransactionProof.input.witness(proof)
      addr := recoverFromWitness(witness, proof)
    }
  
    

    function verifyMerkleProof(transaction) -> leftish {
      // Select Merkle Proof Height
      let treeHeight := TransactionProof.merkleProof.length(transaction)

      // Select Tree (ahead of Array length)
      let treeMemoryPosition := TransactionProof.merkleProof.position(transaction)

      // Select Transaction Index
      let transactionIndex := TransactionProof.transactionIndex(transaction)

      // Assert Valid Merkle Tree Height (i.e. below Maximum)
      require(lt(treeHeight, 256),
        0x25)

      // Select computed hash
      let computedHash := 0

      // if the transaction has length, than hash it
      if gt(TransactionProof.transaction.length(transaction), 0) {
        computedHash := TransactionProof.transaction.keccak256(transaction)
      }

      // Clean Rightmost (leftishness) Detection Var (i.e. any previous use of this Stack Position)
      leftish := 0x00

      // Iterate Through Merkle Proof Depths
      // https://crypto.stackexchange.com/questions/31871/what-is-the-canonical-way-of-creating-merkle-tree-branches
      for { let depth := 0 } lt(depth, treeHeight) { depth := safeAdd(depth, 1) } {
        // get the leaf hash
        let proofLeafHash := mload(safeAdd(treeMemoryPosition, safeMul(depth, 32)))

        // Determine Proof Direction the merkle brand left:  tx index % 2 == 0
        switch eq(smod(transactionIndex, 2), 0)

        // Direction is left branch
        case 1 {
            mstore(mul32(1), computedHash)
            mstore(mul32(2), proofLeafHash)

            // Leftishness Detected in Proof, This is not Rightmost
            leftish := 0x01
        }

        // Direction is right branch
        case 0 {
            mstore(mul32(1), proofLeafHash)
            mstore(mul32(2), computedHash)
        }

        default { revert(0, 0) } // Direction is Invalid, Ensure no other cases!

        // Construct Depth Hash
        computedHash := keccak256(mul32(1), mul32(2))

        // Shift transaction index right by 1
        transactionIndex := shr(1, transactionIndex)
      }

      // Assert constructed merkle tree root is provided merkle tree root, or else, Invalid Inclusion!
      require(eq(computedHash, TransactionProof.merkleTreeRoot(transaction)),
        0x26)
    }
  
    function verifyTransactionProof(transaction, assertFinalized) {
      verifyHeader(TransactionProof.block(transaction),
          TransactionProof.root(transaction),
          TransactionProof.rootIndex(transaction),
          assertFinalized)

      let leftish := verifyMerkleProof(transaction)

      require(gt(TransactionProof.transaction.length(transaction), 0),
        0x27)
    }
  
    

    function mul32(x) -> result {
      result := safeMul(x, 32)
    }

    function eqor(x, y, z) -> result {
      result := or(eq(x, y), eq(x, z))
    }

    function round32(x) -> result {
      result := safeMul(safeDiv(x, 32), 32)

      if lt(result, x) {
        result := safeAdd(x, 32)
      }
    }

    function transfer(amount, token, owner) {
      require(gt(amount, 0), 0x28)
      require(gt(owner, 0), 0x29)
      require(gte(token, 0), 0x2a)

      switch token

      case 0 {
        require(call(gas(), owner, amount, 0, 0, 0, 0), 0x2b)
      }

      default {
        mstore(0, 0xa9059cbb) mstore(add(0,32), owner) mstore(add(0,64), amount)
        require(call(gas(), token, 0, 28, 68, 0, 32), 0x2c)
        require(gt(mload(0), 0), 0x2d)
      }
    }
  
    

    function assertOrFraud(assertion, fraudCode, block) {
      // Assert or Begin Fraud State Change Sequence
      if lt(assertion, 1) {
        // Fraud block details
        let fraudBlockHeight := BlockHeader.height(block)
        let fraudBlockProducer := BlockHeader.producer(block)

        // Assert Fraud block cannot be the genesis block
        require(gt(fraudBlockHeight, 0), 0x0f)

        // Copy constructor args to memory
        Constructor.copy(0)
        let bondSize := Constructor.bondSize(0)
        let penaltyDelay := Constructor.penaltyDelay(0)

        // Assert fraud block cannot be finalized
        require(lt(number(), safeAdd(BlockHeader.ethereumBlockNumber(block), Constructor.finalizationDelay(0))),
          0x2e)

        // Log block tips (old / new)
        log4(0, 0, 0x62a5229d18b497dceab57b82a66fb912a8139b88c6b7979ad25772dc9d28ddbd,
          blockTip(),
          safeSub(fraudBlockHeight, 1),
          fraudCode)

        // Set new block tip to before fraud block
        sstore(6, safeSub(fraudBlockHeight, 1))

        // Set the penalty, remove mempool submission delay required, free for all..
        setPenalty(penaltyDelay)

        // Transfer Half The Bond for this Block
        transfer(safeDiv(bondSize, 2), 0, caller())

        // stop execution from here
        stop()
      }
    }
  
    function inputOwner(transaction) -> addr {
      let input := selectInput(transaction)

      if eq(Input.type(input), 1) {
        addr := InputDeposit.owner(input)
      }
    }

    function proveDoubleSpend(transactionA, transactionB) {
      // Check for Invalid Transaction Double Spend (Same Input Twice)
      verifyTransactionProof(transactionA, 2)
      verifyTransactionProof(transactionB, 0)

       // Require the inputs are different
      require(neq(inputId(transactionA), inputId(transactionB)),
        0x2f)

      // Metadata reference and input owner
      mstore(0, inputMetadataId(transactionA)) mstore(add(0,32), inputOwner(transactionA))
      let hashA := keccak256(0, 64)

      // Metadata reference and input owner
      mstore(0, inputMetadataId(transactionB)) mstore(add(0,32), inputOwner(transactionB))
      let hashB := keccak256(0, 64)

      // Assert Inputs are Different OR FRAUD Double Spend!
      assertOrFraud(neq(hashA, hashB), 0x30, transactionB)
    }
  
    function constructMerkleTreeRoot(transactions, transactionsLength, fraudBlock) -> merkleTreeRoot {
      // Start Memory Position at Transactions Data
      let memoryPosition := transactions
      let freshMemoryPosition := safeAdd(calldata.offset(), 64)
      let transactionIndex := 0

      for {} lt(memoryPosition, safeAdd(transactions, transactionsLength)) {} {
        let len := safeAdd(mslice(memoryPosition, 2), 2)

        // if transaction length is below minimum transaction length, stop
        assertOrFraud(gt(len, 44),
            0x31, fraudBlock)

        // Assert transaction length is not too long
        assertOrFraud(lt(len, 896),
            0x32, fraudBlock)

        // computed length greater than provided payload
        assertOrFraud(lte(safeSub(memoryPosition, transactions), transactionsLength),
          0x33, fraudBlock)

        // store the base leaf hash (add 2 removed from here..)
        mstore(freshMemoryPosition, keccak256(memoryPosition, len))

        // Increase mem pos
        memoryPosition := safeAdd(memoryPosition, len)

        // increase fresh memory by 32 bytes
        freshMemoryPosition := safeAdd(freshMemoryPosition, 32)

        // Increase Index
        transactionIndex := safeAdd(transactionIndex, 1)

        // Transactions overflow
        assertOrFraud(lt(transactionIndex, 2048),
            0x34, fraudBlock)
      }

      // computed length greater than provided payload
      assertOrFraud(eq(memoryPosition, safeAdd(transactions, transactionsLength)),
          0x33, fraudBlock)

      // Merkleize nodes into a binary merkle tree
      memoryPosition := safeSub(freshMemoryPosition, safeMul(transactionIndex, 32)) // setup new memory position

      // Create Binary Merkle Tree / Master Root Hash
      for {} gt(transactionIndex, 0) {} { // loop through tree Heights (starting at base)
        if gt(mod(transactionIndex, 2), 0) { // fix uneven leaf count (i.e. add a zero hash)
          mstore(safeAdd(memoryPosition, safeMul(transactionIndex, 32)), 0) // add 0x00...000 hash leaf
          transactionIndex := safeAdd(transactionIndex, 1) // increase count for zero hash leaf
          freshMemoryPosition := safeAdd(freshMemoryPosition, 32) // increase fresh memory past new leaf
        }

        for { let i := 0 } lt(i, transactionIndex) { i := safeAdd(i, 2) } { // loop through Leaf hashes at this height
          mstore(freshMemoryPosition, keccak256(safeAdd(memoryPosition, safeMul(i, 32)), 64)) // hash two leafs together
          freshMemoryPosition := safeAdd(freshMemoryPosition, 32) // increase fresh memory past new hash leaf
        }

        memoryPosition := safeSub(freshMemoryPosition, safeMul(transactionIndex, 16)) // set new memory position
        transactionIndex := safeDiv(transactionIndex, 2) // half nodes (i.e. next height)

         // shim 1 to zero (stop), i.e. top height end..
        if lt(transactionIndex, 2) { transactionIndex := 0 }
      }

      // merkle root has been produced
      merkleTreeRoot := mload(memoryPosition)
    }

    function proveMalformedBlock(block, root, rootIndex, transactions, transactionsLength) {
      // Verify the header
      verifyHeader(block,
        root,
        rootIndex,
        0)

      // Require that commitment hash is the hash of the data provided
      require(eq(
          RootHeader.commitmentHash(root),
          keccak256(transactions, transactionsLength)),
              0x35)

      // Assert Root Construction
      assertOrFraud(eq(
          RootHeader.merkleTreeRoot(root),
          constructMerkleTreeRoot(transactions, transactionsLength, block)),
              0x36, block)
    }
  
    function proveMetadata(leaf, proof) {
      let pos := TransactionLeaf.inputs.position(leaf)
      let end := TransactionLeaf.inputs.offset(leaf)
      let metadata := TransactionLeaf.metadata.position(leaf)

      for {} lt(pos, end) {} {
        switch Input.type(pos)

        case 1 {
          assertOrFraud(gt(MetadataDeposit.blockNumber(metadata), 0),
            0x37, proof)

          assertOrFraud(lte(MetadataDeposit.blockNumber(metadata),
            TransactionProof.ethereumBlockNumber(proof)),
            0x38, proof)

          assertOrFraud(gte(MetadataDeposit.token(metadata), 0),
            0x39, proof)

          assertOrFraud(lt(MetadataDeposit.token(metadata),
            TransactionProof.numTokens(proof)),
            0x3a, proof)
        }

        default {
          assertOrFraud(gt(Metadata.blockHeight(metadata), 0),
            0x3b, proof)

          assertOrFraud(lte(Metadata.blockHeight(metadata), TransactionProof.blockHeight(proof)),
            0x3c, proof)

          assertOrFraud(gte(Metadata.rootIndex(metadata), 0),
            0x3d, proof)

          assertOrFraud(lt(Metadata.rootIndex(metadata), 256),
            0x3e, proof)

          assertOrFraud(gte(Metadata.transactionIndex(metadata), 0),
            0x3f, proof)

          assertOrFraud(lt(Metadata.transactionIndex(metadata), 2048),
            0x40, proof)

          assertOrFraud(gte(Metadata.outputIndex(metadata), 0),
            0x41, proof)

          assertOrFraud(lt(Metadata.outputIndex(metadata), 8),
            0x42, proof)

          // Root must always select tx and output index 0, in a previous block
          if eq(Input.type(pos), 3) {
            assertOrFraud(lt(Metadata.blockHeight(metadata), TransactionProof.blockHeight(proof)),
              0x43, proof)

            assertOrFraud(eq(Metadata.transactionIndex(metadata), 0),
              0x44, proof)

            assertOrFraud(eq(Metadata.outputIndex(metadata), 0),
              0x45, proof)
          }
        }

        pos := safeAdd(pos, inputSize(pos))
        metadata := safeAdd(metadata, 8)
      }

      assertOrFraud(eq(metadata, TransactionLeaf.metadata.offset(leaf)),
        0x46, proof)
    }

    function proveWitnesses(leaf, proof) {
      let pos := TransactionLeaf.witnesses.position(leaf)
      let end := TransactionLeaf.witnesses.offset(leaf)
      let index := 0

      for {} lt(pos, end) {} {
        assertOrFraud(lt(Signature.type(pos), 3), 0x24, proof)

        switch Signature.type(pos)

        case 0 {}

        case 1 {
          let stateWitness := witnesses(Caller.owner(pos), Caller.blockNumber(pos))
          assertOrFraud(gt(stateWitness, 0), 0x47, proof)

          assertOrFraud(lt(Caller.blockNumber(pos), TransactionProof.ethereumBlockNumber(proof)),
            0x48, proof)
        }

        case 2 {}

        pos := safeAdd(pos, witnessSize(pos))
        index := safeAdd(index, 1)

        assertOrFraud(lt(index, 8), 0x49, proof)
      }

      assertOrFraud(eq(pos, end), 0x4a, proof)
    }

    function proveSizes(leaf, proof) {
      let metadataSize := TransactionLeaf.metadata.length(leaf)
      let inputsSize := inputsLength(leaf)

      assertOrFraud(eq(metadataSize, inputsSize),
         0x4b, proof)
    }

    function proveOutputValue(pos, proof) {
      let _numTokens := TransactionProof.numTokens(proof)

      assertOrFraud(gt(Output.token.length(pos), 0),
        0x4c, proof)

      assertOrFraud(lte(Output.token.length(pos), 20),
        0x4d, proof)

      assertOrFraud(lt(Output.token.slice(pos), _numTokens),
        0x4e, proof)

      assertOrFraud(gte(Output.amount.shift(pos), 0),
        0x4f, proof)

      assertOrFraud(lt(Output.amount.shift(pos), 256),
        0x50, proof)

      assertOrFraud(gt(Output.amount.length(pos), 0),
        0x51, proof)

      assertOrFraud(lte(Output.amount.length(pos), 32),
        0x52, proof)

      assertOrFraud(eq(mod(Output.amount.shift(pos), 8), 0),
        0x53, proof)

      let amountLen := safeAdd(Output.amount.shift(pos),
        safeMul(Output.amount.length(pos), 8))

      assertOrFraud(lte(amountLen, 256),
        0x52, proof)
    }

    function proveOutputOwner(pos, proof) {
      let _numAddresses := TransactionProof.numAddresses(proof)

      assertOrFraud(gt(Output.owner.length(pos), 0),
        0x54, proof)

      assertOrFraud(lte(Output.owner.length(pos), 20),
        0x55, proof)

      if lt(Output.owner.length(pos), 20) {
        assertOrFraud(lt(Output.owner.slice(pos), _numAddresses),
          0x56, proof)
      }
    }

    function proveOutputReturnOwner(pos, proof) {
      let _numAddresses := TransactionProof.numAddresses(proof)

      assertOrFraud(gt(OutputHTLC.returnOwner.length(pos), 0),
        0x57, proof)

      assertOrFraud(lte(OutputHTLC.returnOwner.length(pos), 20),
        0x58, proof)

      if lt(OutputHTLC.returnOwner.length(pos), 20) {
        assertOrFraud(lt(OutputHTLC.returnOwner.slice(pos), _numAddresses),
          0x59, proof)
      }
    }

    function proveOutputs(leaf, proof) {
      let witnessLength := witnessesLength(leaf)
      let pos := TransactionLeaf.outputs.position(leaf)
      let end := TransactionLeaf.outputs.offset(leaf)
      let index := 0

      for {} lt(pos, end) {} {
        switch Output.type(pos)

        case 0 {
          proveOutputValue(pos, proof)
          proveOutputOwner(pos, proof)
        }

        case 1 {
          proveOutputValue(pos, proof)
          proveOutputOwner(pos, proof)
        }

        case 2 {
          proveOutputValue(pos, proof)
          proveOutputOwner(pos, proof)
          proveOutputReturnOwner(pos, proof)
        }

        case 3 {
          assertOrFraud(gt(OutputReturn.data.length(pos), 0),
            0x5a, proof)

          assertOrFraud(lte(OutputReturn.data.length(pos), 512),
            0x5b, proof)
        }

        default {
          assertOrFraud(0, 0x5c, proof)
        }

        pos := safeAdd(pos, outputSize(pos))
        index := safeAdd(index, 1)

        assertOrFraud(lt(index, 8), 0x5d, proof)
      }

      assertOrFraud(eq(pos, end), 0x5e, proof)
    }

    function proveInputs(leaf, proof) {
      let witnessLength := witnessesLength(leaf)
      let pos := TransactionLeaf.inputs.position(leaf)
      let end := TransactionLeaf.inputs.offset(leaf)
      let index := 0

      for {} lt(pos, end) {} {
        assertOrFraud(gte(Input.type(pos), 0),
           0x5f, proof)
        assertOrFraud(lt(Input.type(pos), 4),
           0x60, proof)

        assertOrFraud(gte(Input.witnessReference(pos), 0),
           0x61, proof)
        assertOrFraud(lt(Input.witnessReference(pos), witnessLength),
          0x62, proof)

        pos := safeAdd(pos, inputSize(pos))
        index := safeAdd(index, 1)
      }

      assertOrFraud(lt(index, 8), 0x63, proof)
      assertOrFraud(eq(pos, end), 0x64, proof)
    }

    function proveInvalidTransaction(proof) {
      verifyTransactionProof(proof, 0x00)

      let leaf := TransactionProof.transaction.position(proof)
      let size := TransactionLeaf.metadata.length(leaf)

      assertOrFraud(gt(size, 0), 0x65, proof)
      assertOrFraud(lte(size, 8), 0x46, proof)

      size := TransactionLeaf.witnesses.length(leaf)

      assertOrFraud(gt(size, 0), 0x66, proof)
      assertOrFraud(lte(size, 896), 0x4a, proof)

      size := TransactionLeaf.inputs.length(leaf)

      assertOrFraud(gte(size, 2), 0x67, proof)
      assertOrFraud(lte(size, 896), 0x68, proof)

      size := TransactionLeaf.outputs.length(leaf)

      assertOrFraud(gte(size, 3), 0x69, proof)
      assertOrFraud(lte(size, 896), 0x6a, proof)

      size := TransactionLeaf.size(leaf)

      assertOrFraud(gt(size, 44), 0x6b, proof)
      assertOrFraud(lte(size, 896), 0x6c, proof)
      assertOrFraud(eq(size, safeAdd(TransactionLeaf.length(leaf), 2)), 0x6d, proof)

      proveWitnesses(leaf, proof)
      proveInputs(leaf, proof)
      proveOutputs(leaf, proof)
      proveSizes(leaf, proof)
      proveMetadata(leaf, proof)
    }
  
    // const FunnelContract0 := 0x605a600d600039605a6000f3fe60006020603a82393381511415602b57608036
    // const FunnelContract1 := 0x14156028573681823780816044603c8485515af1505b33ff5b50000000000000

    
    
    

    function createFunnel(recipient) -> addr {
      addr := calculateFunnelAddress(recipient)

      if eq(extcodesize(addr), 0) {
        mstore(0, 0x604d600d600039604d6000f3fe60006020602d82393381511415602b57608036) mstore(add(0,32), 0x14156028573681823780816044603c8485515af1505b33ff5b50000000000000)
        mstore(58, address())
        mstore(90, recipient)
        addr := create2(0, 0, 122, 0xa46ff7e2eb85eecf4646f2c151221bcd9c079a3dcb63cb87962413cfaae53947)
      }
    }

    function calculateFunnelAddress(recipient) -> addr {
      mstore(0, 0x604d600d600039604d6000f3fe60006020602d82393381511415602b57608036) mstore(add(0,32), 0x14156028573681823780816044603c8485515af1505b33ff5b50000000000000)
      mstore(58, address())
      mstore(90, recipient)

      mstore(53, keccak256(0, 122))
      mstore8(0, 0xff)
      mstore(1, shl(96, address()))
      mstore(21, 0xa46ff7e2eb85eecf4646f2c151221bcd9c079a3dcb63cb87962413cfaae53947)

      addr := shr(96, shl(96, keccak256(0, 85)))
    }
  
    

    function deposits(account, token, blockNumber) -> amount {
      amount := sload(mappingKey3(4, account, token, blockNumber))
    }

    function deposit(account, token) {
      // Num tokens
      let _tokenId := commitToken(token)

      // build create2 funnel
      let funnel := createFunnel(account)

      // Variables
      let amount := 0

      // handle different tokens
      switch token

      // If Ether
      case 0 {
          amount := balance(funnel)
          require(gt(amount, 0), 0x6e)
          require(call(gas(), funnel, 0, 0, 0, 0, 0), 0x6f)
          require(eq(balance(funnel), 0), 0x70)
      }

      // If ERC20
      default {
        require(or(iszero(balance(funnel)), eq(token, 0)), 0x71)

        mstore(0, 0x70a08231) mstore(add(0,32), funnel)
        require(call(gas(), token, 0, 28, 36, 0, 32), 0x72)
        amount := mload(0)
        require(gt(amount, 0), 0x73)

        mstore(0, token) mstore(add(0,32), 0xa9059cbb) mstore(add(0,64), address()) mstore(add(0,96), amount)
        require(call(gas(), funnel, 0, 0, 128, 0, 0), 0x74)

        mstore(0, 0x70a08231) mstore(add(0,32), funnel)
        require(call(gas(), token, 0, 28, 36, 0, 32), 0x72)
        require(iszero(mload(0)), 0x75)
      }

      // Load current balance from storage
      let balanceAmount := deposits(account, _tokenId, number())
      sstore(mappingKey3(4, account, _tokenId, number()), safeAdd(balanceAmount, amount))

      mstore(0, amount)
      log3(0, mul32(1),
        0x1de3ece35391f6bba650736f2d5d3f12e2cfc54538a340cc5d762d34ca449de7,
        account,
        token)
    }
  
    function proveInvalidInput(proof, transaction) {
      verifyTransactionProof(transaction, 0)
      let input := selectInput(transaction)
      let inputMetadata := selectMetadata(transaction, TransactionProof.input(transaction))

      // Handle Deposit Input
      if eq(Input.type(input), 1) {
        let depositAmount := deposits(InputDeposit.owner(input),
          MetadataDeposit.token(inputMetadata),
          MetadataDeposit.blockNumber(inputMetadata))

        assertOrFraud(gt(depositAmount, 0), 0x76,
          transaction)

        stop()
      }

      // verify the proof
      verifyHeader(TransactionProof.block(proof),
          TransactionProof.root(proof),
          TransactionProof.rootIndex(proof),
          2)

      require(eq(Metadata.blockHeight(inputMetadata),
        TransactionProof.blockHeight(proof)), 0x77)

      assertOrFraud(lt(Metadata.rootIndex(inputMetadata),
        TransactionProof.roots.length(proof)), 0x78, transaction)

      require(eq(Metadata.rootIndex(inputMetadata),
        TransactionProof.rootIndex(proof)), 0x79)

      // Handle Root Spend
      if eq(Input.type(input), 3) {
        stop()
      }


      // Transaction index
      if eq(verifyMerkleProof(proof), 0x00) {
        assertOrFraud(lte(Metadata.transactionIndex(inputMetadata),
          TransactionProof.transactionIndex(proof)), 0x7a,
          transaction)
      }

      require(eq(Metadata.transactionIndex(inputMetadata),
        TransactionProof.transactionIndex(proof)), 0x7b)

      assertOrFraud(gt(TransactionProof.transaction.length(proof), 0),
        0x27, transaction)

      // Output
      let output := selectOutput(proof)

      // Output Index
      assertOrFraud(lt(Metadata.outputIndex(inputMetadata),
        TransactionProof.outputs.length(proof)), 0x7c,
        transaction)

      require(eq(Metadata.outputIndex(inputMetadata),
        TransactionProof.output(proof)), 0x7d)


      // Output Types
      assertOrFraud(neq(Output.type(output), 1),
        0x7e, transaction)

      assertOrFraud(neq(Output.type(output), 3),
        0x7f, transaction)


      // Input Checks
      switch Input.type(input)

      case 0 {
        assertOrFraud(eq(Output.type(output), 0),
          0x80, transaction)
      }

      case 2 {
        assertOrFraud(eq(Output.type(output), 2),
          0x81, transaction)

        if lt(TransactionProof.blockHeight(transaction),
          OutputHTLC.expiry(output)) {
          assertOrFraud(eq(OutputHTLC.digest(output),
            InputHTLC.preImage.keccak256(input)), 0x82, transaction)
        }
      }
    }
  
    function verifyInputs(transaction, inputs) {
      verifyTransactionProof(transaction, 0)

      let leaf := TransactionProof.transaction.position(transaction)
      let pos := TransactionLeaf.inputs.position(leaf)
      let index := 0

      for {} lt(pos, TransactionLeaf.inputs.offset(leaf)) {} {
        switch Input.type(pos)

        case 0 {
          verifyTransactionProof(inputs, 2)

          require(eq(outputId(inputs), TransactionLeaf.metadata(leaf, index)),
            0x83)

          require(eq(TransactionProof.UTXO.keccak256(inputs),
            TransactionProof.data(transaction, index)), 0x84)

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        case 1 {
          let metadata := selectMetadata(transaction, index)

          require(eq(Deposit.token(inputs), MetadataDeposit.token(metadata)),
            0x85)

          require(eq(Deposit.blockNumber(inputs), MetadataDeposit.blockNumber(metadata)),
            0x86)

          require(eq(Deposit.keccak256(inputs),
            TransactionProof.data(transaction, index)), 0x87)

          inputs := safeAdd(inputs, Deposit.size(inputs))
        }

        case 3 {
          verifyTransactionProof(inputs, 2)

          require(eq(RootHeader.keccak256(TransactionProof.rootProducer.position(inputs)),
            TransactionProof.data(transaction, index)), 0x88)

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        case 2 {
          verifyTransactionProof(inputs, 2)

          require(eq(outputId(inputs), TransactionLeaf.metadata(leaf, index)),
            0x83)

          require(eq(TransactionProof.UTXO.keccak256(inputs),
            TransactionProof.data(transaction, index)), 0x84)

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        index := safeAdd(index, 1)
        pos := safeAdd(pos, inputSize(pos))
      }
    }
  
    function proveWitness(transaction, inputs) {
      let leaf := TransactionProof.transaction.position(transaction)
      let pos := TransactionLeaf.inputs.position(leaf)
      let index := 0

      for {} lt(pos, TransactionLeaf.inputs.offset(leaf)) {} {
        switch Input.type(pos)

        case 0 {
          if eq(index, TransactionProof.input(transaction)) {
            assertOrFraud(ownerEquates(selectOutput(inputs),
              TransactionProof.input.recoverWitness(transaction)), 0x89, transaction)
          }

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        case 1 {
          if eq(index, TransactionProof.input(transaction)) {
            assertOrFraud(eq(Deposit.owner(inputs),
              TransactionProof.input.recoverWitness(transaction)),
              0x8a, transaction)
          }

          inputs := safeAdd(inputs, Deposit.size(inputs))
        }

        case 3 {
          if eq(index, TransactionProof.input(transaction)) {
            assertOrFraud(eq(TransactionProof.blockProducer(inputs),
              TransactionProof.input.recoverWitness(transaction)), 0x8b, transaction)
          }

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        case 2 {
          if eq(index, TransactionProof.input(transaction)) {
            switch outputExpired(inputs, transaction)

            case 1 {
              assertOrFraud(ownerReturnEquates(selectOutput(inputs),
                TransactionProof.input.recoverWitness(transaction)),
                0x8c, transaction)
            }

            case 0 {
              assertOrFraud(ownerEquates(selectOutput(inputs),
                TransactionProof.input.recoverWitness(transaction)),
                0x8d, transaction)
            }
          }

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        if eq(index, TransactionProof.input(transaction)) {
          assertOrFraud(neq(TransactionProof.input.recoverWitness(transaction), 0),
            0x8e, transaction)
        }

        index := safeAdd(index, 1)
        pos := safeAdd(pos, inputSize(pos))
      }
    }

    function proveInvalidWitness(transaction, inputs) {
      verifyInputs(transaction, inputs)
      proveWitness(transaction, inputs)
    }
  
    

    function withdrawals(blockNumber, withdrawalHashId) -> result {
      result := sload(mappingKey2(5, blockNumber, withdrawalHashId))
    }

    function withdraw(transaction) {
      // Verify transaction proof
      verifyTransactionProof(transaction, 1)

      // Select the Output
      let output := selectOutput(transaction)

      // withdrawal Token
      let token := TransactionProof.token(transaction)
      let owner := caller()

      // check owner
      require(ownerEquates(output, owner), 0x8f)

      // check token id
      require(eq(Output.token.slice(output), tokenId(token)),
        0x90)

      // Check Proof Type is Correct
      require(eq(Output.type(output), 1),
          0x91)

      // Get transaction details
      let transactionLeafHash := TransactionProof.transaction.keccak256(transaction)
      let outputIndex := TransactionProof.output(transaction)
      let blockHeight := TransactionProof.blockHeight(transaction)

      // Construct withdrawal hash id
      mstore(0, TransactionProof.rootIndex(transaction)) mstore(add(0,32), transactionLeafHash) mstore(add(0,64), outputIndex)
      let withdrawalHashId := WithdrawalProof.keccak256(0)

      // This output has not been withdrawn yet!
      require(eq(withdrawals(blockHeight, withdrawalHashId), 0x00),
        0x92)

      // Transfer amount out
      transfer(outputAmount(output), token, owner)

      // Set withdrawals
      sstore(mappingKey2(5, blockHeight, withdrawalHashId), 0x01)

      // Construct Log Data for withdrawal
      mstore(0,
        token) mstore(add(0,32),
        outputAmount(output)) mstore(add(0,64),
        TransactionProof.rootIndex(transaction)) mstore(add(0,96),
        outputIndex) mstore(add(0,128),
        transactionHashId(transaction))
      log4(0, mul32(5),
        0x782748bc04673eff1ae34a02239afa5a53a83abdfa31d65d7eea2684c4b31fe4,
        owner,
        blockHeight,
        transactionLeafHash)
    }

    function bondWithdraw(blockHeader) {
      // Setup block producer withdrawal hash ID (i.e. Zero)
      let withdrawalHashId := 0

      // block height
      let blockHeight := BlockHeader.height(blockHeader)

      // Verify block header proof is finalized!
      verifyHeader(blockHeader, 0, 0, 1)

      // Assert Caller is Block Producer
      require(eq(BlockHeader.producer(blockHeader), caller()),
          0x0e)

      // Assert Block Bond withdrawal has not been Made!
      require(eq(withdrawals(blockHeight, withdrawalHashId), 0x00),
          0x93)

      // Bond size
      Constructor.copy(0)
      let bondSize := Constructor.bondSize(0)

      // Transfer Bond Amount back to Block Producer
      transfer(bondSize, 0, caller())

      // Set withdrawal
      sstore(mappingKey2(5, blockHeight, withdrawalHashId), 0x01)

      // Log withdrawal data and topics
      mstore(0, 0) mstore(add(0,32), bondSize) mstore(add(0,64), 0) mstore(add(0,96), 0) mstore(add(0,128), 0)
      log4(0, mul32(5),
        0x782748bc04673eff1ae34a02239afa5a53a83abdfa31d65d7eea2684c4b31fe4,
        caller(),
        blockHeight,
        0)
    }
  
    function verifyData(transaction, inputs) {
      let pos := TransactionLeaf.inputs.position(TransactionProof.transaction.position(transaction))
      let index := 0

      for {} lt(pos, TransactionLeaf.inputs.offset(TransactionProof.transaction.position(transaction))) {} {
        switch Input.type(pos)

        case 0 {
          require(eq(TransactionProof.data(transaction, index), UTXO.keccak256(inputs)),
            0x94)

          inputs := safeAdd(inputs, UTXO.size(inputs))
        }

        case 1 {
          require(eq(TransactionProof.data(transaction, index), Deposit.keccak256(inputs)),
            0x95)

          inputs := safeAdd(inputs, Deposit.size(inputs))
        }

        case 2 {
          require(eq(TransactionProof.data(transaction, index), UTXO.keccak256(inputs)),
            0x94)

          inputs := safeAdd(inputs, UTXO.size(inputs))
        }

        case 3 {
          require(eq(TransactionProof.data(transaction, index), RootHeader.keccak256(inputs)),
            0x94)

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        default { require(0, 0x96) }

        pos := safeAdd(pos, inputSize(pos))
        index := safeAdd(index, 1)
      }
    }
  
    function verifyWitness(transaction, inputs) {
      let witness := TransactionProof.witness(transaction, 0)
      let leaf := TransactionProof.transaction.position(transaction)
      let input := TransactionLeaf.inputs.position(leaf)

      switch Signature.type(witness)

      case 0 {
        switch Input.type(input)

        case 1 {
          require(eq(
            ecrecover(transactionHashId(transaction), witness),
            Deposit.owner(inputs)
          ), 0x97)
        }

        case 3 {
          require(eq(
            ecrecover(transactionHashId(transaction), witness),
            TransactionProof.blockProducer(inputs)
          ), 0x97)
        }

        default {
          require(eq(
            ecrecover(transactionHashId(transaction), witness),
            UTXO.owner(inputs)
          ), 0x97)
        }
      }

      case 1 {
        require(eq(
          witnesses(Caller.owner(witness), Caller.blockNumber(witness)),
          transactionHashId(transaction)
        ), 0x98)
      }

      case 2 {
        require(eq(Producer.hash(witness), transactionHashId(transaction)),
          0x99)
      }

      default { require(0, 0x24) }
    }
  
    function ins(proof, inputs) -> sum {
      let pos := TransactionLeaf.inputs.position(TransactionProof.transaction.position(proof))
      let token := tokenId(TransactionProof.token(proof))

      for {} lt(pos, TransactionLeaf.inputs.offset(TransactionProof.transaction.position(proof))) {} {
        switch Input.type(pos)

        case 0 {
          if eq(token, UTXO.token(inputs)) {
            sum := safeAdd(sum, UTXO.amount(inputs))
          }

          inputs := safeAdd(inputs, UTXO.size(inputs))
        }

        case 1 {
          if eq(token, Deposit.token(inputs)) {
            sum := safeAdd(sum, Deposit.value(inputs))
          }

          inputs := safeAdd(inputs, Deposit.size(inputs))
        }

        case 2 {
          if eq(token, UTXO.token(inputs)) {
            sum := safeAdd(sum, UTXO.amount(inputs))
          }

          inputs := safeAdd(inputs, UTXO.size(inputs))
        }

        case 3 {
          if eq(token, TransactionProof.feeToken(inputs)) {
            sum := safeAdd(sum, safeMul(TransactionProof.fee(inputs), TransactionProof.rootLength(inputs)))
          }

          inputs := safeAdd(inputs, TransactionProof.size(inputs))
        }

        default { require(0, 0x96) }

        pos := safeAdd(pos, inputSize(pos))
      }
    }

    function outs(token, proof) -> sum {
      let leaf := TransactionProof.transaction.position(proof)
      let pos := TransactionLeaf.outputs.position(leaf)
      let end := TransactionLeaf.outputs.offset(leaf)

      for {} lt(pos, end) {} {
        if and(
          lt(Output.type(pos), 3),
          eq(token, Output.token.slice(pos))
        ) {
          sum := safeAdd(sum, outputAmount(pos))
        }

        pos := safeAdd(pos, outputSize(pos))
      }
    }

    function proveSum(proof, inputs) {
      let token := tokenId(TransactionProof.token(proof))
      let outsum := safeAdd(rootFee(proof, token), outs(token, proof))
      let insum := ins(proof, inputs)

      assertOrFraud(eq(outsum, insum), 0x9a, proof)
    }

    function proveInvalidSum(proof, inputs) {
      verifyTransactionProof(proof, 0x00)
      verifyWitness(proof, inputs)
      verifyData(proof, inputs)
      proveSum(proof, inputs)
    }
  
      calldata.copy()

      switch calldata.signature()

      case 0xf9609f08 {
        deposit(calldata.word(0), calldata.word(1))
      }

      case 0xb4cb0fbc {
        commitRoot(calldata.word(0),
          keccak256(abi.offset(calldata.word(3)), abi.length(calldata.word(3))),
          abi.length(calldata.word(3)),
          calldata.word(1),
          calldata.word(2))
      }

      case 0xe23b1915 {
        commitBlock(
          calldata.word(0),
          calldata.word(1),
          abi.length(calldata.word(2)),
          abi.offset(calldata.word(2))
        )
      }

      case 0xcc4c0b4b {
        commitWitness(calldata.word(0))
      }

      case 0xdd1d9bc3 {
        return.word(commitAddress(calldata.word(0)))
      }

      case 0x679a178f {
        let block := abi.offset(calldata.word(0))
        let root := abi.offset(calldata.word(1))
        let rootIndex := calldata.word(2)
        let transactions := abi.offset(calldata.word(3))
        let transactionsLength := abi.length(calldata.word(3))

        proveMalformedBlock(block, root, rootIndex, transactions, transactionsLength)
      }

      case 0x6f2ba873 {
        proveInvalidTransaction(abi.offset(calldata.word(0)))
      }

      case 0xa86735c3 {
        let transactionA := abi.offset(calldata.word(0))
        let transactionB := abi.offset(calldata.word(1))

        proveInvalidInput(transactionA, transactionB)
      }

      case 0xbe4be780 {
        let transactionA := abi.offset(calldata.word(0))
        let transactionB := abi.offset(calldata.word(1))

        proveDoubleSpend(transactionA, transactionB)
      }

      case 0x67df9aa7 {
        proveInvalidWitness(abi.offset(calldata.word(0)), abi.offset(calldata.word(1)))
      }

      case 0x84e9520c {
        proveInvalidSum(abi.offset(calldata.word(0)), abi.offset(calldata.word(1)))
      }

      case 0x0968f264 {
        withdraw(abi.offset(calldata.word(0)))
      }

      case 0xdfefa73e {
        bondWithdraw(abi.offset(calldata.word(0)))
      }

      case 0x98d5d455 {
        return.word(witnesses(calldata.word(0),
          calldata.word(1)))
      }

      case 0xf0e7574e {
        return.word(calculateFunnelAddress(calldata.word(0)))
      }

      case 0x891f4f2f {
        verifyHeader(
          abi.offset(calldata.word(0)),
          abi.offset(calldata.word(1)),
          calldata.word(2),
          calldata.word(3)
        )
        return.word(0x01)
      }

      case 0x35b9dd37 {
        verifyTransactionProof(
          abi.offset(calldata.word(0)),
          calldata.word(1)
        )
        return.word(0x01)
      }

      /*
      case sig"verifyMetadata(bytes8 metadata, bytes proof) external view returns (bool)" {
        let verified := verifyMetadata(
          add(_calldata, 28), // _calldata + 4 + 24
          abi.offset(calldata.word(1))
        )
        return.word(verified)
      }
      */

      case 0x43b3af1e {
        TransactionProof.UTXO.assign(abi.offset(calldata.word(0)), 0)
        return (0, UTXO.size(0))
      }

      case 0x150bf039 {
        let pos := selectOutput(abi.offset(calldata.word(0)))
        mstore(safeSub(pos, 64), 32)
        mstore(safeSub(pos, 32), outputSize(pos))
        return (pos, round32(outputSize(pos)))
      }

      case 0xd15fe100 {
        let id := outputId(abi.offset(calldata.word(0)))
        return.word(id)
      }

      case 0x96e17b9c {
        let id := inputId(abi.offset(calldata.word(0)))
        return.word(id)
      }

      case 0x8de8f611 {
        let pos := selectMetadata(abi.offset(calldata.word(0)), calldata.word(1))
        return.word(mslice(pos, 8))
      }

      case 0xbe8ca8dd {
        Constructor.copy(0)
        return(Constructor.blockProducer.position(0), 32)
      }

      case 0xeba953cb {
        return.word(blockTip())
      }

      case 0x8e499bcf {
        return.word(numTokens())
      }

      case 0xe4860339 {
        return.word(tokenId(calldata.word(0)))
      }

      case 0x2f8646d6 {
        return.word(numAddresses())
      }

      case 0x82d38954 {
        return.word(addresses(calldata.word(0)))
      }

      case 0x97b45536 {
        return.word(deposits(
          calldata.word(0),
          calldata.word(1),
          calldata.word(2)
        ))
      }

      case 0x363f8c3b {
        return.word(blockCommitments(calldata.word(0)))
      }

      case 0x937c2f74 {
        return.word(roots(calldata.word(0)))
      }

      case 0x2f4cea60 {
        return.word(withdrawals(calldata.word(0), calldata.word(1)))
      }

      case 0x23eda127 {
        Constructor.copy(0)
        return(Constructor.bondSize.position(0), 32)
      }

      case 0x16e2bcd5 {
        return.word(57600)
      }

      case 0xb29a9069 {
        Constructor.copy(0)
        return(Constructor.submissionDelay.position(0), 32)
      }

      case 0x88dd56ec {
        Constructor.copy(0)
        return(Constructor.finalizationDelay.position(0), 32)
      }

      case 0x8d683c50 {
        Constructor.copy(0)
        return(Constructor.penaltyDelay.position(0), 32)
      }

      case 0x0edd2ffc {
        return.word(getPenalty())
      }

      case 0x06fdde03 {
        Constructor.copy(0)
        Constructor.name.copy(0, 0)
        return(0, 96)
      }

      case 0x54fd4d50 {
        Constructor.copy(0)
        Constructor.version.copy(0, 0)
        return(0, 96)
      }

      default {
        require(0, 0x9b)
      }

      // Ensure Execution Stop
      stop()
    }
  }
}