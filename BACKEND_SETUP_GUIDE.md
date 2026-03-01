# Backend Setup & Deployment Guide

## Overview

Your website now has a complete backend server that handles:
- ✅ Contact form email submissions
- ✅ Bill payment with QuickBooks integration
- ✅ Deposit payments with Stripe
- ✅ Payment confirmations and receipts

This guide will walk you through setting everything up.

---

## Quick Start (5 Minutes)

### 1. Install Node.js

Download from: https://nodejs.org/ (LTS version recommended)

Verify installation:
```bash
node --version
npm --version
```

### 2. Install Dependencies

In your `Pedro` folder, run:
```bash
npm install
```

This installs everything from `package.json`.

### 3. Create `.env` File

Copy `.env.example` and rename to `.env`:
```bash
cp .env.example .env
```

Or on Windows:
```bash
copy .env.example .env
```

### 4. Configure Email (for contact form)

**Using Gmail:**

1. Go to https://myaccount.google.com/apppasswords
2. Log in with your Gmail account
3. Select "Mail" and "Windows Computer" (or your device)
4. Generate app password (16 characters)
5. Copy this password to `.env`:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
OWNER_EMAIL=ortizcustomworks@gmail.com
```

**Using another email provider:**

Contact your email provider for SMTP settings (host, port, credentials).

### 5. Run the Server

```bash
npm start
```

You should see:
```
==================================================
🚀 ORTIZ CUSTOM WORKS SERVER STARTED
📍 Running on http://localhost:5000
==================================================
```

### 6. Test It Works

Open your browser and visit:
- http://localhost:5000/api/health

You should see a status response.

---

## Configuration Details

### Email Service

The contact form and payment confirmations require email configuration.

**Option 1: Gmail (Easiest)**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
OWNER_EMAIL=ortizcustomworks@gmail.com
```

**Option 2: Mailgun (Best for production)**

Sign up at https://www.mailgun.com/

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
EMAIL_USER=postmaster@yourdomain.mailgun.org
EMAIL_PASS=your-mailgun-password
OWNER_EMAIL=ortizcustomworks@gmail.com
```

**Option 3: SendGrid**

Sign up at https://sendgrid.com/

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
OWNER_EMAIL=ortizcustomworks@gmail.com
```

### QuickBooks Integration

Once you have your QB credentials from the morning:

```env
QB_REALM_ID=your-realm-id
QB_CLIENT_ID=your-client-id
QB_CLIENT_SECRET=your-client-secret
QB_ACCESS_TOKEN=your-access-token
QB_REFRESH_TOKEN=your-refresh-token
QB_API_URL=https://quickbooks.api.intuit.com/v2/company
```

Then update `pay-bill.html` QB_CONFIG (around line 255):

```javascript
const QB_CONFIG = {
  realmId: 'your-realm-id',
  accessToken: 'your-access-token',
  environmentUrl: 'https://quickbooks.api.intuit.com',
  apiVersion: 'v2',
  paymentUrl: 'http://localhost:5000/api/process-quickbooks-payment'
};
```

### Stripe Setup (for deposits)

1. Sign up at https://stripe.com
2. Get your API keys from https://dashboard.stripe.com/apikeys
3. Add to `.env`:

```env
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
```

For production, use `pk_live_` and `sk_live_` keys.

---

## API Endpoints

Once running, your backend provides these endpoints:

### Contact Form
```
POST /api/contact-form
Body: { name, phone, email, projectDetails }
Response: { success, message/error }
```

### Bill Payment - Lookup
```
POST /api/process-quickbooks-payment/lookup-bill
Body: { billNumber, realmId }
Response: { found, billId, totalAmount, vendorId, dueDate }
```

### Bill Payment - Process
```
POST /api/process-quickbooks-payment/process-payment
Body: { billNumber, billId, vendorId, amount, customerName, customerEmail, customerPhone, realmId }
Response: { success, transactionId, error }
```

### Stripe Checkout
```
POST /api/create-deposit-session
Body: { amount, customerEmail }
Response: { sessionId, url }
```

### Verify Payment
```
GET /api/verify-payment/:sessionId
Response: { status, amountTotal, customerEmail }
```

### Health Check
```
GET /api/health
Response: { status, services }
```

---

## Deployment

### Option 1: Heroku (Easiest)

```bash
# Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
# Log in
heroku login

# Create app
heroku create ortiz-custom-works

# Set environment variables
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASS=your-app-password
heroku config:set QB_REALM_ID=your-realm-id
heroku config:set QB_ACCESS_TOKEN=your-token

# Deploy
git push heroku main
```

### Option 2: AWS EC2

1. Launch an EC2 instance
2. SSH into it
3. Install Node.js: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`
4. Clone your repo and run npm start
5. Use PM2 to keep it running: `npm install -g pm2` then `pm2 start server.js`

### Option 3: DigitalOcean

Similar to EC2. Use their app platform for easier deployment.

### Option 4: Your Own Server

If you have your own web hosting:
1. Ensure Node.js is installed
2. Upload your files
3. Run `npm install` then `npm start`
4. Use PM2 or systemd to keep the server running

---

## Testing Locally

### Test Contact Form

```bash
curl -X POST http://localhost:5000/api/contact-form \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "(407) 123-4567",
    "email": "john@example.com",
    "projectDetails": "Kitchen renovation"
  }'
```

### Test Bill Lookup

```bash
curl -X POST http://localhost:5000/api/process-quickbooks-payment/lookup-bill \
  -H "Content-Type: application/json" \
  -d '{
    "billNumber": "BILL-001",
    "realmId": "YOUR_REALM_ID"
  }'
```

### Check Health

```bash
curl http://localhost:5000/api/health
```

---

## Troubleshooting

### "Port 5000 already in use"

Change the port in `.env`:
```env
PORT=5001
```

Or kill the existing process:
```bash
# On Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# On Mac/Linux
lsof -i :5000
kill -9 <PID>
```

### "Email not sending"

1. Check `.env` has correct credentials
2. If using Gmail, verify app password (16 chars, spaces don't matter)
3. Check if 2FA is enabled on Gmail account
4. Review server logs for error messages

### "QuickBooks connection failed"

1. Verify access token hasn't expired
2. Check realm ID is correct
3. Ensure you're using the right OAuth credentials
4. Check if QB OAuth token needs refresh

### "Stripe checkout not working"

1. Verify `STRIPE_SECRET_KEY` is in `.env`
2. Check key starts with `sk_test_` (test) or `sk_live_` (production)
3. Make sure backend is running when clicking "Pay Deposit"

---

## Production Checklist

Before going live:

- [ ] Verify all `.env` variables are set correctly
- [ ] Update frontend API URLs to production server URL (not localhost)
- [ ] Switch Stripe to live keys (`sk_live_`, not `sk_test_`)
- [ ] Test all forms and payment flows
- [ ] Set up SSL/HTTPS certificate
- [ ] Enable CORS for production domain only
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Set up error logging/monitoring
- [ ] Back up your QB and Stripe credentials
- [ ] Test on actual mobile devices

---

## File Structure

```
Pedro/
├── server.js                           ✅ Backend server
├── package.json                        ✅ Dependencies
├── .env                                ← Your secrets (NEVER commit)
├── .env.example                        ✅ Template for .env
├── contact.html                        ✅ Contact form (now fully working)
├── pay-bill.html                       ✅ Bill payment (ready when QB configured)
├── payment-success.html                ✅ Success page
├── payment-cancel.html                 ✅ Cancel page
├── QB_CREDENTIALS_CHECKLIST.md         📋 Where to find QB credentials
├── QUICKBOOKS_INTEGRATION_GUIDE.md     📋 QB setup guide
└── (other HTML pages)
```

---

## Support Resources

- **Node.js/Express**: https://expressjs.com/
- **Nodemailer**: https://nodemailer.com/
- **Stripe Docs**: https://stripe.com/docs
- **QuickBooks API**: https://developer.intuit.com/app/developer/qbo/docs
- **Heroku Deployment**: https://devcenter.heroku.com/

---

## Common Commands

```bash
# Start server development mode
npm run dev

# Start server production mode
npm start

# Install new package
npm install package-name

# Check what's running on port 5000
netstat -ano | findstr :5000  # Windows
lsof -i :5000                  # Mac/Linux

# View server logs
# Server outputs go to console while running
```

---

## Next Steps

1. **Install Node.js** and run `npm install`
2. **Setup email** - configure `.env` with Gmail or other provider
3. **Test locally** - run `npm start` and test contact form
4. **Add QB credentials** - once you have them tomorrow
5. **Setup Stripe** - create account and add API keys
6. **Deploy** - push to Heroku or your server

---

## You're All Set! 🚀

Your website has everything it needs. The frontend is fully linked and ready. The backend handles all the heavy lifting.

**Questions?** Check the QUICKBOOKS_INTEGRATION_GUIDE.md for more details!

---

**Version**: 1.0
**Last Updated**: February 28, 2026
