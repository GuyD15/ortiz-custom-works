# 📧 Sending Invoices Through QuickBooks

## Overview

Yes, **invoices should be sent through QuickBooks**. Your website now integrates with QB to:

1. **Create/Send Invoices** - Created in QB desktop/online
2. **Email Invoices to Customers** - Via your website OR QB itself
3. **Track Payments** - All payment status updates in QB
4. **Access Payment Link** - Customers can pay directly from email

---

## 🔄 Invoice Flow

### Method 1: QB Creates Invoice → Website Sends Email

```
You create invoice in QB
    ↓
Customer gets emailed by your site
    ↓
Email includes link to pay online
    ↓
Customer pays on your website
    ↓
Payment processed and confirmed in QB
```

### Method 2: QB Creates & Sends Directly

```
You create invoice in QB
    ↓
QB sends email to customer (QB built-in)
    ↓
Customer can pay via QB
    OR visit your pay-bill.html
    ↓
Payment processed in QB
```

---

## 💻 How to Send Invoices

### Option A: Via Your Website (Recommended)

Your backend has a ready-to-go endpoint:

```javascript
POST /api/send-invoice
Body: {
  "invoiceId": "456",
  "customerEmail": "john@example.com",
  "realmId": "YOUR_REALM_ID"
}
```

**Advantages:**
- ✅ Branded email from your company
- ✅ Include custom message
- ✅ Link to your pay-bill page
- ✅ Track email sends

**You could add:**
- A button on your admin dashboard to send invoices
- Automatic invoice sending on schedule
- Custom email template

### Option B: QB Sends Directly

QB Online has built-in email:

1. Go to QB Online
2. Click on invoice
3. Click "Send"
4. QB emails the customer

**Advantages:**
- ✅ No extra setup
- ✅ QB's built-in templates
- ✅ Automatic reminders available
- ✅ QB tracks email opens

**Disadvantages:**
- ❌ Generic QB template
- ❌ QB branding visible
- ❌ Your link to pay-bill.html not included

---

## 🎯 Recommended Setup

Combine both:

1. **QB Creates Invoice** - In QB Online/Desktop
2. **QB tracks it** - QB knows customer, amount, due date
3. **Your site sends email** - Using the endpoint above
4. **Email contains:**
   - Invoice details
   - Amount due
   - Due date
   - Link: "Pay Online" → your pay-bill.html
5. **Customer pays** - On your website
6. **QB updates automatically** - Payment marked as received

---

## 🚀 Implementation (Code Already Ready)

Your backend already has the invoice sending logic:

**File:** `server.js` - Endpoint `/api/send-invoice`

```javascript
app.post('/api/send-invoice', async (req, res) => {
  // Gets invoice from QB
  // Sends professional email to customer
  // Includes link to pay online
  // Confirms email was sent
});
```

### To Use This Endpoint:

```bash
curl -X POST http://localhost:5000/api/send-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "456",
    "customerEmail": "john@example.com",
    "realmId": "YOUR_REALM_ID"
  }'
```

---

## 📋 What You Need

### To Send Invoices Via QB API

```env
QB_REALM_ID=your_company_id
QB_ACCESS_TOKEN=your_access_token
```

### Email Configuration

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
OWNER_EMAIL=ortizcustomworks@gmail.com
```

---

## ✨ What the Email Includes

When a customer receives invoice via your site:

```html
Subject: Invoice INV-001 - Ortiz Custom Works

---

Invoice from Ortiz Custom Works

Invoice #: INV-001
Date Issued: January 15, 2026
Due Date: February 15, 2026

Amount Due: $5,000.00

You can pay this invoice online at: 
[Button/Link: Pay Bill]

Questions? Contact us:
(407) 676-3102
ortizcustomworks@gmail.com

Best regards,
Ortiz Custom Works Team
```

---

## 🔌 Setup Steps

### Today (No QB Needed Yet)

1. ✅ Backend is ready (code already written)
2. ✅ Email service setup (configure Gmail in .env)
3. ✅ Endpoint created and waiting

### Tomorrow (With QB Credentials)

1. Add QB credentials to `.env`
2. Create an invoice in QB Online
3. Test the `/api/send-invoice` endpoint
4. Customer receives email
5. Customer clicks "Pay Bill"
6. Customer pays on your website
7. Payment appears in QB

---

## 🎨 Customizing the Email

The email is generated in `server.js`. To customize:

1. **Edit HTML template** in server.js (around line 350)
2. **Add custom message** - Add your own text
3. **Change styling** - Modify HTML/CSS
4. **Add logo** - Include image URL
5. **Change colors** - Match your brand

**Example customization:**

```javascript
const invoiceEmail = `
  <h2 style="color: #c2410c;">Ortiz Custom Works Invoice</h2>
  <p>Thank you for choosing us for your renovation needs!</p>
  <p><strong>Invoice #:</strong> ${invoice.DocNumber}</p>
  <p><strong>Amount Due:</strong> $${invoice.TotalAmt}</p>
  <p>Your deadline: ${new Date(invoice.DueDate).toLocaleDateString()}</p>
  <p>
    <a href="${process.env.FRONTEND_URL}/pay-bill.html" 
       style="background: #c2410c; color: white; padding: 10px 20px;">
      Pay Now Online
    </a>
  </p>
`;
```

---

## 📊 Invoicing Workflow

```
┌─────────────────────────────────────────┐
│  You Create Invoice in QB               │
│  (QB Online or Desktop)                 │
└──────────────┬──────────────────────────┘
               │
               ├→ QB stores invoice
               │
               ├→ Your site can query it
               │
               ├→ Customer can look it up
               │
               └→ You can email it
                  
┌──────────────────────────────────────────┐
│ Email Sent to Customer                   │
│ (from your website backend)              │
├──────────────────────────────────────────┤
│ "You have an invoice of $5,000 due"      │
│ [Pay Online Button]                      │
│ Questions? Call (407) 676-3102           │
└─────────────┬──────────────────────────────┘
              │
              └→ Customer clicks "Pay Online"
                 
┌──────────────────────────────────────────┐
│ pay-bill.html Page Loads                 │
│ Customer searches by email               │
│ Sees their outstanding invoices          │
│ Checks invoice amount                    │
│ Proceeds to payment                      │
│ Selects payment method                   │
│ Makes payment                            │
└─────────────┬──────────────────────────────┘
              │
              └→ Payment sent to QB
              
┌──────────────────────────────────────────┐
│ Payment Processed & Confirmed            │
│                                          │
│ - Invoice marked PAID in QB              │
│ - Payment recorded                       │
│ - Confirmation email sent               │
│ - Customer notified                      │
└──────────────────────────────────────────┘
```

---

## 🎯 Best Practices

### When Creating Invoices in QB

1. **Always include:**
   - Invoice number
   - Customer name and email
   - Clear description of services
   - Amount due
   - Due date (reasonable)

2. **Make it easy for payment:**
   - Include your website mention
   - List payment methods
   - Phone number for questions

### When Sending Invoices

1. **Send promptly** - Don't wait
2. **Follow up** - Send reminder before due date
3. **Track opens** - Monitor customer engagement
4. **Make payment visible** - Link to pay page
5. **Provide support** - Clear contact info

### When Processing Payments

1. **No extra fees** - QB handles it natively
2. **Automatic updates** - QB status changes immediately
3. **Clear confirmation** - Customer knows it processed
4. **Keep records** - QB stores everything
5. **Send receipt** - Email confirmation sent

---

## 🔐 Security Notes

- ✅ QB handles payment data securely
- ✅ No sensitive data on your website
- ✅ All payments encrypted
- ✅ PCI compliance handled by QB
- ✅ Your backend just coordinates

---

## 📞 Invoice Reminders

QB Online has built-in reminder emails:

1. Invoice created
2. Automatically email customer
3. Set reminders for overdue invoices
4. QB sends on schedule

**Your website also supports:**
- Custom reminder emails
- Personalized payment links
- Multi-step follow-up sequences

---

## 💡 Advanced Features (Future)

Once you have credentials, you could add:

1. **Admin Dashboard**
   - View all invoices
   - Send invoices with one click
   - Track which are paid/unpaid

2. **Customer Portal**
   - Customers see their invoice history
   - View aged payables
   - Pay from portal

3. **Automatic Reminders**
   - Send 7 days before due date
   - Send on due date
   - Send 7 days overdue
   - Send 30 days overdue

4. **Payment Confirmations**
   - Send automatically
   - Include receipt
   - Thank you message

---

## ✅ Summary

| Question | Answer |
|----------|--------|
| Send invoices through QB? | ✅ Yes, through website API OR QB directly |
| Create invoices in QB? | ✅ Yes, in QB Online/Desktop |
| Pay invoices online? | ✅ Yes, via your pay-bill.html page |
| Email customers? | ✅ Yes, backend ready to send |
| Track payments in QB? | ✅ Yes, automatic |
| All in one place? | ✅ Yes, everything in QuickBooks |

---

## 🚀 Getting Started

1. **Create invoice in QB** - Do this now
2. **Add QB credentials** - Tomorrow morning
3. **Test sending email** - Via `/api/send-invoice` endpoint
4. **Customer receives email** - With payment link
5. **Customer pays online** - On your website
6. **Payment updates QB** - Automatic

All the code is ready. Just add credentials and go!

---

**Document:** Invoicing & Payment Guide
**Updated:** March 1, 2026
**Status:** Ready to implement
