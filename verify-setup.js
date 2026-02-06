#!/usr/bin/env node

/**
 * Verify Switchboard setup is correct
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Switchboard setup...\n');

let errors = 0;
let warnings = 0;

// Check required files
const requiredFiles = [
  'package.json',
  'pages/api/overlay.js',
  'lib/imageProcessor.js',
  'pages/index.js',
  'next.config.js',
  'vercel.json'
];

console.log('📄 Checking required files...');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    errors++;
  }
});

// Check dependencies
console.log('\n📦 Checking dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = {
  'next': 'Web framework',
  'sharp': 'Image processing',
  'axios': 'HTTP client',
  'react': 'UI framework',
  'react-dom': 'React DOM'
};

Object.entries(requiredDeps).forEach(([dep, description]) => {
  if (packageJson.dependencies[dep]) {
    console.log(`  ✅ ${dep} (${description}) - ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`  ❌ ${dep} (${description}) - MISSING`);
    errors++;
  }
});

// Check node_modules
console.log('\n📁 Checking installation...');
if (fs.existsSync('node_modules')) {
  const installedPackages = fs.readdirSync('node_modules').length;
  console.log(`  ✅ node_modules exists (${installedPackages} packages)`);
} else {
  console.log('  ❌ node_modules missing - Run: npm install');
  errors++;
}

// Check documentation
console.log('\n📚 Checking documentation...');
const docs = [
  'README.md',
  'QUICKSTART.md',
  'DEPLOYMENT.md',
  'GOOGLE_SCRIPT_INTEGRATION.md',
  'PROJECT_SUMMARY.md'
];

docs.forEach(doc => {
  if (fs.existsSync(doc)) {
    console.log(`  ✅ ${doc}`);
  } else {
    console.log(`  ⚠️  ${doc} - missing`);
    warnings++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed!');
  console.log('\n🚀 Next steps:');
  console.log('   1. npm run dev         - Test locally');
  console.log('   2. vercel --prod       - Deploy to production');
  console.log('   3. Update Google Script with your Vercel URL');
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} error(s) found`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning(s) found`);
  }

  if (errors > 0) {
    console.log('\n🔧 Fix errors first:');
    console.log('   - Run: npm install');
    process.exit(1);
  }
}

console.log('='.repeat(50));
