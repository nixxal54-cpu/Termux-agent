import os from 'os';

export const systemTool = {
  name: "system_info",
  description: "Retrieve system information (OS, memory, arch). Useful for understanding the Termux environment.",
  schema: {},
  execute: async () => {
    return {
      status: "success",
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      uptime: os.uptime()
    };
  }
};
