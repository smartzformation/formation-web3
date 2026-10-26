// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
interface IVRFCoordinator {
 struct Request { bytes32 keyHash; uint256 subId; uint16 requestConfirmations; uint32 callbackGasLimit; uint32 numWords; bytes extraArgs; }
 function requestRandomWords(Request calldata req) external returns(uint256);
}
interface IRandomReceiver { function receiveRandomness(uint256 id,uint256 word) external; }
/// @notice Adaptateur Chainlink VRF v2.5 minimal, immuable, sans migration.
/// @dev Abonnement en LINK requis. Ajouter cet adaptateur comme consumer VRF.
contract RandomProvider {
 address public immutable coordinator; address public immutable admin; uint256 public immutable subscription; bytes32 public immutable keyHash; address public workshop;
 mapping(uint256=>bool) public requested; mapping(uint256=>bool) public fulfilled;
 event Requested(uint256 indexed id);
 constructor(address c,uint256 sub,bytes32 lane) {require(c.code.length>0,"Coordinateur invalide");coordinator=c;admin=msg.sender;subscription=sub;keyHash=lane;}
 function bind(address target) external {require(msg.sender==admin&&workshop==address(0)&&target.code.length>0,"Liaison interdite");workshop=target;}
 function request() external returns(uint256 id) {
 require(msg.sender==workshop,"Atelier uniquement");
 id=IVRFCoordinator(coordinator).requestRandomWords(IVRFCoordinator.Request(keyHash,subscription,3,200000,1,abi.encodeWithSelector(bytes4(keccak256("VRF ExtraArgsV1")),false)));
 requested[id]=true;emit Requested(id);
 }
 function rawFulfillRandomWords(uint256 id,uint256[] calldata words) external {
 require(msg.sender==coordinator,"Coordinateur uniquement");if(!requested[id]||fulfilled[id]||words.length==0)return;
 fulfilled[id]=true;IRandomReceiver(workshop).receiveRandomness(id,words[0]);
 }
}
