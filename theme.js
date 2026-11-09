(()=>{
  const KEY='jc-theme-mode';
  const pageIsOverlay=document.body?.classList.contains('scoreLayerBody');
  function apply(mode){
    const value=mode==='light'?'light':'dark';
    document.documentElement.dataset.theme=value;
    document.documentElement.style.colorScheme=value;
    document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
      btn.textContent=value==='light'?'🌙 Night mode':'☀ Day mode';
      btn.setAttribute('aria-pressed',String(value==='light'));
      btn.title=value==='light'?'Switch whole site to night mode':'Switch whole site to day mode';
    });
  }
  let initial='dark';try{initial=localStorage.getItem(KEY)||'dark'}catch{}
  apply(initial);
  document.addEventListener('click',event=>{
    const btn=event.target.closest('[data-theme-toggle]');if(!btn)return;
    const next=document.documentElement.dataset.theme==='light'?'dark':'light';
    try{localStorage.setItem(KEY,next)}catch{}
    apply(next);
  });
  if(pageIsOverlay){
    const btn=document.querySelector('.scoreLayerThemeToggle');
    const allow=new URLSearchParams(location.search).get('themeUI')==='1';
    if(btn)btn.style.display=allow?'block':'none';
  }
})();
