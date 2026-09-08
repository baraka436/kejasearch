# Nyumba360 — Legal & Compliance Checklist

**Not legal advice.** This flags what's built into the prototype and what needs a Kenyan advocate, real business documents, and your own decisions before launch. I'm not a lawyer and this isn't a substitute for one.

## Built into the site
- Privacy Policy, Terms & Conditions, Cookie Policy, Refund Policy pages, all referencing the **Data Protection Act, 2019** and written for a Kenya-based marketplace.
- Cookie consent banner that blocks non-essential scripts (analytics, tracking embeds) until the user clicks **Accept** — required because the DPA treats tracking cookies as personal data processing needing informed, opt-in consent.
- Signup form collects only what's needed (name, email, phone, password; ID docs only for landlord verification) and has separate checkboxes for Terms, Privacy, and optional marketing — no bundled consent.
- "Verified landlord" badge with a stated verification date and an explicit note that verification isn't a guarantee.
- Reviews require confirming a genuine tenancy; the review workflow and copy explicitly reject unverified/incentivized reviews.
- Safety notice on the property page warning tenants never to pay a deposit before viewing in person.
- Refund policy scoped only to platform fees, not rent/deposits (Nyumba360 never touches that money in this design).
- Data-subject rights: "download my data" / "delete my account" buttons on the dashboard, and a named contact for DPA requests.
- Accessibility: skip link, visible focus outlines, labelled form fields, keyboard-operable tabs (arrow keys) on login/signup, alt text and text alternatives for the 360° viewer and decorative art marked `aria-hidden`, contrast-checked colour palette (all text/background pairs ≥ 4.5:1, large text/buttons ≥ 3:1), `prefers-reduced-motion` respected, semantic tables/headings/landmarks throughout.
- No third-party analytics or ad scripts are wired in — the site currently calls nothing external except Google Fonts (see below) and placeholder `tel:`/`wa.me` links.

## You still need to do before this goes live
1. **Legal review.** Have a Kenyan advocate check all four policy pages, your actual business registration, and whether you need to register with the **Office of the Data Protection Commissioner (ODPC)** as a data controller/processor.
2. **Real photos and 360° tours.** This prototype uses illustrations, not photos, specifically to avoid copyright issues. Before launch: only use photos you or the landlord own or are licensed to use, get written landlord sign-off that they own the images they upload, and consider watermarking to deter scraping.
3. **Landlord identity checks.** Decide the actual verification process (ID + title deed/lease, phone OTP) and who reviews it — the badge is only trustworthy if verification is real and periodically re-checked.
4. **Fake reviews / unsupported claims.** The UI nudges toward honest reviews and requires a tenancy confirmation, but you need real moderation: a human or automated review queue, a way to detect review-for-payment schemes, and a process to fact-check landlord claims (square footage, amenities) before they go live.
5. **Analytics & third-party embeds.** Before adding Google Analytics, Meta Pixel, WhatsApp click-to-chat tracking, or a 360°-tour provider's embed (Matterport/Kuula/etc.), check what cookies/trackers each one sets and gate them behind the consent banner (`loadNonEssentialScripts()` in `script.js` is the hook for this). Google Fonts is currently loaded unconditionally — for strict compliance, self-host the fonts or move the Google Fonts request behind consent too, since it does contact a third-party server.
6. **Payments.** If you later collect rent, deposits, or subscription fees directly, you'll need a licensed Kenyan payment processor (e.g. M-Pesa/Safaricom integration, a PCI-compliant card processor) and the Refund Policy will need real terms, not the placeholder ones here.
7. **Business details.** Replace every placeholder (`CR/2026/XXXXXX`, phone numbers, `dpo@nyumba360.example`) with your real company registration number, KRA PIN if applicable, physical address, and monitored contact channels.
8. **Defamation & liability exposure.** Reviews and "report a landlord" features carry defamation risk if false claims go live unmoderated — get advice on your take-down process and Terms' limitation-of-liability clause.
9. **Data breach plan.** The DPA requires notifying the ODPC and affected users after a breach likely to cause harm — have an actual incident-response process, not just the policy sentence.
10. **Accessibility retest.** Run a real screen reader (NVDA/VoiceOver) and automated checker (axe, Lighthouse) over the final site once real content and images replace these placeholders — alt text needs to describe the *actual* photo/tour, not a placeholder.

## Design note
Property photography and hero art use original SVG illustrations rather than stock or scraped photos, specifically so the prototype carries zero copyright risk out of the box. Swap in real listing photos only once you've confirmed ownership/licensing per item 2 above.
