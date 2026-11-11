
'use strict';
const page=document.body.dataset.page;
const storageKey='polar-maquette-trois-pages-v1';
const clans=[...new Set(catalog.map(c=>c.clan))];
const names=['Alice','Bruno','Chloé','David','Emma','Farid','Gaëlle','Hugo','Inès'];
const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const find=id=>catalog.find(c=>c.id===Number(id));
const player=i=>s.players[i]?.name??names[i];
const button=(label,action,id='',disabled=false,primary=false)=>`<button type="button" data-action="${action}" data-id="${id}" ${disabled?'disabled':''} ${primary?'class="primary"':''}>${label}</button>`;
let s,role=page==='formateur'?-1:0,tab=page==='formateur'?'admin':page==='dao'?'dao':'main',pending;
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(s));}catch{}}
function restore(){try{return JSON.parse(localStorage.getItem(storageKey));}catch{return null;}}
function update(){persist();render();}
function reset(){
 s={phase:'prête',duration:30,remaining:1800,deadline:0,count:5,players:names.slice(0,5).map(name=>({name,wallet:''})),size:5,round:1,owners:{},listings:{},offers:[],balance:names.map(()=>2000),initial:names.map(()=>2000),settled:null,nft:false,smzf:false,closed:false,vote:null,history:[],log:[],sequence:0,progress:{}};
 distribute(); update();
}
function distribute(){
 s.owners={};s.listings={};s.offers=[];s.progress={};s.sequence=0;s.nft=false;s.settled=null;
 catalog.filter(c=>clans.indexOf(c.clan)<s.count&&c.number<=s.size).forEach(c=>{
   s.owners[c.id]=(clans.indexOf(c.clan)+c.number-1)%s.count;
 });
 const sample=catalog.filter(c=>s.owners[c.id]===1&&c.number!==1)[0];
 if(sample)s.listings[sample.id]=350;
 s.remaining=s.duration*60;s.phase='prête';
}
function say(message){$('message').textContent=message;}
function log(message){s.log.unshift(message);say(message);}
function active(){return s.phase==='en cours'&&seconds()>0;}
function seconds(){return s.phase==='en cours'?Math.max(0,Math.ceil((s.deadline-Date.now())/1000)):s.remaining;}
function time(v){return `${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}`;}
function hand(i){return catalog.filter(c=>s.owners[c.id]===i);}
function score(i){
 const cards=hand(i), progress=clans.slice(0,s.count).map(clan=>({clan,n:cards.filter(c=>c.clan===clan).length})).sort((a,b)=>b.n-a.n);
 return {i,cards,best:progress[0],exact:cards.length===s.size&&progress[0].n===s.size,gain:s.balance[i]-s.initial[i]};
}
function recordProgress(){
 for(let i=0;i<s.count;i++){
   const row=score(i), previous=s.progress[i]||{};
   const complete=row.best.n===s.size;
   s.progress[i]={clan:row.best.clan,completed:complete?(previous.clan===row.best.clan?previous.completed??s.sequence:s.sequence):null,eligible:row.exact?(previous.clan===row.best.clan?previous.eligible??s.sequence:s.sequence):null};
 }
}
function finish(cancelled=false){
 s.remaining=0;s.offers.forEach(o=>{if(o.status==='En attente')o.status='Expirée';});s.phase=cancelled?'annulée':'terminée';
 if(!cancelled){
  s.settled=Array.from({length:s.count},(_,i)=>({...score(i),...s.progress[i]}));
 }
 log(cancelled?'Manche annulée · aucun résultat publié.':'Manche terminée · résultats figés.');
 update();
}
function card(c,actions=''){
 return `<article class="tile"><img width="320" height="320" alt="" src="${c.image}"><span class="pill">${esc(c.clan)} · ${c.number===1?'★ Joker':c.number+'/5'} · NFT ${c.id}</span><h3>${esc(c.name)}</h3>${actions}</article>`;
}
function cards(list,actions){return list.length?`<div class="cards">${list.map(c=>card(c,actions(c))).join('')}</div>`:'<p class="muted">Aucune carte à afficher.</p>';}
function main(){
 const i=role<0?0:role;
 const row=score(i);
 const missing=catalog.filter(c=>c.clan===row.best.clan&&c.number<=s.size&&s.owners[c.id]!==i);
 return `<section class="panel"><h2>${role<0?'Main témoin':'Ma main'}</h2>${!active()?'<p class="muted">La mise en vente s’active au lancement de la manche.</p>':''}<p>${row.cards.length} carte(s) · meilleure famille ${esc(row.best.clan)} ${row.best.n}/${s.size} · ${row.exact?'Éligible à la victoire':row.best.n===s.size?'Famille complète avec cartes en trop':'Famille à compléter'}</p>
 ${cards(row.cards,c=>role<0?'':c.number===1?button('Voir les jokers','open-jokers'):button(s.listings[c.id]?'Modifier le prix':'Mettre en vente','list',c.id,!active())+(s.listings[c.id]?button('Retirer l’annonce','unlist',c.id,!active()):''))}
 <h3>Cartes manquantes dans cette famille</h3><p class="muted">${missing.map(c=>`${c.number===1?'★':c.number} · ${esc(c.name)}${s.owners[c.id]!==undefined?' — '+esc(player(s.owners[c.id])):''}`).join(' / ')||'Aucune'}</p></section>`;
}
function market(){
 const list=catalog.filter(c=>c.number!==1&&s.owners[c.id]!==undefined&&s.owners[c.id]!==role).sort((a,b)=>Number(!!s.listings[b.id])-Number(!!s.listings[a.id]));
 return `<section class="panel"><h2>Marché en SMZF</h2><p class="muted">Achète au prix affiché ou propose un prix au détenteur.</p>${cards(list,c=>`<small>${esc(player(s.owners[c.id]))} · ${s.listings[c.id]?s.listings[c.id]+' SMZF':'Sans annonce'}</small>`+(s.listings[c.id]?button('Acheter','buy',c.id,!active()||role<0):'')+button('Faire une offre','offer',c.id,!active()||role<0))}</section>`;
}
function jokers(){
 return `<section class="panel"><h2>Échanges de jokers</h2><p class="muted">Un joker contre un joker, sans paiement.</p>${cards(catalog.filter(c=>c.number===1&&s.owners[c.id]!==undefined),c=>`<small>${esc(player(s.owners[c.id]))}</small>`+button('Proposer un échange','swap',c.id,!active()||role<0||s.owners[c.id]===role))}</section>`;
}
function offers(){
 const list=s.offers.map((o,i)=>({o,i})).filter(({o})=>role<0||o.from===role||o.to===role);
 return `<section class="panel"><h2>Offres et échanges</h2>${list.length?list.map(({o,i})=>`<div class="panel"><strong>${esc(find(o.card).name)}</strong> · ${o.kind==='swap'?'Échange contre '+esc(find(o.give).name):o.price+' SMZF'}<p>${esc(player(o.from))} → ${esc(player(o.to))} · ${o.status}</p><div class="row">${button('Accepter','accept',i,role!==o.to||o.status!=='En attente'||!active(),true)}${button('Refuser','reject',i,role!==o.to||o.status!=='En attente'||!active())}${button('Annuler','withdraw',i,role!==o.from||o.status!=='En attente'||!active())}${o.kind==='sale'?button('Contre-offre','counter',i,role!==o.to||o.status!=='En attente'||!active()):''}</div></div>`).join(''):'<p class="muted">Aucune offre pour ce profil.</p>'}</section>`;
}
function rankings(){
 if(s.phase==='annulée')return '<section class="panel"><h2>Classements</h2><p>Manche annulée. Aucun classement publié.</p></section>';
 const rows=s.settled||Array.from({length:s.count},(_,i)=>score(i));
 const winners=rows.filter(r=>r.exact).sort((a,b)=>a.eligible-b.eligible||a.completed-b.completed);
 const champions=winners.filter(r=>r.eligible===winners[0]?.eligible&&r.completed===winners[0]?.completed);
 return `<section class="panel"><h2>Classements</h2><p class="status">${s.settled?(champions.length?'Victoire famille · '+champions.map(r=>esc(player(r.i))).join(' et '):'Aucun vainqueur des familles'):'Résultats provisoires'} </p><p class="muted">Pour gagner une famille, il faut exactement ses cartes actives en main au chrono.</p><div class="split"><div class="scroll"><h3>Progression des familles</h3><table><thead><tr><th>Joueur</th><th>Clan</th><th>Cartes</th></tr></thead><tbody>${[...rows].sort((a,b)=>b.best.n-a.best.n).map(r=>`<tr><td>${esc(player(r.i))}</td><td>${esc(r.best.clan)}</td><td>${r.best.n}/${s.size}</td></tr>`).join('')}</tbody></table></div><div class="scroll"><h3>Gain net en SMZF</h3><table><thead><tr><th>Joueur</th><th>Gain</th></tr></thead><tbody>${[...rows].sort((a,b)=>b.gain-a.gain).map(r=>`<tr><td>${esc(player(r.i))}</td><td>${r.gain>0?'+':''}${r.gain}</td></tr>`).join('')}</tbody></table></div></div></section>`;
}
function participantFields(count, values=s.players){
 return Array.from({length:count},(_,i)=>`<label><span>Joueur ${i+1}</span><input id="name-${i}" required maxlength="40" placeholder="Nom ou pseudo" value="${esc(values[i]?.name??'')}"><input id="wallet-${i}" placeholder="Wallet de démo facultatif" pattern="0x[0-9a-fA-F]{40}" value="${esc(values[i]?.wallet??'')}"></label>`).join('');
}
function overview(){
 const rows=s.settled||Array.from({length:s.count},(_,i)=>score(i));
 return `<section class="panel"><h2>Vue d’ensemble des joueurs</h2><div class="scroll"><table><thead><tr><th>Participant</th><th>Wallet</th><th>Cartes</th><th>Meilleur clan</th><th>Solde de jeu</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(player(r.i))}</td><td>${esc(s.players[r.i].wallet||'Démo')}</td><td>${r.cards.length}</td><td>${esc(r.best.clan)} · ${r.best.n}/${s.size}</td><td>${s.balance[r.i]} SMZF</td></tr>`).join('')}</tbody></table></div>${s.settled?'<p class="muted">Les cartes et la progression reflètent la fin de manche.</p>':''}</section>`;
}
function admin(){
 const adjustable=s.phase==='prête'&&!s.closed;
 const ended=['terminée','annulée'].includes(s.phase);
 return `<section class="panel"><h2>Pilotage formateur</h2><p class="muted">Choisis le nombre de participants, puis saisis les joueurs.</p><div class="row"><label>Nombre de participants <select id="players" ${adjustable?'':'disabled'}>${names.slice(1).map((_,i)=>`<option ${s.count===i+2?'selected':''}>${i+2}</option>`).join('')}</select></label><label>Cartes par clan <select id="size" ${adjustable?'':'disabled'}>${[2,3,4,5].map(n=>`<option ${s.size===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Minutes <input id="duration" type="number" min="1" max="120" value="${s.duration}" ${adjustable?'':'disabled'}></label></div>
 ${adjustable?`<h3>Participants</h3><div id="participants" class="participants">${participantFields(s.count)}</div>${button('Valider les participants et distribuer','setup','',false,true)}`:''}
 <p>${clans.slice(0,s.count).map(esc).join(' · ')}</p><p class="muted">Inscrits · ${s.players.map(p=>esc(p.name)).join(', ')} · ${s.count*s.size} cartes actives</p>
 <div class="row">${button('Lancer le chrono','start','',!adjustable,true)}${button('Pause','pause','',!active())}${button('Reprendre','resume','',s.phase!=='en pause')}${button('Simuler la fin du chrono','finish','',!active()&&s.phase!=='en pause')}${button('Annuler la manche','cancel-round','',!active()&&s.phase!=='en pause')}</div></section>
 <section class="panel"><h2>Récupérations du formateur</h2><p class="muted">Deux actions distinctes. Les apprenants ne signent aucune récupération.</p><div class="split"><div><h3>NFT</h3><p>${s.nft?'Cartes récupérées':'Cartes disponibles au rappel après la manche'}</p>${button('Récupérer les NFT','nft','',!ended||s.nft,true)}</div><div><h3>SMZF</h3><p>${s.smzf?'Réserve récupérée · soldes clos':'Réserve de jeu et soldes de la session'}</p>${button('Récupérer les SMZF','smzf','',!ended||s.smzf,true)}</div></div><div class="row">${button('Préparer la manche suivante','next','',!ended||!s.nft||s.closed)}${s.nft&&s.smzf?'<a href="dao.html">Ouvrir l’atelier DAO</a>':''}</div></section>
 ${overview()}<section class="panel"><h2>Journal de simulation</h2><p>${s.log.slice(0,8).map(esc).join('<br>')||'Aucune action enregistrée.'}</p></section>`;
}
function dao(){
 const v=s.vote;
 return `<section class="panel"><h2>Propositions et votes</h2><p class="muted">Une voix par joueur inscrit. La DAO s’ouvre après les deux récupérations finales. Les décisions s’appliquent à la session suivante.</p>
 ${role<0?button('Ouvrir une proposition','proposal','',!s.nft||!s.smzf||!!v,true):''}
 ${v?`<div class="panel"><h3>${esc(v.title)}</h3><p>Temps de vote restant · <span id="vote-clock">${time(Math.max(0,Math.ceil((v.deadline-Date.now())/1000)))}</span></p><div class="row">${role<0?button('Prolonger de 5 min','extend','',Date.now()>=v.deadline)+button('Simuler la fin et clôturer','close-vote')+button('Annuler le vote','cancel-vote'):button('Voter oui','vote','oui',!!v.votes[role]||Date.now()>=v.deadline,true)+button('Voter non','vote','non',!!v.votes[role]||Date.now()>=v.deadline)}</div></div>`:''}
 <h3>Historique</h3><p>${s.history.map(h=>esc(h)).join('<br>')||'Aucun vote clôturé.'}</p></section>`;
}
const screens={main:['Ma main',main],market:['Marché',market],jokers:['Jokers',jokers],offers:['Offres',offers],rank:['Résultats',rankings],admin:['Formateur',admin],dao:['DAO',dao]};
function render(){
 if(role>=s.count)role=0;
 if(page==='jeu'&&role<0)role=0;
 $('role').innerHTML=s.players.map((p,i)=>`<option value="${i}">${esc(p.name)} · Joueur</option>`).join('')+(page==='dao'?'<option value="-1">Formateur</option>':'');
 $('role').value=String(role);
 $('nav').innerHTML=Object.entries(screens).filter(([k])=>page==='jeu'?!['admin','dao'].includes(k):page==='formateur'?['admin','rank','offers'].includes(k):k==='dao').map(([k,[label]])=>`<button data-tab="${k}" aria-current="${tab===k}">${label}</button>`).join('');
 $('stats').innerHTML=`<div class="panel"><small>Manche ${s.round}</small><strong>${s.phase}</strong></div><div class="panel"><small>Chronomètre</small><strong id="clock">${time(seconds())}</strong></div><div class="panel"><small>Clans actifs</small><strong>${s.count} × ${s.size} cartes</strong></div><div class="panel"><small>${role<0?'Vue':'Mon solde de jeu'}</small><strong>${role<0?'Formateur':s.balance[role]+' SMZF'}</strong></div>`;
 $('screen').innerHTML=screens[tab][1]();
}
function confirmAction(title,body,callback){
 $('dialog-title').textContent=title;$('dialog-body').innerHTML=body;pending=callback;$('dialog').showModal();
}
function priceAction(title,callback){confirmAction(title,'<p><label>Prix en SMZF <input name="price" type="number" required min="1" max="1000000" value="350"></label></p>',f=>callback(Number(f.get('price'))));}
function invalidate(ids){s.offers.forEach(o=>{if(o.status==='En attente'&&(ids.includes(o.card)||ids.includes(o.give)))o.status='Caduque';});}
function sell(id,buyer,seller,price){
 if(!active()||s.owners[id]!==seller||s.balance[buyer]<price){say('Vente impossible · vérifie le solde et la disponibilité.');return false;}
 s.balance[buyer]-=price;s.balance[seller]+=price;s.owners[id]=buyer;delete s.listings[id];
 invalidate([id]);s.sequence++;recordProgress();log(`${esc(player(buyer))} a acheté ${find(id).name} pour ${price} SMZF.`);return true;
}
function handle(action,id){
 const c=find(id);
 const offer=s.offers[id];
 switch(action){
 case 'open-jokers':tab='jokers';break;
 case 'setup':{
   const d=$('duration'),count=Number($('players').value), participants=[];
   if(!d.reportValidity())return;
   for(let i=0;i<count;i++){
     const name=$('name-'+i),wallet=$('wallet-'+i);
     if(!name.reportValidity()||!wallet.reportValidity())return;
     if(!name.value.trim()){say('Renseigne le nom du joueur '+(i+1)+'.');return;}
     participants.push({name:name.value.trim(),wallet:wallet.value.trim()});
   }
   const wallets=participants.map(p=>p.wallet.toLowerCase()).filter(Boolean);
   if(new Set(wallets).size!==wallets.length){say('Chaque portefeuille renseigné doit être distinct.');return;}
   const sameRoster=count===s.count&&participants.every((p,i)=>p.name===s.players[i].name&&p.wallet===s.players[i].wallet);
   if(s.round>1&&!sameRoster){say('Le changement de participants entre deux manches reste à simuler.');return;}
   s.players=participants;s.count=count;s.size=Number($('size').value);s.duration=Number(d.value);
   distribute();log('Participants inscrits et distribution de démonstration préparée.');break;
 }
 case 'start':s.initial=[...s.balance];recordProgress();s.phase='en cours';s.deadline=Date.now()+s.remaining*1000;log('Chronomètre lancé.');break;
 case 'pause':s.remaining=seconds();s.phase='en pause';log('Manche en pause.');break;
 case 'resume':s.phase='en cours';s.deadline=Date.now()+s.remaining*1000;log('Manche reprise.');break;
 case 'finish':finish();return;
 case 'cancel-round':confirmAction('Annuler la manche','<p>Aucun résultat ne sera publié.</p>',()=>finish(true));return;
 case 'list':priceAction('Mettre la carte en vente',price=>{if(active()&&s.owners[id]===role){s.listings[id]=price;log('Annonce publiée.');}});return;
 case 'unlist':delete s.listings[id];log('Annonce retirée.');break;
 case 'buy':{const seller=s.owners[id],price=s.listings[id];confirmAction('Acheter cette carte',`<p>${esc(c.name)} · ${price} SMZF</p>`,()=>{if(s.listings[id]===price)sell(id,role,seller,price);});return;}
 case 'offer':priceAction('Faire une offre',price=>{if(active()){s.offers.push({kind:'sale',card:id,buyer:role,seller:s.owners[id],from:role,to:s.owners[id],price,status:'En attente'});log('Offre envoyée. Change de profil pour voir la réponse côté vendeur.');}});return;
 case 'swap':{const own=hand(role).find(c=>c.number===1);if(!own)return;confirmAction('Proposer un échange',`<p>${esc(own.name)} contre ${esc(c.name)}</p>`,()=>{if(active()){s.offers.push({kind:'swap',card:id,give:own.id,from:role,to:s.owners[id],status:'En attente'});log('Échange proposé. Change de profil pour l’accepter.');}});return;}
 case 'counter':priceAction('Faire une contre-offre',price=>{if(active()&&offer.status==='En attente'){offer.status='Remplacée';s.offers.push({...offer,from:role,to:offer.from,price,status:'En attente'});log('Contre-offre envoyée.');}});return;
 case 'reject':case 'withdraw':offer.status=action==='reject'?'Refusée':'Annulée';log('Offre mise à jour.');break;
 case 'accept':if(offer.kind==='sale'){if(sell(offer.card,offer.buyer,offer.seller,offer.price))offer.status='Acceptée';}else if(active()&&s.owners[offer.give]===offer.from&&s.owners[offer.card]===offer.to){s.owners[offer.give]=offer.to;s.owners[offer.card]=offer.from;invalidate([offer.card,offer.give]);offer.status='Acceptée';s.sequence++;recordProgress();log('Jokers échangés.');}break;
 case 'nft':confirmAction('Récupérer les NFT','<p>Les cartes de la manche retournent au formateur. Le classement reste consultable.</p>',()=>{s.nft=true;s.owners={};s.listings={};log('NFT récupérés.');});return;
 case 'smzf':confirmAction('Récupérer les SMZF','<p>Les soldes de jeu sont clos et la réserve revient au formateur.</p>',()=>{s.smzf=true;s.closed=true;s.balance=s.balance.map(()=>0);log('Réserve SMZF récupérée.');});return;
 case 'next':s.round++;distribute();log('Nouvelle manche préparée.');break;
 case 'proposal':confirmAction('Ouvrir une proposition','<p><label>Texte <input name="title" required value="Passer de 30 à 60 minutes"></label></p><p><label>Durée en minutes <input name="minutes" type="number" min="1" max="120" value="5" required></label></p>',f=>{const title=f.get('title').trim();if(title)s.vote={title,deadline:Date.now()+Number(f.get('minutes'))*60000,votes:{}};});return;
 case 'extend':s.vote.deadline+=300000;log('Vote prolongé de cinq minutes.');break;
 case 'vote':confirmAction('Confirmer le vote',`<p>Choix · ${id}</p>`,()=>{if(Date.now()<s.vote.deadline&&!s.vote.votes[role]){s.vote.votes[role]=id;log('Vote simulé enregistré.');}});return;
 case 'close-vote':{const v=s.vote, votes=Object.values(v.votes),yes=votes.filter(x=>x==='oui').length,no=votes.length-yes;s.history.unshift(`${v.title} · ${yes} oui, ${no} non · ${yes>no?'Adoptée':'Règle actuelle conservée'}`);s.vote=null;break;}
 case 'cancel-vote':s.history.unshift(s.vote.title+' · Annulée');s.vote=null;break;
 }
 update();
}
$('role').addEventListener('change',e=>{role=Number(e.target.value);render();});
$('reset').addEventListener('click',()=>{role=-1;tab='admin';reset();say('Démonstration réinitialisée.');});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.tab){tab=b.dataset.tab;render();}if(b.dataset.action)handle(b.dataset.action,b.dataset.action==='vote'?b.dataset.id:Number(b.dataset.id));});
$('dialog-form').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);$('dialog').close();pending(data);update();});
$('cancel-dialog').addEventListener('click',()=>$('dialog').close());
setInterval(()=>{if(s.phase==='en cours'&&seconds()===0)finish();else if($('clock'))$('clock').textContent=time(seconds());if(s.vote&&$('vote-clock'))$('vote-clock').textContent=time(Math.max(0,Math.ceil((s.vote.deadline-Date.now())/1000)));},1000);
document.addEventListener('change',e=>{
 if(e.target.id!=='players')return;
 const area=$('participants');
 const values=Array.from(area.querySelectorAll('label'),(_,i)=>({name:$('name-'+i).value,wallet:$('wallet-'+i).value}));
 area.innerHTML=participantFields(Number(e.target.value),values);
});
window.addEventListener('storage',e=>{if(e.key===storageKey){const latest=restore();if(latest){s=latest;render();}}});
s=restore();
if(s)render();else reset();
