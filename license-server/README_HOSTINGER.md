# 🚀 Hostinger Deployment Guide — Story Studio (`studio.enrollx.in`)

This server contains:
1. **Ultra-Modern Apple Light Theme Landing Page** (`/`): High-converting desktop suite website with custom vector icons, interactive studio workspace preview, aspect ratio switcher (16:9 / 9:16), comparison table, FAQ, and macOS specs. **Zero admin links exposed.**
2. **Direct macOS DMG Download Service** (`/download`): Automatically serves the 219 MB native installer (`StoryStudio-1.0.0-arm64.dmg`).
3. **WhatsApp OTP Authentication API**: Sends instant 6-digit verification codes using `connect.enrollx.in`.
4. **Hardware Anti-Piracy Server**: Locks licenses to user Mac hardware IDs (HWID).
5. **Executive Admin Control Center** (`/admin`): Ultra-secure console protected by an ID + Password verification gate before unlocking metrics, 1-click extensions, HWID unlocks, direct WhatsApp chats, and CSV exports.

---

## 📁 1. Hostinger Package Files (`dist_electron/license-server-hostinger.zip`)

```
license-server/
├── data/
│   └── database.json          # Persistent user & license store
├── public/
│   ├── index.html             # High-end Apple-grade Landing Page (NO admin links)
│   ├── admin.html             # Executive Control Center (ID & Password Gated)
│   ├── logo.png               # High-res Studio App Logo
│   └── downloads/
│       └── StoryStudio-1.0.0-arm64.dmg  # Pre-bundled macOS DMG Installer!
├── .env                       # Pre-configured for studio.enrollx.in
├── db.js                      # Persistent atomic database logic
├── package.json               # Node.js dependencies (Express, Axios, JWT, CORS)
├── server.js                  # Production server & WhatsApp OTP engine
└── README_HOSTINGER.md        # Guide
```

---

## 🌐 2. Deployment on Hostinger Node.js (`studio.enrollx.in`)

### Option A: Using Hostinger File Manager (All-in-One Single Zip)
1. Log in to Hostinger hPanel -> Go to **Websites** -> Select **studio.enrollx.in**.
2. Go to **Node.js** in hPanel:
   - **Node.js version**: `v20.x` or `v18.x`.
   - **Application mode**: `Production`.
   - **Application startup file**: `server.js`.
3. Open **File Manager**, upload [`dist_electron/license-server-hostinger.zip`](file:///Users/abhishekverma/Desktop/videostudio/dist_electron/license-server-hostinger.zip) into your app root directory, and **Extract** it. *(DMG installer is already pre-packed inside `public/downloads/`)*.
4. Click **Run NPM Install** in hPanel.
5. Click **Restart Application**.

### Option B: Using Hostinger Connector (Git / Extension)
If using the Hostinger Connector extension:
1. Ensure the repository root points to `license-server/` or deploy files into `public_html`.
2. Startup file: `server.js`.
3. Run npm install and restart.

---

## 🔗 3. Live URLs

| Purpose | URL |
| :--- | :--- |
| **Public Landing Page** | `https://studio.enrollx.in/` |
| **Direct DMG Download** | `https://studio.enrollx.in/download` |
| **Executive Admin Gate** | `https://studio.enrollx.in/admin` |
| **API Health Status** | `https://studio.enrollx.in/api/health` |

---

## 🔐 4. Executive Admin Login Credentials

Navigating directly to `https://studio.enrollx.in/admin`:
- **Administrator ID**: `abhishek731827@gmail.com` (or `admin`)
- **Master Secret Key / Password**: `abhishek_storyreel_admin_2026`
- **Features in Admin**:
  - Live metric cards (Total users, Active, Lifetime VIPs, Expiring soon, HWID bound, Blocked).
  - Search by Phone / HWID in real-time.
  - Direct 1-click WhatsApp chat link for every user.
  - Quick 1-click buttons: `+7d`, `+30d`, `+1yr`, `💎 Lifetime`.
  - Reset Mac Device Lock (HWID) with 1 click.
  - Export full subscriber database to CSV.
  - Live activity audit log.

