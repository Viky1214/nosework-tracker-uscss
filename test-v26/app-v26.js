import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,collection,doc,addDoc,setDoc,deleteDoc,onSnapshot,getDocs,writeBatch} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const firebaseConfig={apiKey:'AIzaSyB9GxFSvMM6hnTDD-SMLIKuPtKeU_W4X1Q',authDomain:'nosework-tracker-uscss.firebaseapp.com',projectId:'nosework-tracker-uscss',storageBucket:'nosework-tracker-uscss.firebasestorage.app',messagingSenderId:'844329070212',appId:'1:844329070212:web:3b6228ce5a43c3e7255cd1'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const LEVELS=['Novice','Intermédiaire','Avancé','Senior','Master'],EX=['Intérieur','Extérieur','Véhicules','Contenants'];
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,dogs=[],dogId='',unsubscribeDogs=null,unsubscribeResults=null,loading=true;
const state={dog:'',results:[]};window.state=state;
const status=(message)=>{$('cloudStatus').textContent=message};
const dogsCol=()=>collection(db,'users',user.uid,'dogs');
const resultsCol=()=>collection(db,'users',user.uid,'dogs',dogId,'results');
const ready=()=>!!user&&!!dogId&&!loading;
const show=(id,visible)=>$(id).classList.toggle('hidden',!visible);
for(const id of ['level','entryLevel'])$(id).innerHTML=LEVELS.map(x=>`<option>${x}</option>`).join('');
$('exercise').innerHTML=EX.map(x=>`<option>${x}</option>`).join('');
$('googleLogin').onclick=async()=>{try{await signInWithPopup(auth,provider)}catch(e){status('Connexion impossible : '+e.message)}};
$('googleLogout').onclick=async()=>{await signOut(auth)};
function resetResults(){if(unsubscribeResults)unsubscribeResults();unsubscribeResults=null;state.results=[];state.dog=dogs.find(x=>x.id===dogId)?.name||'';loading=!!dogId;render();if(!user||!dogId)return;unsubscribeResults=onSnapshot(resultsCol(),snap=>{state.results=snap.docs.map(d=>({id:d.id,...d.data()}));loading=false;status(`Synchronisé · ${state.dog} · ${state.results.length} résultat(s)`);render()},e=>{loading=true;status('Lecture impossible : '+e.message);render()})}
function refreshDogSelect(){const s=$('dogSelect');s.innerHTML=dogs.length?dogs.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join(''):'<option value="">Aucun chien</option>';if(!dogs.some(d=>d.id===dogId))dogId=dogs[0]?.id||'';s.value=dogId;resetResults()}
$('dogSelect').onchange=e=>{dogId=e.target.value;resetResults()};
$('addDog').onclick=async()=>{if(!user)return;const name=prompt('Nom du nouveau chien :')?.trim();if(!name)return;if(name.length>70){alert('70 caractères maximum');return}try{const ref=await addDoc(dogsCol(),{name,createdAt:Date.now()});dogId=ref.id;status('Chien ajouté')}catch(e){status('Ajout impossible : '+e.message)}};
$('renameDog').onclick=async()=>{if(!ready())return;const name=prompt('Nouveau nom :',state.dog)?.trim();if(!name||name.length>70)return;try{await setDoc(doc(db,'users',user.uid,'dogs',dogId),{name},{merge:true})}catch(e){status(e.message)}};
$('level').onchange=render;
document.querySelectorAll('nav button[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.tab));render()});
const EX_ICONS={'Intérieur':'<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>','Extérieur':'<path d="m12 3-6 8h3l-5 6h16l-5-6h3z"/><path d="M12 17v5"/>','Véhicules':'<path d="M5 16 6.5 9a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16"/><path d="M5 16h14v4H5z"/><path d="M7 20v2m10-2v2M5 13h14"/>','Contenants':'<path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>'};
const icon=e=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;margin-right:10px;color:#10356e">${EX_ICONS[e]||''}</svg>`;
function progress(level){const r=state.results.filter(x=>x.level===level),counts=Object.fromEntries(EX.map(e=>[e,r.filter(x=>x.exercise===e&&x.qualified).length]));const groups={};for(const x of r){const k=x.date+'|'+x.event.trim().toLowerCase();(groups[k]??=[]).push(x)}const classic=Object.values(groups).filter(g=>EX.every(e=>g.some(x=>x.exercise===e&&x.qualified))).length;const variable=Math.min(...EX.map(e=>Math.floor(counts[e]/3)));return {counts,classic,variable}}
function render(){const active=ready();$('resultForm').querySelector('button[type=submit]').disabled=!active;$('pdfAnalyze').disabled=!active;$('pdfSave').disabled=!active;$('importJson').disabled=!active;
if(!dogId){$('summary').innerHTML='<p class="muted">Ajoutez votre premier chien pour commencer.</p>'; $('historyList').innerHTML='';return}
const lev=$('level').value,{counts,classic,variable}=progress(lev);$('summary').innerHTML=`<div class="stats"><div class="stat">Validations Classique<strong>${classic}</strong></div><div class="stat">Validations Variable<strong>${variable}</strong></div></div><h2>Qualifications · ${esc(lev)}</h2><p class="muted">Pour la prochaine validation Variable (${variable+1}e) : objectif ${3*(variable+1)} qualifications par exercice.</p>`+EX.map(e=>{const n=counts[e],goal=3*(variable+1),missing=Math.max(0,goal-n);return `<div class="exercise">${icon(e)}<b>${e}</b> · ${n} Q <span class="muted">— ${missing?`Encore ${missing} qualification${missing>1?'s':''} nécessaire${missing>1?'s':''}`:'Objectif atteint'}</span><div class="meter"><div class="fill" style="width:${Math.min(100,100*n/goal)}%"></div></div></div>`}).join('')+'<p class="muted">Les qualifications obtenues en Classique sont également comptées en Variable. Chaque validation reste comptabilisée.</p>';
$('historyList').innerHTML=state.results.length?state.results.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<div class="record"><div><b>${esc(r.date)} · ${esc(r.event)}</b><p>${esc(r.level)} · ${esc(r.exercise)} · ${r.qualified?'Q':'NQ'} · ${esc(r.time||'—')} · Rang ${esc(r.rank||'—')}/${esc(r.participants||'—')}</p></div><button data-delete="${esc(r.id)}">Supprimer</button></div>`).join(''):'<p class="muted">Aucun résultat pour le moment.</p>'}
$('resultForm').onsubmit=async e=>{e.preventDefault();if(!ready())return;const o=Object.fromEntries(new FormData(e.target));o.event=o.event.trim();o.qualified=o.qualified==='true';if(!o.date||!o.event)return;const duplicate=state.results.some(r=>r.date===o.date&&r.event.toLowerCase()===o.event.toLowerCase()&&r.level===o.level&&r.exercise===o.exercise);if(duplicate&&!confirm('Un résultat existe déjà pour cet exercice, ce niveau et ce concours. Ajouter quand même ?'))return;o.updatedAt=Date.now();try{await addDoc(resultsCol(),o);$('formMsg').textContent='Résultat enregistré.';e.target.elements.exercise.selectedIndex=(e.target.elements.exercise.selectedIndex+1)%EX.length;e.target.elements.time.value='';e.target.elements.rank.value='';e.target.elements.participants.value=''}catch(err){$('formMsg').textContent='Enregistrement impossible : '+err.message}};
$('historyList').onclick=async e=>{const b=e.target.closest('[data-delete]');if(!b||!ready()||!confirm('Supprimer ce résultat ?'))return;try{await deleteDoc(doc(resultsCol(),b.dataset.delete))}catch(err){status('Suppression impossible : '+err.message)}};
function download(name,content,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('exportJson').onclick=()=>{if(!ready())return;download('nosework-'+state.dog+'-sauvegarde.json',JSON.stringify({dog:state.dog,results:state.results},null,2),'application/json')};
$('exportCsv').onclick=()=>{if(!ready())return;const cols=['date','event','level','exercise','qualified','time','rank','participants'];const csv=[['Date','Concours','Niveau','Exercice','Qualification','Temps','Rang','Participants'],...state.results.map(r=>cols.map(k=>k==='qualified'?(r[k]?'Q':'NQ'):r[k]??''))].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');download('nosework-resultats.csv','\ufeff'+csv,'text/csv;charset=utf-8')};
$('importJson').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||!ready())return;try{const v=JSON.parse(await file.text());if(!Array.isArray(v.results)||v.results.some(r=>!LEVELS.includes(r.level)||!EX.includes(r.exercise)||typeof r.date!=='string'||typeof r.event!=='string'||typeof r.qualified!=='boolean'))throw Error('Format de sauvegarde invalide');const existing=new Set(state.results.map(r=>r.id));const incoming=v.results.filter(r=>!r.id||!existing.has(String(r.id)));if(!confirm(`Importer ${incoming.length} résultat(s) dans « ${state.dog} » ? Aucun résultat existant ne sera supprimé. Vérifiez que le bon chien est sélectionné.`))return;const uid=user.uid,selectedDog=dogId;let added=0;for(let i=0;i<incoming.length;i+=400){const batch=writeBatch(db);for(const r of incoming.slice(i,i+400)){const id=r.id&&/^[a-zA-Z0-9_-]{1,120}$/.test(String(r.id))?String(r.id):doc(collection(db,'users',uid,'dogs',selectedDog,'results')).id;const ref=doc(db,'users',uid,'dogs',selectedDog,'results',id);const clean={date:r.date,event:r.event,level:r.level,exercise:r.exercise,qualified:r.qualified,time:String(r.time||''),rank:String(r.rank||''),participants:String(r.participants||''),updatedAt:Number(r.updatedAt)||Date.now()};batch.set(ref,clean);added++}await batch.commit()}alert(`${added} résultat(s) importé(s). Contrôlez les totaux.`)}catch(err){alert('Import impossible : '+err.message)}};
// Import PDF : écriture explicite, sans modifier l'état local avant confirmation Firebase.
window.saveImportedResults=async (items,expectedDogId)=>{
 if(!ready()||dogId!==expectedDogId)throw Error('Le chien sélectionné a changé. Relancez l’analyse.');
 const uid=user.uid, selectedDog=dogId;
 const col=collection(db,'users',uid,'dogs',selectedDog,'results');
 const snap=await getDocs(col);
 const key=r=>[r.date,String(r.event||'').trim().toLowerCase(),r.level,r.exercise].join('|');
 const known=new Set(snap.docs.map(d=>key(d.data())));
 const unique=[];
 for(const r of items){const k=key(r);if(!known.has(k)){known.add(k);unique.push(r)}}
 if(!unique.length)return {added:0,skipped:items.length};
 for(let i=0;i<unique.length;i+=400){
  const batch=writeBatch(db);
  for(const r of unique.slice(i,i+400)){
   const ref=doc(col);
   batch.set(ref,{date:r.date,event:r.event,level:r.level,exercise:r.exercise,qualified:r.qualified,time:String(r.time||''),rank:String(r.rank||''),participants:String(r.participants||''),updatedAt:Date.now()});
  }
  await batch.commit();
 }
 return {added:unique.length,skipped:items.length-unique.length};
};
window.getSelectedDogId=()=>dogId;
// Compatibilité avec le module d'import PDF : les écritures partent vers Firestore.
window.save=async()=>{if(!ready())throw Error('Connexion requise');const current=await getDocs(resultsCol());const known=new Set(current.docs.map(d=>d.id));const pending=state.results.filter(r=>!known.has(r.id));for(const r of pending){const {id,...data}=r;await addDoc(resultsCol(),data)}render()};
onAuthStateChanged(auth,u=>{if(unsubscribeDogs)unsubscribeDogs();if(unsubscribeResults)unsubscribeResults();unsubscribeDogs=unsubscribeResults=null;user=u;dogs=[];dogId='';state.results=[];state.dog='';loading=true;show('loggedOut',!u);show('loggedIn',!!u);show('appArea',!!u);$('userName').textContent=u?.displayName||u?.email||'';if(!u){status('Connectez-vous pour accéder à vos données.');return}status('Chargement de vos chiens…');unsubscribeDogs=onSnapshot(dogsCol(),snap=>{dogs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));refreshDogSelect()},e=>status('Erreur de lecture des chiens : '+e.message))});
