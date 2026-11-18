// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ClansPolarDaoV2 as Dao} from "../contracts/ClansPolarDaoV2.sol";

contract TestSMZF is ERC20 {
    constructor() ERC20("Test SMZF", "TEST") {}
    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }
}

contract Player {
    function act(address target, bytes calldata data) external returns (bytes memory result) {
        bool ok;
        (ok, result) = target.call(data);
        require(ok, "Action joueur attendue");
    }

    function rejects(address target, bytes calldata data, bytes4 reason) external {
        (bool ok, bytes memory result) = target.call(data);
        require(!ok && bytes4(result) == reason, "Rejet joueur attendu");
    }
}

contract Scenarios {
    constructor() {
        TestSMZF smzf = new TestSMZF();
        Dao dao = new Dao(address(this), smzf, 100 ether);
        Player alice = new Player();
        Player bob = new Player();
        Player carol = new Player();
        Player outsider = new Player();
        address[] memory roster = new address[](3);
        roster[0] = address(alice);
        roster[1] = address(bob);
        roster[2] = address(bob);
        rejects(dao, abi.encodeCall(dao.openSession, (roster)), Dao.InvalidPlayer.selector);
        require(dao.session() == 0, "Ouverture atomique");
        roster[2] = address(carol);
        dao.openSession(roster);
        require(dao.polarVote().balanceOf(address(this)) == 20, "Reserve initiale");
        for (uint256 i; i < roster.length; ++i) {
            require(dao.polarVote().balanceOf(roster[i]) == 0, "Aucune dotation a l inscription");
        }

        rewardWinners(dao, roster, outsider);

        bytes memory submit = abi.encodeCall(dao.submitIdea, ("", Dao.Action.WeightedMode));
        outsider.rejects(address(dao), submit, Dao.InvalidPlayer.selector);
        uint256 id = abi.decode(alice.act(address(dao), submit), (uint256));
        bytes memory support = abi.encodeCall(dao.supportIdea, (id));
        alice.rejects(address(dao), support, Dao.InvalidIdea.selector);
        alice.act(address(dao.polarVote()), abi.encodeCall(dao.polarVote().transfer, (address(outsider), 1)));
        carol.act(address(dao.polarVote()), abi.encodeCall(dao.polarVote().transfer, (address(bob), 1)));
        carol.act(address(dao), support);
        carol.rejects(address(dao), support, Dao.InvalidIdea.selector);
        bob.act(address(dao), support);
        require(!dao.isQualified(id), "Proposant sans jeton");
        outsider.act(address(dao.polarVote()), abi.encodeCall(dao.polarVote().transfer, (address(alice), 1)));
        require(dao.isQualified(id), "Qualification apres transfert");

        uint64 deadline = uint64(block.timestamp + 60);
        bytes memory open = abi.encodeCall(dao.openBallot, (id, deadline));
        bob.rejects(address(dao), open, Dao.TrainerOnly.selector);
        rejects(dao, open, Dao.InvalidVote.selector);
        bob.act(address(dao.polarVote()), abi.encodeCall(dao.polarVote().transfer, (address(carol), 1)));
        smzf.mint(address(carol), 200 ether);
        carol.act(address(smzf), abi.encodeCall(smzf.approve, (address(dao), 200 ether)));
        bytes memory buy = abi.encodeCall(dao.buyPolarVote, ());
        carol.rejects(address(dao), buy, Dao.InvalidPayment.selector);
        dao.enablePurchases();
        carol.act(address(dao), buy);
        carol.act(address(dao), buy);
        require(smzf.balanceOf(address(this)) == 200 ether, "Paiement SMZF");

        dao.openBallot(id, deadline);
        require(dao.snapshotWeight(id, address(carol)) == 3, "Poids initial");
        carol.act(address(dao.polarVote()), abi.encodeCall(dao.polarVote().transfer, (address(outsider), 3)));
        outsider.rejects(address(dao), abi.encodeCall(dao.castVote, (id, true)), Dao.InvalidVote.selector);
        vote(dao, alice, id, true);
        alice.rejects(address(dao), abi.encodeCall(dao.castVote, (id, true)), Dao.InvalidVote.selector);
        vote(dao, bob, id, true);
        vote(dao, carol, id, false);
        dao.closeBallot();
        checkComparison(dao, id);
        bytes memory applyDecision = abi.encodeCall(dao.recordApplication, (id, true));
        alice.rejects(address(dao), applyDecision, Dao.TrainerOnly.selector);
        dao.recordApplication(id, false);
        require(dao.officialMode() == Dao.Mode.Equal, "Decision differee");
        dao.recordApplication(id, true);
        require(dao.officialMode() == Dao.Mode.Weighted, "Mode futur POL-007");
        require(dao.officialResult(id) == Dao.Result.Adopted, "Mode historique fige");

        outsider.act(address(dao.polarVote()), abi.encodeCall(dao.polarVote().transfer, (address(carol), 1)));
        uint256 next = abi.decode(alice.act(address(dao),
            abi.encodeCall(dao.submitIdea, ("Regle suivante", Dao.Action.Advisory))), (uint256));
        bob.act(address(dao), abi.encodeCall(dao.supportIdea, (next)));
        carol.act(address(dao), abi.encodeCall(dao.supportIdea, (next)));
        dao.openBallot(next, deadline);
        rejects(dao, abi.encodeCall(dao.closeSession, ()), Dao.InvalidState.selector);
        vote(dao, alice, next, true);
        vote(dao, bob, next, true);
        dao.closeBallot();
        require(dao.officialResult(next) == Dao.Result.NoQuorum, "Quorum de personnes");
        dao.closeSession();
        require(dao.polarVote().balanceOf(address(this)) == 20, "Rappel complet");
        require(dao.officialMode() == Dao.Mode.Equal && !dao.purchasesEnabled(), "Parametres reinitialises");
        roster[2] = address(outsider);
        dao.openSession(roster);
        require(dao.polarVote().balanceOf(roster[0]) == 0, "Aucune dotation au changement de groupe");
        dao.rewardWinner(bytes32(uint256(1)), roster[0]);
        require(!dao.registered(dao.session(), address(carol)), "Isolation entre groupes");
        require(dao.officialResult(id) == Dao.Result.Adopted, "Historique conserve");
        checkComparison(dao, id);
    }

    function rewardWinners(Dao dao, address[] memory roster, Player outsider) private {
        bytes32 round = bytes32(uint256(1));
        bytes memory reward = abi.encodeCall(dao.rewardWinner, (round, roster[0]));
        outsider.rejects(address(dao), reward, Dao.TrainerOnly.selector);
        rejects(dao, abi.encodeCall(dao.rewardWinner, (round, address(outsider))), Dao.InvalidPlayer.selector);
        dao.rewardWinner(round, roster[0]);
        rejects(dao, reward, Dao.InvalidRound.selector);
        dao.rewardWinner(bytes32(uint256(2)), roster[1]);
        dao.rewardWinner(bytes32(uint256(3)), roster[2]);
        require(dao.polarVote().balanceOf(roster[0]) == 1, "Recompense du gagnant");
    }

    function rejects(Dao dao, bytes memory data, bytes4 reason) private {
        (bool ok, bytes memory result) = address(dao).call(data);
        require(!ok && bytes4(result) == reason, "Rejet formateur attendu");
    }

    function vote(Dao dao, Player player, uint256 id, bool support) private {
        player.act(address(dao), abi.encodeCall(dao.castVote, (id, support)));
    }

    function checkComparison(Dao dao, uint256 id) private view {
        (,, ,uint256 equalFor, uint256 equalAgainst, uint256 weightedFor, uint256 weightedAgainst,
            Dao.Result equalResult, Dao.Result weightedResult,) = dao.ballots(id);
        require(equalFor == 2 && equalAgainst == 1 && weightedFor == 2 && weightedAgainst == 3,
            "Meme vote, deux decomptes");
        require(equalResult == Dao.Result.Adopted && weightedResult == Dao.Result.Rejected,
            "Majorites opposees");
    }
}
