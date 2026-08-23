const githubReleaseCache=new Map();
const githubPrereleaseCache=new Map();

function releaseTime(release){
  return Date.parse(release?.published_at||release?.created_at||'')||0;
}

function releaseVersionParts(release){
  const raw=String(release?.tag_name||release?.name||'').trim().replace(/^v/i,'');
  const match=raw.match(/^(\d+(?:\.\d+)*)/);
  if(!match)return null;
  return match[1].split('.').map(Number);
}

function compareVersionParts(a,b){
  const length=Math.max(a.length,b.length);
  for(let i=0;i<length;i+=1){
    const left=a[i]??0;
    const right=b[i]??0;
    if(left!==right)return left>right?1:-1;
  }
  return 0;
}

function isPrereleaseNewerThanStable(prerelease,stable){
  const preParts=releaseVersionParts(prerelease);
  const stableParts=releaseVersionParts(stable);
  if(preParts&&stableParts)return compareVersionParts(preParts,stableParts)>0;
  return releaseTime(prerelease)>releaseTime(stable);
}

async function getPreferredGithubRelease(repo){
  if(githubReleaseCache.has(repo))return githubReleaseCache.get(repo);
  const request=(async()=>{
    const headers={Accept:'application/vnd.github+json'};
    const latest=await fetch(`https://api.github.com/repos/${repo}/releases/latest`,{headers});
    if(latest.ok)return await latest.json();
    const list=await fetch(`https://api.github.com/repos/${repo}/releases?per_page=20`,{headers});
    if(!list.ok)throw new Error(String(list.status));
    const releases=(await list.json()).filter(r=>!r.draft);
    if(!releases.length)throw new Error('no-releases');
    return releases[0];
  })();
  githubReleaseCache.set(repo,request);
  return request;
}

async function getLatestGithubPrerelease(repo){
  if(githubPrereleaseCache.has(repo))return githubPrereleaseCache.get(repo);
  const request=(async()=>{
    const headers={Accept:'application/vnd.github+json'};
    const list=await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`,{headers});
    if(!list.ok)throw new Error(String(list.status));
    const prereleases=(await list.json())
      .filter(r=>!r.draft&&r.prerelease)
      .sort((a,b)=>releaseTime(b)-releaseTime(a));
    return prereleases[0]||null;
  })();
  githubPrereleaseCache.set(repo,request);
  return request;
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
  version.textContent=release.name||release.tag_name;
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
    const release=await getPreferredGithubRelease(repo);
    populateReleasePanel(panel,release,release.prerelease?'Latest pre-release':'Latest release');
    panel.classList.toggle('release-panel-prerelease',release.prerelease);
    panel.parentNode?.querySelector('[data-github-prerelease]')?.remove();
    if(!release.prerelease){
      try{
        const prerelease=await getLatestGithubPrerelease(repo);
        if(prerelease&&isPrereleaseNewerThanStable(prerelease,release)){
          panel.insertAdjacentElement('afterend',createPrereleasePanel(prerelease));
        }
      }catch(_){/* Stable release remains valid if prerelease discovery fails. */}
    }
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
    version.textContent=release.name||release.tag_name;
  }catch(error){
    label.textContent='Development';
    label.classList.add('development');
    version.textContent='Repository build';
  }
});