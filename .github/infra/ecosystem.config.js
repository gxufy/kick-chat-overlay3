const path = require('path');

const root = path.resolve(__dirname, '../..');

module.exports = {
  apps: [
    {
      name: 'multichat',
      cwd: root,
      script: 'node_modules/next/dist/bin/next',
      args: 'start app -p 3000',
      instances: 1,
      autorestart: true,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
