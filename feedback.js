(() => {
  const root=document.getElementById('stick-tetris'),buttons=[...document.querySelectorAll('[data-reaction]')],text=document.getElementById('feedback-text'),share=document.getElementById('share-feedback'),state=document.getElementById('feedback-state');
  let reaction='';
  buttons.forEach(button=>button.addEventListener('click',()=>{reaction=button.dataset.reaction;buttons.forEach(item=>item.classList.toggle('selected',item===button));state.textContent='';}));
  share.addEventListener('click',async()=>{
    const comment=text.value.trim();if(!reaction&&!comment){state.textContent='Choisis une impression ou écris un commentaire.';return;}
    const report=['Retour Last Stick Standing v0.1','Impression : '+(reaction||'Non précisée'),'Commentaire : '+(comment||'Aucun'),'Manches terminées : '+(root.dataset.completedRounds||0)].join('\n');
    try{
      if(navigator.share)await navigator.share({title:'Retour Last Stick Standing v0.1',text:report});
      else{await navigator.clipboard.writeText(report);state.textContent='Retour copié : tu peux maintenant le coller où tu veux.';}
      localStorage.setItem('last-stick-feedback',JSON.stringify({reaction,comment,rounds:Number(root.dataset.completedRounds||0),date:new Date().toISOString()}));
    }catch(error){if(error?.name!=='AbortError')state.textContent='Le partage a échoué. Ton texte reste affiché ici.';}
  });
})();
