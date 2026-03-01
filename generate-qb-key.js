// QuickBooks Token Encryption Key Generator
// Run this script to generate a secure encryption key for your QuickBooks tokens

const crypto = require('crypto');

console.log('\n==============================================');
console.log('QuickBooks Token Encryption Setup');
console.log('==============================================\n');

// Generate a secure 256-bit (32 bytes) encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated 256-bit encryption key:');
console.log('\nQB_ENCRYPTION_KEY=' + encryptionKey);

console.log('\n----------------------------------------------');
console.log('NEXT STEPS:');
console.log('----------------------------------------------');
console.log('1. Copy the key above');
console.log('2. Add it to Render environment variables:');
console.log('   - Name: QB_ENCRYPTION_KEY');
console.log('   - Value: ' + encryptionKey);
console.log('\n3. Once you have your QuickBooks tokens from the OAuth Playground,');
console.log('   run: node encrypt-qb-tokens.js');
console.log('   to encrypt them for secure storage.\n');
console.log('==============================================\n');
