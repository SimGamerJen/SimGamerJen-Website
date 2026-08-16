(()=>{
  const root=document.querySelector('[data-watch-featured]');
  const grid=document.querySelector('[data-featured-grid]');
  const lanesRoot=document.querySelector('[data-watch-lanes]');
  if(!root||!grid)return;

  function safeHttpUrl(value){
    try{const url=new URL(value,window.location.origin);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}
  }

  function formatDate(value){
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  }

  function latestCard(item){
    const href=safeHttpUrl(item.url);
    const thumb=safeHttpUrl(item.thumbnail);
    const card=document.createElement(href?'a':'article');
    card.className='series-card latest-card';
    if(href){card.href=href;card.target='_blank';card.rel='noopener noreferrer';}

    const art=document.createElement('div');art.className='series-art latest-art';
    if(thumb){const img=document.createElement('img');img.src=thumb;img.alt='';img.loading='lazy';img.decoding='async';art.appendChild(img);}
    const channel=document.createElement('span');channel.className='latest-channel';channel.textContent=item.channel||'YouTube';art.appendChild(channel);

    const copy=document.createElement('div');copy.className='series-copy';
    const meta=document.createElement('div');meta.className='latest-meta';
    const status=document.createElement('span');status.className='status';status.textContent=item.channel||'YouTube';
    const date=document.createElement('span');date.textContent=formatDate(item.published);meta.append(status,date);
    const title=document.createElement('h3');title.textContent=item.title||'Latest upload';
    const description=document.createElement('p');description.textContent=item.description||'Watch the latest SGJ upload on YouTube.';
    const cta=document.createElement('span');cta.className='series-cta';cta.textContent='Watch on YouTube ↗';
    copy.append(meta,title,description,cta);card.append(art,copy);return card;
  }

  function fallbackCard(item){
    const href=safeHttpUrl(item.url);
    const article=document.createElement(href?'a':'article');article.className=`series-card series-${String(item.tone||'default').replace(/[^a-z0-9_-]/gi,'')}`;
    if(href){article.href=href;article.target='_blank';article.rel='noopener noreferrer';}
    const art=document.createElement('div');art.className='series-art';
    const code=document.createElement('span');code.className='series-code';code.textContent=item.code||'SGJ';
    const artLabel=document.createElement('span');artLabel.className='series-art-label';artLabel.textContent=item.artLabel||'';art.append(code,artLabel);
    const copy=document.createElement('div');copy.className='series-copy';
    const status=document.createElement('span');status.className='status';status.textContent=item.label||'';
    const title=document.createElement('h3');title.textContent=item.title||'';
    const desc=document.createElement('p');desc.textContent=item.description||'';copy.append(status,title,desc);article.append(art,copy);return article;
  }

  function renderLanes(config,latestItems=[]){
    if(!lanesRoot)return;
    const all=(config.items||[]).filter(item=>safeHttpUrl(item.url));
    const haystack=latestItems.map(item=>`${item.title||''} ${item.description||''}`.toLowerCase()).join(' ');
    const matched=all.filter(item=>(item.keywords||[]).some(keyword=>haystack.includes(String(keyword).toLowerCase())));
    const selected=[...matched,...all.filter(item=>!matched.includes(item))].slice(0,config.maxItems||4);
    lanesRoot.replaceChildren(...selected.map(item=>{
      const article=document.createElement('article');article.className='watch-lane';
      const mark=document.createElement('div');mark.className='lane-mark';mark.textContent=item.code||'PLAY';
      const text=document.createElement('div');const title=document.createElement('h3');title.textContent=item.title||'Playlist';const desc=document.createElement('p');desc.textContent=item.description||'';text.append(title,desc);
      const link=document.createElement('a');link.href=safeHttpUrl(item.url);link.target='_blank';link.rel='noopener noreferrer';link.textContent=item.cta||'Open playlist ↗';
      article.append(mark,text,link);return article;
    }));
  }

  async function loadLanes(latestItems){
    try{const response=await fetch('/assets/data/watch-playlists.json',{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));renderLanes(await response.json(),latestItems);}catch{if(lanesRoot)lanesRoot.innerHTML='<p class="muted-note">Playlist links are temporarily unavailable.</p>';}
  }

  async function loadFallback(){
    const response=await fetch('/assets/data/watch-featured.json',{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));
    const data=await response.json();grid.replaceChildren(...(data.items||[]).map(fallbackCard));await loadLanes([]);
  }

  (async()=>{
    try{
      const response=await fetch('/api/youtube/latest',{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));
      const data=await response.json();const items=(data.items||[]).slice(0,3);if(!items.length)throw new Error('empty');
      grid.replaceChildren(...items.map(latestCard));await loadLanes(items);
    }catch(error){
      console.warn('[SGJ] Live YouTube feed unavailable; using editorial fallback.',error);
      try{await loadFallback();}catch{root.hidden=true;}
    }
  })();
})();
