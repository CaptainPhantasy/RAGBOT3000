# 📘 FOUNDATION
**Call Tracking**: A mechanism to measure the effectiveness of ads by tracking calls generated from specific campaigns, keywords, or website visits.

**Methods**:
1.  **Call Extensions**: A phone number displayed directly in the ad.
2.  **Website Call Tracking**: Dynamic number insertion (DNI) on your website. When a user clicks an ad, the phone number on your site is replaced with a Google Forwarding Number (GFN).

**Google Forwarding Number (GFN)**: A unique toll-free or local number provided by Google. It routes calls to your actual business line while tracking details (duration, area code, etc.).

**Key Metrics**:
-   **Call Duration**: Set a minimum length (e.g., 60 seconds) to count as a conversion.
-   **Call Conversions**: Calls that meet the duration threshold.

---

# 🛠️ WORKFLOW

### Phase 1: Setup Call Extension
1.  **Campaign Level**: Go to "Assets" > "Call".
2.  **Add Number**: Enter your business phone number.
3.  **Enable Call Reporting**: Toggle "On". This is required to track conversions.
4.  **Conversion Action**: Select "Calls from Ads".

### Phase 2: Setup Website Call Tracking
1.  **Create Conversion Action**:
    -   Tools > Measurement > Conversions.
    -   New Conversion Action > Phone Calls.
    -   Select "Calls to a phone number on your website".
2.  **Configure Tag**:
    -   Enter the phone number *exactly* as it appears on your website.
    -   Get the "Global Site Tag" and "Phone Snippet".
3.  **Install Code**:
    -   Place the Global Site Tag on every page.
    -   Place the Phone Snippet on pages where the number appears.
    -   *Alternative*: Use Google Tag Manager (GTM) with the "Google Ads Calls from Website Conversion" tag.

---

# 🛑 TRAP-DOORS (Common Failures)

-   **Exact Number Match**: The phone number entered in the conversion settings MUST match the website number character-for-character (e.g., `(555) 123-4567` vs `555-123-4567`). Mismatches break dynamic insertion.
-   **International Formatting**: For GTM, use the national format without the plus sign to avoid display errors.
-   **"Call from Google" Whisper**: You might not hear this if using VoIP or forwarding services.
-   **One Number Limit**: The default script tracks only *one* number per page. Tracking multiple numbers requires advanced manual JavaScript editing.

---

# 🔧 TRIAGE MATRIX

| Issue | Diagnosis | Fix |
| :--- | :--- | :--- |
| **Number Not Swapping** | Cache/Mismatch | Clear browser cache. Check if the "Exact Number Match" rule is violated. Test by clicking a live ad (costs money) or using tag assistant. |
| **No "Call Reporting" Data** | Setting Off | Ensure "Call Reporting" is enabled in Account Settings or Asset settings. |
| **Zero Conversions** | Duration Threshold | Check if your minimum call duration is too high (e.g., 60s). Lower it to capture shorter inquiries. |
| **GTM "Plus Sign" Error** | Formatting | Remove `+` from the phone number field in GTM. Use national format. |

---

# 🔗 RESOLUTION LINKS

-   **Google Tag Manager Help**: `https://tagmanager.google.com/`
-   **Conversion Settings**: Access via Google Ads > Tools > Measurement > Conversions.

