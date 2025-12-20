# QuickBooks Bank Feed Transactions

## Visual UI Anchors
- **Banking** (left navigation)
- **For Review tab**: Lists downloaded transactions
- **Recognized tab**: Transactions with suggested categories
- **Transactions tab**: All entered transactions
- **Add/Match/Exclude buttons**: Action options for each transaction
- **Rules link**: Create automatic categorization rules

## Step-by-Step Workflow (2025)
1. Click **Banking** in the left navigation
2. Select the bank account from the dropdown (if multiple)
3. Review transactions in the **For Review** tab
4. For each transaction:
   - **Quick Add**: Accept suggested category and payee
   - **Add**: Manually select category and/or payee
   - **Match**: Link to existing transaction (invoice, bill, etc.)
   - **Find match**: Search for existing transaction
   - **Exclude**: Remove from bank feed (not for transactions)
5. Click **Update** after processing each transaction
6. Use **Batch Actions** to process multiple transactions similarly

## Why This Matters (Accounting Context)
Bank feeds automate data entry but still require human review. Proper categorization ensures:
- Accurate financial reports
- Correct tax deductions
- Meaningful business insights
- Easy tax preparation

## Common Error States / Pitfalls

### Using Add instead of Match for customer payments
- **What you see:** Customer shows unpaid balance despite payment; Income is double-recorded
- **Diagnosis:** Payment was added as new income instead of matched to invoice
- **Fix:**
  1. Find the incorrect payment in the register
  2. Delete it
  3. Go back to Banking → For Review
  4. Find the transaction again
  5. Click **Find match** and select the correct invoice

### Uncategorized expenses
- **What you see:** Many transactions show "Uncategorized Expense"
- **Diagnosis:** Categories not being assigned during review
- **Fix:**
  1. Go to Chart of Accounts
  2. Find "Uncategorized Expense" account
  3. Run a QuickReport to see all transactions
  4. Edit each transaction with proper categories

### Personal expenses mixed with business
- **What you see:** Personal transactions in bank feed
- **Diagnosis:** Business account used for personal expenses
- **Fix:**
  1. For tracking: Create an "Owner's Draw/Equity" account
  2. Better: Use separate business accounts

## 2025-Specifics
- Enhanced AI-powered categorization suggestions
- Improved bank rules with more conditions available
- Better transaction matching algorithm
- Enhanced mobile app for categorizing on the go

**Sources:** QuickBooks Online Student Guide Lesson 2, Banking section; Certification Exam Answers

