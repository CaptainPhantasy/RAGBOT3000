# 📘 FOUNDATION
**Conversion Tracking**: The process of connecting ad clicks to valuable customer actions (Purchases, Leads, Sign-ups).

**Types**:
-   **Website**: Sales, form fills.
-   **App**: Installs, in-app actions (via Firebase or 3rd party).
-   **Phone**: Calls (Ads or Website).
-   **Import**: Offline conversions (CRM data), Store Visits.

**Enhanced Conversions**: A feature that improves accuracy by sending hashed first-party data (email, phone) from your website to Google to match users who converted but weren't tracked by cookies.

**Attribution Models**:
-   **Data-Driven (Default/Recommended)**: Uses AI to assign credit to touchpoints based on impact.
-   **Last Click**: Assigns all credit to the final click (becoming obsolete).

---

# 🛠️ WORKFLOW

### Phase 1: Create Action
1.  **Dashboard**: Tools > Measurement > Conversions > New Conversion Action.
2.  **Goal Category**: Select "Website" (or other).
3.  **Scan URL**: Google scans your site for easy setup options.
4.  **Define Value**:
    -   **Use same value**: For leads (e.g., $50 avg value).
    -   **Use different values**: For e-commerce (dynamic transaction value).

### Phase 2: Implementation (Tagging)
1.  **Google Tag (gtag.js)**: Must be on *every* page of the site.
2.  **Event Snippet**: Placed *only* on the page/action that counts as a conversion (e.g., "Thank You" page or Button Click).
3.  **Enhanced Conversions**: Turn on in settings. Update the tag to capture variables (email/phone) securely.

### Phase 3: Validation
1.  **Tag Assistant**: Use the "Google Tag Assistant" Chrome extension to verify tags are firing.
2.  **Status**: Check the "Conversions" column in Ads Manager. Status changes from "Unverified" to "Recording" after the first signal.

---

# 🛑 TRAP-DOORS (Tracking Gaps)

-   **Double Counting**: Placing the event snippet on a page users revisit (like a homepage) instead of a unique confirmation page. Use "Count: One" for leads to avoid duplicates.
-   **"Unknown" Conversions**: Caused by privacy settings (iOS). Use "Enhanced Conversions" to mitigate this.
-   **Cookie Blockers**: Relying solely on client-side cookies is risky. Use "Google Tag Gateway" (Server-side) for resilience.
-   **Unverified Status**: If a tag stays "Unverified" for >24 hours, no traffic has triggered it. Perform a test conversion yourself.

---

# 🔧 TRIAGE MATRIX

| Issue | Diagnosis | Fix |
| :--- | :--- | :--- |
| **"Unverified" Status** | No Data | Trigger the conversion event yourself (submit the form). Check code placement. |
| **Duplicate Conversions** | Counting Setting | Change setting from "Every" to "One" for lead generation goals. |
| **Low Match Rate** | Enhanced Conv. Off | Enable Enhanced Conversions and ensure user data (email) is being captured/hashed correctly. |
| **GTM Trigger Fails** | Trigger Config | Ensure the GTM trigger is set to "Form Submission" or "Page View" correctly, not just "All Pages". |

---

# 🔗 RESOLUTION LINKS

-   **Tag Assistant**: `https://tagassistant.google.com/`
-   **Enhanced Conversions Setup**: Access via Conversion Settings > Enhanced Conversions.

