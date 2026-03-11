// QuickBooks OAuth Token Generator
// This opens a browser for you to authorize, then captures the tokens

const http = require('http');
const { spawn } = require('child_process');

const CLIENT_ID = 'ABfPDUL8UaYDP5Btk4MznWPGAoRKzDDveOGXzPIIU0ybXgHKt';
const CLIENT_SECRET = 'aBx14g1dQT2uPyXQrh2Enk1wfHsJ010ajYDgYm2';
const REDIRECT_URI = 'http://localhost:8000/callback';
const SCOPES = 'com.intuit.quickbooks.accounting com.intuit.quickbooks.payment';

console.log('\n==============================================');
console.log('QuickBooks OAuth Token Generator');
console.log('==============================================\n');

// Create a simple HTTP server to receive the authorization code
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/callback')) {
    const url = new URL(req.url, `http://localhost:8000`);
    const code = url.searchParams.get('code');
    const realmId = url.searchParams.get('realmId');

    if (code && realmId) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1 style="color: green;">✅ Authorization Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
          </body>
        </html>
      `);

      console.log('\n✅ Authorization successful!');
      console.log('📝 Realm ID:', realmId);
      console.log('\n🔄 Exchanging authorization code for tokens...\n');

      // Exchange authorization code for tokens
      try {
        const axios = require('axios');
        const tokenResponse = await axios.post(
          'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
          }),
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
            }
          }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        console.log('==============================================');
        console.log('✅ SUCCESS! Your QuickBooks Credentials:');
        console.log('==============================================\n');
        console.log('QB_CLIENT_ID=' + CLIENT_ID);
        console.log('\nQB_CLIENT_SECRET=' + CLIENT_SECRET);
        console.log('\nQB_REALM_ID=' + realmId);
        console.log('\nAccess Token (expires in ' + expires_in + ' seconds):');
        console.log(access_token);
        console.log('\nRefresh Token:');
        console.log(refresh_token);
        console.log('\n==============================================');
        console.log('NEXT STEP: Encrypt the tokens');
        console.log('==============================================\n');
        console.log('Run: node encrypt-qb-tokens.js');
        console.log('\nThen add all values to Render environment variables.\n');

        server.close();
        process.exit(0);

      } catch (error) {
        console.error('❌ Token exchange failed:', error.response?.data || error.message);
        server.close();
        process.exit(1);
      }

    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Authorization failed - missing code or realmId');
      server.close();
      process.exit(1);
    }
  }
});

server.listen(8000, () => {
  console.log('🌐 Local server started on http://localhost:8000');
  console.log('\n📋 INSTRUCTIONS:');
  console.log('1. A browser will open in a moment');
  console.log('2. Sign in to QuickBooks');
  console.log('3. Select your Sandbox company (Sandbox Company US 7f73)');
  console.log('4. Click "Authorize"');
  console.log('5. Tokens will appear here in the terminal\n');
  console.log('Opening browser in 3 seconds...\n');

  setTimeout(() => {
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=test`;
    
    console.log('🔗 Authorization URL:', authUrl);
    console.log('\nIf browser doesn\'t open, copy the URL above and paste it in your browser.\n');

    // Open browser based on platform
    const platform = process.platform;
    let command;

    if (platform === 'win32') {
      command = `start "" "${authUrl}"`;
      spawn('cmd', ['/c', command], { shell: true, detached: true });
    } else if (platform === 'darwin') {
      spawn('open', [authUrl]);
    } else {
      spawn('xdg-open', [authUrl]);
    }
  }, 3000);
});

// Handle errors
server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});
