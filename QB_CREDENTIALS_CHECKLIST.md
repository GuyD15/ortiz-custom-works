# QuickBooks Credentials Checklist

Use this checklist when you get your QuickBooks information to ensure you have everything needed for the bill payment integration.

---

## OAuth Credentials (REQUIRED)

These are critical for authenticating with QuickBooks API.

- [ ] **Client ID**
  - Where to find: Intuit Developer Portal → App Dashboard → Keys
  - Format: Looks like `ABCDEFGHIJKLMNOPQRSTUVWXYZabcd`
  - Goes in: `.env` file as `QB_CLIENT_ID`

- [ ] **Client Secret**
  - Where to find: Intuit Developer Portal → App Dashboard → Keys
  - Format: Longer string, keep confidential
  - Goes in: `.env` file as `QB_CLIENT_SECRET`

- [ ] **Realm ID** (QuickBooks Company ID)
  - Where to find: QuickBooks Admin → Profile → Company Information
  - Or: Intuit Developer Portal → App Dashboard → Realms
  - Format: Numeric ID like `1234567890`
  - Goes in: `.env` file as `QB_REALM_ID`
  - Also used in: `pay-bill.html` QB_CONFIG object

- [ ] **Access Token**
  - Where to find: Generated after OAuth authentication
  - Format: Long string starting with `eyJ...` (JWT format)
  - Goes in: `.env` file as `QB_ACCESS_TOKEN`
  - Also used in: `pay-bill.html` QB_CONFIG object
  - **Important**: Valid for 1 hour, after that use Refresh Token

- [ ] **Refresh Token**
  - Where to find: Generated with Access Token
  - Format: Long string
  - Goes in: `.env` file as `QB_REFRESH_TOKEN`
  - Used to: Get new Access Token when current one expires

---

## Optional Credentials

These are nice-to-have for email confirmations and enhanced features.

- [ ] **QB Payments API Key** (if using QuickBooks Payments)
  - Where to find: Intuit Developer Portal → Payments settings
  - Goes in: `.env` file as `QUICKBOOKS_PAYMENTS_KEY`

- [ ] **AP Account ID** (for payment posting)
  - Where to find: QuickBooks → Chart of Accounts → Accounts Payable account
  - Format: Numeric ID
  - Default: `2` (usually correct)
  - Goes in: `server.js` as `QB_AP_ACCOUNT_ID`

- [ ] **SMTP Email Settings** (for payment confirmations)
  - Host: Your email provider's SMTP server
  - Port: Usually 587
  - Email: Your notification email address
  - Password: App password (not your regular password)
  - Goes in: `.env` file

---

## Step-by-Step: Where to Find Each Credential

### From QuickBooks Online

1. Log into QuickBooks Online
2. Click **Gear icon** (top right) → **Account and settings**
3. Look for "Company information" section
4. Copy the **Company ID** - this is your Realm ID

### From Intuit Developer Portal

1. Visit https://developer.intuit.com
2. Log in with your Intuit account
3. Go to **Dashboard** or **My Apps**
4. Click on your app
5. In the **Keys & OAuth** section, you'll find:
   - Client ID
   - Client Secret
6. After connecting your QB account via OAuth, you'll get:
   - Access Token
   - Refresh Token

---

## Format Reference

Here's what each value should look like (examples):

```
Client ID:        ABCDEf0ghijklmnopqrstuvwxyzABC123
Client Secret:    A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0
Realm ID:         1234567890
Access Token:     eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1Nijo...
Refresh Token:    AB12CD34EF56GH78IJ90KL12MN34OP56QR78...
QB AP Account ID: 2
```

---

## Security Reminders

⚠️ **IMPORTANT SECURITY NOTES:**

- **Never** share your credentials via email or chat
- **Never** commit credentials to Git
- Keep the `.env` file out of version control (use `.gitignore`)
- Access Token expires after 1 hour - implement refresh logic
- If credentials are exposed, immediately revoke them in Intuit Portal
- Use different credentials for development vs. production

---

## Files to Update Once You Have Credentials

### 1. Create `.env` file in your server directory

```env
QB_CLIENT_ID=your_client_id_here
QB_CLIENT_SECRET=your_secret_here
QB_REALM_ID=your_realm_id_here
QB_ACCESS_TOKEN=your_access_token_here
QB_REFRESH_TOKEN=your_refresh_token_here
QB_API_URL=https://quickbooks.api.intuit.com/v2/company
PORT=3000
NODE_ENV=development
```

### 2. Update `pay-bill.html` - Find this section

Look for this in `pay-bill.html` (around line 195):

```javascript
const QB_CONFIG = {
  realmId: 'YOUR_REALM_ID_HERE',
  accessToken: 'YOUR_ACCESS_TOKEN_HERE',
  environmentUrl: 'https://quickbooks.api.intuit.com',
  apiVersion: 'v2',
  paymentUrl: 'http://localhost:3000/api/process-quickbooks-payment'
};
```

Replace with your actual values.

### 3. Update `server.js` if deploying

Use the template from `QUICKBOOKS_INTEGRATION_GUIDE.md`

---

## Verification Checklist

Once you have all credentials:

- [ ] All 5 required OAuth credentials obtained
- [ ] Credentials copied to `.env` file correctly
- [ ] `.env` file added to `.gitignore`
- [ ] `pay-bill.html` updated with Realm ID and Access Token
- [ ] Server configured with credentials
- [ ] Backend API endpoints created
- [ ] Tested bill lookup endpoint
- [ ] Tested payment processing endpoint
- [ ] Confirmed payments appear in QuickBooks

---

## Quick Reference Card

Print or bookmark this for quick access:

| Credential | Length | Where Found | Goes To |
|-----------|--------|------------|---------|
| Client ID | ~30 chars | Developer Portal | .env |
| Client Secret | ~50 chars | Developer Portal | .env |
| Realm ID | ~10 digits | QB Company Info | .env + pay-bill.html |
| Access Token | ~500 chars | OAuth response | .env + pay-bill.html |
| Refresh Token | ~500 chars | OAuth response | .env |

---

## Getting Help

If you're stuck finding a credential:

1. Check the **QUICKBOOKS_INTEGRATION_GUIDE.md** file for detailed instructions
2. Visit Intuit Developer Forum: https://developer.intuit.com/support
3. Try searching QB help: https://support.quickbooks.intuit.com

---

**Status**: Ready to receive credentials whenever available

**Prepared Date**: February 28, 2026
