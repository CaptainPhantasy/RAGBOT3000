# RAGBOT3000

**Your Expert Knowledge Assistant**

<div align="center">
  <img src="icon-192.jpeg" alt="RAGBOT3000" width="400" />
</div>

---

## Finally, an AI That Actually Knows What It's Talking About

We've all been there. You need help with something important—taxes, healthcare decisions, business software, legal questions—and you get an AI that confidently tells you... completely wrong information.

**RAGBOT3000 is different.**

Every answer is grounded in verified documentation. When you ask a question, you get real guidance from real sources—not guesswork, not hallucinations, not "I think maybe..."

Just help. The kind you'd get from a trusted expert who actually read the manual.

---

## What Can RAGBOT3000 Help You With?

### 💼 Business & Finance
Get clear guidance on accounting workflows, invoicing, payroll, financial reporting, and business operations. Stop second-guessing yourself on important financial decisions.

### ⚖️ Legal & Compliance
Navigate complex regulations with confidence. From tax law and workplace rights to privacy compliance and family matters—get answers grounded in actual legal documentation.

### 🏥 Healthcare & Advocacy
Find your way through healthcare systems, Medicare questions, elder care decisions, and patient rights. When you or your loved ones need help, get answers that matter.

### 🛠️ Software & Platforms
Master the tools you use every day. Whether it's field service management, CRM systems, e-commerce platforms, or productivity software—learn faster and work smarter.

### 📚 Education & Public Services
Understand your rights as a student, parent, or citizen. Navigate financial aid, special education requirements, disaster assistance, and public health resources.

---

## How It Works

**1. Ask your question** — in plain English, just like you'd ask a colleague.

**2. Get grounded answers** — every response is backed by verified documentation.

**3. Follow clear steps** — no jargon, no essays. Just actionable guidance.

**4. Verify as you go** — check your work at each step so you never feel lost.

**5. Troubleshoot when needed** — when something goes wrong, get real solutions.

---

## Talk, Type, or Show

### 🎤 Voice Conversations
Just talk. RAGBOT3000 listens and responds naturally—like having an expert on call whenever you need one. Interrupt anytime. Ask follow-up questions. Have a real conversation.

### 👁️ Show What You're Working On
Sometimes it's easier to show than explain. Share your screen or point your camera at what you're struggling with. "See this? Why isn't it working?" Problem understood. Solution delivered.

### 🌍 Your Language, Your Way
Speak Spanish, French, German, or dozens of other languages. RAGBOT3000 responds in kind—no translation apps, no awkward misunderstandings.

### 📱 Works Everywhere
Desktop, tablet, phone—install it like an app and get help wherever you are. Fullscreen, no clutter, always ready.

---

## Why People Trust RAGBOT3000

✅ **Honest answers** — if it doesn't know something, it tells you. No making things up.

✅ **Privacy-first** — your conversations aren't stored forever. What you share stays between us.

✅ **No judgment** — ask "basic" questions without feeling embarrassed. That's what we're here for.

✅ **Always learning** — our knowledge base grows constantly, covering more topics and staying current.

---

## One Assistant, Infinite Expertise

RAGBOT3000 adapts to what you need. Ask about tax deductions in the morning and software troubleshooting in the afternoon. The same trusted assistant, with the right expertise for every question.

Whether you're a small business owner wearing every hat, a caregiver making important decisions, or someone just trying to understand your rights—RAGBOT3000 is the expert friend everyone deserves.

---

## Try It Now

**Live Demo:** [ragbot3000-production.up.railway.app](https://ragbot3000-production.up.railway.app)

### On Your Phone
1. Open the link in Safari (iPhone) or Chrome (Android)
2. Tap **Share** → **Add to Home Screen**
3. Open your new app and start talking

### On Desktop
1. Visit the link
2. Choose **Voice** to talk, **Screen** to share what you're working on, or **Live** to use your camera
3. Allow microphone access and start your conversation

---

## Built by Legacy AI

We believe everyone deserves access to expert guidance—not just those who can afford consultants or know the right people. RAGBOT3000 is our answer to that belief.

Questions? Feedback? We'd love to hear from you.

---

## Important Disclaimer

**RAGBOT3000 is an independent product created by Legacy AI.** We are not affiliated with, endorsed by, sponsored by, or officially connected with any of the companies, organizations, or government agencies whose documentation may be referenced in our knowledge base.

### Corporate Trademarks
The following are trademarks of their respective owners:
- **QuickBooks®** is a registered trademark of Intuit Inc.
- **ServiceTitan®** is a registered trademark of ServiceTitan, Inc.
- **Stripe®** is a registered trademark of Stripe, Inc.
- **Google®**, **Google Workspace®**, and **Google Ads®** are registered trademarks of Google LLC
- **HubSpot®** is a registered trademark of HubSpot, Inc.
- **Shopify®** is a registered trademark of Shopify Inc.
- **Twilio®** is a registered trademark of Twilio Inc.
- **Supabase®** is a trademark of Supabase, Inc.
- **Airtable®** is a registered trademark of Formagrid Inc.
- **Microsoft®**, **Power Automate®**, and **Office 365®** are registered trademarks of Microsoft Corporation
- **Notion®** is a trademark of Notion Labs, Inc.

### Government & Public Information
Information regarding tax law, workplace rights, education rights, healthcare regulations, elder care, disaster assistance, and other public matters is derived from publicly available government resources. This information is provided for educational purposes only and does not constitute legal, tax, medical, or professional advice.

**Always consult qualified professionals for decisions affecting your legal rights, finances, health, or safety.**

---

*RAGBOT3000 — Expert guidance for everyone.*
# RAGBOT3000

## Local development

Copy `.env.example` to `.env`, set `GEMINI_API_KEY`, and run `npm run dev`. The paired Vite and Node server uses a local-only development bypass. Production deployments must set `APP_ACCESS_TOKEN`, `GEMINI_API_KEY`, and `ALLOWED_ORIGINS`; the browser receives only short-lived, single-use Gemini Live tokens.

The repository gate is `npm run check`. It runs formatting, lint, TypeScript, tests, the production build, the client-bundle secret scan, both dependency audits, and Secretlint without modifying the working tree.
