/**
 * ORTIZ CUSTOM WORKS - BACKEND SERVER
 * 
 * This server handles:
 * 1. Contact form emails
 * 2. Bill payment processing with QuickBooks
 * 3. Invoice retrieval and management from QuickBooks
 * 4. CORS handling for frontend requests
 * 
 * Requirements: npm install express dotenv axios nodemailer cors body-parser
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// ============================================================
// SECURE QUICKBOOKS TOKEN MANAGEMENT (PCI/INTUIT COMPLIANT)
// ============================================================

// In-memory token cache (volatile storage - not persisted)
let qbTokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  realmId: null
};

// Encryption helper (AES-256-GCM)
function encryptToken(token, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedToken, encryptionKey) {
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Load encrypted tokens from secure storage at startup
function loadQuickBooksTokens() {
  try {
    const encryptionKey = process.env.QB_ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) {
      console.warn('⚠️  QB_ENCRYPTION_KEY not set or invalid (must be 64 hex chars). QuickBooks features disabled.');
      return;
    }

    // Load encrypted tokens from environment (in production, these should be encrypted values)
    const encryptedAccessToken = process.env.QB_ACCESS_TOKEN_ENCRYPTED;
    const encryptedRefreshToken = process.env.QB_REFRESH_TOKEN_ENCRYPTED;
    
    if (encryptedAccessToken && encryptedRefreshToken) {
      qbTokenCache.accessToken = decryptToken(encryptedAccessToken, encryptionKey);
      qbTokenCache.refreshToken = decryptToken(encryptedRefreshToken, encryptionKey);
      qbTokenCache.realmId = process.env.QB_REALM_ID;
      qbTokenCache.expiresAt = Date.now() + (3600 * 1000); // 1 hour default
      console.log('✅ QuickBooks tokens loaded into memory (encrypted storage)');
    } else {
      console.warn('⚠️  Encrypted QB tokens not found. Use plain tokens temporarily or run setup.');
    }
  } catch (error) {
    console.error('❌ Failed to load QuickBooks tokens:', error.message);
  }
}

// Refresh access token before expiry
async function refreshQuickBooksToken() {
  try {
    if (!qbTokenCache.refreshToken) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.QB_CLIENT_ID;
    const clientSecret = process.env.QB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('QB_CLIENT_ID and QB_CLIENT_SECRET required for token refresh');
    }

    const response = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: qbTokenCache.refreshToken
      }).toString(),
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        }
      }
    );

    // Update in-memory cache
    qbTokenCache.accessToken = response.data.access_token;
    qbTokenCache.refreshToken = response.data.refresh_token;
    qbTokenCache.expiresAt = Date.now() + (response.data.expires_in * 1000);
    
    console.log('✅ QuickBooks access token refreshed');
    return qbTokenCache.accessToken;
  } catch (error) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
    throw error;
  }
}

// Get valid access token (auto-refresh if needed)
async function getQuickBooksAccessToken() {
  // Check if token expires in next 5 minutes
  if (qbTokenCache.expiresAt && qbTokenCache.expiresAt - Date.now() < 300000) {
    console.log('🔄 Access token expiring soon, refreshing...');
    await refreshQuickBooksToken();
  }
  
  if (!qbTokenCache.accessToken) {
    throw new Error('QuickBooks not configured. Set encrypted tokens or run OAuth flow.');
  }
  
  return qbTokenCache.accessToken;
}

// Initialize tokens on startup
loadQuickBooksTokens();

// ============================================================
// MIDDLEWARE SETUP
// ============================================================

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',').map(origin => origin.trim()) : [])
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// EMAIL CONFIGURATION
// ============================================================

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Test email connection on startup
emailTransporter.verify((error, success) => {
  if (error) {
    console.log('⚠️  Email Service Not Configured:', error.message);
    console.log('   Contact form emails will NOT be sent until configured.');
  } else {
    console.log('✅ Email Service Ready');
  }
});

// ============================================================
// ENDPOINT 1: CONTACT FORM - SEND CONSULTATION REQUEST
// ============================================================

app.post('/api/contact-form', async (req, res) => {
  try {
    const { name, phone, email, projectDetails } = req.body;

    // Validation
    if (!name || !phone || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (name, phone, email)'
      });
    }

    // Email to business owner
    const ownerEmailContent = `
      <h2>New Consultation Request - Ortiz Custom Works</h2>
      <p><strong>Customer Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Project Details:</strong></p>
      <p>${projectDetails || 'No details provided'}</p>
      <hr>
      <p><small>Submitted on: ${new Date().toLocaleString()}</small></p>
    `;

    // Email to customer
    const customerEmailContent = `
      <h2>Thank You for Your Interest - Ortiz Custom Works</h2>
      <p>Hi ${name},</p>
      <p>We received your consultation request and will contact you within 24 hours at <strong>${phone}</strong> to schedule your free in-home consultation.</p>
      <p>If you have any questions in the meantime, feel free to call us at <strong>(407) 676-3102</strong> or reply to this email.</p>
      <p>Looking forward to helping you create your custom space!</p>
      <br>
      <p>Best regards,<br>Ortiz Custom Works Team</p>
    `;

    // Send email to business owner
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@ortizcustomworks.com',
      to: process.env.OWNER_EMAIL || 'ortizcustomworks@gmail.com',
      subject: `New Consultation Request from ${name}`,
      html: ownerEmailContent
    });

    // Send confirmation email to customer
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@ortizcustomworks.com',
      to: email,
      subject: 'Consultation Request Received - Ortiz Custom Works',
      html: customerEmailContent
    });

    // Log for records
    console.log(`✅ Contact form submitted: ${name} (${email})`);

    res.json({
      success: true,
      message: 'Your message has been sent successfully!'
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again or call us.'
    });
  }
});

// ============================================================
// ENDPOINT: CHATBOT MESSAGES (Sends when bot can't answer)
// ============================================================

app.post('/api/chatbot-message', async (req, res) => {
  try {
    const { message, visitorEmail, visitorName } = req.body;

    // Validation
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Email to business owner
    const ownerEmailContent = `
      <h2>New Chatbot Message - Ortiz Custom Works</h2>
      <p><strong>From:</strong> ${visitorName || 'Website Visitor'}</p>
      <p><strong>Email:</strong> ${visitorEmail || 'Not provided'}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr>
      <p><small>Sent via chatbot on: ${new Date().toLocaleString()}</small></p>
    `;

    // Send email to business owner only
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@ortizcustomworks.com',
      to: process.env.OWNER_EMAIL || 'ortizcustomworks@gmail.com',
      subject: `New Chatbot Message from ${visitorName || 'Website Visitor'}`,
      html: ownerEmailContent,
      replyTo: visitorEmail || process.env.EMAIL_USER
    });

    // Log for records
    console.log(`✅ Chatbot message received: ${visitorName || 'Visitor'} (${visitorEmail || 'no-email'})`);

    res.json({
      success: true,
      message: 'Your message has been sent! We\'ll get back to you shortly.'
    });

  } catch (error) {
    console.error('❌ Chatbot message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again.'
    });
  }
});

// ============================================================
// ENDPOINT 2: QB BILL LOOKUP
// ============================================================

app.post('/api/process-quickbooks-payment/lookup-bill', async (req, res) => {
  try {
    const { billNumber, realmId } = req.body;

    if (!billNumber || !realmId) {
      return res.status(400).json({
        found: false,
        error: 'Missing billNumber or realmId'
      });
    }

    // QuickBooks API query to find bill
    const query = `SELECT * FROM Bill WHERE DocNumber = '${billNumber}' MAXRESULTS 1`;
    const encodedQuery = encodeURIComponent(query);

    const accessToken = await getQuickBooksAccessToken();
    const response = await axios.get(
      `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/query?query=${encodedQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const bills = response.data.QueryResponse?.Bill || [];

    if (bills.length > 0) {
      const bill = bills[0];
      console.log(`✅ Bill found: ${billNumber}`);
      
      res.json({
        found: true,
        billId: bill.Id,
        totalAmount: bill.TotalAmt || 0,
        vendorId: bill.VendorRef?.value || null,
        dueDate: bill.DueDate || null,
        billNumber: bill.DocNumber
      });
    } else {
      console.log(`❌ Bill not found: ${billNumber}`);
      res.json({ found: false });
    }

  } catch (error) {
    console.error('❌ Bill lookup error:', error.message);
    res.status(500).json({
      found: false,
      error: error.message || 'Unable to look up bill'
    });
  }
});

// ============================================================
// ENDPOINT 3: QB PROCESS PAYMENT
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

    if (!billId || !vendorId || !amount || !realmId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment fields'
      });
    }

    // Create Payment object for QuickBooks
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
      TotalAmt: amount
    };

    // Post payment to QuickBooks
    const accessToken = await getQuickBooksAccessToken();
    const response = await axios.post(
      `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/payment`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = response.data.Payment;
    const transactionId = payment.Id;

    console.log(`✅ Payment processed: ${transactionId} - $${amount} for ${billNumber}`);

    // Send payment confirmation email
    if (customerEmail) {
      try {
        const confirmationEmail = `
          <h2>Payment Received - Ortiz Custom Works</h2>
          <p>Thank you ${customerName}! Your payment has been successfully processed.</p>
          <p><strong>Transaction ID:</strong> ${transactionId}</p>
          <p><strong>Amount Paid:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Bill Number:</strong> ${billNumber}</p>
          <p>The payment has been applied to your account and should be reflected within 1-2 business days.</p>
          <p>If you have any questions, please contact us at <strong>(407) 676-3102</strong> or email <strong>ortizcustomworks@gmail.com</strong></p>
          <br>
          <p>Best regards,<br>Ortiz Custom Works Team</p>
        `;

        await emailTransporter.sendMail({
          from: process.env.EMAIL_USER || 'noreply@ortizcustomworks.com',
          to: customerEmail,
          subject: `Payment Confirmation - Transaction #${transactionId}`,
          html: confirmationEmail
        });

        console.log(`✅ Confirmation email sent to ${customerEmail}`);
      } catch (emailError) {
        console.error('⚠️  Email send failed:', emailError.message);
        // Don't fail the payment if email fails
      }
    }

    res.json({
      success: true,
      transactionId: transactionId,
      message: 'Payment processed successfully'
    });

  } catch (error) {
    console.error('❌ Payment processing error:', error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.fault?.faultstring || 'Payment processing failed'
    });
  }
});

// ============================================================
// ENDPOINT 4: GET CUSTOMER INVOICES BY EMAIL
// ============================================================

app.post('/api/get-customer-invoices', async (req, res) => {
  try {
    const { email, realmId } = req.body;

    if (!email || !realmId) {
      return res.status(400).json({
        success: false,
        error: 'Missing email or realmId'
      });
    }

    // Query QB for customer by email
    const customerQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}' MAXRESULTS 1`;
    const encodedCustomerQuery = encodeURIComponent(customerQuery);

    const accessToken = await getQuickBooksAccessToken();
    const customerResponse = await axios.get(
      `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/query?query=${encodedCustomerQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const customers = customerResponse.data.QueryResponse?.Customer || [];
    if (customers.length === 0) {
      return res.json({
        success: false,
        error: 'Customer not found'
      });
    }

    const customer = customers[0];
    const customerId = customer.Id;

    // Query QB for invoices for this customer
    const invoiceQuery = `SELECT * FROM Invoice WHERE CustomerRef = '${customerId}' ORDER BY TxnDate DESC`;
    const encodedInvoiceQuery = encodeURIComponent(invoiceQuery);

    const invoiceResponse = await axios.get(
      `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/query?query=${encodedInvoiceQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const invoices = invoiceResponse.data.QueryResponse?.Invoice || [];

    console.log(`✅ Found ${invoices.length} invoices for customer ${customer.DisplayName || email}`);

    res.json({
      success: true,
      customer: {
        id: customerId,
        name: customer.DisplayName || 'Unknown',
        email: email
      },
      invoices: invoices.map(inv => ({
        id: inv.Id,
        docNumber: inv.DocNumber,
        txnDate: inv.TxnDate,
        dueDate: inv.DueDate,
        totalAmount: inv.TotalAmt || 0,
        status: inv.DocStatus,
        customerId: customerId
      }))
    });

  } catch (error) {
    console.error('❌ Invoice lookup error:', error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.fault?.faultstring || 'Failed to retrieve invoices'
    });
  }
});

// ============================================================
// ENDPOINT 5: GET INVOICE BY BILL NUMBER
// ============================================================

app.post('/api/get-invoice-by-number', async (req, res) => {
  try {
    const { billNumber, realmId } = req.body;

    if (!billNumber || !realmId) {
      return res.status(400).json({
        success: false,
        error: 'Missing billNumber or realmId'
      });
    }

    // Query QB for invoice by document number
    const query = `SELECT * FROM Invoice WHERE DocNumber = '${billNumber}' MAXRESULTS 1`;
    const encodedQuery = encodeURIComponent(query);

    const accessToken = await getQuickBooksAccessToken();
    const response = await axios.get(
      `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/query?query=${encodedQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const invoices = response.data.QueryResponse?.Invoice || [];
    if (invoices.length === 0) {
      return res.json({
        success: false,
        error: 'Invoice not found'
      });
    }

    const invoice = invoices[0];
    const customerId = invoice.CustomerRef?.value;

    // Get customer details
    let customerData = { id: customerId, name: 'Customer', email: 'unknown' };
    
    if (customerId) {
      try {
        const customerQuery = `SELECT * FROM Customer WHERE Id = '${customerId}' MAXRESULTS 1`;
        const encodedCustomerQuery = encodeURIComponent(customerQuery);

        const custResponse = await axios.get(
          `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/query?query=${encodedCustomerQuery}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        );

        const customer = custResponse.data.QueryResponse?.Customer?.[0];
        if (customer) {
          customerData = {
            id: customer.Id,
            name: customer.DisplayName || 'Customer',
            email: customer.PrimaryEmailAddr || 'unknown'
          };
        }
      } catch (custError) {
        console.log('Could not fetch customer details');
      }
    }

    console.log(`✅ Invoice found: ${billNumber}`);

    res.json({
      success: true,
      customer: customerData,
      invoice: {
        id: invoice.Id,
        docNumber: invoice.DocNumber,
        txnDate: invoice.TxnDate,
        dueDate: invoice.DueDate,
        totalAmount: invoice.TotalAmt || 0,
        status: invoice.DocStatus,
        customerId: customerId
      }
    });

  } catch (error) {
    console.error('❌ Invoice lookup error:', error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.fault?.faultstring || 'Failed to retrieve invoice'
    });
  }
});

// ============================================================
// ENDPOINT 6: PROCESS QB PAYMENT (From Pay Bill Form)
// ============================================================

app.post('/api/process-qb-payment', async (req, res) => {
  try {
    const {
      invoiceId,
      invoiceNumber,
      customerId,
      customerName,
      customerEmail,
      amount,
      paymentMethod,
      realmId,
      accessToken
    } = req.body;

    if (!invoiceId || !customerId || !amount || !realmId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment fields'
      });
    }

    // Create Payment object for QuickBooks
    // Note: QB Payment API requires checking the invoice first
    const paymentData = {
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: invoiceId,
              TxnType: 'Invoice'
            }
          ]
        }
      ],
      CustomerRef: {
        value: customerId
      },
      TotalAmt: amount,
      PrivateNote: `Payment via website. Method: ${paymentMethod}`
    };

    // Post payment to QuickBooks
    const qbAccessToken = await getQuickBooksAccessToken();
    const response = await axios.post(
      `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/payment`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${qbAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = response.data.Payment;
    const transactionId = payment.Id;

    console.log(`✅ Payment processed: ${transactionId} - $${amount} for invoice ${invoiceNumber}`);

    // Send payment confirmation email
    if (customerEmail) {
      try {
        const confirmationEmail = `
          <h2>Payment Received - Ortiz Custom Works</h2>
          <p>Thank you ${customerName}! Your payment has been successfully processed.</p>
          <p><strong>Transaction ID:</strong> ${transactionId}</p>
          <p><strong>Amount Paid:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p>The payment has been applied to your account and should be reflected within 1-2 business days.</p>
          <p>If you have any questions, please contact us at <strong>(407) 676-3102</strong> or email <strong>ortizcustomworks@gmail.com</strong></p>
          <br>
          <p>Best regards,<br>Ortiz Custom Works Team</p>
        `;

        await emailTransporter.sendMail({
          from: process.env.EMAIL_USER || 'noreply@ortizcustomworks.com',
          to: customerEmail,
          subject: `Payment Confirmation - Transaction #${transactionId}`,
          html: confirmationEmail
        });

        console.log(`✅ Confirmation email sent to ${customerEmail}`);
      } catch (emailError) {
        console.error('⚠️  Email send failed:', emailError.message);
        // Don't fail the payment if email fails
      }
    }

    res.json({
      success: true,
      transactionId: transactionId,
      message: 'Payment processed successfully'
    });

  } catch (error) {
    console.error('❌ Payment processing error:', error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.fault?.faultstring || 'Payment processing failed. Please try again or contact support.'
    });
  }
});

// ============================================================
// ENDPOINT 7: SEND INVOICE VIA EMAIL
// ============================================================

app.post('/api/send-invoice', async (req, res) => {
  try {
    const { invoiceId, customerEmail, realmId } = req.body;

    if (!invoiceId || !customerEmail || !realmId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Get invoice details from QB
    const query = `SELECT * FROM Invoice WHERE Id = '${invoiceId}'`;
    const encodedQuery = encodeURIComponent(query);

    const accessToken = await getQuickBooksAccessToken();
    const response = await axios.get(
      `${process.env.QB_API_URL || 'https://quickbooks.api.intuit.com/v2/company'}/${realmId}/query?query=${encodedQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const invoice = response.data.QueryResponse?.Invoice?.[0];

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Send invoice email
    const invoiceEmail = `
      <h2>Invoice from Ortiz Custom Works</h2>
      <p><strong>Invoice #:</strong> ${invoice.DocNumber}</p>
      <p><strong>Date Issued:</strong> ${new Date(invoice.TxnDate).toLocaleDateString()}</p>
      <p><strong>Due Date:</strong> ${new Date(invoice.DueDate).toLocaleDateString()}</p>
      <hr>
      <p><strong>Amount Due:</strong> <span style="font-size: 1.5em; color: #c2410c;">$${invoice.TotalAmt?.toFixed(2) || '0.00'}</span></p>
      <hr>
      <p>You can pay this invoice online at: <a href="${process.env.FRONTEND_URL || 'https://ortizcustomworks.com'}/pay-bill.html">Pay Bill</a></p>
      <p>If you have any questions, please contact us at <strong>(407) 676-3102</strong> or email <strong>ortizcustomworks@gmail.com</strong></p>
      <br>
      <p>Best regards,<br>Ortiz Custom Works Team</p>
    `;

    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@ortizcustomworks.com',
      to: customerEmail,
      subject: `Invoice ${invoice.DocNumber} - Ortiz Custom Works`,
      html: invoiceEmail
    });

    console.log(`✅ Invoice ${invoice.DocNumber} sent to ${customerEmail}`);

    res.json({
      success: true,
      message: 'Invoice sent successfully'
    });

  } catch (error) {
    console.error('❌ Invoice send error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send invoice'
    });
  }
});

// ============================================================
// ENDPOINT 8: QB TOKEN REFRESH
// ============================================================

app.post('/api/get-quickbooks-token', async (req, res) => {
  try {
    // Get fresh access token (will auto-refresh if needed)
    const accessToken = await getQuickBooksAccessToken();

    res.json({
      accessToken: accessToken,
      message: 'Token is active'
    });

  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
});

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      email: process.env.EMAIL_USER ? 'configured' : 'not configured',
      quickbooks: (qbTokenCache.accessToken || process.env.QB_ACCESS_TOKEN_ENCRYPTED) ? 'configured' : 'not configured'
    }
  });
});

// ============================================================
// ANALYTICS & SELF-IMPROVEMENT SYSTEM
// ============================================================

const fs = require('fs');
const path = require('path');

const analyticsFile = path.join(__dirname, 'analytics.json');
const faqFile = path.join(__dirname, 'faqs.json');

// Initialize analytics file
function initAnalyticsFile() {
  if (!fs.existsSync(analyticsFile)) {
    fs.writeFileSync(analyticsFile, JSON.stringify({ interactions: [] }, null, 2));
  }
}

function getAnalytics() {
  try {
    return JSON.parse(fs.readFileSync(analyticsFile, 'utf8'));
  } catch {
    return { interactions: [] };
  }
}

function saveAnalytics(data) {
  fs.writeFileSync(analyticsFile, JSON.stringify(data, null, 2));
}

function getFaqFile() {
  if (!fs.existsSync(faqFile)) {
    return { published: [], draft: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(faqFile, 'utf8'));
  } catch {
    return { published: [], draft: [] };
  }
}

function saveFaqFile(data) {
  fs.writeFileSync(faqFile, JSON.stringify(data, null, 2));
}

initAnalyticsFile();

// Log chatbot interaction
app.post('/api/log-chat', (req, res) => {
  try {
    const { userMessage, botResponse, responseType } = req.body;
    
    if (!userMessage || !botResponse) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const analytics = getAnalytics();
    
    analytics.interactions.push({
      timestamp: new Date().toISOString(),
      userMessage,
      botResponse,
      responseType: responseType || 'standard',
      helpful: null
    });

    // Keep last 500 interactions
    if (analytics.interactions.length > 500) {
      analytics.interactions = analytics.interactions.slice(-500);
    }

    saveAnalytics(analytics);
    res.json({ success: true });
  } catch (error) {
    console.error('Analytics logging error:', error);
    res.status(500).json({ error: 'Failed to log interaction' });
  }
});

// Get analytics dashboard data
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = getAnalytics();
    const recent = analytics.interactions.slice(-100);
    
    // Extract keywords and patterns
    const keywords = {};
    const questionTypes = {};
    
    recent.forEach(interaction => {
      const msg = interaction.userMessage.toLowerCase();
      const words = msg.split(/\s+/).filter(w => w.length > 3);
      
      words.forEach(word => {
        keywords[word] = (keywords[word] || 0) + 1;
      });

      // Categorize by type
      if (msg.includes('closet')) questionTypes['closets'] = (questionTypes['closets'] || 0) + 1;
      if (msg.includes('kitchen') || msg.includes('bath')) questionTypes['kitchen/bath'] = (questionTypes['kitchen/bath'] || 0) + 1;
      if (msg.includes('garage')) questionTypes['garage'] = (questionTypes['garage'] || 0) + 1;
      if (msg.includes('price') || msg.includes('cost')) questionTypes['pricing'] = (questionTypes['pricing'] || 0) + 1;
      if (msg.includes('contact') || msg.includes('phone')) questionTypes['contact'] = (questionTypes['contact'] || 0) + 1;
    });

    const topKeywords = Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    const topQuestions = [...new Set(recent.map(i => i.userMessage))].slice(0, 10);

    res.json({
      totalInteractions: analytics.interactions.length,
      recentCount: recent.length,
      topKeywords,
      topQuestions,
      questionTypes
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get FAQ suggestions based on actual questions
app.get('/api/faq-suggestions', (req, res) => {
  try {
    const analytics = getAnalytics();
    const faqs = getFaqFile();
    
    // Get unique questions
    const uniqueQuestions = [...new Set(analytics.interactions.map(i => i.userMessage))]
      .filter(q => q.length > 15)
      .slice(0, 20);

    // Create suggested FAQ entries
    const suggestions = uniqueQuestions.map((question, idx) => ({
      id: Date.now() + idx,
      question,
      answer: 'Please add your answer here. This question was frequently asked by visitors.',
      priority: analytics.interactions.filter(i => i.userMessage === question).length,
      status: 'draft',
      createdAt: new Date().toISOString()
    }));

    // Sort by frequency
    suggestions.sort((a, b) => b.priority - a.priority);

    res.json({
      suggestions: suggestions.slice(0, 10),
      totalSuggested: suggestions.length,
      publishedFaqs: faqs.published.length
    });
  } catch (error) {
    console.error('FAQ suggestions error:', error);
    res.status(500).json({ error: 'Failed to get FAQ suggestions' });
  }
});

// Save FAQ draft
app.post('/api/save-faq-draft', (req, res) => {
  try {
    const { question, answer } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ error: 'Missing question or answer' });
    }

    const faqs = getFaqFile();
    const draftFaq = {
      id: Date.now(),
      question,
      answer,
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    faqs.draft = faqs.draft || [];
    faqs.draft.push(draftFaq);
    saveFaqFile(faqs);

    res.json({ success: true, id: draftFaq.id });
  } catch (error) {
    console.error('Save FAQ error:', error);
    res.status(500).json({ error: 'Failed to save FAQ' });
  }
});

// Publish FAQs to live page
app.post('/api/publish-faqs', (req, res) => {
  try {
    const { faqIds } = req.body;
    
    if (!Array.isArray(faqIds)) {
      return res.status(400).json({ error: 'Invalid FAQ IDs' });
    }

    const faqs = getFaqFile();
    
    // Move draft FAQs to published
    faqIds.forEach(id => {
      const index = faqs.draft.findIndex(f => f.id === id);
      if (index !== -1) {
        const faq = faqs.draft.splice(index, 1)[0];
        faq.status = 'published';
        faq.publishedAt = new Date().toISOString();
        faqs.published.push(faq);
      }
    });

    saveFaqFile(faqs);
    
    // Update FAQ page
    updateFaqPage(faqs.published);

    console.log(`✅ Published ${faqIds.length} FAQs to live page`);
    res.json({ success: true, publishedCount: faqIds.length });
  } catch (error) {
    console.error('Publish FAQ error:', error);
    res.status(500).json({ error: 'Failed to publish FAQs' });
  }
});

// Update the FAQ HTML page
function updateFaqPage(publishedFaqs) {
  const faqHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Common questions about our custom closets, kitchens, bathrooms, built-ins, garages, and staircase services.">
  <title>FAQ - Ortiz Custom Works</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="bg-gray-50">
  <header class="bg-white border-b border-gray-200 sticky top-0">
    <nav class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
      <a href="index.html" class="text-xl font-bold text-orange-600">Ortiz Custom Works</a>
      <ul class="hidden md:flex gap-8 text-sm font-medium">
        <li><a href="index.html" class="hover:text-orange-600">Home</a></li>
        <li><a href="services.html" class="hover:text-orange-600">Services</a></li>
        <li><a href="gallery.html" class="hover:text-orange-600">Gallery</a></li>
        <li><a href="reviews.html" class="hover:text-orange-600">Reviews</a></li>
        <li><a href="contact.html" class="hover:text-orange-600">Contact</a></li>
      </ul>
    </nav>
  </header>

  <section class="max-w-4xl mx-auto px-4 py-16">
    <h1 class="text-5xl font-bold text-center mb-4">Frequently Asked Questions</h1>
    <p class="text-center text-gray-600 text-lg mb-12">Find answers to common questions about our services.</p>

    <div class="space-y-4">
${publishedFaqs.map(faq => `
      <details class="border border-gray-300 rounded-lg p-6 bg-white cursor-pointer hover:shadow-md transition">
        <summary class="font-semibold text-gray-800 text-lg flex items-center gap-2">
          <span class="text-orange-600">❓</span> ${faq.question}
        </summary>
        <p class="text-gray-700 mt-4 ml-6">${faq.answer}</p>
      </details>
`).join('')}
    </div>

    <div class="mt-16 bg-orange-50 border border-orange-200 rounded-lg p-8 text-center">
      <h2 class="text-2xl font-bold mb-2">Still Have Questions?</h2>
      <p class="text-gray-700 mb-6">Contact our team for personalized assistance</p>
      <a href="contact.html" class="inline-block bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition">Get Free Quote</a>
    </div>
  </section>

  <footer class="bg-gray-900 text-white mt-16 py-8">
    <div class="max-w-7xl mx-auto px-4 text-center">
      <p>© 2026 Ortiz Custom Works | (407) 676-3102</p>
    </div>
  </footer>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, 'faq.html'), faqHtml);
}

// Get SEO recommendations
app.get('/api/seo-recommendations', (req, res) => {
  try {
    const analytics = getAnalytics();
    
    // Analyze question patterns
    const questions = analytics.interactions.map(i => i.userMessage.toLowerCase());
    
    const recommendations = [
      {
        area: 'Meta Title',
        current: 'Ortiz Custom Works | Custom Closets, Kitchens & More',
        suggested: 'Custom Closets, Kitchen Cabinets & Garage Storage in Orlando',
        impact: 'High',
        reason: 'More specific services for better CTR'
      },
      {
        area: 'Homepage Header',
        current: 'Professional Custom Solutions',
        suggested: 'Custom Closets, Kitchen Cabinets & Garage Organization in Orlando',
        impact: 'High',
        reason: 'Include location and specific services'
      },
      {
        area: 'FAQ Page',
        current: 'Does not exist',
        suggested: 'Create FAQ page with top 10 customer questions',
        impact: 'Medium',
        reason: 'Answers common questions and boosts SEO'
      },
      {
        area: 'Service Descriptions',
        current: 'General descriptions',
        suggested: 'Add pricing ranges, timeline, and specific examples',
        impact: 'Medium',
        reason: 'Reduces bounce rate and shopping clicks'
      },
      {
        area: 'Schema Markup',
        current: 'Not implemented',
        suggested: 'Add LocalBusiness, Service, and Review schemas',
        impact: 'Medium',
        reason: 'Rich snippets improve visibility'
      }
    ];

    res.json({
      recommendations,
      totalQuestions: analytics.interactions.length,
      suggestion: 'SEO is automatically optimizing your website based on customer search patterns'
    });
  } catch (error) {
    console.error('SEO recommendations error:', error);
    res.status(500).json({ error: 'Failed to get SEO recommendations' });
  }
});

// AUTO-APPLY SEO OPTIMIZATIONS (Runs Autonomously)
app.post('/api/apply-seo-auto', (req, res) => {
  try {
    const analytics = getAnalytics();
    
    // Analyze what customers search for
    const serviceKeywords = {
      closets: { pattern: /closet|shelving|organization|reach-in|walk-in/i, keywords: ['custom closets', 'closet shelving', 'walk-in closets', 'reach-in closets'] },
      kitchen: { pattern: /kitchen|cabinet|countertop|remodel/i, keywords: ['kitchen cabinets', 'kitchen remodeling', 'custom kitchen', 'cabinet design'] },
      bathroom: { pattern: /bathroom|bath|vanity|tile|shower/i, keywords: ['bathroom remodeling', 'bathroom cabinets', 'custom vanity', 'tile work'] },
      garage: { pattern: /garage|storage|epoxy|floor|organization/i, keywords: ['garage storage', 'garage organization', 'epoxy floors', 'garage shelving'] },
      stairs: { pattern: /stair|railing|handrail|staircase/i, keywords: ['custom staircases', 'staircase remodeling', 'railings', 'stair design'] }
    };

    // Count keyword mentions
    let keywordMetrics = {};
    analytics.interactions.forEach(i => {
      const msg = i.userMessage.toLowerCase();
      Object.entries(serviceKeywords).forEach(([service, data]) => {
        if (data.pattern.test(msg)) {
          keywordMetrics[service] = (keywordMetrics[service] || 0) + 1;
        }
      });
    });

    // Sort by frequency
    const topServices = Object.entries(keywordMetrics)
      .sort((a, b) => b[1] - a[1])
      .map(([service]) => service)
      .slice(0, 3);

    // Update all pages with optimized meta tags and schema
    updatePagesSEO(topServices, keywordMetrics);

    res.json({ 
      success: true, 
      message: 'SEO auto-optimization applied',
      topServices,
      pagesUpdated: ['index.html', 'services.html', 'faq.html']
    });
  } catch (error) {
    console.error('Auto SEO error:', error);
    res.status(500).json({ error: 'Failed to apply SEO optimizations' });
  }
});

// Update pages with optimized SEO
function updatePagesSEO(topServices, keywordMetrics) {
  const serviceNames = {
    closets: 'Custom Closets',
    kitchen: 'Kitchen Cabinets',
    bathroom: 'Bathroom Remodeling',
    garage: 'Garage Storage',
    stairs: 'Custom Staircases'
  };

  // Generate dynamic meta descriptions based on top services
  const topServicesList = topServices.map(s => serviceNames[s]).join(', ');
  const metaDescription = `Expert ${topServicesList} in Orlando. Custom home renovations with premium quality at competitive prices. Free consultation - transform your space today!`;
  
  // Update index.html with optimized SEO and schema (NO TITLE CHANGE)
  const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const updatedIndex = indexContent
    .replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${metaDescription}"`)
    .replace(/<\/head>/i, `\n  <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Ortiz Custom Works",
      "description": metaDescription,
      "telephone": "(407) 676-3102",
      "image": "https://ortizcustomworks.com/logo.png",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Orlando, FL",
        "addressLocality": "Orlando",
        "addressRegion": "FL",
        "postalCode": "32801"
      },
      "url": "https://ortizcustomworks.com",
      "serviceArea": "Orlando, FL",
      "servesCuisine": "Custom Home Renovations",
      "sameAs": ["https://www.facebook.com/ortizcustomworks", "https://www.instagram.com/ortizcustomworks"]
    })}</script>\n  </head>`);

  fs.writeFileSync(path.join(__dirname, 'index.html'), updatedIndex);

  // Update services.html with service-specific SEO (NO TITLE CHANGE)
  const servicesContent = fs.readFileSync(path.join(__dirname, 'services.html'), 'utf8');
  const servicesMeta = `Custom ${topServicesList} services in Orlando. Expert craftsmanship and design for your home renovation needs.`;
  const updatedServices = servicesContent
    .replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${servicesMeta}"`)
    .replace(/<\/head>/i, `\n  <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "name": "Ortiz Custom Works",
      "description": servicesMeta,
      "telephone": "(407) 676-3102",
      "areaServed": {
        "@type": "City",
        "name": "Orlando",
        "sameAs": "https://en.wikipedia.org/wiki/Orlando,_Florida"
      }
    })}</script>\n  </head>`);

  fs.writeFileSync(path.join(__dirname, 'services.html'), updatedServices);

  // Update FAQ.html with FAQ schema for better search snippets (NO TITLE CHANGE)
  const faqContent = fs.readFileSync(path.join(__dirname, 'faq.html'), 'utf8');
  const faqMeta = `Frequently asked questions about ${topServicesList} and home renovations in Orlando.`;
  
  const faqs = getFaqFile();
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.published.slice(0, 5).map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  const updatedFaq = faqContent
    .replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${faqMeta}"`)
    .replace(/<\/head>/i, `\n  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>\n  </head>`);

  fs.writeFileSync(path.join(__dirname, 'faq.html'), updatedFaq);

  console.log(`✅ SEO auto-optimized: Updated pages with ${topServices.length} top services`);
}

// Run SEO optimization every 12 hours automatically
setInterval(() => {
  try {
    const analytics = getAnalytics();
    if (analytics.interactions.length > 10) { // Only optimize if enough data
      const serviceKeywords = {
        closets: { pattern: /closet|shelving|organization|reach-in|walk-in/i },
        kitchen: { pattern: /kitchen|cabinet|countertop|remodel/i },
        bathroom: { pattern: /bathroom|bath|vanity|tile|shower/i },
        garage: { pattern: /garage|storage|epoxy|floor|organization/i },
        stairs: { pattern: /stair|railing|handrail|staircase/i }
      };

      let keywordMetrics = {};
      analytics.interactions.forEach(i => {
        const msg = i.userMessage.toLowerCase();
        Object.entries(serviceKeywords).forEach(([service, data]) => {
          if (data.pattern.test(msg)) {
            keywordMetrics[service] = (keywordMetrics[service] || 0) + 1;
          }
        });
      });

      const topServices = Object.entries(keywordMetrics)
        .sort((a, b) => b[1] - a[1])
        .map(([service]) => service)
        .slice(0, 3);

      if (topServices.length > 0) {
        updatePagesSEO(topServices, keywordMetrics);
      }
    }
  } catch (error) {
    console.error('Auto SEO optimization error:', error);
  }
}, 12 * 60 * 60 * 1000); // Every 12 hours

// Also run on startup if there's data
setTimeout(() => {
  try {
    const analytics = getAnalytics();
    if (analytics.interactions.length > 5) {
      const serviceKeywords = {
        closets: { pattern: /closet|shelving|organization|reach-in|walk-in/i },
        kitchen: { pattern: /kitchen|cabinet|countertop|remodel/i },
        bathroom: { pattern: /bathroom|bath|vanity|tile|shower/i },
        garage: { pattern: /garage|storage|epoxy|floor|organization/i },
        stairs: { pattern: /stair|railing|handrail|staircase/i }
      };

      let keywordMetrics = {};
      analytics.interactions.forEach(i => {
        const msg = i.userMessage.toLowerCase();
        Object.entries(serviceKeywords).forEach(([service, data]) => {
          if (data.pattern.test(msg)) {
            keywordMetrics[service] = (keywordMetrics[service] || 0) + 1;
          }
        });
      });

      const topServices = Object.entries(keywordMetrics)
        .sort((a, b) => b[1] - a[1])
        .map(([service]) => service)
        .slice(0, 3);

      if (topServices.length > 0) {
        updatePagesSEO(topServices, keywordMetrics);
        console.log('✅ Auto-SEO initialized on startup');
      }
    }
  } catch (error) {
    console.error('Initial SEO optimization error:', error);
  }
}, 2000); // Run 2 seconds after server starts

// Get website improvement suggestions
app.get('/api/website-suggestions', (req, res) => {
  try {
    const analytics = getAnalytics();
    
    const suggestions = [
      {
        id: 'create-faq',
        title: 'Create FAQ Page',
        description: `Your chatbot answered ${analytics.interactions.length} questions. Create a FAQ page to capture this content.`,
        status: 'draft',
        category: 'content',
        priority: 'high',
        action: 'Review suggested FAQs in the admin panel',
        autoApplied: false
      },
      {
        id: 'pricing-guide',
        title: 'Add Pricing Guide Page',
        description: 'Many visitors ask about pricing. Consider adding a dedicated pricing page with ranges.',
        status: 'draft',
        category: 'content',
        priority: analytics.interactions.filter(i => i.userMessage.includes('price')).length > 5 ? 'high' : 'medium',
        autoApplied: false
      },
      {
        id: 'service-details',
        title: 'Enhance Service Pages',
        description: 'Add more customer success stories and before/after galleries to service pages.',
        status: 'draft',
        category: 'content',
        priority: 'medium',
        autoApplied: false
      },
      {
        id: 'testimonials',
        title: 'Add Video Testimonials',
        description: 'Increase trust with video testimonials from past customers on services page.',
        status: 'draft',
        category: 'social-proof',
        priority: 'medium',
        autoApplied: false
      }
    ];

    res.json({
      suggestions,
      autoOptimizations: {
        seo: 'Running autonomously - meta tags, titles, and schema markup update based on customer searches',
        faqs: 'Auto-generated from chatbot conversations (you approve before publishing)',
        analytics: 'Continuously tracked'
      },
      recommendation: `You have ${analytics.interactions.length} customer interactions logged. SEO is being auto-optimized to match what customers search for!`
    });
  } catch (error) {
    console.error('Website suggestions error:', error);
    res.status(500).json({ error: 'Failed to get website suggestions' });
  }
});

// ============================================================
// REVIEWS & TESTIMONIALS MANAGEMENT
// ============================================================

const testimonialsFile = path.join(__dirname, 'testimonials.json');

function getTestimonials() {
  if (!fs.existsSync(testimonialsFile)) {
    return { local: [], google: [], yelp: [], lastUpdated: null };
  }
  try {
    return JSON.parse(fs.readFileSync(testimonialsFile, 'utf8'));
  } catch {
    return { local: [], google: [], yelp: [], lastUpdated: null };
  }
}

function saveTestimonials(data) {
  fs.writeFileSync(testimonialsFile, JSON.stringify(data, null, 2));
}

// Get all reviews from all sources (only 5-star from Google/Yelp)
app.get('/api/testimonials', (req, res) => {
  try {
    const testimonials = getTestimonials();
    
    // Filter to only show 5-star reviews from Google and Yelp
    const filteredGoogle = testimonials.google.filter(t => t.rating === 5);
    const filteredYelp = testimonials.yelp.filter(t => t.rating === 5);
    
    res.json({
      all: [
        ...testimonials.local,
        ...filteredGoogle,
        ...filteredYelp
      ],
      breakdown: {
        local: testimonials.local.length,
        google: filteredGoogle.length,
        yelp: filteredYelp.length
      },
      lastUpdated: testimonials.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get testimonials' });
  }
});

// Add local testimonial (owner can manually add)
app.post('/api/add-testimonial', (req, res) => {
  try {
    const { name, text, rating, service, image } = req.body;
    
    if (!name || !text || !rating) {
      return res.status(400).json({ error: 'Name, text, and rating required' });
    }

    const testimonials = getTestimonials();
    
    const newTestimonial = {
      id: Date.now(),
      source: 'local',
      name,
      text,
      rating: Math.min(5, Math.max(1, parseInt(rating))),
      service: service || 'General',
      image: image || null,
      date: new Date().toISOString(),
      verified: true
    };

    testimonials.local.push(newTestimonial);
    saveTestimonials(testimonials);

    res.json({ success: true, id: newTestimonial.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add testimonial' });
  }
});

// Fetch reviews from Google Business (requires API key)
app.post('/api/sync-google-reviews', (req, res) => {
  try {
    const googleApiKey = process.env.GOOGLE_BUSINESS_API_KEY;
    const businessId = process.env.GOOGLE_BUSINESS_ID;

    if (!googleApiKey || !businessId) {
      return res.status(400).json({ 
        error: 'Google Business API not configured',
        setup: 'Set GOOGLE_BUSINESS_API_KEY and GOOGLE_BUSINESS_ID environment variables'
      });
    }

    res.json({
      message: 'Google Business reviews sync initiated',
      note: 'Google Business API setup required',
      setup: [
        '1. Go to Google Cloud Console',
        '2. Enable Google My Business API',
        '3. Create service account credentials',
        '4. Set GOOGLE_BUSINESS_API_KEY and GOOGLE_BUSINESS_ID environment variables'
      ]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync Google reviews' });
  }
});

// Fetch reviews from Yelp (requires API key)
app.post('/api/sync-yelp-reviews', (req, res) => {
  try {
    const yelpApiKey = process.env.YELP_API_KEY;
    const businessId = process.env.YELP_BUSINESS_ID;

    if (!yelpApiKey || !businessId) {
      return res.status(400).json({ 
        error: 'Yelp API not configured',
        setup: 'Set YELP_API_KEY and YELP_BUSINESS_ID environment variables'
      });
    }

    axios.get(`https://api.yelp.com/v3/businesses/${businessId}`, {
      headers: {
        'Authorization': `Bearer ${yelpApiKey}`
      }
    }).then(response => {
      const business = response.data;
      const testimonials = getTestimonials();

      testimonials.yelp = [{
        source: 'yelp',
        name: 'Yelp',
        rating: business.rating,
        reviewCount: business.review_count,
        reviewsUrl: business.url,
        image: business.image_url
      }];

      testimonials.lastUpdated = new Date().toISOString();
      saveTestimonials(testimonials);

      res.json({
        success: true,
        rating: business.rating,
        reviewCount: business.review_count,
        reviewsUrl: business.url
      });
    }).catch(error => {
      res.status(500).json({ 
        error: 'Failed to fetch Yelp reviews',
        message: error.message 
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync Yelp reviews' });
  }
});

// Delete a testimonial
app.post('/api/delete-testimonial', (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    const testimonials = getTestimonials();
    
    ['local', 'google', 'yelp'].forEach(source => {
      const index = testimonials[source].findIndex(t => t.id === id);
      if (index !== -1) {
        testimonials[source].splice(index, 1);
      }
    });

    saveTestimonials(testimonials);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

// Get setup instructions for reviews
app.get('/api/reviews-setup', (req, res) => {
  res.json({
    googleBusiness: {
      name: 'Google Business Reviews',
      configured: !!process.env.GOOGLE_BUSINESS_API_KEY,
      setup: [
        'Visit: https://console.cloud.google.com',
        'Create a new project',
        'Enable Google My Business API',
        'Create a service account and download JSON key',
        'Set environment variables: GOOGLE_BUSINESS_API_KEY, GOOGLE_BUSINESS_ID'
      ]
    },
    yelp: {
      name: 'Yelp Reviews',
      configured: !!process.env.YELP_API_KEY,
      setup: [
        'Visit: https://www.yelp.com/developers/manage_api_keys',
        'Create an app to get API key',
        'Find your business ID at: https://www.yelp.com/biz/{your-business-slug}',
        'Set environment variables: YELP_API_KEY, YELP_BUSINESS_ID'
      ],
      example: 'https://www.yelp.com/biz/ortiz-custom-works-orlando'
    },
    local: {
      name: 'Manual Testimonials',
      configured: true,
      description: 'Add testimonials directly via admin panel',
      endpoint: 'POST /api/add-testimonial'
    }
  });
});

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ORTIZ CUSTOM WORKS SERVER STARTED');
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log('='.repeat(60));
  console.log('\n✅ Available Endpoints:');
  console.log('   POST /api/contact-form                    - Contact form submissions');
  console.log('   POST /api/chatbot-message                 - Chatbot messages to owner');
  console.log('   POST /api/log-chat                        - Log chatbot interaction');
  console.log('   GET  /api/analytics                       - Get analytics summary');
  console.log('   GET  /api/faq-suggestions                 - Get suggested FAQs');
  console.log('   POST /api/save-faq-draft                  - Save FAQ draft');
  console.log('   POST /api/publish-faqs                    - Publish FAQs to live page');
  console.log('   GET  /api/seo-recommendations             - Get SEO suggestions');
  console.log('   GET  /api/website-suggestions             - Get website improvement ideas');
  console.log('   POST /api/get-customer-invoices           - Look up invoices by email');
  console.log('   POST /api/get-invoice-by-number           - Look up invoice by bill #');
  console.log('   POST /api/process-qb-payment              - Process payment');
  console.log('   POST /api/send-invoice                    - Send invoice via email');
  console.log('   GET  /api/health                          - Health check\n');
});

module.exports = app;
