// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
interface IReceiver {function receiveRandomness(uint256,uint256) external;}
contract MockSMZF is ERC20 {constructor() ERC20("Mock SMZF","SMZF"){} function mint(address a,uint256 n) external {_mint(a,n);}}
// Tests locaux uniquement : ne pas utiliser pour un vrai tirage.
contract MockRandom {uint256 public id;address public target;function request() external returns(uint256){target=msg.sender;return ++id;}function fulfill(uint256 word) external {IReceiver(target).receiveRandomness(id,word);}}
contract MockCoordinator {
 struct Request {bytes32 keyHash;uint256 subId;uint16 requestConfirmations;uint32 callbackGasLimit;uint32 numWords;bytes extraArgs;}
 uint256 public id;address public consumer;
 function requestRandomWords(Request calldata r) external returns(uint256){require(r.numWords==1&&r.requestConfirmations==3,"args");consumer=msg.sender;return ++id;}
 function fulfill(uint256 word) external {uint256[] memory w=new uint256[](1);w[0]=word;(bool ok,)=consumer.call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])",id,w));require(ok,"callback");}
}
