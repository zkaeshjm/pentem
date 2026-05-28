import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const pkgPath = resolve('packages/pentem-cli/package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const dep = pkg.dependencies['@internal/pentem-shared'];
if (dep) {
  delete pkg.dependencies['@internal/pentem-shared'];
  console.log(`Removed @internal/pentem-shared (${dep}) from dependencies`);
}

delete pkg.devDependencies;
console.log('Removed devDependencies');

delete pkg.scripts;
console.log('Removed scripts');

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Cleaned ${pkgPath}`);
