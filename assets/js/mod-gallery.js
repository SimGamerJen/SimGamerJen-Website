(async()=>{
  const mount=document.querySelector('[data-mod-gallery]');
  if(!mount)return;
  const key=mount.dataset.modGallery;
  try{
    const response=await fetch('/assets/data/mod-galleries.json',{cache:'no-cache'});
    if(!response.ok)throw new Error(String(response.status));
    const data=await response.json();
    const gallery=data.galleries&&data.galleries[key];
    if(!gallery||gallery.visible===false){mount.remove();return;}
    const images=(gallery.images||[]).filter(image=>image.visible!==false).sort((a,b)=>(a.order||0)-(b.order||0));
    if(!images.length){mount.remove();return;}

    const head=document.createElement('div');
    head.className='mod-gallery-head';
    const headingWrap=document.createElement('div');
    const eyebrow=document.createElement('p');
    eyebrow.className='eyebrow';
    eyebrow.textContent=gallery.eyebrow||'In game';
    const heading=document.createElement('h2');
    heading.textContent=gallery.heading||'Gallery';
    headingWrap.append(eyebrow,heading);
    const intro=document.createElement('p');
    intro.textContent=gallery.intro||'';
    head.append(headingWrap,intro);

    const grid=document.createElement('div');
    grid.className='mod-gallery-grid';
    images.forEach(image=>{
      const figure=document.createElement('figure');
      figure.className='mod-shot'+(image.featured?' featured':'');
      if(image.type)figure.dataset.imageType=image.type;
      const img=document.createElement('img');
      img.loading='lazy';
      img.decoding='async';
      img.src=image.localSource||image.source;
      img.alt=image.alt||image.title||'';
      const caption=document.createElement('figcaption');
      const title=document.createElement('strong');
      title.textContent=image.title||'';
      const text=document.createElement('span');
      text.textContent=image.caption||'';
      caption.append(title,text);
      figure.append(img,caption);
      grid.append(figure);
    });
    mount.replaceChildren(head,grid);
  }catch(error){
    console.warn('Unable to load mod gallery',key,error);
    mount.remove();
  }
})();
