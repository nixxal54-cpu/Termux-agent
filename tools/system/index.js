import os from 'os';

export const systemTool = {
  name: "system_info",
  description: "Retrieve system information, performance metrics, and memory usage.",
  schema: {},
  execute: async () => {
    return {
      status: "success",
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      uptime: os.uptime(),
      cpus: os.cpus().length,
      loadavg: os.loadavg()
    };
  }
};
