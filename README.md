# LabelLens — Packaged Commodity Intelligence
### Automated Legal Metrology & Regulatory Compliance Verification System
**Smart India Hackathon (SIH 2026) | Problem Statement SIH26034**

---

## 📌 Executive Overview

**LabelLens** is an AI-powered compliance audit and verification platform designed to automate the inspection of packaged commodities against the statutory mandates of the **Legal Metrology (Packaged Commodities) Rules, 2011 (Rule 6)** and the **Drugs and Cosmetics Rules, 1945**.

By combining **PP-OCRv4 ONNX** multi-angle text extraction, adaptive resolution enhancement, 2D spatial clustering, and fuzzy synonym matching, LabelLens scans physical packaging photos or e-commerce listing URLs to identify mandatory declarations, detect formatting violations, and generate official audit reports in seconds.

---

## 🎨 Visual Identity & Design System

LabelLens features a bespoke design system engineered for high legibility and professional authority:

### 1. Color Palette

| Token Name | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| **Graphite** | `#171B20` | Left sidebar background, dark cards, primary buttons, user avatar |
| **Orange** | `#F28B36` | Primary brand accent, active navigation item, section indicators (`\|`), donut score arc |
| **Ivory** | `#F4F2EC` | Main dashboard canvas background |
| **Sage** | `#A8B5AE` | Secondary borders, muted indicators, subtle tags |
| **Silver** | `#D8DAD6` | Card outlines, dividers, timeline connectors, subtle boundaries |

### 2. Typography

| Font Family | Classification | Usage |
| :--- | :--- | :--- |
| **Space Grotesk** | Headings & Brand | Brand title (`LabelLens`), hero headlines, section headings, score numbers |
| **Inter** | Body & Navigation | Navigation menu items, subtitles, body text, status descriptions, action buttons |
| **IBM Plex Mono** | Technical Labels | Taglines, format limits, timestamps, detected value pills, system metrics |

---

## 🌟 Key Capabilities & Technical Highlights

### 1. Dual Regulatory Framework Modes
- **General Packaged Commodities**: Verifies mandatory Rule 6 declarations:
  - **Net Quantity (Rule 6(1)(d))**: Validates standard SI metric symbols (`g`, `kg`, `ml`, `l`, `m`, `cm`, `units`) with correct numeral spacing. Flags non-standard units (e.g., `gms`, `ml.`, `kgs`).
  - **Maximum Retail Price (Rule 6(1)(e))**: Verifies rupee symbol (`₹` / `Rs.`) and the statutory phrase `"(Inclusive of all taxes)"`.
  - **Manufacturer / Packer / Importer (Rule 6(1)(a)-(b))**: Extracts complete legal business names and physical postal addresses.
  - **Date of Mfg / Packing (Rule 6(1)(c))**: Validates Month & Year format (`MM/YYYY` or Month text).
  - **Consumer Care Helpline (Rule 6(1)(g))**: Detects verified telephone helplines, toll-free numbers, and contact email addresses.
  - **Country of Origin (Rule 6(10))**: Validates domestic and imported origin declarations.
  - **Generic Commodity Description**: Identifies product identity while ignoring allergen and marketing noise.

- **Medicine & Pharmaceutical Mode**: Verifies general declarations plus Drugs & Cosmetics Act fields:
  - Batch Number (`B.No.`), Manufacturing License (`Mfg. Lic. No.`), Expiry Date (`Exp. Date`), Active Ingredients / Dosage, Storage Conditions, and Schedule Drug / Rx classification.

### 2. Adaptive Optical OCR & 2D Spatial Engine
- **Multi-Scale Upscaling**: Automatically detects low-resolution photos and applies high-fidelity interpolation (`cv2.INTER_LANCZOS4`) to make fine, small-print text legible to OCR models.
- **2D Spatial Proximity Clustering**: Rather than assuming sequential output order, LabelLens computes geometric coordinates to bind label headers (e.g., `"Manufactured By:"`) with multi-line text blocks directly below or beside them.
- **Noise Isolation**: Specifically filters out nutrition panel tokens (`g,mg,ug`, `Qty per Serving`, `Sodium`) and allergen warnings to prevent false statutory matches.
- **Strict Word-Boundary Matching**: Prevents short 3-letter abbreviations (like `mfg`, `pkd`, `mrp`, `coo`) from triggering false substring matches in unrelated words.

### 3. Interactive Packaging Inspection Dashboard
- **Viewfinder Canvas**: Displays uploaded packaging with optical reticle brackets `[ ]` and interactive SVG bounding boxes. Hovering or clicking any box highlights its exact coordinates and OCR confidence.
- **Executive Scorecard**: Circular donut gauge displaying real-time compliance percentage, compliant field counters, advisory review items, and major violation alerts.
- **Audit Breakdown Drawer**: Per-field audit cards with status filters (`All`, `Compliant`, `Needs Review`, `Non-Compliant`) and full raw OCR transcript inspection.
- **Multi-Format Export**: Generates official PDF Audit Reports and structured JSON exports.

---

## 📁 Project Architecture

```
LabelLens/
├── backend/
│   ├── app/
│   │   ├── config.py                   # Port settings, confidence limits, file paths
│   │   ├── main.py                     # FastAPI server with CORS, upload & URL endpoints
│   │   ├── ocr/
│   │   │   ├── ocr_engine.py           # PP-OCRv4 ONNX runner with multi-scale upscaling
│   │   │   └── preprocessor.py         # Deskew, gentle CLAHE contrast, noise filtering
│   │   ├── rules/
│   │   │   ├── synonyms.json           # Extensible JSON rules & synonym dictionary
│   │   │   ├── rule_engine.py          # Dynamic Legal Metrology verification engine
│   │   │   └── validators.py           # SI unit, MRP, Date, Address, & Pharma format checks
│   │   └── services/
│   │       ├── field_mapper.py         # 2D spatial clustering & NLP synonym mapper
│   │       ├── url_fetcher.py          # Safe HTTP fetcher for e-commerce and direct images
│   │       ├── pdf_converter.py        # Multi-page PDF page extractor
│   │       └── report_exporter.py      # PDF & JSON audit report generation
│   └── run_backend.py                  # Backend server entrypoint (:8088)
├── frontend/
│   ├── index.html                      # LabelLens dashboard UI (Space Grotesk + Inter)
│   ├── css/
│   │   └── styles.css                  # Custom styling, reticle viewfinders, SVG overlays
│   ├── js/
│   │   └── app.js                      # UI logic, SVG bounding box visualizer, API client
│   ├── assets/                         # Branding badges, factory visual, national seal
│   └── serve_frontend.py              # Frontend static server entrypoint (:5188)
├── tests/
│   └── test_compliance.py             # Automated unit & integration tests
├── requirements.txt                    # Project dependencies
├── start_servers.py                    # Unified concurrent launcher with auto port-cleanup
├── start_background.ps1               # Detached background service starter
├── stop_background.ps1                # Background process cleanup script
└── README.md                           # Documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python**: Version `3.10` or higher (`3.12` recommended)
- **Pip**: Latest version

### 2. Installation
Clone the repository and install the required dependencies:
```bash
git clone https://github.com/chandanaraos03/LabelLens.git
cd LabelLens
pip install -r requirements.txt
```

### 3. Launch Servers
Run the unified launcher:
```bash
python start_servers.py
```
> **Note**: `start_servers.py` automatically checks for and clears any lingering processes on ports `8088` and `5188` before starting, ensuring seamless startup without `[Errno 10048]` socket errors.

Alternatively, you can run the servers in separate terminals:
```powershell
# Terminal 1: Backend API (Port 8088)
python backend/run_backend.py

# Terminal 2: Frontend Dashboard (Port 5188)
python frontend/serve_frontend.py
```

### 4. Access the Application
- **Frontend Dashboard**: [http://localhost:5188](http://localhost:5188)
- **Backend Swagger API Docs**: [http://localhost:8088/docs](http://localhost:8088/docs)
- **Backend Health Check**: [http://localhost:8088/api/health](http://localhost:8088/api/health)

---

## 🧪 Running Automated Tests

Run the compliance rule test suite:
```bash
python tests/test_compliance.py
```

All 8 test suites verify:
- Rule 11 standard SI metric symbols & numeral spacing (`500 g`, `1 kg`, `250 ml`).
- MRP formatting & inclusive tax declaration detection (`₹`, `Rs.`, `(Incl. of all taxes)`).
- Date validation (manufacture, packing, and expiry durability dates).
- Manufacturer name & physical postal address validation.
- Consumer helpline phone numbers & verified email parsing.
- PP-OCRv4 text detection and bounding box coordinate normalization.
- Automated PDF report generation.

---

## 📡 API Reference Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns backend service status and active OCR engine |
| `GET` | `/api/rules/config?product_type=general` | Returns active rule definitions and synonyms |
| `POST` | `/api/analyze/upload` | Multipart upload for multi-image & PDF packaging inspection |
| `POST` | `/api/analyze/url` | JSON payload to fetch and verify e-commerce or direct URLs |
| `POST` | `/api/export/pdf` | Generates official PDF compliance audit certificates |

---

## ⚖️ Legal Metrology Compliance Reference Matrix

| Declaration | Mandatory Rule | Standard Criteria | Violation Trigger |
| :--- | :--- | :--- | :--- |
| **Net Quantity** | Rule 6(1)(d) & Rule 11 | `g`, `kg`, `ml`, `l`, `m`, `cm`, `units` with numeral space | Symbols like `gms`, `ml.`, `kgs`, or missing unit |
| **MRP** | Rule 6(1)(e) | `₹` or `Rs.` with `"(Inclusive of all taxes)"` | Missing tax statement, rounded currency symbols |
| **Date of Mfg / Pkg** | Rule 6(1)(c) | `MM/YYYY` or Month text | Missing month/year, illegible date stamps |
| **Manufacturer Details** | Rule 6(1)(a)-(b) | Complete business name + physical postal address | Incomplete address, missing city or PIN code |
| **Consumer Helpline** | Rule 6(1)(g) | Phone number, toll-free number, or email | Missing contact point for customer grievances |
| **Country of Origin** | Rule 6(10) | `"Country of Origin"`, `"Made in"`, `"Product of"` | Missing origin declaration on domestic or imported goods |

---

## 👥 Contributors & Acknowledgements

- **Developed for**: Smart India Hackathon (SIH 2026)
- **Problem Statement**: SIH26034 — Legal Metrology (Packaged Commodities) Compliance System
- **Technologies**: FastAPI, Python 3.12, PP-OCRv4 ONNX, OpenCV, RapidFuzz, ReportLab, Tailwind CSS
- **License**: MIT
