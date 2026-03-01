// QuickBooks Token Encryption Utility
// This script encrypts your QuickBooks access and refresh tokens for secure storage

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Encryption function (same as in server.js)
function encryptToken(token, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv:authTag:encrypted format
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

console.log('\n==============================================');
console.log('QuickBooks Token Encryption');
console.log('==============================================\n');

// Step 1: Get encryption key
rl.question('Enter your QB_ENCRYPTION_KEY (64 hex characters): ', (encryptionKey) => {
  if (!encryptionKey || encryptionKey.length !== 64) {
    console.error('❌ Error: Encryption key must be exactly 64 hex characters.');
    console.error('   Run: node generate-qb-key.js to generate one.');
    rl.close();
    return;
  }

  // Step 2: Get access token
  rl.question('\nEnter your QuickBooks Access Token: ', (accessToken) => {
    if (!accessToken) {
      console.error('❌ Error: Access token is required.');
      rl.close();
      return;
    }

    // Step 3: Get refresh token
    rl.question('Enter your QuickBooks Refresh Token: ', (refreshToken) => {
      if (!refreshToken) {
        console.error('❌ Error: Refresh token is required.');
        rl.close();
        return;
      }

      console.log('\n----------------------------------------------');
      console.log('Encrypting tokens...');
      console.log('----------------------------------------------\n');

      try {
        // Encrypt both tokens
        const encryptedAccessToken = encryptToken(accessToken, encryptionKey);
        const encryptedRefreshToken = encryptToken(refreshToken, encryptionKey);

        console.log('✅ Encryption successful!\n');
        console.log('Add these to your Render environment variables:\n');
        console.log('QB_ACCESS_TOKEN_ENCRYPTED=' + encryptedAccessToken);
        console.log('\nQB_REFRESH_TOKEN_ENCRYPTED=' + encryptedRefreshToken);
        
        console.log('\n----------------------------------------------');
        console.log('COMPLETE ENVIRONMENT VARIABLES NEEDED:');
        console.log('----------------------------------------------');
        console.log('QB_ENCRYPTION_KEY=' + encryptionKey);
        console.log('QB_CLIENT_ID=[your Client ID]');
        console.log('QB_CLIENT_SECRET=[your Client Secret]');
        console.log('QB_REALM_ID=[your Realm ID]');
        console.log('QB_ACCESS_TOKEN_ENCRYPTED=' + encryptedAccessToken);
        console.log('QB_REFRESH_TOKEN_ENCRYPTED=' + encryptedRefreshToken);
        console.log('\n==============================================\n');

      } catch (error) {
        console.error('❌ Encryption failed:', error.message);
      }

      rl.close();
    });
  });
});
