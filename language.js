(()=>{
const dictionaries={
fr:{'Suivi des concours et des qualifications':'Suivi des concours et des qualifications'},
en:{
'Suivi des concours et des qualifications':'Competition and qualification tracking',
'Progression':'Progress','Ajouter':'Add result','Historique':'History','Données & aide':'Data & help',
'Chien':'Dog','Niveau':'Level','Ajouter un résultat':'Add a result',
'Importer les résultats d’un PDF USCSS':'Import USCSS PDF results',
'Pour les PDF contenant du texte (comme Mouriès). Aucun enregistrement sans confirmation. Les classements généraux et les PDF scannés ne sont pas encore pris en charge.':'For text-based PDFs (such as Mouriès). No results are saved without confirmation. Overall rankings and scanned PDFs are not yet supported.',
'Concours / lieu':'Competition / location','Document PDF':'PDF document','Analyser le PDF':'Analyze PDF','Enregistrer les nouveaux résultats':'Save new results',
'Une ligne par exercice. Les quatre qualifications du même concours sont reconnues automatiquement comme une validation Classique.':'One entry per exercise. Four qualifications in the same competition count as a Classic validation.',
'Date':'Date','Exercice':'Exercise','Qualification':'Qualification','Temps (mm:ss,cc)':'Time (mm:ss.cc)','Rang':'Rank','Participants':'Participants','Enregistrer le résultat':'Save result',
'Chaque résultat reste modifiable en le supprimant puis en le ressaisissant.':'To correct a result, delete it and enter it again.',
'Synchronisation Google Drive':'Google Drive synchronization',
'Les données restent sur cet appareil et sont synchronisées avec votre Google Drive lorsque vous êtes connecté. Après réouverture de l’application, reconnectez Google Drive pour reprendre la synchronisation.':'Your data stays on this device and syncs with Google Drive when connected. Reconnect Google Drive after reopening the app to resume synchronization.',
'Connecter Google Drive':'Connect Google Drive','Synchroniser maintenant':'Sync now',
'Sauvegarde et transfert':'Backup and transfer','Conservez également une sauvegarde JSON indépendante de Google Drive.':'Keep an independent JSON backup outside Google Drive.',
'Exporter la sauvegarde JSON':'Export JSON backup','Exporter les résultats CSV':'Export results CSV','Importer une sauvegarde JSON':'Import JSON backup',
'Mode d\'emploi':'Instructions',
'Nom du chien':'Dog name','Nom du concours':'Competition name','Ex. Mouriès':'E.g. Mouriès',
'Qualifiée (Q)':'Qualified (Q)','Non qualifiée (NQ)':'Not qualified (NQ)',
'Intérieur':'Interior','Extérieur':'Exterior','Véhicules':'Vehicles','Contenants':'Containers','Intermédiaire':'Intermediate','Avancé':'Advanced',
'Validations Classique':'Classic validations','Validations Variable':'Variable validations',
'Qualifications':'Qualifications','Supprimer':'Delete','Aucun résultat pour le moment.':'No results yet.',
'Résultat enregistré.':'Result saved.'
}}
const original=new WeakMap();const translatedOptions=new WeakMap();
function translateText(el,lang){
 if(!original.has(el))original.set(el,el.nodeValue);
 const source=original.get(el);if(!source.trim())return;
 const normalized=source.trim();const dict=dictionaries[lang]||{};
 let target=dict[normalized];
 if(target===undefined&&lang==='en'){
  if(normalized.startsWith('Pour la prochaine validation Variable'))target=normalized.replace('Pour la prochaine validation Variable','For the next Variable validation').replace('objectif','target').replace('qualifications par exercice','qualifications per exercise');
  else if(normalized.startsWith('Les qualifications obtenues en Classique'))target='Classic qualifications also count toward Variable. Every validation remains recorded.';
  else if(normalized.includes('encore nécessaire(s)'))target=normalized.replace('encore nécessaire(s)','more needed');
  else if(normalized==='objectif atteint')target='target reached';
  else if(normalized.startsWith('Rang '))target=normalized.replace('Rang ','Rank ');
 }
 if(target!==undefined)el.nodeValue=source.replace(normalized,target);else el.nodeValue=source;
}
function apply(){const lang=localStorage.getItem('nosework-language')==='en'?'en':'fr';document.documentElement.lang=lang;
 document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('selected',b.dataset.lang===lang);b.setAttribute('aria-pressed',String(b.dataset.lang===lang))});
 const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
 for(const n of nodes){if(n.parentElement?.closest('script,style'))continue;translateText(n,lang)}
 document.querySelectorAll('input[placeholder]').forEach(el=>{if(!el.dataset.frPlaceholder)el.dataset.frPlaceholder=el.placeholder;el.placeholder=(dictionaries[lang][el.dataset.frPlaceholder]||el.dataset.frPlaceholder)});
 // Keep option values in French for storage, translate visible labels only.
 document.querySelectorAll('select option').forEach(el=>{if(!translatedOptions.has(el))translatedOptions.set(el,el.textContent);const fr=translatedOptions.get(el);if(!el.hasAttribute('value'))el.value=fr;el.textContent=dictionaries[lang][fr]||fr});
}
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem('nosework-language',b.dataset.lang);apply()}));
// app.js regenerates dashboard/history on render; translate new text without changing state.
const observer=new MutationObserver(()=>{observer.disconnect();apply();observer.observe(document.getElementById('summary'),{childList:true,subtree:true});observer.observe(document.getElementById('historyList'),{childList:true,subtree:true});observer.observe(document.getElementById('pdfPreview'),{childList:true,subtree:true})});
['summary','historyList','pdfPreview'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,subtree:true})});
apply();
})();
