# Logging & Troubleshooting

## Overview
This application uses **Winston** for structured logging. All errors, payments, and critical operations are logged with full context for troubleshooting.

## Log Storage

### Local Development
- **Location**: `logs/` directory in project root
- **Files**:
  - `error.log` - All errors with stack traces
  - `combined.log` - All log levels (info, warn, error)
- **Format**: JSON with timestamps
- **Rotation**: Automatic (5MB max per file, 5 files max)

### Production (Render)
- **Location**: Render Dashboard → Logs tab
- **Access**: https://dashboard.render.com → Select service → Logs
- **Retention**: 7 days (on free plan)
- **Real-time**: Live tail available in dashboard

## What Gets Logged

### Payment Operations
```json
{
  "level": "info",
  "message": "Payment processed successfully",
  "timestamp": "2026-03-01 15:30:45",
  "transactionId": "12345",
  "intuitTid": "1a2b3c4d-5e6f-7g8h",
  "amount": 250.00,
  "invoiceNumber": "INV-001",
  "customerEmail": "customer@example.com",
  "paymentMethod": "Online Payment"
}
```

### Payment Errors
```json
{
  "level": "error",
  "message": "Payment processing failed",
  "timestamp": "2026-03-01 15:35:12",
  "error": "Invalid invoice ID",
  "stack": "Error: Invalid invoice ID\n  at...",
  "intuitTid": "1a2b3c4d-5e6f-7g8h",
  "invoiceNumber": "INV-999",
  "qbFaultString": "Invoice not found"
}
```

### Contact Form Submissions
```json
{
  "level": "info",
  "message": "Contact form submitted",
  "timestamp": "2026-03-01 14:20:33",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(407) 555-1234",
  "projectDetails": "provided"
}
```

## Accessing Logs for Support

### For Intuit Support
When contacting Intuit about QuickBooks API issues, provide:
1. **intuit_tid** - Found in every QB API log entry
2. **Timestamp** - Exact time of the error
3. **Error details** - Full error message from logs

### For Internal Troubleshooting
1. **Download logs from Render**:
   - Go to Render Dashboard
   - Select "ortiz-custom-works" service
   - Click "Logs" tab
   - Use search/filter or download

2. **Search logs by transaction**:
   ```bash
   # Search for specific transaction ID
   grep "transactionId\":\"12345\"" logs/combined.log
   
   # Search for specific customer
   grep "customer@example.com" logs/combined.log
   
   # View only errors
   cat logs/error.log
   ```

## Log Levels

- **error**: Payment failures, API errors, critical issues
- **warn**: Deprecation notices, missing optional configs
- **info**: Successful operations, form submissions, payments
- **debug**: Detailed diagnostic information (not currently enabled)

## Sharing Logs with Support

To share logs securely:
1. Download relevant log file from Render or local `logs/` directory
2. Redact sensitive customer information if needed
3. Share via secure email or support ticket
4. Include **intuit_tid** in your support request

## Log Rotation

- Logs automatically rotate when they reach 5MB
- Up to 5 backup files are kept
- Older logs are automatically deleted
- No manual cleanup needed

## Privacy & Compliance

⚠️ **Logs contain**:
- Customer emails
- Transaction IDs
- Payment amounts
- Error messages

✅ **Logs do NOT contain**:
- Credit card numbers
- Full bank account numbers
- Passwords or API keys
- Unencrypted QuickBooks tokens

Logs are stored securely and should be handled according to your privacy policy.
