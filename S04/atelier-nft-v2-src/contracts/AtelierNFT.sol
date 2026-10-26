// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IAtelierRandom { function request() external returns (uint256); }

/// @notice Collection pédagogique administrée. Aucun usage avec argent réel prévu.
/// @dev Le formateur peut reprendre sans paiement tous les NFT, sans approbation.
contract AtelierNFT is ERC721URIStorage, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 public constant TOTAL = 24;
    uint256 public constant CONTRACT_VERSION = 2;
    uint256 public constant MIN_PRICE = 1 ether; // 1 SMZF, 18 décimales
    address public immutable trainer;
    IERC20 public immutable smzf;
    address public immutable randomness;
    enum Phase { Closed, Ready, Drawing, Drawn, Open }
    Phase public phase;
    bool public paused;
    uint256 public session;
    uint256 public requestId;
    uint256 public seed;
    uint256 public jokerX;
    uint256 public jokerY;
    uint256 public marketEpoch;
    bool private authorizedMove;
    address[] public participants;
    mapping(address => bool) public enrolled;
    mapping(uint256 => uint256) public revision;
    struct Listing { address seller; uint256 price; uint256 epoch; uint256 rev; }
    mapping(uint256 => Listing) public listings;
    struct Swap { address proposer; address target; uint256 give; uint256 take; uint256 epoch; uint256 giveRev; uint256 takeRev; uint256 deadline; }
    uint256 public nextSwap;
    mapping(uint256 => Swap) public swaps;
    struct Pair { uint256 x; uint256 y; uint256 score; }
    Pair[] public candidates;
    uint256 public ballot;
    bool public ballotOpen;
    uint256 public proposalEnd;
    uint256 public voteEnd;
    uint256 public quorumBps;
    uint256 public totalWeight;
    uint256 public castWeight;
    mapping(address => uint256) public weight;
    mapping(address => uint256) public lastVoted;
    event SessionPrepared(uint256 indexed session, uint256 count, uint256 x, uint256 y);
    event DrawRequested(uint256 indexed id);
    event RandomnessReady(uint256 indexed id);
    event Distributed(uint256 indexed session, uint256 perParticipant, uint256 retained);
    event Listed(uint256 indexed id, address indexed seller, uint256 price);
    event Bought(uint256 indexed id, address indexed seller, address indexed buyer, uint256 price);
    event SwapProposed(uint256 indexed id, address proposer, address target, uint256 give, uint256 take);
    event SwapDone(uint256 indexed id);
    event BallotStarted(uint256 indexed ballot, uint256 proposalEnd, uint256 voteEnd, uint256 totalWeight);
    event Proposed(uint256 indexed ballot, uint256 indexed index, uint256 x, uint256 y);
    event Voted(uint256 indexed ballot, address indexed voter, uint256 index, uint256 weight);
    event BallotEnded(uint256 indexed ballot, bool applied, uint256 x, uint256 y);
    event Closed(uint256 indexed session);
    event PauseChanged(bool paused);
    modifier onlyTrainer() { require(msg.sender == trainer, "Formateur uniquement"); _; }
    modifier active() { require(phase == Phase.Open && !paused && enrolled[msg.sender], "Session inactive ou non inscrit"); _; }
    constructor(address token, address randomProvider, string[] memory uris) ERC721("Les Familles du Web3 - Atelier V2", "FWEB3A") {
        require(token.code.length > 0 && randomProvider.code.length > 0 && uris.length == TOTAL, "Configuration invalide");
        trainer = msg.sender; smzf = IERC20(token); randomness = randomProvider;
        for (uint256 i; i < TOTAL; ++i) { require(bytes(uris[i]).length != 0, "URI vide"); _mint(trainer, i+1); _setTokenURI(i+1, uris[i]); }
    }
    function participantCount() external view returns(uint256) { return participants.length; }
    function candidateCount() external view returns(uint256) { return candidates.length; }
    function isJoker(uint256 id) public view returns(bool) { return id == jokerX || id == jokerY; }
    function prepare(address[] calldata learners, uint256 x, uint256 y) external onlyTrainer {
        require(phase == Phase.Closed && learners.length >= 2 && learners.length <= TOTAL, "Session ou effectif invalide");
        require(x >= 1 && x <= TOTAL && y >= 1 && y <= TOTAL && x != y, "Paire invalide");
        for(uint256 i=1; i<=TOTAL; ++i) require(ownerOf(i)==trainer, "Recuperer les cartes d'abord");
        for(uint256 i; i<participants.length; ++i) enrolled[participants[i]]=false;
        delete participants;
        for(uint256 i; i<learners.length; ++i) { address p=learners[i]; require(p!=address(0) && p!=trainer && !enrolled[p] && p.code.length==0, "Adresse invalide, dupliquee ou contrat"); enrolled[p]=true; participants.push(p); }
        ++session; jokerX=x; jokerY=y; paused=false; phase=Phase.Ready; ++marketEpoch;
        emit SessionPrepared(session, learners.length, x, y);
    }
    function requestDraw() external onlyTrainer nonReentrant {
        require(phase==Phase.Ready, "Tirage deja demande"); phase=Phase.Drawing;
        requestId=IAtelierRandom(randomness).request(); emit DrawRequested(requestId);
    }
    /// @dev Le fournisseur VRF enregistre seulement le résultat. Aucun transfert dans son callback.
    function receiveRandomness(uint256 id, uint256 word) external {
        require(msg.sender==randomness, "Fournisseur uniquement");
        if(phase!=Phase.Drawing || id!=requestId) return;
        seed=word; phase=Phase.Drawn; emit RandomnessReady(id);
    }
    function distribute() external onlyTrainer nonReentrant {
        require(phase==Phase.Drawn, "Tirage non pret");
        uint256 n=participants.length; uint256 q=TOTAL/n;
        uint256[] memory deck=new uint256[](TOTAL-2); uint256 k;
        for(uint256 id=1; id<=TOTAL; ++id) if(!isJoker(id)) deck[k++]=id;
        uint256 counter;
        for(uint256 i=deck.length-1; i>0; --i) { uint256 j=uint256(keccak256(abi.encode(seed, counter++)))%(i+1); (deck[i],deck[j])=(deck[j],deck[i]); }
        uint256 a=uint256(keccak256(abi.encode(seed,counter++)))%n;
        uint256 b=uint256(keccak256(abi.encode(seed,counter++)))%(n-1); if(b>=a) ++b;
        _move(trainer,participants[a],jokerX); _move(trainer,participants[b],jokerY);
        k=0;
        for(uint256 i; i<n; ++i) { uint256 count=q-((i==a || i==b)?1:0); for(uint256 j; j<count; ++j) _move(trainer,participants[i],deck[k++]); }
        phase=Phase.Open; emit Distributed(session,q,TOTAL-n*q);
    }
    function setPaused(bool value) external onlyTrainer { require(phase==Phase.Open, "Session non ouverte"); paused=value; emit PauseChanged(value); }
    function closeAndRecover() external onlyTrainer nonReentrant {
        require(phase!=Phase.Drawing && phase!=Phase.Drawn, "Finaliser le tirage avant cloture");
        phase=Phase.Closed; paused=false; ballotOpen=false; ++marketEpoch;
        for(uint256 i=1; i<=TOTAL; ++i) if(ownerOf(i)!=trainer) _move(ownerOf(i),trainer,i);
        for(uint256 i; i<participants.length; ++i) { enrolled[participants[i]]=false; weight[participants[i]]=0; }
        emit Closed(session);
    }
    function _recipient(address to, uint256 id) private view {
        require(to!=trainer && enrolled[to], "Destinataire hors session");
        if(isJoker(id)) require(ownerOf(id==jokerX?jokerY:jokerX)!=to, "Deux jokers interdits");
    }
    function giveJoker(uint256 id, address to) external active nonReentrant {
        require(isJoker(id) && ownerOf(id)==msg.sender && to!=msg.sender, "Don invalide"); _recipient(to,id); _move(msg.sender,to,id);
    }
    function list(uint256 id, uint256 price) external active {
        require(ownerOf(id)==msg.sender && price>=MIN_PRICE, "Prix ou proprietaire invalide");
        listings[id]=Listing(msg.sender,price,marketEpoch,revision[id]); emit Listed(id,msg.sender,price);
    }
    function cancelListing(uint256 id) external { require(ownerOf(id)==msg.sender, "Proprietaire uniquement"); delete listings[id]; }
    function listingValid(uint256 id) public view returns(bool) {
        Listing memory l=listings[id]; return phase==Phase.Open && !paused && l.price>=MIN_PRICE && l.epoch==marketEpoch && l.rev==revision[id] && enrolled[l.seller] && _ownerOf(id)==l.seller;
    }
    function buy(uint256 id, address expectedSeller, uint256 expectedPrice) external active nonReentrant {
        Listing memory l=listings[id]; require(listingValid(id) && l.seller==expectedSeller && l.price==expectedPrice && msg.sender!=l.seller, "Offre modifiee ou invalide");
        _recipient(msg.sender,id);
        // Le token est le SMZF standard, sans taxe de transfert; pas un token arbitraire.
        delete listings[id]; smzf.safeTransferFrom(msg.sender,l.seller,l.price); _move(l.seller,msg.sender,id);
        emit Bought(id,l.seller,msg.sender,l.price);
    }
    function proposeSwap(uint256 give, uint256 take, uint256 deadline) external active returns(uint256 id) {
        address target=ownerOf(take);
        require(isJoker(give)&&isJoker(take)&&give!=take&&ownerOf(give)==msg.sender&&target!=msg.sender&&enrolled[target]&&deadline>block.timestamp, "Echange invalide");
        id=++nextSwap; swaps[id]=Swap(msg.sender,target,give,take,marketEpoch,revision[give],revision[take],deadline);
        emit SwapProposed(id,msg.sender,target,give,take);
    }
    function cancelSwap(uint256 id) external { require(swaps[id].proposer==msg.sender,"Proposant uniquement"); delete swaps[id]; }
    function swapValid(uint256 id) public view returns(bool) {
        Swap memory s=swaps[id]; return phase==Phase.Open&&!paused&&s.proposer!=address(0)&&s.epoch==marketEpoch&&s.deadline>=block.timestamp&&enrolled[s.proposer]&&enrolled[s.target]&&revision[s.give]==s.giveRev&&revision[s.take]==s.takeRev&&_ownerOf(s.give)==s.proposer&&_ownerOf(s.take)==s.target&&isJoker(s.give)&&isJoker(s.take);
    }
    function acceptSwap(uint256 id) external active nonReentrant {
        Swap memory s=swaps[id]; require(s.target==msg.sender&&swapValid(id),"Offre d'echange invalide"); delete swaps[id];
        // Transferts internes sans callback : aucune intervention entre les deux mouvements.
        _move(s.proposer,s.target,s.give); _move(s.target,s.proposer,s.take); emit SwapDone(id);
    }
    function startBallot(uint256 proposalSeconds, uint256 voteSeconds, uint256 participationBps) external onlyTrainer {
        require(phase==Phase.Open&&!paused&&!ballotOpen&&proposalSeconds>=60&&voteSeconds>=60&&participationBps>=1&&participationBps<=10000,"Scrutin invalide");
        ++ballot; ballotOpen=true; delete candidates; proposalEnd=block.timestamp+proposalSeconds; voteEnd=proposalEnd+voteSeconds; quorumBps=participationBps; totalWeight=0; castWeight=0;
        for(uint256 i; i<participants.length; ++i) { address p=participants[i]; uint256 w=(ownerOf(jokerX)==p||ownerOf(jokerY)==p)?3:1; weight[p]=w; totalWeight+=w; }
        emit BallotStarted(ballot,proposalEnd,voteEnd,totalWeight);
    }
    function _eligiblePair(uint256 x,uint256 y) private view returns(bool) {
        if(x==y||x<1||y>TOTAL||y<1||x>TOTAL||isJoker(x)||isJoker(y)) return false;
        address a=ownerOf(x);address b=ownerOf(y); return a!=b&&enrolled[a]&&enrolled[b];
    }
    function proposePair(uint256 x,uint256 y) external active {
        require(ballotOpen&&block.timestamp<proposalEnd&&_eligiblePair(x,y),"Paire non admissible"); if(x>y) (x,y)=(y,x);
        for(uint256 i; i<candidates.length; ++i) require(candidates[i].x!=x||candidates[i].y!=y,"Paire deja proposee");
        // Au plus C(22,2)=231 paires; boucle de cloture bornee.
        candidates.push(Pair(x,y,0)); emit Proposed(ballot,candidates.length-1,x,y);
    }
    function vote(uint256 index) external active {
        require(ballotOpen&&block.timestamp>=proposalEnd&&block.timestamp<voteEnd&&index<candidates.length&&lastVoted[msg.sender]!=ballot,"Vote impossible");
        uint256 w=weight[msg.sender]; require(w>0,"Aucun droit"); lastVoted[msg.sender]=ballot; candidates[index].score+=w; castWeight+=w; emit Voted(ballot,msg.sender,index,w);
    }
    function finalizeBallot() external onlyTrainer nonReentrant {
        require(phase==Phase.Open&&ballotOpen&&block.timestamp>=voteEnd,"Scrutin non termine"); ballotOpen=false;
        uint256 best;uint256 winner;bool tied;
        for(uint256 i; i<candidates.length; ++i) { uint256 score=candidates[i].score; if(score>best){best=score;winner=i;tied=false;} else if(score==best&&score>0) tied=true; }
        bool applyResult=best>0&&!tied&&castWeight*10000>=totalWeight*quorumBps;
        if(applyResult) { Pair memory p=candidates[winner];applyResult=_eligiblePair(p.x,p.y); if(applyResult){jokerX=p.x;jokerY=p.y;++marketEpoch;} }
        emit BallotEnded(ballot,applyResult,jokerX,jokerY);
    }
    // Tous les chemins ERC721 hérités passent ici. Les transferts directs sont interdits.
    function _update(address to,uint256 id,address auth) internal override returns(address) {
        require(_ownerOf(id)==address(0)||authorizedMove,"Utiliser achat, don joker ou echange");
        address from=super._update(to,id,auth); ++revision[id]; delete listings[id]; return from;
    }
    function _move(address from,address to,uint256 id) private { authorizedMove=true; _transfer(from,to,id); authorizedMove=false; }
}
