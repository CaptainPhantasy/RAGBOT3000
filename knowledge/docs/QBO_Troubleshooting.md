# QuickBooks Troubleshooting Guide

## Banking Issues

### Bank feed not updating
- **Symptoms:** New transactions not appearing
- **Causes:** Connection expired, bank maintenance
- **Fix:**
  1. Go to Banking → select account
  2. Click **Update** button
  3. If still not working, disconnect and reconnect bank

### Duplicate transactions
- **Symptoms:** Same transaction appears twice
- **Causes:** Bank feed + manual entry
- **Fix:**
  1. Find the duplicate in Banking
  2. Click **Exclude** on one copy
  3. Keep the one matched to existing transaction

### Wrong beginning balance in reconciliation
- **Symptoms:** Beginning balance doesn't match statement
- **Causes:** Previously reconciled transaction was edited
- **Fix:**
  1. Go to **Gear** → **Tools** → **Reconcile**
  2. Click **History by account**
  3. Find discrepancy report
  4. Fix or undo the changed transaction

## Sales & Receivables Issues

### Invoice not matching payment
- **Symptoms:** Payment applied to wrong invoice or not at all
- **Causes:** Using Add instead of Match in bank feed
- **Fix:**
  1. Delete the incorrect payment entry
  2. Return to Banking → For Review
  3. Find the payment transaction
  4. Click **Find match** and select correct invoice

### Customer balance incorrect
- **Symptoms:** Customer shows balance but invoices are paid
- **Causes:** Payment not applied to invoice
- **Fix:**
  1. Run Open Invoices report
  2. Check unapplied payments
  3. Edit payment to apply to correct invoice

### Duplicate invoice numbers
- **Symptoms:** Error when saving invoice
- **Causes:** Invoice number already used
- **Fix:**
  1. Check Gear → Account and Settings → Sales
  2. Enable custom transaction numbers if needed
  3. Change invoice number manually

## Expense & Payables Issues

### Bill showing unpaid after payment
- **Symptoms:** Bills list shows open balance
- **Causes:** Payment recorded as expense, not bill payment
- **Fix:**
  1. Delete incorrect expense entry
  2. Go to Expenses → Bills
  3. Click **Make payment**
  4. Apply payment to correct bill

### Expense categorization wrong
- **Symptoms:** Expenses in wrong accounts
- **Causes:** Bank rule miscategorization, manual error
- **Fix:**
  1. Find transactions in register
  2. Edit category
  3. Update bank rule if needed

### Personal vs. Business expenses
- **Symptoms:** Personal items in business books
- **Causes:** Mixed use of business accounts
- **Fix:**
  1. Create Owner's Draw/Equity account
  2. Recategorize personal expenses
  3. Consider separate business bank account

## General Issues

### Reports don't match
- **Symptoms:** P&L and Balance Sheet don't reconcile
- **Causes:** Date range issues, filters applied
- **Fix:**
  1. Clear all filters
  2. Use same date range
  3. Check accrual vs cash basis setting

### Slow performance
- **Symptoms:** QuickBooks running slowly
- **Causes:** Too many browser tabs, large file, internet issues
- **Fix:**
  1. Close other browser tabs
  2. Clear browser cache
  3. Try different browser
  4. Check internet connection

### Can't delete transaction
- **Symptoms:** Delete option grayed out or unavailable
- **Causes:** Transaction is reconciled or linked
- **Fix:**
  1. Unreconcile the transaction first
  2. Or void instead of delete
  3. Check for linked transactions

## Best Practices

### Daily Tasks
- Review and categorize bank feed transactions
- Send overdue invoice reminders

### Weekly Tasks
- Reconcile bank accounts
- Review A/R and A/P aging
- Back up reports

### Monthly Tasks
- Review P&L and Balance Sheet
- File sales tax
- Review user access

### Quarterly Tasks
- Review chart of accounts
- Update recurring transactions
- Audit user permissions

**Sources:** QuickBooks Certification Exam; QuickBooks Online Student Guides; Common support issues

