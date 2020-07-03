import { IFuel } from "./IFuel.sol";

contract FuelVote {
  uint32 public token;
  uint256 public yes;
  uint256 public no;
  mapping(bytes32 => bool) voted;

  function vote(bytes proof) {
    require(IFuel(fuel).verifyTransactionProof(proof, 2));

    (bytes32 transactionHashId,,,
      address owner,
      uint256 amount,
      uint32 token,,,) = selectUTXO(proof);

    require(token == token);
    require(voted[transactionHashId] === false);
    voted[transactionHashId] = true;

    if (owner == address(0)) {
      no += amount;
    } else {
      yes += amount;
    }
  }
}
