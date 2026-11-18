// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PolarVote} from "./PolarVote.sol";

contract ClansPolarDaoV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Mode { Equal, Weighted }
    enum Action { Advisory, EqualMode, WeightedMode }
    enum Result { Pending, Adopted, Rejected, NoQuorum }
    enum Application { Pending, Applied, Deferred }

    struct Idea {
        uint256 session;
        address proposer;
        uint256 supportCount;
        Action action;
        string description;
    }

    struct Ballot {
        uint64 deadline;
        Mode mode;
        uint256 eligible;
        uint256 equalFor;
        uint256 equalAgainst;
        uint256 weightedFor;
        uint256 weightedAgainst;
        Result equalResult;
        Result weightedResult;
        Application application;
    }

    error TrainerOnly();
    error InvalidState();
    error InvalidPlayer();
    error InvalidIdea();
    error InvalidVote();
    error InvalidPayment();
    error InvalidRound();

    event SessionOpened(uint256 indexed session);
    event SessionClosed(uint256 indexed session, uint256 recalled);
    event IdeaSubmitted(uint256 indexed id, uint256 indexed session, address indexed proposer);
    event IdeaSupported(uint256 indexed id, address indexed supporter);
    event WinnerRewarded(uint256 indexed session, bytes32 indexed round, address indexed winner);
    event PurchasesEnabled(uint256 indexed session);
    event PolarVotePurchased(uint256 indexed session, address indexed player);
    event BallotOpened(uint256 indexed id, uint64 deadline, Mode mode);
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event BallotClosed(uint256 indexed id, Result equalResult, Result weightedResult);
    event ApplicationRecorded(uint256 indexed id, Application status);
    event OfficialModeChanged(uint256 indexed session, Mode mode);

    uint256 public constant QUORUM = 3;
    uint256 public constant REQUIRED_SUPPORTS = 2;
    uint256 public constant STOCK = 20;
    address public immutable trainer;
    IERC20 public immutable smzf;
    uint256 public immutable purchasePrice;
    PolarVote public immutable polarVote;

    bool public sessionOpen;
    bool public purchasesEnabled;
    uint256 public session;
    uint256 public latestIdeaId;
    uint256 public activeBallot;
    Mode public officialMode;
    mapping(uint256 => address[]) private players;
    mapping(uint256 => mapping(address => bool)) public registered;
    mapping(uint256 => mapping(bytes32 => bool)) public roundRewarded;
    mapping(uint256 => Idea) public ideas;
    mapping(uint256 => Ballot) public ballots;
    mapping(uint256 => mapping(address => bool)) public hasSupported;
    mapping(uint256 => mapping(address => uint256)) public snapshotWeight;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    modifier onlyTrainer() {
        if (msg.sender != trainer) revert TrainerOnly();
        _;
    }

    modifier onlyPlayer() {
        if (!sessionOpen || !registered[session][msg.sender]) revert InvalidPlayer();
        _;
    }

    constructor(address trainer_, IERC20 smzf_, uint256 purchasePrice_) {
        if (trainer_ == address(0)) revert InvalidPlayer();
        if (address(smzf_).code.length == 0 || purchasePrice_ == 0) revert InvalidPayment();
        trainer = trainer_;
        smzf = smzf_;
        purchasePrice = purchasePrice_;
        polarVote = new PolarVote(trainer_, STOCK);
    }

    function openSession(address[] calldata roster) external onlyTrainer {
        if (sessionOpen || roster.length < QUORUM || roster.length > STOCK) revert InvalidState();
        ++session;
        sessionOpen = true;
        for (uint256 i; i < roster.length; ++i) {
            address player = roster[i];
            if (player == address(0) || player == trainer || registered[session][player]) revert InvalidPlayer();
            registered[session][player] = true;
            players[session].push(player);
        }
        emit SessionOpened(session);
    }

    function rewardWinner(bytes32 round, address winner) external onlyTrainer {
        if (!sessionOpen) revert InvalidState();
        if (round == bytes32(0) || roundRewarded[session][round]) revert InvalidRound();
        if (!registered[session][winner]) revert InvalidPlayer();
        roundRewarded[session][round] = true;
        polarVote.distribute(winner);
        emit WinnerRewarded(session, round, winner);
    }

    function enablePurchases() external onlyTrainer {
        if (!sessionOpen || purchasesEnabled) revert InvalidState();
        purchasesEnabled = true;
        emit PurchasesEnabled(session);
    }

    function buyPolarVote() external onlyPlayer nonReentrant {
        if (!purchasesEnabled || polarVote.balanceOf(trainer) == 0) revert InvalidPayment();
        uint256 balanceBefore = smzf.balanceOf(trainer);
        smzf.safeTransferFrom(msg.sender, trainer, purchasePrice);
        if (smzf.balanceOf(trainer) != balanceBefore + purchasePrice) revert InvalidPayment();
        polarVote.distribute(msg.sender);
        emit PolarVotePurchased(session, msg.sender);
    }

    function submitIdea(string calldata description, Action action) external onlyPlayer returns (uint256 id) {
        uint256 length = bytes(description).length;
        if (action == Action.Advisory ? length == 0 || length > 1024 : length != 0) {
            revert InvalidIdea();
        }
        id = ++latestIdeaId;
        string memory text = description;
        if (action == Action.EqualMode) text = "POL-007 : adopter le mode egalitaire pour les prochains scrutins";
        if (action == Action.WeightedMode) text = "POL-007 : adopter le mode pondere pour les prochains scrutins";
        ideas[id] = Idea(session, msg.sender, 0, action, text);
        emit IdeaSubmitted(id, session, msg.sender);
    }

    function supportIdea(uint256 id) external onlyPlayer {
        Idea storage idea = ideas[id];
        if (idea.session != session || idea.proposer == msg.sender || ballots[id].deadline != 0
            || hasSupported[id][msg.sender]) revert InvalidIdea();
        hasSupported[id][msg.sender] = true;
        ++idea.supportCount;
        emit IdeaSupported(id, msg.sender);
    }

    function isQualified(uint256 id) public view returns (bool) {
        Idea storage idea = ideas[id];
        return sessionOpen && idea.session == session && idea.supportCount >= REQUIRED_SUPPORTS
            && ballots[id].deadline == 0 && polarVote.balanceOf(idea.proposer) != 0;
    }

    function openBallot(uint256 id, uint64 deadline) external onlyTrainer {
        if (activeBallot != 0 || !isQualified(id) || deadline <= block.timestamp) revert InvalidVote();
        Ballot storage ballot = ballots[id];
        ballot.deadline = deadline;
        ballot.mode = officialMode;
        address[] storage roster = players[session];
        for (uint256 i; i < roster.length; ++i) {
            address player = roster[i];
            uint256 weight = polarVote.balanceOf(player);
            if (weight == 0) continue;
            snapshotWeight[id][player] = weight;
            ++ballot.eligible;
        }
        if (ballot.eligible < QUORUM) revert InvalidVote();
        activeBallot = id;
        emit BallotOpened(id, deadline, ballot.mode);
    }

    function castVote(uint256 id, bool support) external {
        Ballot storage ballot = ballots[id];
        uint256 weight = snapshotWeight[id][msg.sender];
        if (id != activeBallot || block.timestamp >= ballot.deadline || weight == 0 || hasVoted[id][msg.sender]) {
            revert InvalidVote();
        }
        hasVoted[id][msg.sender] = true;
        if (support) {
            ++ballot.equalFor;
            ballot.weightedFor += weight;
        } else {
            ++ballot.equalAgainst;
            ballot.weightedAgainst += weight;
        }
        emit VoteCast(id, msg.sender, support, weight);
    }

    function closeBallot() external {
        uint256 id = activeBallot;
        if (id == 0) revert InvalidVote();
        Ballot storage ballot = ballots[id];
        if (block.timestamp < ballot.deadline && msg.sender != trainer) revert TrainerOnly();
        bool quorum = ballot.equalFor + ballot.equalAgainst >= QUORUM;
        ballot.equalResult = result(quorum, ballot.equalFor, ballot.equalAgainst);
        ballot.weightedResult = result(quorum, ballot.weightedFor, ballot.weightedAgainst);
        activeBallot = 0;
        emit BallotClosed(id, ballot.equalResult, ballot.weightedResult);
    }

    function officialResult(uint256 id) public view returns (Result) {
        Ballot storage ballot = ballots[id];
        return ballot.mode == Mode.Equal ? ballot.equalResult : ballot.weightedResult;
    }

    function recordApplication(uint256 id, bool applyDecision) external onlyTrainer {
        Ballot storage ballot = ballots[id];
        Idea storage idea = ideas[id];
        if (!sessionOpen || idea.session != session || officialResult(id) != Result.Adopted
            || ballot.application == Application.Applied) revert InvalidState();
        if (applyDecision && idea.action != Action.Advisory) {
            if (activeBallot != 0) revert InvalidState();
            officialMode = idea.action == Action.EqualMode ? Mode.Equal : Mode.Weighted;
            emit OfficialModeChanged(session, officialMode);
        }
        ballot.application = applyDecision ? Application.Applied : Application.Deferred;
        emit ApplicationRecorded(id, ballot.application);
    }

    function closeSession() external onlyTrainer {
        if (!sessionOpen || activeBallot != 0) revert InvalidState();
        sessionOpen = false;
        purchasesEnabled = false;
        officialMode = Mode.Equal;
        emit SessionClosed(session, polarVote.recallAll());
    }

    function result(bool quorum, uint256 votesFor, uint256 votesAgainst) private pure returns (Result) {
        if (!quorum) return Result.NoQuorum;
        return votesFor > votesAgainst ? Result.Adopted : Result.Rejected;
    }
}
