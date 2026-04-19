const fs = require('fs');
const path = require('path');

const envFile = `export const environment = {
  production: true,
  pocketbaseUrl: '${process.env.POCKETBASE_URL || 'https://game-gauntlet-backend.fly.dev'}',
  rawgApiKey: '${process.env.RAWG_API_KEY || ''}',
};
`;

const targetPath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');
fs.writeFileSync(targetPath, envFile);
console.log(`Environment file written to ${targetPath}`);
