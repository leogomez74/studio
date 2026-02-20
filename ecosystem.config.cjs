module.exports = {
  apps: [
    {
      name: "studio-next",
      cwd: "C:/laragon/www/studio",
      script: "node_modules/next/dist/bin/next",
      args: "dev -p 3000",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "dsf3-frontend",
      cwd: "C:/laragon/www/dsf3",
      script: "node_modules/next/dist/bin/next",
      args: "dev -p 3001",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
