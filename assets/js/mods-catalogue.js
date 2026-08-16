(async()=>{
  const root=document.querySelector('[data-mod-catalogue]');
  if(!root)return;
  const intro=document.querySelector('[data-mods-intro]');

  function escapeHtml(value=''){
    return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function makeCard(mod,featured){
    const href=mod.path||`https://github.com/${mod.repo}`;
    const external=!mod.path;
    const typeLabel=mod.type==='utility'?'Desktop utility':'';
    const featuredLabel=featured?'Featured':'';
    const metaLabels=[featuredLabel,typeLabel].filter(Boolean).map(label=>`<span class="status">${escapeHtml(label)}</span>`).join('');
    const iconAttr=mod.iconDds?` data-dds-icon="${escapeHtml(mod.iconDds)}"`:'';
    return `<a class="catalogue-card${featured?' featured':''}" href="${escapeHtml(href)}" data-github-release-card="${escapeHtml(mod.repo)}"${external?' target="_blank" rel="noopener noreferrer"':''}>
      <span class="catalogue-mark"${iconAttr}><span class="dds-fallback">${escapeHtml(mod.code||'SGJ')}</span></span>
      <div>
        <div class="catalogue-meta">${metaLabels}<span class="release-chip" data-card-release-label>Checking…</span><span class="release-chip-version" data-card-release-version></span></div>
        <h2>${escapeHtml(mod.name)}</h2>
        <p>${escapeHtml(mod.summary)}</p>
        <span class="card-link">${external?'View on GitHub ↗':'Open project page →'}</span>
      </div>
    </a>`;
  }

  async function hydrateRelease(card){
    const repo=card.dataset.githubReleaseCard;
    const label=card.querySelector('[data-card-release-label]');
    const version=card.querySelector('[data-card-release-version]');
    if(typeof getPreferredGithubRelease!=='function'){
      label.textContent='GitHub';
      version.textContent='Repository';
      return;
    }
    try{
      const release=await getPreferredGithubRelease(repo);
      label.textContent=release.prerelease?'Pre-release':'Released';
      label.classList.toggle('prerelease',release.prerelease);
      version.textContent=release.name||release.tag_name;
    }catch(error){
      label.textContent='Development';
      label.classList.add('development');
      version.textContent='Repository build';
    }
  }

  try{
    const response=await fetch('/assets/data/mods.json',{cache:'no-store'});
    if(!response.ok)throw new Error(String(response.status));
    const data=await response.json();
    if(intro&&data.intro)intro.textContent=data.intro;
    const mods=(data.mods||[]).filter(mod=>mod.visible!==false).sort((a,b)=>(a.order??999)-(b.order??999));
    const featuredRepo=data.featuredRepo;
    root.innerHTML=mods.map(mod=>makeCard(mod,mod.repo===featuredRepo)).join('');
    root.querySelectorAll('[data-github-release-card]').forEach(hydrateRelease);
    document.dispatchEvent(new CustomEvent('sgj:mods-rendered'));
    if(window.SGJDDSIcons)window.SGJDDSIcons.hydrate(root);
  }catch(error){
    root.innerHTML='<div class="catalogue-error"><h2>Mod catalogue unavailable</h2><p>The project list could not be loaded. Please try again shortly.</p></div>';
  }
})();
