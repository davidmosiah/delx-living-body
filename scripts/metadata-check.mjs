import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const serverJson = JSON.parse(readFileSync('server.json', 'utf8'));
const errors = [];

function requireFile(path) {
  if (!existsSync(path)) errors.push(`Missing required file: ${path}`);
}

requireFile('README.md');
if (packageJson.private !== true && packageJson.license !== 'UNLICENSED') {
  requireFile('LICENSE');
}
requireFile('llms.txt');
requireFile('server.json');

if (serverJson.version !== packageJson.version) {
  errors.push(`server.json version ${serverJson.version} != package.json version ${packageJson.version}`);
}

const npmPackage = serverJson.packages?.find((pkg) => pkg.registryType === 'npm');
if (!npmPackage) {
  errors.push('server.json must declare an npm package.');
} else {
  if (npmPackage.identifier !== packageJson.name) {
    errors.push(`server.json package identifier ${npmPackage.identifier} != package name ${packageJson.name}`);
  }
  if (npmPackage.version !== packageJson.version) {
    errors.push(`server.json package version ${npmPackage.version} != package version ${packageJson.version}`);
  }
}

if (Array.isArray(packageJson.files) && !packageJson.files.includes('llms.txt')) {
  errors.push('package.json files must include llms.txt.');
}

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, metadata: true, package: packageJson.name, version: packageJson.version }, null, 2));
