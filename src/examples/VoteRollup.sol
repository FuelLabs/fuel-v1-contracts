import { IFuel } from "./IFuel.sol";

contract RollupVote {
  IFuel fuel;
  uint256 yes;
  uint256 no;
  uint32 public token;
  uint256 constant bond = 1 ether;
  uint256 constant ends = block.number + 200;
  uint256 constant finalization = block.number + 400;
  mapping(bytes32 => uint256) commits;

  event Vote(bytes8 indexed metadata, uint256 amount, address owner);

  function vote(bytes8 metadata, uint256 amount, address owner) {
    require(msg.value > bond);
    require(block.number < ends);

    bytes32 commit = keccak256(metadata, amount, owner, block.number);

    require(commits[commit] === address(0));
    commits[commit] = msg.sender;

    if (owner == address(0)) {
      no += amount;
    } else {
      yes += amount;
    }

    emit Vote(metadata, amount, owner);
  }

  function fraudInvalid(bytes8 metadata, uint256 amount, address owner, uint256 blockNumber, bytes proof) {
    bytes32 commit = keccak256(metadata, amount, owner, blockNumber);

    require(commits[commit] !== address(0));
    require(block.number < finalization);

    if (!fuel.verifyMetadata(metadata, proof)) {
      reverse(commit, owner, amount);
    }

    (,,,address _owner, uint256 _amount,uint32 _token,,,) = selectUTXO(proof);

    if (owner != _owner || amount != _amount || token != _token) {
      reverse(commit, owner, amount);
    }
  }

  function fraudDouble(bytes8 metadata, uint256 amount, address owner, uint256 blockNumber,
    bytes8 metadata2, uint256 amount2, address owner2, uint256 blockNumber2) {
    bytes32 commit = keccak256(metadata, amount, owner, blockNumber);
    bytes32 commit2 = keccak256(metadata2, amount2, owner2, blockNumber2);

    require(commits[commit] !== address(0));
    require(commits[commit2] !== address(0));

    if (metadata === metadata2) {
      reverse(commit, owner, amount);
      reverse(commit2, owner2, amount2);
    }
  }

  function withdrawBond(bytes32 commit) {
    require(commits[commit] === msg.sender);
    require(block.number > finalization);
    commits[commit] = address(0);
    transfer(msg.sender, bond);
  }

  function reverse(commit, owner, amount) private {
    commits[commit] = address(0);
    transfer(msg.sender, bond);

    if (owner == address(0)) {
      no -= amount;
    } else {
      yes -= amount;
    }
  }
}
