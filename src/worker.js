import siteWorker from './index.js';
import { handleDownload, handleDownloadStats } from './download-tracking.js';
import { handleLiveStatus } from './live-status.js';
import { handleYouTubeOAuth } from './youtube-oauth.js';
import { handleUpdates } from './updates.js';

export default {
  async fetch(request, env, ctx) {
    const downloadResponse = await handleDownload(request, env);
    if (downloadResponse) return downloadResponse;

    const statsResponse = await handleDownloadStats(request, env);
    if (statsResponse) return statsResponse;

    const oauthResponse = await handleYouTubeOAuth(request, env);
    if (oauthResponse) return oauthResponse;

    const liveResponse = await handleLiveStatus(request, env, ctx);
    if (liveResponse) return liveResponse;

    const updatesResponse = await handleUpdates(request, env, ctx);
    if (updatesResponse) return updatesResponse;

    return siteWorker.fetch(request, env, ctx);
  },
};
