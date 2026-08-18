import siteWorker from './index.js';
import { handleDownload, handleDownloadStats } from './download-tracking.js';
import { handleLiveStatus } from './live-status.js';

export default {
  async fetch(request, env, ctx) {
    const downloadResponse = await handleDownload(request, env);
    if (downloadResponse) return downloadResponse;

    const statsResponse = await handleDownloadStats(request, env);
    if (statsResponse) return statsResponse;

    const liveResponse = await handleLiveStatus(request, env, ctx);
    if (liveResponse) return liveResponse;

    return siteWorker.fetch(request, env, ctx);
  },
};
