const githubReleaseCache=new Map();

function releaseTime(release){
  return Date.parse(release?.published_at||release?.created_at||'')||0;
}

async function getGithubReleases(repo){
  if(githubReleaseCache.has(repo))return githubReleaseCache.get(repo);
  const request=(async()=>{
    const headers={Accept:'application/vnd.github+json'};
    const list=await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`,{headers});
    if(!list.ok)throw new Error(String(list.status));
    const releases=(await list.json()).filter(r=>!r.draft).sort((a,b)=>releaseTime(b)-releaseTime(a));
    if(!releases.length)throw new Error('no-releases');
    const stable=releases.find(r=>!r.prerelease)||null;
    const prerelease=releases.find(r=>r.prerelease)||null;
    return{releases,stable,prerelease};
  })();
  githubReleaseCache.set(repo,request);
  return request;
}

async function getPreferredGithubRelease(repo){
  const{stable,prerelease}=await getGithubReleases(repo);
  return stable||prerelease;
}

function secureExternal(link){
  if(!link)return;
  link.target='_blank';
  link.rel='noopener noreferrer';
}

function formatReleaseDate(release){
  const published=release?.published_at?new Date(release.published_at):null;
  return published?published.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
}

function releaseVersion(release){
  return release?.tag_name||release?.name||'Release';
}

function findZipAsset(release){
  return(release?.assets||[]).find(a=>/\.zip$/i.test(a.name));
}

function populateReleasePanel(panel,release,label){
  const status=panel.querySelector('[data-release-status]');
  const version=panel.querySelector('[data-release-version]');
  const date=panel.querySelector('[data-release-date]');
  const download=panel.querySelector('[data-release-download]');
  const releaseLink=panel.querySelector('[data-release-link]');
  status.textContent=label;
  version.textContent=releaseVersion(release);
  date.textContent=formatReleaseDate(release);
  releaseLink.href=release.html_url;
  releaseLink.textContent='Release notes ↗';
  releaseLink.hidden=false;
  secureExternal(releaseLink);
  const asset=findZipAsset(release);
  if(asset){download.href=asset.browser_download_url;download.hidden=false;secureExternal(download);}else download.hidden=true;
}

function createPrereleasePanel(release){
  const panel=document.createElement('div');
  panel.className='release-panel release-panel-prerelease';
  panel.setAttribute('data-github-prerelease','');
  const status=document.createElement('span');status.className='release-label';status.setAttribute('data-release-status','');
  const version=document.createElement('strong');version.className='release-version';version.setAttribute('data-release-version','');
  const date=document.createElement('span');date.className='release-date';date.setAttribute('data-release-date','');
  const note=document.createElement('p');note.className='release-prerelease-note';note.textContent='Preview build — intended for testing and early access to in-development features.';
  const actions=document.createElement('div');actions.className='release-actions';
  const notes=document.createElement('a');notes.setAttribute('data-release-link','');notes.hidden=true;
  const download=document.createElement('a');download.setAttribute('data-release-download','');download.hidden=true;download.textContent='Download ZIP ↗';
  actions.append(notes,download);
  panel.append(status,version,date,note,actions);
  populateReleasePanel(panel,release,'Latest pre-release');
  return panel;
}

document.querySelectorAll('[data-github-release]').forEach(async panel=>{
  const repo=panel.dataset.githubRelease;
  const repoUrl=`https://github.com/${repo}`;
  const status=panel.querySelector('[data-release-status]');
  const version=panel.querySelector('[data-release-version]');
  const date=panel.querySelector('[data-release-date]');
  const download=panel.querySelector('[data-release-download]');
  const releaseLink=panel.querySelector('[data-release-link]');
  try{
    const{stable,prerelease}=await getGithubReleases(repo);
    const primary=stable||prerelease;
    populateReleasePanel(panel,primary,stable?'Latest release':'Latest pre-release');
    panel.classList.toggle('release-panel-prerelease',!stable&&Boolean(prerelease));
    const showNewerPrerelease=Boolean(stable&&prerelease&&releaseTime(prerelease)>releaseTime(stable));
    panel.parentNode?.querySelector('[data-github-prerelease]')?.remove();
    if(showNewerPrerelease)panel.insertAdjacentElement('afterend',createPrereleasePanel(prerelease));
  }catch(error){
    status.textContent='Development repository';
    version.textContent='No published GitHub release';
    date.textContent='';
    releaseLink.href=repoUrl;
    releaseLink.textContent='View repository ↗';
    releaseLink.hidden=false;
    secureExternal(releaseLink);
    download.hidden=true;
  }
});

document.querySelectorAll('[data-github-release-card]').forEach(async card=>{
  const repo=card.dataset.githubReleaseCard;
  const label=card.querySelector('[data-card-release-label]');
  const version=card.querySelector('[data-card-release-version]');
  try{
    const release=await getPreferredGithubRelease(repo);
    label.textContent=release.prerelease?'Pre-release':'Released';
    label.classList.toggle('prerelease',release.prerelease);
    version.textContent=releaseVersion(release);
  }catch(error){
    label.textContent='Development';
    label.classList.add('development');
    version.textContent='Repository build';
  }
});