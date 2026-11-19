/* Google Drive sync: OAuth browser token, no client secret. */
const DRIVE_CLIENT_ID='965548811272-ch43hjusk807pce7cgfu3eoc6cv08ob2.apps.googleusercontent.com';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const DRIVE_FILENAME='nosework-tracker-viky-sync.json';
let driveToken='',driveFileId='',driveBusy=false,drivePending=false,driveClient=null;
const driveStatus=()=>document.getElementById('driveStatus');
function driveMessage(msg){if(driveStatus())driveStatus().textContent=msg}
function driveAuthInit(){if(!window.google?.accounts?.oauth2){driveMessage('Connexion Google indisponible. Vérifier Internet.');return}driveClient=google.accounts.oauth2.initTokenClient({client_id:DRIVE_CLIENT_ID,scope:DRIVE_SCOPE,callback:async response=>{if(response.error){driveMessage('Connexion refusée : '+response.error);return}driveToken=response.access_token;document.getElementById('driveConnect').textContent='Reconnecter Google Drive';driveMessage('Connecté. Synchronisation en cours…');await driveSync()}});driveMessage('Non connecté à Google Drive. Les données restent enregistrées localement.')}
function driveConnect(){if(!driveClient){driveMessage('Google n’est pas encore chargé. Réessayez dans un instant.');return}driveClient.requestAccessToken({prompt:driveToken?'':'consent'})}
async function driveRequest(url,opts={}){const res=await fetch(url,{...opts,headers:{Authorization:'Bearer '+driveToken,...opts.headers}});if(res.status===401){driveToken='';throw Error('Session Google expirée : reconnectez Google Drive')}if(!res.ok)throw Error('Google Drive : '+res.status+' '+(await res.text()).slice(0,180));return res}
async function driveFind(){const q=encodeURIComponent("name = '"+DRIVE_FILENAME+"' and trashed = false");const res=await driveRequest('https://www.googleapis.com/drive/v3/files?q='+q+'&fields=files(id,name),nextPageToken&page_size=100');const json=await res.json();return json.files?.[0]?.id||''}
async function driveRead(id){const r=await driveRequest('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media');return r.json()}
async function driveWrite(data){const body=JSON.stringify(data);if(driveFileId){await driveRequest('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(driveFileId)+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body});return}const boundary='nosework_'+Date.now();const multipart='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:DRIVE_FILENAME,mimeType:'application/json'})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+boundary+'--';const r=await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:multipart});driveFileId=(await r.json()).id}
// Exact duplicate detection: different IDs may represent the same imported result.
// Include performance fields so distinct attempts are not collapsed merely because
// they share a competition, level and exercise.
function resultFingerprint(r){
 const clean=v=>String(v??'').trim().normalize('NFC').toLocaleLowerCase('fr').replace(/\s+/g,' ');
 const time=v=>clean(v).replace(/^0+(?=\d)/,'').replace(/^(\d+):(\d{2})[.,](\d{2})$/,(_,m,sec,cs)=>`${Number(m)}:${sec},${cs}`);
 return [clean(r.date),clean(r.event),clean(r.level),clean(r.exercise),String(!!r.qualified),time(r.time),clean(r.rank),clean(r.participants)].join('|');
}
function mergeStates(local,remote){
 if(!remote||!Array.isArray(remote.results))throw Error('Sauvegarde distante invalide');
 const removed={};for(const [id,t] of [...Object.entries(remote.deleted||{}),...Object.entries(local.deleted||{})])removed[id]=Math.max(Number(removed[id]||0),Number(t||0));
 const byId=new Map();
 for(const item of [...remote.results,...local.results]){
  if(!item.id)continue;
  const prior=byId.get(item.id);
  if(!prior||Number(item.updatedAt||0)>=Number(prior.updatedAt||0))byId.set(item.id,item);
 }
 for(const [id,time] of Object.entries(removed)){
  const item=byId.get(id);
  if(item&&Number(time)>=Number(item.updatedAt||0))byId.delete(id);
 }
 const fingerprints=new Map();const results=[];
 for(const item of byId.values()){
  const key=resultFingerprint(item),prior=fingerprints.get(key);
  if(prior){
   const keep=String(prior.id)<String(item.id)?prior:item;
   const discard=keep===prior?item:prior;
   removed[discard.id]=Math.max(Number(removed[discard.id]||0),Number(discard.updatedAt||0),Date.now());
   if(keep!==prior){results[results.indexOf(prior)]=keep;fingerprints.set(key,keep)}
  }else{fingerprints.set(key,item);results.push(item)}
 }
 return {dog:(Number(local.dogUpdatedAt||0)>=Number(remote.dogUpdatedAt||0)?local.dog:remote.dog)||'',dogUpdatedAt:Math.max(Number(local.dogUpdatedAt||0),Number(remote.dogUpdatedAt||0)),results,deleted:removed};
}
async function driveSync(){if(!driveToken)return;if(driveBusy){drivePending=true;return}driveBusy=true;try{driveMessage('Synchronisation Google Drive…');driveFileId=await driveFind();const remote=driveFileId?await driveRead(driveFileId):{dog:'',results:[],deleted:{}};const merged=mergeStates(state,remote);state=merged;localStorage.setItem(KEY,JSON.stringify(state));$('dog').value=state.dog;render();await driveWrite(state);driveMessage('Google Drive synchronisé ✓ · '+new Date().toLocaleTimeString('fr-CH'))}catch(err){driveMessage('Synchronisation impossible : '+err.message+'. Données conservées sur cet appareil.')}finally{driveBusy=false;if(drivePending){drivePending=false;driveSync()}}}
function driveChanged(){if(driveToken)driveSync();else driveMessage('Modifications sauvegardées sur cet appareil. Connectez Google Drive pour synchroniser.')}
document.getElementById('driveConnect').addEventListener('click',driveConnect);
document.getElementById('driveSyncNow').addEventListener('click',()=>driveToken?driveSync():driveConnect());
window.addEventListener('online',()=>{if(driveToken)driveSync()});
window.addEventListener('focus',()=>{if(driveToken)driveSync()});
window.addEventListener('load',driveAuthInit);
