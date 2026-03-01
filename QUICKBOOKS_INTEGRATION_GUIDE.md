# QuickBooks Bill Payment Integration Guide

## Overview

The `pay-bill.html` page has been created with a complete bill payment form and JavaScript framework ready for QuickBooks API integration. This guide will help you set up the authorization and backend integration needed to process payments.

---

## Step 1: QuickBooks Account Setup (Morning Tasks)

When you get your QuickBooks information, you'll need:

1. **OAuth Credentials** from Intuit:
   - Client ID
   - Client Secret
   - Realm ID (your QuickBooks Company ID)
   - Access Token
   - Refresh Token

2. **QuickBooks Payments Setup**:
   - Payments API credentials
   - Merchant Account ID (if using QB Payments)

### Where to Get These:
- **QuickBooks Online**: 
  - Go to Admin → Billing & Subscription → Payment Methods
  - Look for "Setup Payments" or "Accept Payments"
  - Or visit: https://developer.intuit.com/app/developer/qbo/docs/get-started/hello-world/nodejs

- **Intuit Developer Portal**:
  - Visit: https://developer.intuit.com
  - Create an app in your development environment
  - Get credentials from Dashboard → Keys & OAuth

---

## Step 2: Backend Setup (Node.js/Express Example)

You'll need to create backend API endpoints to handle QuickBooks integration. Here's a template using Node.js:

### Installation

```bash
npm install express dotenv axios body-parser cors
npm install intuit-oauth2
```

### Environment File (.env)

Create a `.env` file in your server directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# QuickBooks OAuth Credentials
QB_CLIENT_ID=YOUR_CLIENT_ID_HERE
QB_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
QB_REALM_ID=YOUR_REALM_ID_HERE
QB_ACCESS_TOKEN=YOUR_ACCESS_TOKEN_HERE
QB_REFRESH_TOKEN=YOUR_REFRESH_TOKEN_HERE

# QuickBooks URL
QB_API_URL=https://quickbooks.api.intuit.com/v2/company

# Payment Processing
QUICKBOOKS_PAYMENTS_KEY=YOUR_QB_PAYMENTS_KEY_HERE

# Email Configuration (for confirmations)
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
FROM_EMAIL=noreply@ortizcustomworks.com
```

### Backend Server Example (server.js)

```javascript
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ============================================================
// API ENDPOINT 1: LOOKUP BILL IN QUICKBOOKS
// ============================================================
app.post('/api/process-quickbooks-payment/lookup-bill', async (req, res) => {
  try {
    const { billNumber, realmId } = req.body;

    // Query QuickBooks for the bill
    const query = `SELECT * FROM Bill WHERE DocNumber = '${billNumber}'`;
    const encodedQuery = encodeURIComponent(query);

    const response = await axios.get(
      `${process.env.QB_API_URL}/${realmId}/query?query=${encodedQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.QB_ACCESS_TOKEN}`,
          'Accept': 'application/json'
        }
      }
    );

    const bills = response.data.QueryResponse.Bill || [];

    if (bills.length > 0) {
      const bill = bills[0];
      res.json({
        found: true,
        billId: bill.Id,
        totalAmount: bill.TotalAmt || 0,
        vendorId: bill.VendorRef.value,
        dueDate: bill.DueDate || null,
        billNumber: bill.DocNumber
      });
    } else {
      res.json({ found: false });
    }

  } catch (error) {
    console.error('Error looking up bill:', error);
    res.status(500).json({
      found: false,
      error: 'Unable to look up bill'
    });
  }
});

// ============================================================
// API ENDPOINT 2: PROCESS PAYMENT
// ============================================================
app.post('/api/process-quickbooks-payment/process-payment', async (req, res) => {
  try {
    const {
      billNumber,
      billId,
      vendorId,
      amount,
      customerName,
      customerEmail,
      customerPhone,
      realmId
    } = req.body;

    // Create Payment in QuickBooks
    const paymentData = {
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: billId,
              TxnType: 'Bill'
            }
          ]
        }
      ],
      VendorRef: {
        value: vendorId
      },
      TotalAmt: amount,
      APAccountRef: process.env.QB_AP_ACCOUNT_ID || '2'
    };

    const response = await axios.post(
      `${process.env.QB_API_URL}/${realmId}/payment`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.QB_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = response.data.Payment;

    // Log payment details for records
    console.log('Payment processed:', {
      transactionId: payment.Id,
      amount: amount,
      bill: billNumber,
      customer: customerName,
      timestamp: new Date()
    });

    // Send confirmation email (optional)
    // await sendPaymentConfirmationEmail(customerEmail, {
    //   transactionId: payment.Id,
    //   amount: amount,
    //   billNumber: billNumber
    // });

    res.json({
      success: true,
      transactionId: payment.Id,
      message: 'Payment processed successfully'
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    
    // Log failed payment attempt
    console.error('Failed payment details:', {
      error: error.message,
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      error: 'Payment processing failed. Please try again or contact support.'
    });
  }
});

// ============================================================
// API ENDPOINT 3: GET NEW ACCESS TOKEN (Token Refresh)
// ============================================================
app.post('/api/get-quickbooks-token', async (req, res) => {
  try {
    // This endpoint refreshes the OAuth token when it expires
    const response = await axios.post(
      'https://oauth.platform.intuit.com/oauth2/tokens/introspect',
      {
        token: process.env.QB_ACCESS_TOKEN,
        client_id: process.env.QB_CLIENT_ID,
        client_secret: process.env.QB_CLIENT_SECRET
      }
    );

    // If token is expired, refresh it
    if (response.data.active === false) {
      const refreshResponse = await axios.post(
        'https://oauth.platform.intuit.com/oauth2/tokens/refresh',
        {},
        {
          auth: {
            username: process.env.QB_CLIENT_ID,
            password: process.env.QB_CLIENT_SECRET
          },
          data: {
            grant_type: 'refresh_token',
            refresh_token: process.env.QB_REFRESH_TOKEN
          }
        }
      );

      // Update the env with new token (in production, save to database)
      process.env.QB_ACCESS_TOKEN = refreshResponse.data.access_token;
    }

    res.json({ accessToken: process.env.QB_ACCESS_TOKEN });

  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ============================================================
// UTILITY: EMAIL CONFIRMATION (Optional)
// ============================================================
async function sendPaymentConfirmationEmail(customerEmail, paymentData) {
  try {
    // Using nodemailer or your preferred email service
    // Example with Gmail/SMTP:

    /*
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: customerEmail,
      subject: 'Payment Confirmation - Ortiz Custom Works',
      html: `
        <h2>Payment Received</h2>
        <p>Thank you for your payment!</p>
        <p><strong>Transaction ID:</strong> ${paymentData.transactionId}</p>
        <p><strong>Amount:</strong> $${paymentData.amount.toFixed(2)}</p>
        <p><strong>Bill Number:</strong> ${paymentData.billNumber}</p>
        <p>Your payment has been successfully applied to your account.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    */

  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Bill payment API endpoints ready');
});
```

---

## Step 3: Frontend Configuration

In the `pay-bill.html` file, update the QB_CONFIG object with your credentials:

```javascript
const QB_CONFIG = {
  realmId: 'YOUR_REALM_ID_HERE',
  accessToken: 'YOUR_ACCESS_TOKEN_HERE',
  environmentUrl: 'https://quickbooks.api.intuit.com',
  apiVersion: 'v2',
  paymentUrl: 'http://localhost:3000/api/process-quickbooks-payment'
};
```

**Important**: In production, never expose credentials in frontend code. Use server-side proxying instead.

---

## Step 4: Testing

### Test the Bill Lookup

```bash
curl -X POST http://localhost:3000/api/process-quickbooks-payment/lookup-bill \
  -H "Content-Type: application/json" \
  -d '{
    "billNumber": "TEST-001",
    "realmId": "YOUR_REALM_ID"
  }'
```

### Test Payment Processing

```bash
curl -X POST http://localhost:3000/api/process-quickbooks-payment/process-payment \
  -H "Content-Type: application/json" \
  -d '{
    "billNumber": "TEST-001",
    "billId": "123456789",
    "vendorId": "1",
    "amount": 500.00,
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "realmId": "YOUR_REALM_ID"
  }'
```

---

## Step 5: Security Best Practices

1. **Never expose credentials in frontend code**
   - Keep all API keys server-side
   - Use environment variables
   - Use .gitignore to prevent credential leaks

2. **HTTPS Only**
   - Use SSL/TLS for all communications
   - Verify SSL certificates

3. **Rate Limiting**
   - Implement rate limiting on your API endpoints
   - Protect against brute force attempts

4. **Input Validation**
   - Validate all user inputs
   - Sanitize bill numbers to prevent SQL injection
   - Validate email addresses and phone numbers

5. **Error Handling**
   - Don't expose detailed error messages to users
   - Log errors securely for debugging
   - Implement proper error recovery

6. **Data Storage**
   - Don't store payment card information
   - Store only transaction IDs and metadata
   - Comply with PCI DSS standards

---

## Step 6: Deployment

### Deploy to Heroku (Example)

```bash
# Create Heroku app
heroku create ortiz-bill-payment

# Set environment variables
heroku config:set QB_REALM_ID=your_realm_id
heroku config:set QB_ACCESS_TOKEN=your_token
heroku config:set QB_CLIENT_ID=your_client_id
heroku config:set QB_CLIENT_SECRET=your_secret

# Deploy
git push heroku main
```

### Deploy to AWS (Example)

Use AWS Lambda with API Gateway, or EC2 with Node.js application:

```bash
# Using AWS Lambda with serverless
npm install -g serverless
serverless deploy
```

---

## Troubleshooting

### Common Issues

**Issue: "Bill not found"**
- Verify the bill number is correct in QuickBooks
- Check that the bill is not marked as closed/paid already
- Ensure the Realm ID matches your QB Company ID

**Issue: "Authentication failed"**
- Check access token hasn't expired
- Implement token refresh mechanism
- Verify OAuth credentials are correct

**Issue: "Invalid amount"**
- Bill amount mismatch? Check QB for the exact amount
- Include cents in the amount (e.g., 500.00)
- Verify currency matches (USD)

**Issue: "Server connection error"**
- Check firewall/network settings
- Verify QB API is accessible from your server
- Check both API endpoints are responding

---

## Additional Resources

- **QuickBooks API Documentation**: https://developer.intuit.com/app/developer/qbo/docs/get-started/hello-world/nodejs
- **OAuth 2.0 Guide**: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- **Payments API**: https://developer.intuit.com/app/developer/payments/docs/get-started
- **Node.js examples**: https://github.com/intuit/QuickBooks-V4-Node-SDK

---

## Support Contacts

- **Intuit Developer Support**: https://developer.intuit.com/support
- **QuickBooks API Forum**: https://quickbooks-api.intuit.com/forum

---

## File Structure

```
Pedro/
├── pay-bill.html                 (Bill payment form - READY TO USE)
├── server.js                     (Backend - USE TEMPLATE ABOVE)
├── .env                          (Environment variables - CREATE THIS)
├── package.json                  (Node dependencies - CREATE THIS)
└── Other pages...
```

---

## Next Steps

1. **Get QuickBooks Credentials** (from owner in the morning)
2. **Create .env file** with credentials
3. **Set up Node.js backend** using the server.js template
4. **Test API endpoints** with provided curl commands
5. **Deploy to production server**
6. **Update pay-bill.html** with production API URL
7. **Thoroughly test** before going live

---

**Status**: Frontend Ready | Backend Template Ready | Awaiting QuickBooks Credentials

**Last Updated**: February 28, 2026
