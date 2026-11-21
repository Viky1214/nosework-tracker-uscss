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
function analyze(lines,dog){
 const head=lines.slice(0,5).join(' ');const date=dateFrom(head);const level=LEVELS.find(l=>norm(head).includes(norm(l)));
 const exercise=EX.find(e=>norm(head).includes(norm(e))||(e==='Véhicules'&&/vehicule/i.test(norm(head)))||(e==='Contenants'&&/contenant/i.test(norm(head))));
 if(!date||!level||!exercise)return null;
 const dogRows=lines.filter(l=>new RegExp(`(^|\\s)${dog.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s|$)`,'i').test(l));
 if(!dogRows.length)return null;
 const row=dogRows[0];const after=row.slice(row.toLowerCase().indexOf(dog.toLowerCase())+dog.length).trim();
 const qMatch=after.match(/^(NQ|Q)\b/i);if(!qMatch)return {date,level,exercise,error:`Qualification illisible : ${row}`};
 const qualified=qMatch[1].toUpperCase()==='Q';
 const time=parseTime(after);
 // Ranking: qualified dogs only, ascending time; do not infer ranking where penalties or irregularities appear.
 const valid=lines.filter(l=>/\sQ\s/.test(' '+l+' ')&&/\d\s*[:;,]\s*\d{2}\s*["'.,:]\s*\d{2}/.test(l)).map(l=>parseTime(l)).filter(Boolean);
 const rank=qualified&&time&&valid.length?String(1+valid.filter(t=>seconds(t)<seconds(time)).length):'';
 // Total entries may be ambiguous with wrapped lines; require manual review.
 return {date,level,exercise,qualified,time:qualified?time:'',rank,participants:'',source:'PDF',review:true};
}
let candidates=[],candidateDogId=null;
const status=$('pdfImportStatus'),preview=$('pdfPreview'),file=$('pdfFile');
$('pdfAnalyze').addEventListener('click',async()=>{
 const selected=file.files?.[0];if(!selected){status.textContent='Sélectionne d’abord un PDF.';return}
 const event=$('pdfEvent').value.trim();if(!event){status.textContent='Renseigne le concours / lieu.';return}
 if(!window.pdfjsLib){status.textContent='Bibliothèque PDF indisponible. Vérifie la connexion Internet.';return}
 status.textContent='Analyse du PDF en cours…';preview.innerHTML='';$('pdfSave').disabled=true;candidateDogId=window.getSelectedDogId?.();
 try{
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await selected.arrayBuffer())}).promise;
  candidates=[];const errors=[];
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i),tc=await page.getTextContent(),lines=pageLines(tc.items);
   const r=analyze(lines,(state.dog||'Viky').trim());
   if(r?.error)errors.push(`Page ${i} : ${r.error}`);
   else if(r)candidates.push({...r,event,id:'',updatedAt:0});
  }
  if(!candidates.length){status.textContent='Aucun résultat exploitable pour '+(state.dog||'Viky')+'. Ce PDF est peut-être scanné ou utilise un autre format. Aucun résultat enregistré.';return}
  status.textContent=`${candidates.length} résultat(s) détecté(s) sur ${pdf.numPages} pages. Vérifie chaque ligne avant d’enregistrer.${errors.length?' '+errors.join(' ; '):''}`;
  preview.innerHTML='<div class="pdf-scroll"><table class="pdf-table"><thead><tr><th>Date</th><th>Niveau</th><th>Exercice</th><th>Q/NQ</th><th>Temps</th><th>Rang</th><th>Participants</th><th>État</th></tr></thead><tbody>'+candidates.map((r,i)=>`<tr><td>${r.date}</td><td>${r.level}</td><td>${r.exercise}</td><td>${r.qualified?'Q':'NQ'}</td><td><input data-i="${i}" data-field="time" value="${r.time}" aria-label="Temps ${r.exercise}"></td><td><input data-i="${i}" data-field="rank" value="${r.rank}" type="number" min="1" aria-label="Rang ${r.exercise}"></td><td><input data-i="${i}" data-field="participants" type="number" min="1" aria-label="Participants ${r.exercise}"></td><td>${state.results.some(x=>sameResult(x,r))?'Déjà présent':'Nouveau'}</td></tr>`).join('')+'</tbody></table></div>';
  $('pdfSave').disabled=false;
 }catch(err){status.textContent='Lecture impossible : '+err.message+' Aucun résultat enregistré.'}
});
function sameResult(a,b){return a.date===b.date&&norm(a.event)===norm(b.event)&&a.level===b.level&&a.exercise===b.exercise}
$('pdfSave').addEventListener('click',async()=>{
 if(!candidates.length)return;
 if(!candidateDogId||candidateDogId!==window.getSelectedDogId?.()){
  status.textContent='Le chien sélectionné a changé. Relance l’analyse du PDF.';return;
 }
 preview.querySelectorAll('input[data-i]').forEach(input=>{candidates[Number(input.dataset.i)][input.dataset.field]=input.value.trim()});
 const invalid=candidates.find(r=>r.time&&!/^\d+:[0-5]\d,\d{2}$/.test(r.time));
 if(invalid){status.textContent='Corrige les temps au format mm:ss,cc avant de valider.';return}
 const incoming=candidates.filter(r=>!state.results.some(x=>sameResult(x,r)));
 if(!incoming.length){status.textContent='Tous les résultats existent déjà. Aucun doublon ajouté.';return}
 if(!confirm(`Ajouter ${incoming.length} nouveau(x) résultat(s) pour « ${state.dog} » ? Les résultats existants ne seront pas modifiés.`))return;
 const button=$('pdfSave');button.disabled=true;status.textContent='Enregistrement Firebase en cours…';
 try{
  const result=await window.saveImportedResults(incoming,candidateDogId);
  status.textContent=`Enregistrement Firebase confirmé : ${result.added} nouveau(x) résultat(s). ${candidates.length-result.added} doublon(s) ignoré(s).`;
  candidates=[];candidateDogId=null;preview.innerHTML='';
 }catch(err){status.textContent='Échec de l’enregistrement : '+err.message+' Vérifie les résultats avant de réessayer.';button.disabled=false}
});
})();
