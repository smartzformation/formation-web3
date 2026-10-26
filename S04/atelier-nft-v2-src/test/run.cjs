const assert=require('node:assert/strict'),fs=require('fs');const ganache=require('ganache');const {ethers}=require('ethers');
const C=JSON.parse(fs.readFileSync('build/contracts.json'));
(async()=>{
 const raw=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:27},chain:{hardfork:'shanghai'},miner:{blockGasLimit:30000000}});
 const p=new ethers.BrowserProvider(raw);p.pollingInterval=10;const signers=await Promise.all(Array.from({length:27},(_,i)=>p.getSigner(i))),a=await Promise.all(signers.map(s=>s.getAddress()));let checks=0;
 function ok(label,fn){fn();checks++;console.log('OK',label)}
 async function tx(call){return (await call).wait()}
 async function reject(label,call){await assert.rejects(async()=>{const t=await call();if(t.wait)await t.wait()});checks++;console.log('OK refus',label)}
 async function deploy(file,name,args=[]){const c=C[file][name];const x=await new ethers.ContractFactory(c.abi,c.evm.bytecode.object,signers[0]).deploy(...args,{gasLimit:25000000});await x.waitForDeployment();return x}
 const token=await deploy('test/Mocks.sol','MockSMZF'),rand=await deploy('test/Mocks.sol','MockRandom');
 const uris=JSON.parse(fs.readFileSync('cartes.json'));
 const nft=await deploy('contracts/AtelierNFT.sol','AtelierNFT',[await token.getAddress(),await rand.getAddress(),uris]);const addr=await nft.getAddress();
 ok('24 cartes creees',()=>assert.equal(uris.length,24));assert.equal(await nft.balanceOf(a[0]),24n);
 await reject('preparation par apprenant',()=>nft.connect(signers[1]).prepare(a.slice(1,10),1,2));
 await reject('doublon participant',()=>nft.prepare([a[1],a[1]],1,2));
 await reject('plus de 24 participants',()=>nft.prepare(a.slice(1,26),1,2));
 await reject('formateur participant',()=>nft.prepare([a[0],a[1]],1,2));
 await reject('injection aleatoire',()=>nft.receiveRandomness(1,1));
 for(const n of [24,12,10,9,2]){
  await tx(nft.prepare(a.slice(1,n+1),1,2));await tx(nft.requestDraw());
  await reject('second tirage',()=>nft.requestDraw());await reject('distribution avant oracle',()=>nft.distribute());
  await tx(rand.fulfill(n*741));await tx(nft.distribute({gasLimit:8000000}));
  for(let i=1;i<=n;i++)assert.equal(await nft.balanceOf(a[i]),BigInt(Math.floor(24/n)));
  assert.equal(await nft.balanceOf(a[0]),BigInt(24%n));assert.notEqual(await nft.ownerOf(1),await nft.ownerOf(2));
  ok('distribution '+n+' participants',()=>{});await tx(nft.closeAndRecover({gasLimit:8000000}));assert.equal(await nft.balanceOf(a[0]),24n);
 }
 await tx(nft.prepare(a.slice(1,10),1,2));await tx(nft.requestDraw());await tx(rand.fulfill(54321));await tx(nft.distribute({gasLimit:8000000}));
 const signerOf=async id=>signers[a.indexOf(await nft.ownerOf(id))];
 const x=await signerOf(1),y=await signerOf(2),xa=await x.getAddress(),ya=await y.getAddress();const third=signers[a.findIndex((v,i)=>i>0&&i<=9&&v!==xa&&v!==ya)],ta=await third.getAddress();
 const ordinary=[];for(let id=3;id<=24;id++)if(await nft.ownerOf(id)!==a[0])ordinary.push(id);const id=ordinary[0],seller=await signerOf(id),sa=await seller.getAddress();const buyer=signers[sa===a[1]?2:1],ba=await buyer.getAddress();
 await reject('transfert direct ordinaire',()=>nft.connect(seller).transferFrom(sa,ba,id));
 await tx(nft.connect(seller).approve(ba,id));await reject('contournement via approval',()=>nft.connect(buyer).transferFrom(sa,ba,id));
 await reject('safeTransfer direct',()=>nft.connect(seller)['safeTransferFrom(address,address,uint256)'](sa,ba,id));
 await reject('don carte ordinaire',()=>nft.connect(seller).giveJoker(id,ba));
 await reject('don du joker vers autre joker',()=>nft.connect(x).giveJoker(1,ya));
 await reject('don vers exterieur',()=>nft.connect(x).giveJoker(1,a[25]));
 const price=ethers.parseEther('100');await tx(nft.connect(seller).list(id,price));
 await reject('solde/autorisation insuffisant',()=>nft.connect(buyer).buy(id,sa,price));
 await tx(token.mint(ba,ethers.parseEther('1000')));await tx(token.connect(buyer).approve(addr,ethers.parseEther('1000')));
 await tx(nft.connect(seller).list(id,price+1n));await reject('prix modifie',()=>nft.connect(buyer).buy(id,sa,price));
 const sellerBefore=await token.balanceOf(sa);await tx(nft.connect(buyer).buy(id,sa,price+1n));assert.equal(await nft.ownerOf(id),ba);assert.equal(await token.balanceOf(sa)-sellerBefore,price+1n);ok('achat NFT et paiement exact',()=>{});
 await tx(nft.connect(x).list(1,price));await tx(token.mint(ya,price));await tx(token.connect(y).approve(addr,price));await reject('achat du deuxieme joker',()=>nft.connect(y).buy(1,xa,price));
 const block=await p.getBlock('latest');await tx(nft.connect(x).proposeSwap(1,2,block.timestamp+5000));const swap=await nft.nextSwap();await reject('acceptation sans consentement destinataire',()=>nft.connect(third).acceptSwap(swap));
 await tx(nft.connect(y).acceptSwap(swap));assert.equal(await nft.ownerOf(1),ya);assert.equal(await nft.ownerOf(2),xa);ok('troc atomique des jokers',()=>{});assert.equal(await nft.listingValid(1),false);
 await tx(nft.connect(y).giveJoker(1,ta));assert.equal(await nft.ownerOf(1),ta);ok('don joker',()=>{});
 await tx(nft.setPaused(true));await reject('vente en pause',()=>nft.connect(buyer).list(id,price));await tx(nft.setPaused(false));
 await tx(nft.startBallot(60,60,5000));assert.equal(await nft.weight(ta),3n);assert.equal(await nft.totalWeight(),13n);
 await reject('scrutin simultane',()=>nft.startBallot(60,60,5000));await reject('joker candidat',()=>nft.connect(third).proposePair(1,id));
 let pair;for(const u of ordinary)for(const v of ordinary)if(u<v&&await nft.ownerOf(u)!==await nft.ownerOf(v)){pair=[u,v];break}assert(pair);
 const reserve=[];for(let i=1;i<=24;i++)if(await nft.ownerOf(i)===a[0])reserve.push(i);await reject('carte formateur candidate',()=>nft.connect(third).proposePair(reserve[0],pair[0]));
 await tx(nft.connect(third).proposePair(...pair));await reject('vote premature',()=>nft.connect(third).vote(0));
 // Déplacement après snapshot : pas de nouveau bonus.
 const outsider=signers[a.findIndex((v,i)=>i>0&&i<=9&&v!==ta&&v!==xa)];const oa=await outsider.getAddress();await tx(nft.connect(third).giveJoker(1,oa));assert.equal(await nft.weight(ta),3n);assert.equal(await nft.weight(oa),1n);ok('poids figes malgre don joker',()=>{});
 await raw.request({method:'evm_increaseTime',params:[61]});await raw.request({method:'evm_mine',params:[]});
 for(let i=1;i<=9;i++)await tx(nft.connect(signers[i]).vote(0,{gasLimit:300000}));await reject('double vote',()=>nft.connect(signers[1]).vote(0));
 await raw.request({method:'evm_increaseTime',params:[61]});await raw.request({method:'evm_mine',params:[]});await reject('finalisation par apprenant',()=>nft.connect(signers[1]).finalizeBallot());await reject('finalisation par adresse exterieure',()=>nft.connect(signers[25]).finalizeBallot());await tx(nft.finalizeBallot());assert.equal(await nft.jokerX(),BigInt(pair[0]));assert.equal(await nft.jokerY(),BigInt(pair[1]));ok('resultat DAO applique',()=>{});
 const smzfBefore=await token.balanceOf(ba);await tx(nft.setPaused(true));await reject('reprise par apprenant',()=>nft.connect(buyer).closeAndRecover());await tx(nft.closeAndRecover({gasLimit:8000000}));assert.equal(await nft.balanceOf(a[0]),24n);assert.equal(await token.balanceOf(ba),smzfBefore);assert.equal(await nft.enrolled(ba),false);ok('reprise sans contrepartie meme en pause',()=>{});
 await tx(nft.prepare(a.slice(10,19),3,4));assert.equal(await nft.enrolled(a[1]),false);ok('nouveau semestre sans anciens droits',()=>{});
 // Adaptateur VRF réel, avec coordinateur simulé.
 const coordinator=await deploy('test/Mocks.sol','MockCoordinator'),adapter=await deploy('contracts/RandomProvider.sol','RandomProvider',[await coordinator.getAddress(),1,ethers.ZeroHash]);
 const second=await deploy('contracts/AtelierNFT.sol','AtelierNFT',[await token.getAddress(),await adapter.getAddress(),uris]);await tx(adapter.bind(await second.getAddress()));await reject('liaison modifiable',()=>adapter.bind(addr));await reject('callback oracle falsifie',()=>adapter.rawFulfillRandomWords(1,[123]));
 await tx(second.prepare(a.slice(1,3),1,2));await tx(second.requestDraw());await tx(coordinator.fulfill(87654));assert.equal(await second.phase(),3n);await tx(second.distribute({gasLimit:8000000}));ok('cycle complet adaptateur VRF',()=>{});

 // Deux participants, 12 cartes chacun : quorum, egalite, candidat devenu invalide.
 const pairFor=async()=>{let x,y;for(let id=3;id<=24;id++){const who=await second.ownerOf(id);if(who===a[1]&&!x)x=id;if(who===a[2]&&!y)y=id;}return [x,y]};
 const advance=async seconds=>{await raw.request({method:'evm_increaseTime',params:[seconds]});await raw.request({method:'evm_mine',params:[]})};
 let pair2=await pairFor();await tx(second.startBallot(60,60,5000));await tx(second.connect(signers[1]).proposePair(...pair2));await advance(122);await tx(second.finalizeBallot({gasLimit:1000000}));assert.equal(await second.jokerX(),1n);ok('absence de quorum maintient les jokers',()=>{});
 await tx(second.startBallot(60,60,5000));await tx(second.connect(signers[1]).proposePair(...pair2));
 let extra;for(let id=3;id<=24;id++)if(id!==pair2[0]&&id!==pair2[1]&&(await second.ownerOf(id))===(await second.ownerOf(pair2[1]))){extra=id;break}
 await tx(second.connect(signers[1]).proposePair(pair2[0],extra));await advance(61);await tx(second.connect(signers[1]).vote(0,{gasLimit:300000}));await tx(second.connect(signers[2]).vote(1,{gasLimit:300000}));await advance(61);await tx(second.finalizeBallot({gasLimit:1000000}));assert.equal(await second.jokerX(),1n);ok('egalite maintient les jokers',()=>{});
 await tx(second.startBallot(60,60,5000));await tx(second.connect(signers[1]).proposePair(...pair2));await advance(61);for(let i=1;i<=2;i++)await tx(second.connect(signers[i]).vote(0,{gasLimit:300000}));
 const from=await second.ownerOf(pair2[0]),to=await second.ownerOf(pair2[1]);const fromS=signers[a.indexOf(from)],toS=signers[a.indexOf(to)];await tx(second.connect(fromS).list(pair2[0],price));await tx(token.mint(to,price));await tx(token.connect(toS).approve(await second.getAddress(),price));await tx(second.connect(toS).buy(pair2[0],from,price));await advance(61);await tx(second.finalizeBallot({gasLimit:1000000}));assert.equal(await second.jokerX(),1n);ok('paire devenue commune au meme portefeuille rejetee',()=>{});
 const hx=signers[a.indexOf(await second.ownerOf(1))],hy=signers[a.indexOf(await second.ownerOf(2))];const now=await p.getBlock('latest');await tx(second.connect(hx).proposeSwap(1,2,now.timestamp+1000));await tx(second.closeAndRecover({gasLimit:8000000}));assert.equal(await second.swapValid(1),false);assert.equal(await second.ballotOpen(),false);ok('cloture invalide les anciennes offres',()=>{});
 console.log('SUCCES : '+checks+' controles; execution EVM locale, pas de transaction Sepolia.');await raw.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
