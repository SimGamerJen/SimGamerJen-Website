(()=>{
  const root=document.querySelector('[data-watch-featured]');
  const grid=document.querySelector('[data-featured-grid]');
  const playlistRoot=document.querySelector('[data-watch-playlists]');
  if(!root||!grid)return;
  function safeHttpUrl(value){try{const url=new URL(value,window.location.origin);return['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}}
  function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
  function formatScheduled(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});}
  function mergeUpcoming(items,liveData){
    const upcoming=!liveData?.live?liveData?.upcoming:null;
    if(!upcoming?.videoId||!upcoming?.scheduledStartTime)return items;
    const byId=new Map(items.map(item=>[item.id,item]));
    const existing=byId.get(upcoming.videoId)||{};
    byId.set(upcoming.videoId,{
      ...existing,
      id:upcoming.videoId,
      title:upcoming.title||existing.title||'Scheduled livestream',
      published:upcoming.scheduledStartTime,
      scheduledStartTime:upcoming.scheduledStartTime,
      description:existing.description||'Scheduled SGJ livestream on YouTube.',
      channel:upcoming.channel||existing.channel||'SimGamerJen',
      handle:existing.handle||'',
      url:upcoming.url||existing.url||`https://www.youtube.com/watch?v=${encodeURIComponent(upcoming.videoId)}`,
      thumbnail:upcoming.thumbnail||existing.thumbnail||`https://i.ytimg.com/vi/${encodeURIComponent(upcoming.videoId)}/hqdefault.jpg`,
      contentState:'upcoming'
    });
    return [...byId.values()].sort((a,b)=>{
      const au=a.contentState==='upcoming',bu=b.contentState==='upcoming';
      if(au&&bu)return Date.parse(a.scheduledStartTime)-Date.parse(b.scheduledStartTime);
      if(au)return-1;
      if(bu)return 1;
      return Date.parse(b.published)-Date.parse(a.published);
    });
  }
  function latestCard(item){const href=safeHttpUrl(item.url),thumb=safeHttpUrl(item.thumbnail),isUpcoming=item.contentState==='upcoming',card=document.createElement(href?'a':'article');card.className=`series-card latest-card${isUpcoming?' is-upcoming':''}`;if(href){card.href=href;card.target='_blank';card.rel='noopener noreferrer';}const art=document.createElement('div');art.className='series-art latest-art';if(thumb){const img=document.createElement('img');img.src=thumb;img.alt='';img.loading='lazy';img.decoding='async';art.appendChild(img);}const channel=document.createElement('span');channel.className='latest-channel';channel.textContent=item.channel||'YouTube';art.appendChild(channel);if(isUpcoming){const state=document.createElement('span');state.className='latest-state-badge';state.textContent='Upcoming';art.appendChild(state);}const copy=document.createElement('div');copy.className='series-copy';const meta=document.createElement('div');meta.className='latest-meta';const status=document.createElement('span');status.className=`status${isUpcoming?' upcoming-status':''}`;status.textContent=isUpcoming?'Upcoming':(item.channel||'YouTube');const date=document.createElement('span');date.textContent=isUpcoming?formatScheduled(item.scheduledStartTime):formatDate(item.published);meta.append(status,date);const title=document.createElement('h3');title.textContent=item.title||(isUpcoming?'Scheduled livestream':'Latest upload');const description=document.createElement('p');description.textContent=item.description||(isUpcoming?'Scheduled SGJ livestream on YouTube.':'Watch the latest SGJ upload on YouTube.');const cta=document.createElement('span');cta.className='series-cta';cta.textContent=isUpcoming?'View scheduled stream ↗':'Watch on YouTube ↗';copy.append(meta,title,description,cta);card.append(art,copy);return card;}
  function fallbackCard(item){const href=safeHttpUrl(item.url),article=document.createElement(href?'a':'article');article.className=`series-card series-${String(item.tone||'default').replace(/[^a-z0-9_-]/gi,'')}`;if(href){article.href=href;article.target='_blank';article.rel='noopener noreferrer';}const art=document.createElement('div');art.className='series-art';const code=document.createElement('span');code.className='series-code';code.textContent=item.code||'SGJ';const artLabel=document.createElement('span');artLabel.className='series-art-label';artLabel.textContent=item.artLabel||'';art.append(code,artLabel);const copy=document.createElement('div');copy.className='series-copy';const status=document.createElement('span');status.className='status';status.textContent=item.label||'';const title=document.createElement('h3');title.textContent=item.title||'';const desc=document.createElement('p');desc.textContent=item.description||'';copy.append(status,title,desc);article.append(art,copy);return article;}
  function playlistScore(item,latestItems){const title=String(item.title||'').toLowerCase();let score=0;latestItems.forEach(latest=>{const words=String(latest.title||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);const unique=[...new Set(words)];unique.forEach(word=>{if(title.includes(word))score+=2;});if(String(latest.channel||'')===String(item.channel||''))score+=.2;});return score;}
  function playlistCard(item){const href=safeHttpUrl(item.url),thumb=safeHttpUrl(item.thumbnail),card=document.createElement('a');card.className='playlist-card';card.href=href;card.target='_blank';card.rel='noopener noreferrer';const art=document.createElement('div');art.className='playlist-art';if(thumb){const img=document.createElement('img');img.src=thumb;img.alt='';img.loading='lazy';img.decoding='async';art.appendChild(img);}else{const fallback=document.createElement('span');fallback.className='playlist-fallback';fallback.textContent='PLAYLIST';art.appendChild(fallback);}const stack=document.createElement('span');stack.className='playlist-stack';stack.textContent='PLAYLIST';art.appendChild(stack);const copy=document.createElement('div');copy.className='playlist-copy';const channel=document.createElement('span');channel.className='status';channel.textContent=item.channel||'YouTube';const title=document.createElement('h3');title.textContent=item.title||'SGJ playlist';const cta=document.createElement('span');cta.className='series-cta';cta.textContent='Open playlist ↗';copy.append(channel,title,cta);card.append(art,copy);return card;}
  async function loadCuratedIds(){try{const response=await fetch('/assets/data/watch-playlist-selection.json',{cache:'no-store'});if(!response.ok)return[];const data=await response.json();return[...new Set((data.featured||[]).map(v=>String(v).trim()).filter(v=>/^PL[\w-]+$/.test(v)))].slice(0,6);}catch{return[];}}
  async function loadPlaylists(latestItems=[]){if(!playlistRoot)return;try{const curatedIds=await loadCuratedIds();const endpoint=curatedIds.length?`/api/youtube/playlists?ids=${encodeURIComponent(curatedIds.join(','))}`:'/api/youtube/playlists';const response=await fetch(endpoint,{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));const data=await response.json();const all=(data.items||[]).filter(item=>safeHttpUrl(item.url)&&item.title);let selected;if(curatedIds.length){const byId=new Map(all.map(item=>[item.id,item]));selected=curatedIds.map(id=>byId.get(id)).filter(Boolean);}else{const ranked=all.map((item,index)=>({item,index,score:playlistScore(item,latestItems)})).sort((a,b)=>b.score-a.score||a.index-b.index);selected=[];for(const row of ranked){if(selected.length>=6)break;if(!selected.some(x=>x.id===row.item.id))selected.push(row.item);}}if(!selected.length)throw new Error('empty');playlistRoot.replaceChildren(...selected.map(playlistCard));}catch(error){console.warn('[SGJ] Playlist discovery unavailable.',error);playlistRoot.innerHTML='<div class="playlist-unavailable"><strong>Playlist shelf is temporarily unavailable.</strong><span>Use the browse-all links below to open either channel’s playlist library.</span></div>';}}
  async function loadFallback(){
    // Never present the editorial series placeholders as though they were latest uploads.
    grid.innerHTML='<div class="watch-feed-unavailable" role="status"><strong>Latest YouTube uploads are temporarily unavailable.</strong><span>The live feed could not be retrieved, so we cannot confirm which videos are newest. You can still open the channels directly:</span><div class="watch-feed-links"><a href="https://www.youtube.com/@SimGamerJen/videos" target="_blank" rel="noopener noreferrer">SimGamerJen videos ↗</a><a href="https://www.youtube.com/@StreamGamerJen/videos" target="_blank" rel="noopener noreferrer">StreamGamerJen videos ↗</a></div></div>';
    await loadPlaylists([]);
  }
  (async()=>{
    try{
      // The feed is required, but live status is optional: a live-status outage must
      // not suppress a healthy latest-uploads response.
      const latestResponse=await fetch('/api/youtube/latest',{cache:'no-store'});
      if(!latestResponse.ok)throw new Error('latest-feed-'+latestResponse.status);
      const data=await latestResponse.json();
      let items=Array.isArray(data.items)?data.items:[];
      try{
        const liveResponse=await fetch('/api/live-status',{cache:'no-store'});
        if(liveResponse.ok)items=mergeUpcoming(items,await liveResponse.json());
      }catch(error){
        console.warn('[SGJ] Live status unavailable; showing latest uploads without live enrichment.',error);
      }
      items=items.slice(0,3);
      if(!items.length)throw new Error('empty');
      grid.replaceChildren(...items.map(latestCard));
      // A partly successful combined response must never imply that the newest
      // uploads across BOTH channels were considered.
      root.querySelector('[data-watch-partial-notice]')?.remove();
      if(data.partial){
        const missing=Object.entries(data.status||{})
          .filter(([,status])=>status?.source==='unavailable')
          .map(([name])=>name);
        const note=document.createElement('p');
        note.className='watch-partial-notice';
        note.setAttribute('data-watch-partial-notice','');
        note.setAttribute('role','status');
        note.textContent=missing.length
          ? `Showing available YouTube uploads only. ${missing.join(' and ')} could not be checked, so newer content may be missing.`
          : 'Showing a partial YouTube feed. Newer uploads may be missing.';
        grid.insertAdjacentElement('beforebegin',note);
      }
      await loadPlaylists(items);
    }catch(error){
      console.warn('[SGJ] Live YouTube feed unavailable.',error);
      await loadFallback();
    }
  })();
})();