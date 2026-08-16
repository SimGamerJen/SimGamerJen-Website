(()=>{
  const cache=new Map();

  function rgb565(v){
    const r=((v>>11)&31)*255/31;
    const g=((v>>5)&63)*255/63;
    const b=(v&31)*255/31;
    return [r|0,g|0,b|0,255];
  }

  function mix(a,b,wa,wb,div){
    return [
      ((a[0]*wa+b[0]*wb)/div)|0,
      ((a[1]*wa+b[1]*wb)/div)|0,
      ((a[2]*wa+b[2]*wb)/div)|0,
      255
    ];
  }

  function colorPalette(c0,c1,allowTransparent){
    const a=rgb565(c0),b=rgb565(c1);
    if(allowTransparent&&c0<=c1){
      return [a,b,mix(a,b,1,1,2),[0,0,0,0]];
    }
    return [a,b,mix(a,b,2,1,3),mix(a,b,1,2,3)];
  }

  function writePixel(out,width,height,x,y,c){
    if(x>=width||y>=height)return;
    const o=(y*width+x)*4;
    out[o]=c[0];out[o+1]=c[1];out[o+2]=c[2];out[o+3]=c[3];
  }

  function decodeColorBlock(view,offset,out,width,height,bx,by,allowTransparent){
    const c0=view.getUint16(offset,true),c1=view.getUint16(offset+2,true);
    const palette=colorPalette(c0,c1,allowTransparent);
    const bits=view.getUint32(offset+4,true);
    for(let py=0;py<4;py++)for(let px=0;px<4;px++){
      const idx=(bits>>(2*(py*4+px)))&3;
      writePixel(out,width,height,bx+px,by+py,palette[idx]);
    }
  }

  function alphaPalette(a0,a1){
    const a=[a0,a1];
    if(a0>a1){
      for(let i=1;i<=6;i++)a.push(Math.round(((7-i)*a0+i*a1)/7));
    }else{
      for(let i=1;i<=4;i++)a.push(Math.round(((5-i)*a0+i*a1)/5));
      a.push(0,255);
    }
    return a;
  }

  function decodeDDS(buffer){
    const view=new DataView(buffer);
    if(view.getUint32(0,true)!==0x20534444)throw new Error('Not a DDS file');
    const height=view.getUint32(12,true),width=view.getUint32(16,true);
    const fourCC=String.fromCharCode(view.getUint8(84),view.getUint8(85),view.getUint8(86),view.getUint8(87));
    const out=new Uint8ClampedArray(width*height*4);
    let offset=128;
    for(let by=0;by<height;by+=4){
      for(let bx=0;bx<width;bx+=4){
        if(fourCC==='DXT1'){
          decodeColorBlock(view,offset,out,width,height,bx,by,true);offset+=8;
        }else if(fourCC==='DXT3'){
          const alphas=[];
          for(let row=0;row<4;row++){
            const v=view.getUint16(offset+row*2,true);
            for(let col=0;col<4;col++)alphas.push(((v>>(col*4))&15)*17);
          }
          const colors=new Uint8ClampedArray(4*4*4);
          decodeColorBlock(view,offset+8,colors,4,4,0,0,false);
          for(let py=0;py<4;py++)for(let px=0;px<4;px++){
            const i=py*4+px,o=i*4;
            writePixel(out,width,height,bx+px,by+py,[colors[o],colors[o+1],colors[o+2],alphas[i]]);
          }
          offset+=16;
        }else if(fourCC==='DXT5'){
          const a0=view.getUint8(offset),a1=view.getUint8(offset+1),ap=alphaPalette(a0,a1);
          let alphaBits=0n;
          for(let i=0;i<6;i++)alphaBits|=BigInt(view.getUint8(offset+2+i))<<BigInt(i*8);
          const colors=new Uint8ClampedArray(4*4*4);
          decodeColorBlock(view,offset+8,colors,4,4,0,0,false);
          for(let py=0;py<4;py++)for(let px=0;px<4;px++){
            const i=py*4+px,o=i*4;
            const ai=Number((alphaBits>>BigInt(i*3))&7n);
            writePixel(out,width,height,bx+px,by+py,[colors[o],colors[o+1],colors[o+2],ap[ai]]);
          }
          offset+=16;
        }else{
          throw new Error(`Unsupported DDS format ${fourCC}`);
        }
      }
    }
    return {width,height,pixels:out};
  }

  async function getDDS(url){
    if(cache.has(url))return cache.get(url);
    const p=(async()=>{
      const response=await fetch(url,{mode:'cors',cache:'force-cache'});
      if(!response.ok)throw new Error(`DDS fetch failed: ${response.status}`);
      return decodeDDS(await response.arrayBuffer());
    })();
    cache.set(url,p);
    return p;
  }

  function constrainRenderedIcon(target,canvas){
    canvas.style.display='block';
    canvas.style.maxWidth='100%';
    canvas.style.maxHeight='100%';
    canvas.style.objectFit='contain';
    canvas.style.margin='0 auto';

    if(target.classList.contains('catalogue-mark')){
      target.style.width='110px';
      target.style.height='110px';
      target.style.minWidth='110px';
      target.style.aspectRatio='1 / 1';
      target.style.overflow='hidden';
      target.style.padding='6px';
      target.style.display='grid';
      target.style.placeItems='center';
      canvas.style.width='98px';
      canvas.style.height='98px';
    }else if(target.classList.contains('detail-mark')){
      target.style.width='min(100%, 390px)';
      target.style.maxWidth='390px';
      target.style.aspectRatio='1 / 1';
      target.style.overflow='hidden';
      target.style.padding='18px';
      target.style.display='grid';
      target.style.placeItems='center';
      canvas.style.width='100%';
      canvas.style.height='100%';
    }

    target.querySelectorAll('.dds-fallback,strong,span').forEach(el=>{
      if(el!==canvas)el.style.display='none';
    });
  }

  async function renderTarget(target,url){
    if(!url||target.dataset.ddsRendered==='true')return;
    target.dataset.ddsRendered='true';
    try{
      const image=await getDDS(url);
      const canvas=document.createElement('canvas');
      canvas.width=image.width;canvas.height=image.height;
      canvas.className='dds-icon-canvas';
      const ctx=canvas.getContext('2d',{alpha:true});
      ctx.putImageData(new ImageData(image.pixels,image.width,image.height),0,0);
      constrainRenderedIcon(target,canvas);
      target.prepend(canvas);
      target.classList.add('has-dds-icon');
    }catch(error){
      target.classList.add('dds-icon-error');
      target.dataset.ddsRendered='false';
      console.warn('[SGJ] Could not render DDS icon',url,error);
    }
  }

  async function loadConfig(){
    const response=await fetch('/assets/data/mods.json',{cache:'no-store'});
    if(!response.ok)throw new Error(String(response.status));
    return response.json();
  }

  async function hydrate(root=document){
    root.querySelectorAll('[data-dds-icon]').forEach(el=>renderTarget(el,el.dataset.ddsIcon));
    const releasePanel=root.querySelector?.('[data-github-release]')||document.querySelector('[data-github-release]');
    const detailMark=document.querySelector('.detail-mark');
    if(releasePanel&&detailMark&&!detailMark.dataset.ddsRendered){
      try{
        const data=await loadConfig();
        const mod=(data.mods||[]).find(item=>item.repo===releasePanel.dataset.githubRelease&&item.iconDds);
        if(mod)renderTarget(detailMark,mod.iconDds);
      }catch(error){console.warn('[SGJ] Mod icon configuration unavailable',error);}
    }
  }

  window.SGJDDSIcons={hydrate};
  document.addEventListener('sgj:mods-rendered',()=>hydrate(document));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>hydrate(document));
  else hydrate(document);
})();
