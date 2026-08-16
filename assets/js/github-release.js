const githubReleaseCache=new Map();

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

function secureExternal(link){
  if(!link)return;
  link.target='_blank';
  link.rel='noopener noreferrer';
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
    status.textContent=release.prerelease?'Latest pre-release':'Latest release';
    version.textContent=release.name||release.tag_name;
    const published=release.published_at?new Date(release.published_at):null;
    date.textContent=published?published.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
    releaseLink.href=release.html_url;
    releaseLink.textContent='Release notes ↗';
    releaseLink.hidden=false;
    secureExternal(releaseLink);
    const asset=(release.assets||[]).find(a=>/\.zip$/i.test(a.name));
    if(asset){download.href=asset.browser_download_url;download.hidden=false;secureExternal(download);}else download.hidden=true;
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