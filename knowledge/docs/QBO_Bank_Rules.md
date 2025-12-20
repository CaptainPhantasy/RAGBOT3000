# QuickBooks Bank Rules

## Visual UI Anchors
- **Banking** → **Rules** link
- **New rule button**: Create automation
- **Rule conditions**: If/Then logic
- **Rule types**: Money in, Money out, All

## Step-by-Step Workflow (2025)
1. Go to **Banking**
2. Click the **Rules** link
3. Click **New rule**
4. **Set conditions**:
   - **Field**: Payee, Description, Amount, etc.
   - **Operator**: Contains, Is exactly, etc.
   - **Value**: What to match
5. **Set actions**:
   - **Transaction type**: Expense, Transfer, etc.
   - **Payee**: Who paid/received
   - **Category**: Expense/income account
   - **Class/Location**: If tracking enabled
6. Choose **Rule applies to**: Money in, Money out, or All
7. Click **Save**

## Why This Matters (Accounting Context)
Bank rules:
- Automate repetitive categorization
- Ensure consistency
- Save time on data entry
- Reduce manual errors

## Common Error States / Pitfalls

### Rules too specific
- **What you see:** Rule doesn't trigger
- **Diagnosis:** Conditions too restrictive
- **Fix:**
  1. Use "Contains" instead of "Is exactly"
  2. Add multiple conditions with OR logic

### Rules conflicting
- **What you see:** Wrong rule applied
- **Diagnosis:** Multiple rules match
- **Fix:**
  1. Rules apply in order
  2. Reorder rules if needed
  3. Delete old rules

### Over-categorizing
- **What you see:** Wrong categories applied
- **Diagnosis:** Rule too broad
- **Fix:**
  1. Make rules more specific
  2. Review rule application regularly

## 2025-Specifics
- Enhanced rule conditions with more options
- Better rule testing before deployment
- Improved rule management interface
- AI-powered rule suggestions

**Sources:** QuickBooks Online Student Guide Lesson 2, Banking section

