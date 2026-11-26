/* Import USCSS text-based PDFs. No OCR: scanned/image-only PDFs require manual entry. */
(()=>{
const $=id=>document.getElementById(id);
const LEVELS=['Novice','Intermédiaire','Avancé','Senior','Master'];
const EX=['Intérieur','Extérieur','Véhicules','Contenants'];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const parseTime=s=>{const m=String(s||'').match(/(\d{1,2})\s*[:;,]\s*(\d{2})\s*["'.,:]\s*(\d{2})/);return m?`${Number(m[1])}:${m[2]},${m[3]}`:''};
const seconds=t=>{const m=t.match(/(\d+):(\d{2}),(\d{2})/);return m?Number(m[1])*60+Number(m[2])+Number(m[3])/100:Infinity};
const dateFrom=s=>{const m=s.match(/(?:date\s*:\s*)?(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/i);return m?`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
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
 for(const row of lines){const id=identify(row),time=parseTime(row);if(personal&&id.level&&id.exercise&&time){const q=row.match(/\b(NQ|Q)\s*$/i);if(q)out.push({date,level:id.level,exercise:id.exercise,attempt:'',qualified:q[1].toUpperCase()==='Q',time,rank:row.match(/\b(\d+)(?:er|e)\b/i)?.[1]||'',participants:'',source:'PDF',anonymous:true});continue;}
 if(id.level&&id.exercise&&!time){flush();level=id.level;exercise=id.exercise;attempt=row.match(/(?:contenant[s]?|conteneur[s]?|vehicule[s]?|interieur|exterieur)\s*(\d+)\b/i)?.[1]||'';continue;}
 if(!time&&/challenge|double defi|jeu \d/i.test(norm(row))){flush();level='';exercise='';continue;}
 if(level&&exercise&&time&&/\b(?:Q|NQ)\b/i.test(row))rows.push(row);
 }flush();return out;
}
let candidates=[],candidateDogId=null;
const status=$('pdfImportStatus'),preview=$('pdfPreview'),file=$('pdfFile');
$('pdfAnalyze').addEventListener('click',async()=>{
 candidates=[];$('pdfSave').disabled=true;preview.innerHTML='';const selected=file.files?.[0];if(!selected){status.textContent='Sélectionne d’abord un PDF.';return}
 const event=$('pdfEvent').value.trim();if(!event){status.textContent='Renseigne le concours / lieu.';return}
 if(!window.pdfjsLib){status.textContent='Bibliothèque PDF indisponible. Vérifie la connexion Internet.';return}
 status.textContent='Analyse du PDF en cours…';preview.innerHTML='';$('pdfSave').disabled=true;candidateDogId=window.getSelectedDogId?.();
 const dog=state.dog; if(!candidateDogId||!dog){status.textContent='Sélectionne un chien.';return} $('pdfAnalyze').disabled=true;
 try{
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await selected.arrayBuffer())}).promise;
  candidates=[];const errors=[];
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i),tc=await page.getTextContent(),lines=pageLines(tc.items);
   let extracted=lines;
   if(!lines.length){status.textContent=`OCR page ${i}/${pdf.numPages}…`;if(!window.Tesseract)throw Error('OCR indisponible');const canvas=document.createElement('canvas'),viewport=page.getViewport({scale:2.5});canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;const result=await Tesseract.recognize(canvas,'fra+eng');extracted=result.data.text.split(/\n/).map(x=>x.trim()).filter(Boolean);canvas.width=canvas.height=0;}
   const found=analyze(extracted,dog,$('pdfDate').value);candidates.push(...found.map(r=>({...r,event,id:'',updatedAt:0})));
  }
  if(candidates.some(r=>!r.date)){status.textContent='Date absente du PDF : renseigne la date du concours et relance.';return}
  if(candidates.some(r=>r.anonymous)&&!confirm('PDF sans nom de chien : confirmer que ces résultats appartiennent à '+dog+' ?')){candidates=[];return}
  if(!candidates.length){status.textContent='Aucun résultat exploitable pour '+(state.dog||'Viky')+'. Ce PDF est peut-être scanné ou utilise un autre format. Aucun résultat enregistré.';return}
  status.textContent=`${candidates.length} résultat(s) détecté(s) sur ${pdf.numPages} pages. Vérifie chaque ligne avant d’enregistrer.${errors.length?' '+errors.join(' ; '):''}`;
  preview.innerHTML='<div class="pdf-scroll"><table class="pdf-table"><thead><tr><th>Date</th><th>Niveau</th><th>Exercice</th><th>Q/NQ</th><th>Temps</th><th>Rang</th><th>Participants</th><th>État</th></tr></thead><tbody>'+candidates.map((r,i)=>`<tr><td>${r.date}</td><td>${r.level}</td><td>${r.exercise} ${r.attempt||''}</td><td>${r.qualified?'Q':'NQ'}</td><td><input data-i="${i}" data-field="time" value="${r.time}" aria-label="Temps ${r.exercise}"></td><td><input data-i="${i}" data-field="rank" value="${r.rank}" type="number" min="1" aria-label="Rang ${r.exercise}"></td><td><input data-i="${i}" data-field="participants" value="${r.participants}" type="number" min="1" aria-label="Participants ${r.exercise}"></td><td>${resultStatus(r)}</td></tr>`).join('')+'</tbody></table></div>';
  $('pdfSave').disabled=false;
 }catch(err){status.textContent='Lecture impossible : '+err.message+' Aucun résultat enregistré.'}finally{$('pdfAnalyze').disabled=false}
});
// Compare accents, case, whitespace and punctuation without confusing distinct events.
function eventKey(s){return norm(s).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function sameResult(a,b){return a.date===b.date&&eventKey(a.event)===eventKey(b.event)&&a.level===b.level&&a.exercise===b.exercise&&String(a.attempt||'')===String(b.attempt||'')}
function possibleDuplicate(a,b){
 if(a.date!==b.date||a.level!==b.level||a.exercise!==b.exercise)return false;
 const stripTest=s=>eventKey(s).replace(/(?:^| )test$/,'').trim();
 return stripTest(a.event)===stripTest(b.event)&&(!a.attempt||!b.attempt||a.attempt===b.attempt);
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
  candidates=[];candidateDogId=null;preview.innerHTML='';
 }catch(err){status.textContent='Échec de l’enregistrement : '+err.message+' Vérifie les résultats avant de réessayer.';button.disabled=false}
});
})();
