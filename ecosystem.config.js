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
      max_memory_restart: '400M',
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
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'matchtrack-worker',
      cwd: path.resolve(__dirname, 'backend'),
      script: './venv/bin/python',
      args: 'worker.py',
      interpreter: 'none',
      restart_delay: 5000,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
