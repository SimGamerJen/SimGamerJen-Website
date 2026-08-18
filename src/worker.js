import siteWorker from './index.js';
import { handleDownload, handleDownloadStats } from './download-tracking.js';

export default {
  async fetch(request, env, ctx) {
    const downloadResponse = await handleDownload(request, env);
    if (downloadResponse) return downloadResponse;

    const statsResponse = await handleDownloadStats(request, env);
    if (statsResponse) return statsResponse;

    return siteWorker.fetch(request, env, ctx);
  },
};
