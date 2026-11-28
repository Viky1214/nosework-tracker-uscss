/* Import USCSS text-based PDFs. No OCR: scanned/image-only PDFs require manual entry. */
(()=>{
const $=id=>document.getElementById(id);
const LEVELS=['Novice','Intermédiaire','Avancé','Senior','Master'];
const EX=['Intérieur','Extérieur','Véhicules','Contenants'];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const parseTime=s=>{const m=String(s||'').match(/(\d{1,2})\s*[:;,]\s*(\d{2})\s*["'.,:]\s*(\d{2})/);return m?`${Number(m[1])}:${m[2]},${m[3]}`:''};
const seconds=t=>{const m=t.match(/(\d+):(\d{2}),(\d{2})/);return m?Number(m[1])*60+Number(m[2])+Number(m[3])/100:Infinity};
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const french=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
function dateFrom(s){s=norm(s);let m=s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);if(m)return m[0];m=s.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(20\d{2})\b/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;m=s.match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/);if(m&&french.includes(m[2]))return `${m[3]}-${String(french.indexOf(m[2])+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;m=s.match(/\b([a-z]+)\s+(\d{1,2}),?\s+(20\d{2})\b/);if(m&&months.includes(m[1].slice(0,3)))return `${m[3]}-${String(months.indexOf(m[1].slice(0,3))+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`;return ''}
// Mobile OCR can put the level on the line AFTER the result.
function normalizeUSCSSRows(text){
 const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const out=[];
 const levelOnly=/^(Novice(?:\s+[AB])?|Intermediate|Advanced|Senior|Master)\s*$/i;
 const exerciseStart=/^(Interior|Exterior|Vehicles?|Containers?)\b/i;
 for(let i=0;i<lines.length;i++){
  let row=lines[i];
  if(exerciseStart.test(row)&&! /\b(novice|intermediate|advanced|senior|master)\b/i.test(row)&&levelOnly.test(lines[i+1]||'')){
   const level=lines[++i];
   row=row.replace(exerciseStart,m=>m+' '+level);
  }
  out.push(row);
 }
 return out.join('\n');
}
function parseUSCSS(text){text=normalizeUSCSSRows(text);let date='',event='',award='',out=[];for(const raw of text.split(/\n/)){const row=raw.trim(),d=dateFrom(row);if(d&&/classic|variable|classique/i.test(row)){date=d;event=row.replace(/^#+\s*/,'').replace(/\b(?:[a-z]+\s+\d{1,2},?\s+20\d{2}|20\d{2}-\d{2}-\d{2}|\d{1,2}\s+[a-z]+\s+20\d{2}).*$/i,'').replace(/,?\s*FR\s*$/i,'').trim();award='';continue}if(/^high champion/i.test(row)){award=row;continue}const l=norm(row),time=parseTime(row),q=row.match(/\b(NQ|Q)\s*\|?\s*$/i);const level=[['novice','Novice'],['intermediate','Intermédiaire'],['advanced','Avancé'],['senior','Senior'],['master','Master']].find(x=>l.includes(x[0]))?.[1];const exercise=[['interior','Intérieur'],['exterior','Extérieur'],['vehicle','Véhicules'],['container','Contenants']].find(x=>l.includes(x[0]))?.[1];if(!date||!event||!time||!q||!level||!exercise)continue;const rank=row.match(/\b(\d+)(?:st|nd|rd|th)\b/i)?.[1]||'';const points=row.slice(row.indexOf(row.match(/\d{1,2}\s*[:;,]\s*\d{2}\s*[.,:]\s*\d{2}/)?.[0]||'')+time.length).match(/\b(\d{1,3}[.,]\d{2})\b/)?.[1]||'';out.push({date,event,level,exercise,attempt:'',qualified:q[1].toUpperCase()==='Q',time,rank,participants:'',points,eventAward:award,distinction:[row.match(/High in Class[^|\n]*?(?:\d+(?:st|nd|rd|th))/i)?.[0]].filter(Boolean).join(' · '),source:'USCSS',anonymous:true})}return out}
window.parseUSCSS=parseUSCSS;
function pageLines(items){
 const groups=[];
 for(const it of items){if(!it.str?.trim())continue;const y=it.transform?.[5]||0;let g=groups.find(g=>Math.abs(g.y-y)<2.8);if(!g){g={y,items:[]};groups.push(g)}g.items.push({x:it.transform?.[4]||0,text:it.str})}
 return groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ').replace(/\s+/g,' ').trim());
}
function analyze(lines,dog,fallbackDate){
 const out=[];let level='',exercise='',attempt='',rows=[];const date=dateFrom(lines.join(' '))||fallbackDate;
 const identify=l=>({level:LEVELS.find(x=>norm(l).includes(norm(x))),exercise:EX.find(x=>norm(l).includes(norm(x))||(x==='Véhicules'&&/vehicule/.test(norm(l)))||(x==='Contenants'&&/contenant|conteneur/.test(norm(l))))});
 const named={test:row=>(' '+norm(row).replace(/[^\p{L}\p{N}]+/gu,' ')+' ').includes(' '+norm(dog)+' ')};
 const personal=lines.some(l=>/classe.*cachettes.*temps.*resultat/.test(norm(l)));
 function flush(){for(const row of rows){if(!named.test(row))continue;const time=parseTime(row);const q=row.match(/(?:^|\s)(NQ|Q)(?=\s|$)/gi);if(!time||!q)continue;const qualified=q.at(-1).trim().toUpperCase()==='Q';const rank=qualified?(row.match(/^\s*(\d+)(?:er|e|eme)?\s/i)?.[1]||''):'';out.push({date,level,exercise,attempt,qualified,time,rank,participants:String(rows.length),source:'PDF'});}rows=[];}
 for(const row of lines){const id=identify(row),time=parseTime(row);if(personal&&id.level&&id.exercise&&time){const q=row.match(/\b(NQ|Q)\s*$/i);if(q)out.push({date,level:id.level,exercise:id.exercise,attempt:'',qualified:q[1].toUpperCase()==='Q',time,rank:row.match(/\b(\d+)(?:er|e)\b/i)?.[1]||row.match(/niveau avance\s+(\d+)\b/i)?.[1]||'',participants:'',source:'PDF',anonymous:true});continue;}
 if(id.level&&id.exercise&&!time){flush();level=id.level;exercise=id.exercise;attempt=row.match(/(?:contenant[s]?|conteneur[s]?|vehicule[s]?|interieur|exterieur)\s*(\d+)\b/i)?.[1]||'';continue;}
 if(!time&&/challenge|double defi|jeu \d/i.test(norm(row))){flush();level='';exercise='';continue;}
 if(level&&exercise&&time&&/\b(?:Q|NQ)\b/i.test(row))rows.push(row);
 }flush();return out;
}
let candidates=[],candidateDogId=null;
const status=$('pdfImportStatus'),preview=$('pdfPreview'),file=$('pdfFile');
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showPreview(){
 const awards=[...new Set(candidates.filter(r=>r.eventAward).map(r=>r.date+' · '+r.event+' — '+r.eventAward))];
  preview.innerHTML=awards.map(a=>'<p class="event-award">'+escapeHTML(a)+'</p>').join('')+'<div class="pdf-scroll"><table class="pdf-table"><thead><tr><th>Date / Concours</th><th>Niveau</th><th>Exercice</th><th>Q/NQ</th><th>Temps</th><th>Rang</th><th>Participants</th><th>Points / Distinction</th><th>État</th></tr></thead><tbody>'+candidates.map((r,i)=>`<tr><td>${r.date} · ${escapeHTML(r.event)}</td><td>${r.level}</td><td>${r.exercise} ${r.attempt||''}</td><td>${r.qualified?'Q':'NQ'}</td><td><input data-i="${i}" data-field="time" value="${r.time}" aria-label="Temps ${r.exercise}"></td><td><input data-i="${i}" data-field="rank" value="${r.rank}" type="number" min="1" aria-label="Rang ${r.exercise}"></td><td><input data-i="${i}" data-field="participants" value="${r.participants}" type="number" min="1" aria-label="Participants ${r.exercise}"></td><td>${escapeHTML(r.points)} ${escapeHTML(r.distinction)}</td><td>${resultStatus(r)}</td></tr>`).join('')+'</tbody></table></div>';
  $('pdfSave').disabled=!candidates.some(r=>resultStatus(r)==='Nouveau');
}
let cache=null, busy=false, cancelled=false, worker=null;
function setBusy(v){busy=v;for(const id of ['pdfAnalyze','textAnalyze','imageAnalyze'])$(id).disabled=v;$('cancelOCR').disabled=!v;}
$('cancelOCR').onclick=()=>{cancelled=true;status.textContent='Annulation en cours…';if(worker)worker.terminate().catch(()=>{});if(cancelReject)cancelReject(Error('Analyse annulée'));};
let cancelReject=null;
async function timed(p,ms=120000){let t;try{return await Promise.race([p,new Promise((_,reject)=>{cancelReject=reject;t=setTimeout(()=>reject(Error('Délai OCR dépassé')),ms)})])}finally{clearTimeout(t);cancelReject=null}}
async function recognize(canvas){if(cancelled)throw Error('Analyse annulée');if(!window.Tesseract)throw Error('OCR indisponible');if(!worker)worker=await timed(Tesseract.createWorker('fra+eng',1,{logger:m=>{if(m.status==='recognizing text')status.textContent=ocrLabel+' · '+Math.round(m.progress*100)+' %'}}));const r=await timed(worker.recognize(canvas));if(cancelled)throw Error('Analyse annulée');return r.data.text}
let ocrLabel='OCR';
async function cleanup(){if(worker){try{await worker.terminate()}catch{}worker=null}setBusy(false)}
function acceptUSCSS(text,expectedDog){if(expectedDog!==window.getSelectedDogId?.())throw Error('Le chien sélectionné a changé');candidates=parseUSCSS(text);candidateDogId=expectedDog;if(!candidates.length){status.textContent='Aucun résultat USCSS reconnu. Vérifiez le texte ou utilisez le copier-coller.';return}if(!confirm('Confirmer que ces résultats appartiennent à '+state.dog+' ?')){candidates=[];return}status.textContent=candidates.length+' résultats détectés. Vérifiez chaque ligne.';showPreview()}
$('textAnalyze').onclick=()=>{if(busy)return;preview.innerHTML='';candidates=[];$('pdfSave').disabled=true;const id=window.getSelectedDogId?.();if(!id)return;acceptUSCSS($('uscssText').value,id)};
$('imageAnalyze').onclick=async()=>{if(busy)return;const id=window.getSelectedDogId?.();if(!id)return;const files=[...$('imageFiles').files,...$('cameraFile').files];if(!files.length)return;preview.innerHTML='';candidates=[];$('pdfSave').disabled=true;cancelled=false;setBusy(true);try{let text='';for(let i=0;i<files.length;i++){ocrLabel=`OCR image ${i+1}/${files.length}`;status.textContent=ocrLabel;text+='\n'+await recognize(files[i])} $('uscssText').value=text;acceptUSCSS(text,id)}catch(e){status.textContent=e.message}finally{await cleanup()}};
$('pdfAnalyze').addEventListener('click',async()=>{
 if(busy)return; candidates=[];$('pdfSave').disabled=true;preview.innerHTML='';const selected=file.files?.[0];if(!selected){status.textContent='Sélectionne d’abord un PDF.';return}
 const event=$('pdfEvent').value.trim();if(!event){status.textContent='Renseigne le concours / lieu.';return}
 if(!window.pdfjsLib){status.textContent='Bibliothèque PDF indisponible. Vérifie la connexion Internet.';return}
 status.textContent='Analyse du PDF en cours…';preview.innerHTML='';$('pdfSave').disabled=true;candidateDogId=window.getSelectedDogId?.();
 const dog=state.dog; if(!candidateDogId||!dog){status.textContent='Sélectionne un chien.';return} cancelled=false;setBusy(true);
 try{
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  if(!cache||cache.file!==selected){const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await selected.arrayBuffer())}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
   if(cancelled)throw Error('Analyse annulée');const page=await pdf.getPage(i),tc=await page.getTextContent(),lines=pageLines(tc.items);
   let extracted=lines;
   if(!lines.length){status.textContent=`OCR page ${i}/${pdf.numPages}…`;if(!window.Tesseract)throw Error('OCR indisponible');const canvas=document.createElement('canvas'),viewport=page.getViewport({scale:2.5});canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;ocrLabel=`OCR page ${i}/${pdf.numPages}`;const text=await recognize(canvas);extracted=text.split(/\n/).map(x=>x.trim()).filter(Boolean);canvas.width=canvas.height=0;}
   pages.push(extracted);
  }cache={file:selected,pages};} const errors=[];const globalDate=dateFrom(cache.pages.flat().join(' '))||$('pdfDate').value;for(const lines of cache.pages){const found=analyze(lines,dog,globalDate);candidates.push(...found.map(r=>({...r,event,id:'',updatedAt:0})));}if(candidateDogId!==window.getSelectedDogId?.())throw Error('Le chien sélectionné a changé');
  if(candidates.some(r=>!r.date)){status.textContent='Date absente du PDF : renseigne la date du concours et relance.';return}
  if(candidates.some(r=>r.anonymous)&&!confirm('PDF sans nom de chien : confirmer que ces résultats appartiennent à '+dog+' ?')){candidates=[];return}
  if(!candidates.length){status.textContent='Aucun résultat exploitable pour '+(state.dog||'Viky')+'. Ce PDF est peut-être scanné ou utilise un autre format. Aucun résultat enregistré.';return}
  status.textContent=`${candidates.length} résultat(s) détecté(s) sur ${cache.pages.length} pages. Vérifie chaque ligne avant d’enregistrer.${errors.length?' '+errors.join(' ; '):''}`;
  showPreview();
 }catch(err){status.textContent='Lecture impossible : '+err.message+' Aucun résultat enregistré.'}finally{await cleanup()}
});
// Compare accents, case, whitespace and punctuation without confusing distinct events.
function eventKey(s){return norm(s).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function sameResult(a,b){return a.date===b.date&&eventKey(a.event)===eventKey(b.event)&&a.level===b.level&&a.exercise===b.exercise&&String(a.attempt||'')===String(b.attempt||'')}
function possibleDuplicate(a,b){
 if(a.date!==b.date||a.level!==b.level||a.exercise!==b.exercise)return false;
 const stripTest=s=>eventKey(s).replace(/(?:^| )test$/,'').trim();
 return (stripTest(a.event)===stripTest(b.event)||stripTest(a.event).startsWith(stripTest(b.event)+' ')||stripTest(b.event).startsWith(stripTest(a.event)+' '))&&(!a.attempt||!b.attempt||a.attempt===b.attempt);
}
function resultStatus(r){
 if(state.results.some(x=>sameResult(x,r)))return 'Déjà présent';
 if(state.results.some(x=>possibleDuplicate(x,r)))return 'Doublon potentiel';
 return 'Nouveau';
}
$('pdfSave').addEventListener('click',async()=>{
 if(!candidates.length)return;
 if(!candidateDogId||candidateDogId!==window.getSelectedDogId?.()){
  status.textContent='Le chien sélectionné a changé. Relance l’analyse du PDF.';return;
 }
 preview.querySelectorAll('input[data-i]').forEach(input=>{candidates[Number(input.dataset.i)][input.dataset.field]=input.value.trim()});
 const invalid=candidates.find(r=>r.time&&!/^\d+:[0-5]\d,\d{2}$/.test(r.time));
 if(invalid){status.textContent='Corrige les temps au format mm:ss,cc avant de valider.';return}
 const incoming=candidates.filter(r=>resultStatus(r)==='Nouveau');
 const potential=candidates.filter(r=>resultStatus(r)==='Doublon potentiel').length;
 if(!incoming.length){status.textContent=potential?`${potential} doublon(s) potentiel(s) non importé(s). Vérifie le nom du concours ou saisis manuellement les résultats s’il s’agit d’un autre concours.`:'Tous les résultats existent déjà. Aucun doublon ajouté.';return}
 if(potential&&!confirm(`${potential} doublon(s) potentiel(s) seront exclus de cet import. Continuer avec ${incoming.length} résultat(s) clairement nouveaux ?`))return;
 if(!confirm(`Ajouter ${incoming.length} nouveau(x) résultat(s) pour « ${state.dog} » ? Les résultats existants ne seront pas modifiés.`))return;
 const button=$('pdfSave');button.disabled=true;status.textContent='Enregistrement Firebase en cours…';
 try{
  const result=await window.saveImportedResults(incoming,candidateDogId);
  status.textContent=`Enregistrement Firebase confirmé : ${result.added} nouveau(x) résultat(s). ${candidates.length-result.added} résultat(s) non ajouté(s) (déjà présents ou à vérifier).`;
  candidates=[];candidateDogId=null;preview.innerHTML='';cache=null;for(const id of ['uscssText','imageFiles','cameraFile','pdfFile','pdfEvent','pdfDate'])$(id).value='';
 }catch(err){status.textContent='Échec de l’enregistrement : '+err.message+' Vérifie les résultats avant de réessayer.';button.disabled=false}
});
})();
