const path = require('path');

module.exports = {
  apps: [
    {
      name: 'matchtrack-backend',
      cwd: path.resolve(__dirname, 'backend'),
      script: './venv/bin/python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      interpreter: 'none',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'matchtrack-frontend',
      cwd: path.resolve(__dirname, 'web'),
      script: 'npm',
      args: 'start',
      interpreter: 'none',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
