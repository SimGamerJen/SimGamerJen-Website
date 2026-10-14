(()=>{
  const section=document.querySelector('[data-home-latest-video]');
  if(!section)return;
  const media=section.querySelector('[data-latest-media]');
  const image=section.querySelector('[data-latest-thumbnail]');
  const play=section.querySelector('[data-latest-play]');
  const title=section.querySelector('[data-latest-title]');
  const description=section.querySelector('[data-latest-description]');
  const date=section.querySelector('[data-latest-date]');
  const open=section.querySelector('[data-latest-open]');
  let current=null;

  function safeUrl(value){try{const url=new URL(value,window.location.origin);return['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}}
  function formatDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});}
  function render(item){
    if(!item?.id||!/^[\w-]{6,}$/.test(item.id))throw new Error('invalid-video');
    current=item;
    title.textContent=item.title||'Latest SimGamerJen video';
    description.textContent=item.description||'Watch the latest long-form SimGamerJen video.';
    date.textContent=formatDate(item.published);
    const thumb=safeUrl(item.thumbnail)||`https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/maxresdefault.jpg`;
    image.src=thumb;
    image.alt=`Thumbnail for ${item.title||'latest SimGamerJen video'}`;
    const href=safeUrl(item.url)||`https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`;
    open.href=href;
    section.hidden=false;
  }
  function playVideo(){
    if(!current?.id||!media)return;
    const iframe=document.createElement('iframe');
    iframe.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(current.id)}?autoplay=1&rel=0`;
    iframe.title=current.title||'SimGamerJen YouTube video';
    iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    iframe.allowFullscreen=true;
    iframe.className='home-latest-iframe';
    media.replaceChildren(iframe);
    media.classList.add('is-playing');
  }
  play?.addEventListener('click',playVideo);

  (async()=>{
    try{
      const response=await fetch('/api/youtube/home-latest',{cache:'no-store'});
      if(!response.ok)throw new Error(String(response.status));
      const data=await response.json();
      render(data.item);
    }catch(error){console.warn('[SGJ] Homepage latest video unavailable.',error);}
  })();
})();
