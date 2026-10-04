<div align="center">
  <img width="200" alt="Falcon Rod Maker Logo" src="public/falcon-theme-rod-logo.svg" />
  
  # 🦅 Falcon Rod Maker — Workshop POS & ERP
  <p><strong>Industrial-Grade Point of Sale, Factory Production & Multi-Tier Ledger ERP</strong></p>
  <p><em>Specialized for Ceiling & Exhaust Fan Down Rods • Gujrat, Pakistan</em></p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web%20PWA-amber?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/Cloud%20Database-Firebase%20Firestore-orange?style=flat-square" alt="Database" />
    <img src="https://img.shields.io/badge/Google%20Workspace-Sheets%20%26%20Drive%20OAuth%202.0-blue?style=flat-square" alt="Google Workspace" />
    <img src="https://img.shields.io/badge/Offline%20Engine-IndexedDB%20%2B%20SQLite%20Cache-emerald?style=flat-square" alt="Offline Engine" />
  </p>
</div>

---

## 🌟 Key Features

- **🦅 Unified Brand Identity**: Matching official Falcon Rod Maker logo across Android launcher icon, Splash screen, Web PWA, and GitHub repository.
- **⚡ Native Android APK**: Built with Capacitor with direct integration for Chrome Custom Tabs, speech recognition, and thermal printer support.
- **📊 Real-Time Google Sheets Sync**: Live synchronization with Google Sheets master workbook with instant native app launching.
- **☁️ Automated Google Drive Backups**: Dual-format (JSON snapshot + ANSI SQL dump) scheduled and manual backups to your dedicated Google Drive folder.
- **🔒 Google OAuth 2.0 Integration**: Certified OAuth 2.0 authentication for Google Sheets and Google Drive with native app deep-link return.
- **🏭 Factory Production & Raw Materials**: Full tracking of pipe bundles, painting charges, cutting scrap, and finished rod inventory.
- **👥 Multi-Tier Customer Ledgers**: Customer debit/credit accounts, payment receipts, invoice PDF generation, and automated Urdu/English invoices.

---

## 🚀 Run & Build

### Web Application
```bash
npm install
npm run dev
```

### Android APK Build
```bash
npm run build
npx cap sync android
```
Open in [Android Studio](https://developer.android.com/studio), connect your device or emulator, and tap **Run**.