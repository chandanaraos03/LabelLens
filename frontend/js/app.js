// LabelLens - Packaged Commodity Intelligence (SIH26034)
// Palette: Graphite #171B20 | Orange #F28B36 | Ivory #F4F2EC | Sage #A8B5AE | Silver #D8DAD6

const API_BASE = "http://localhost:8088";

// App State
const state = {
  productType: "general", // "general" | "medicine"
  inputMode: "upload",    // "upload" | "url"
  selectedFiles: [],
  currentAnalysis: null,
  activeImageIndex: 0,
  activeFilter: "all"
};

// DOM References
const elements = {
  pillGeneralCat: document.getElementById('pillGeneralCat'),
  pillPharmaCat: document.getElementById('pillPharmaCat'),
  tabUploadBtn: document.getElementById('tabUploadBtn'),
  tabUrlBtn: document.getElementById('tabUrlBtn'),
  panelUpload: document.getElementById('panelUpload'),
  panelUrl: document.getElementById('panelUrl'),
  
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  selectedFilesPreview: document.getElementById('selectedFilesPreview'),
  selectedCountText: document.getElementById('selectedCountText'),
  clearFilesBtn: document.getElementById('clearFilesBtn'),
  thumbnailContainer: document.getElementById('thumbnailContainer'),
  urlInput: document.getElementById('urlInput'),
  
  runAnalysisBtn: document.getElementById('runAnalysisBtn'),
  runBtnLabel: document.getElementById('runBtnLabel'),
  errorAlert: document.getElementById('errorAlert'),
  errorTitle: document.getElementById('errorTitle'),
  errorMessage: document.getElementById('errorMessage'),
  loadingSection: document.getElementById('loadingSection'),
  resultsSection: document.getElementById('resultsSection'),
  
  overallStatusHeading: document.getElementById('overallStatusHeading'),
  statusSummaryText: document.getElementById('statusSummaryText'),
  scoreDonutArc: document.getElementById('scoreDonutArc'),
  scorePercentVal: document.getElementById('scorePercentVal'),
  metricTotalCount: document.getElementById('metricTotalCount'),
  metricCompliantCount: document.getElementById('metricCompliantCount'),
  metricReviewCount: document.getElementById('metricReviewCount'),
  metricViolationsCount: document.getElementById('metricViolationsCount'),
  complianceStatusBanner: document.getElementById('complianceStatusBanner'),
  bannerMainHeading: document.getElementById('bannerMainHeading'),
  bannerSubHeading: document.getElementById('bannerSubHeading'),
  
  displayPackagingImg: document.getElementById('displayPackagingImg'),
  bboxSvgOverlay: document.getElementById('bboxSvgOverlay'),
  imageTabsContainer: document.getElementById('imageTabsContainer'),
  detectedPillsContainer: document.getElementById('detectedPillsContainer'),
  verificationItemsContainer: document.getElementById('verificationItemsContainer'),
  
  fieldCardsContainer: document.getElementById('fieldCardsContainer'),
  filterBtns: document.querySelectorAll('.filter-btn'),
  inspectorEmptyState: document.getElementById('inspectorEmptyState'),
  inspectorDetails: document.getElementById('inspectorDetails'),
  inspFieldName: document.getElementById('inspFieldName'),
  inspExtractedVal: document.getElementById('inspExtractedVal'),
  inspSynonym: document.getElementById('inspSynonym'),
  inspConfidence: document.getElementById('inspConfidence'),
  inspLegalRule: document.getElementById('inspLegalRule'),
  inspValidationMsg: document.getElementById('inspValidationMsg'),
  
  toggleRawOcrBtn: document.getElementById('toggleRawOcrBtn'),
  rawOcrChevron: document.getElementById('rawOcrChevron'),
  rawOcrContainer: document.getElementById('rawOcrContainer'),
  rawOcrTextarea: document.getElementById('rawOcrTextarea'),
  
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  downloadJsonBtn: document.getElementById('downloadJsonBtn'),
  historyListContainer: document.getElementById('historyListContainer')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  setupEventListeners();
  checkBackendHealth();
  // Hide results section initially until user runs analysis
  elements.resultsSection.classList.add('hidden');
});

// Event Listeners
function setupEventListeners() {
  // Category Switchers
  const generalRadio = elements.pillGeneralCat.querySelector('input');
  const pharmaRadio = elements.pillPharmaCat.querySelector('input');

  generalRadio.addEventListener('change', () => {
    state.productType = "general";
    elements.pillGeneralCat.className = "cursor-pointer px-3.5 py-1.5 rounded-lg transition-all bg-white text-[#171B20] shadow-sm";
    elements.pillPharmaCat.className = "cursor-pointer px-3.5 py-1.5 rounded-lg transition-all text-[#757E88] hover:text-[#171B20]";
  });

  pharmaRadio.addEventListener('change', () => {
    state.productType = "medicine";
    elements.pillPharmaCat.className = "cursor-pointer px-3.5 py-1.5 rounded-lg transition-all bg-white text-[#171B20] shadow-sm";
    elements.pillGeneralCat.className = "cursor-pointer px-3.5 py-1.5 rounded-lg transition-all text-[#757E88] hover:text-[#171B20]";
  });

  // Mode Switcher (Upload vs URL)
  elements.tabUploadBtn.addEventListener('click', () => switchInputTab('upload'));
  elements.tabUrlBtn.addEventListener('click', () => switchInputTab('url'));

  // Drag & Drop
  elements.dropzone.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelect);

  ['dragenter', 'dragover'].forEach(name => {
    elements.dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      elements.dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    elements.dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      elements.dropzone.classList.remove('drag-over');
    });
  });

  elements.dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      addFiles(Array.from(dt.files));
    }
  });

  elements.clearFilesBtn.addEventListener('click', clearFiles);

  // Analysis Button
  elements.runAnalysisBtn.addEventListener('click', executeAnalysis);

  // Raw OCR Toggle
  elements.toggleRawOcrBtn.addEventListener('click', () => {
    const isHidden = elements.rawOcrContainer.classList.contains('hidden');
    elements.rawOcrContainer.classList.toggle('hidden', !isHidden);
    elements.rawOcrChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  // Filter Buttons
  elements.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.filterBtns.forEach(b => {
        b.className = "filter-btn px-3 py-1.5 rounded-lg bg-[#F4F2EC] text-[#5A626A] hover:text-[#171B20] font-medium border border-[#D8DAD6]";
      });
      btn.className = "filter-btn px-3 py-1.5 rounded-lg bg-[#171B20] text-white font-medium";
      state.activeFilter = btn.getAttribute('data-filter');
      renderFieldCards();
    });
  });

  // Export Buttons
  elements.downloadPdfBtn.addEventListener('click', downloadPdfReport);
  elements.downloadJsonBtn.addEventListener('click', downloadJsonReport);

  // Resize listener for SVG bounding boxes
  window.addEventListener('resize', () => {
    if (state.currentAnalysis) {
      renderBoundingBoxes();
    }
  });

  // Escape key closes modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.fixed.inset-0').forEach(m => m.classList.add('hidden'));
    }
  });
}

function switchInputTab(mode) {
  state.inputMode = mode;
  hideError();

  if (mode === 'upload') {
    elements.tabUploadBtn.className = "px-3.5 py-1.5 rounded-lg bg-[#171B20] text-white shadow-sm transition-all flex items-center space-x-1.5";
    elements.tabUrlBtn.className = "px-3.5 py-1.5 rounded-lg text-[#757E88] hover:text-[#171B20] transition-all flex items-center space-x-1.5";
    elements.panelUpload.classList.remove('hidden');
    elements.panelUrl.classList.add('hidden');
  } else {
    elements.tabUrlBtn.className = "px-3.5 py-1.5 rounded-lg bg-[#171B20] text-white shadow-sm transition-all flex items-center space-x-1.5";
    elements.tabUploadBtn.className = "px-3.5 py-1.5 rounded-lg text-[#757E88] hover:text-[#171B20] transition-all flex items-center space-x-1.5";
    elements.panelUrl.classList.remove('hidden');
    elements.panelUpload.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

function handleFileSelect(e) {
  if (e.target.files && e.target.files.length > 0) {
    addFiles(Array.from(e.target.files));
  }
}

function addFiles(newFiles) {
  state.selectedFiles = [...state.selectedFiles, ...newFiles];
  renderSelectedFilesPreview();
}

function clearFiles() {
  state.selectedFiles = [];
  elements.fileInput.value = "";
  renderSelectedFilesPreview();
}

function removeFile(index) {
  state.selectedFiles.splice(index, 1);
  renderSelectedFilesPreview();
}
window.removeFile = removeFile;

function renderSelectedFilesPreview() {
  if (state.selectedFiles.length === 0) {
    elements.selectedFilesPreview.classList.add('hidden');
    return;
  }

  elements.selectedFilesPreview.classList.remove('hidden');
  elements.selectedCountText.textContent = `Selected ${state.selectedFiles.length} file(s)`;

  elements.thumbnailContainer.innerHTML = state.selectedFiles.map((file, idx) => {
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const previewSrc = isPdf ? "" : URL.createObjectURL(file);

    return `
      <div class="relative group rounded-xl border border-[#D8DAD6] bg-white p-2 flex flex-col items-center space-y-1 shadow-sm">
        ${isPdf ? `
          <div class="w-full h-16 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
            <i data-lucide="file-text" class="w-6 h-6"></i>
          </div>
        ` : `
          <img src="${previewSrc}" class="w-full h-16 object-cover rounded-lg">
        `}
        <span class="text-[10px] text-[#171B20] truncate w-full text-center font-mono">${file.name}</span>
        <button onclick="removeFile(${idx})" type="button" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#171B20] text-white hover:bg-rose-600 flex items-center justify-center text-xs opacity-80 group-hover:opacity-100 transition-all">
          &times;
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function setSampleUrl(url, productType = 'general') {
  elements.urlInput.value = url;
  if (productType === 'general') {
    elements.pillGeneralCat.querySelector('input').click();
  } else {
    elements.pillPharmaCat.querySelector('input').click();
  }
}
window.setSampleUrl = setSampleUrl;

// Backend Health Check
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      document.getElementById('backendStatusBadge').innerHTML = `
        <span class="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
        <span>PP-OCRv4 Active :8088</span>
      `;
    }
  } catch (err) {
    document.getElementById('backendStatusBadge').innerHTML = `
      <span class="w-2 h-2 rounded-full bg-[#F28B36]"></span>
      <span>Connecting to :8088...</span>
    `;
  }
}

function showError(title, msg) {
  elements.errorTitle.textContent = title;
  elements.errorMessage.textContent = msg;
  elements.errorAlert.classList.remove('hidden');
}

function hideError() {
  elements.errorAlert.classList.add('hidden');
}

// =========================================================================
// RUN ANALYSIS VIA BACKEND
// =========================================================================
async function executeAnalysis() {
  hideError();

  if (state.inputMode === 'upload' && state.selectedFiles.length === 0) {
    showError("Missing File Input", "Please select or drop at least one packaging label image or PDF.");
    return;
  }

  if (state.inputMode === 'url' && !elements.urlInput.value.trim()) {
    showError("Missing URL Input", "Please provide a valid product URL or direct image link.");
    return;
  }

  elements.loadingSection.classList.remove('hidden');
  elements.runAnalysisBtn.disabled = true;
  elements.runBtnLabel.innerHTML = `<span>Analyzing Packaging...</span>`;

  try {
    let responseData;

    if (state.inputMode === 'upload') {
      const formData = new FormData();
      formData.append('product_type', state.productType);
      state.selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch(`${API_BASE}/api/analyze/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned HTTP ${res.status}`);
      }
      responseData = await res.json();

    } else {
      const payload = {
        url: elements.urlInput.value.trim(),
        product_type: state.productType
      };

      const res = await fetch(`${API_BASE}/api/analyze/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned HTTP ${res.status}`);
      }
      responseData = await res.json();
    }

    state.currentAnalysis = responseData;
    state.activeImageIndex = 0;
    renderAnalysisResults();

    // Add session to History modal
    addHistoryRecord(responseData);

  } catch (err) {
    showError("Verification Failed", err.message || "An error occurred while connecting to the backend verification engine.");
  } finally {
    elements.loadingSection.classList.add('hidden');
    elements.runAnalysisBtn.disabled = false;
    elements.runBtnLabel.textContent = "Run Legal Metrology Verification";
    if (window.lucide) lucide.createIcons();
  }
}

// Render Results
function renderAnalysisResults() {
  const data = state.currentAnalysis;
  if (!data) return;

  const report = data.compliance_report;
  const metrics = report.metrics;

  // 1. Overall Status Heading & Donut Gauge
  const score = report.compliance_percentage;
  elements.scorePercentVal.textContent = `${score}%`;
  const circumference = 238.76;
  const offset = circumference - (score / 100) * circumference;
  elements.scoreDonutArc.style.strokeDashoffset = offset;

  elements.overallStatusHeading.textContent = report.overall_status.replace(/_/g, ' ');
  elements.statusSummaryText.textContent = report.status_summary;

  if (report.overall_status === 'COMPLIANT') {
    elements.overallStatusHeading.className = "font-heading text-2xl sm:text-3xl font-extrabold text-[#4ADE80] mt-1";
    elements.complianceStatusBanner.className = "w-full rounded-xl bg-[#DEF3E6] p-3.5 flex items-center space-x-3 text-[#14532D] border border-[#BDE5CC]";
    elements.bannerMainHeading.textContent = "Package is Compliant!";
    elements.bannerSubHeading.textContent = "All mandatory Legal Metrology Rule 6 declarations verified.";
  } else if (report.overall_status === 'PARTIALLY_COMPLIANT') {
    elements.overallStatusHeading.className = "font-heading text-2xl sm:text-3xl font-extrabold text-[#FBBF24] mt-1";
    elements.complianceStatusBanner.className = "w-full rounded-xl bg-[#FEF3C7] p-3.5 flex items-center space-x-3 text-[#92400E] border border-[#FDE68A]";
    elements.bannerMainHeading.textContent = "Package requires review.";
    elements.bannerSubHeading.textContent = "Review flagged declarations below.";
  } else {
    elements.overallStatusHeading.className = "font-heading text-2xl sm:text-3xl font-extrabold text-[#F87171] mt-1";
    elements.complianceStatusBanner.className = "w-full rounded-xl bg-[#FEE2E2] p-3.5 flex items-center space-x-3 text-[#991B1B] border border-[#FECACA]";
    elements.bannerMainHeading.textContent = "Non-Compliant Packaging Detected";
    elements.bannerSubHeading.textContent = "Mandatory statutory declarations are missing or invalid.";
  }

  // 2. Metrics
  elements.metricTotalCount.textContent = metrics.total_mandatory_fields;
  elements.metricCompliantCount.textContent = metrics.passed_mandatory_fields;
  elements.metricReviewCount.textContent = metrics.unreadable_fields_count;
  elements.metricViolationsCount.textContent = metrics.failed_mandatory_fields;

  // 3. Multi-Image Tabs
  renderImageTabs();
  loadActiveImage();

  // 4. Detected Pills (Spacious, flex-wrap with min-w-0 to prevent overlap!)
  const fields = report.fields || [];
  const detectedTokens = fields.filter(f => f.extracted_value).map(f => ({
    text: f.extracted_value,
    label: f.field_name
  }));

  if (detectedTokens.length > 0) {
    elements.detectedPillsContainer.innerHTML = detectedTokens.map(tok => `
      <div class="inline-flex items-center gap-1.5 p-1 rounded-lg bg-[#F4F2EC] border border-[#D8DAD6] max-w-full">
        <span class="px-2.5 py-1 rounded bg-white text-[#171B20] font-mono text-xs font-medium border border-[#D8DAD6] truncate max-w-[240px]" title="${tok.text}">
          ${tok.text}
        </span>
        <span class="px-2 py-0.5 rounded bg-[#EBE7DE] text-[#5A626A] font-mono text-[10px] font-semibold flex-shrink-0">
          ${tok.label}
        </span>
      </div>
    `).join('');
  } else {
    elements.detectedPillsContainer.innerHTML = `<p class="text-xs text-[#757E88] italic py-2">No text tokens recognized on packaging.</p>`;
  }

  // 5. Verification Details Checklist (Right Column)
  elements.verificationItemsContainer.innerHTML = fields.map(item => {
    let badgeClass = "bg-[#DEF3E6] text-[#15803D]";
    let badgeText = "Present";

    if (item.status === "WARNING") {
      badgeClass = "bg-[#FEF3C7] text-[#B45309]";
      badgeText = "Needs Review";
    } else if (item.status === "FAIL" || item.status === "NOT_FOUND") {
      badgeClass = "bg-[#FEE2E2] text-[#DC2626]";
      badgeText = "Missing";
    } else if (item.status === "UNREADABLE") {
      badgeClass = "bg-[#FEF3C7] text-[#B45309]";
      badgeText = "Unreadable";
    }

    const iconName = item.field_key.includes("mrp") ? "receipt" :
                     item.field_key.includes("quant") ? "scale" :
                     item.field_key.includes("name") ? "star" :
                     item.field_key.includes("manuf") ? "factory" :
                     item.field_key.includes("care") || item.field_key.includes("help") ? "phone" : "shield";

    return `
      <div class="flex items-center justify-between p-2 rounded-xl hover:bg-[#F4F2EC] transition-colors cursor-pointer group" onclick="focusFieldBox('${item.field_key}', ${item.image_index || 0})">
        <div class="flex items-center space-x-2.5 min-w-0 pr-2">
          <i data-lucide="${iconName}" class="w-4 h-4 text-[#5A626A] group-hover:text-[#F28B36] flex-shrink-0"></i>
          <span class="font-medium text-[#171B20] text-xs truncate" title="${item.field_name}">${item.field_name}</span>
        </div>
        <span class="px-2.5 py-1 rounded text-[11px] font-semibold flex-shrink-0 ${badgeClass}">
          ${badgeText}
        </span>
      </div>
    `;
  }).join('');

  // 6. Raw OCR Text
  elements.rawOcrTextarea.value = data.raw_extracted_text || "(No text recognized)";

  // 7. Field Cards
  renderFieldCards();

  // Reveal results and scroll smoothly
  elements.resultsSection.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

function renderImageTabs() {
  const images = (state.currentAnalysis && state.currentAnalysis.processed_images) || [];
  if (images.length <= 1) {
    elements.imageTabsContainer.classList.add('hidden');
    elements.imageTabsContainer.innerHTML = "";
    return;
  }

  elements.imageTabsContainer.classList.remove('hidden');
  elements.imageTabsContainer.innerHTML = images.map((img, idx) => `
    <button onclick="switchActiveImage(${idx})" type="button" class="px-3 py-1 text-xs rounded-lg font-medium transition-all ${
      state.activeImageIndex === idx 
        ? 'bg-[#171B20] text-white shadow-sm' 
        : 'bg-[#F4F2EC] text-[#5A626A] hover:text-[#171B20] border border-[#D8DAD6]'
    }">
      Photo ${idx + 1} (${img.blocks_count} blocks)
    </button>
  `).join('');
}

window.switchActiveImage = function(index) {
  state.activeImageIndex = index;
  renderImageTabs();
  loadActiveImage();
};

function loadActiveImage() {
  const images = state.currentAnalysis.processed_images || [];
  if (images.length === 0) return;

  const currentImgMeta = images[state.activeImageIndex];
  elements.displayPackagingImg.src = `${API_BASE}${currentImgMeta.url}`;
  elements.displayPackagingImg.onload = () => {
    renderBoundingBoxes();
  };
}

function renderBoundingBoxes() {
  const svg = elements.bboxSvgOverlay;
  svg.innerHTML = "";

  const images = state.currentAnalysis.processed_images || [];
  if (images.length === 0) return;

  const currentImgMeta = images[state.activeImageIndex];
  const fields = state.currentAnalysis.compliance_report.fields || [];
  const fieldBoxes = fields.filter(f => f.bounding_box && (f.image_index == null || f.image_index === state.activeImageIndex));
  const ocrBlocks = currentImgMeta.ocr_blocks || [];

  // OCR Blocks
  ocrBlocks.forEach(block => {
    const bbox = block.bbox_norm;
    if (!bbox) return;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", `${bbox.x * 100}%`);
    rect.setAttribute("y", `${bbox.y * 100}%`);
    rect.setAttribute("width", `${bbox.width * 100}%`);
    rect.setAttribute("height", `${bbox.height * 100}%`);
    rect.setAttribute("rx", "2");

    const isLow = block.is_low_confidence;
    rect.setAttribute("class", `bbox-rect ${isLow ? 'low-confidence' : 'ocr-block'}`);
    rect.addEventListener('mouseenter', () => showOcrBlockInspector(block));
    svg.appendChild(rect);
  });

  // Statutory Field Boxes
  fieldBoxes.forEach(field => {
    const bbox = field.bounding_box;
    if (!bbox) return;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", `${bbox.x * 100}%`);
    rect.setAttribute("y", `${bbox.y * 100}%`);
    rect.setAttribute("width", `${bbox.width * 100}%`);
    rect.setAttribute("height", `${bbox.height * 100}%`);
    rect.setAttribute("rx", "3");
    rect.setAttribute("id", `svg-box-${field.field_key}`);

    const isLow = field.status === "UNREADABLE";
    rect.setAttribute("class", `bbox-rect ${isLow ? 'low-confidence' : 'field-detected'}`);

    rect.addEventListener('mouseenter', () => {
      showFieldInspector(field);
      highlightFieldCard(field.field_key);
    });

    rect.addEventListener('click', () => {
      showFieldInspector(field);
      highlightFieldCard(field.field_key);
      const cardEl = document.getElementById(`field-card-${field.field_key}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    svg.appendChild(rect);
  });
}

function showFieldInspector(field) {
  elements.inspectorEmptyState.classList.add('hidden');
  elements.inspectorDetails.classList.remove('hidden');

  elements.inspFieldName.textContent = field.field_name;
  elements.inspExtractedVal.textContent = field.extracted_value || "(Not detected on packaging)";
  elements.inspSynonym.textContent = field.matched_synonym || "Direct Match";
  elements.inspConfidence.textContent = `${(field.confidence_score * 100).toFixed(1)}%`;
  elements.inspLegalRule.textContent = field.legal_rule;

  const isPass = field.status === "PASS";
  const isWarn = field.status === "WARNING";

  elements.inspValidationMsg.textContent = field.details;
  if (isPass) {
    elements.inspValidationMsg.className = "text-[11px] text-[#166534] bg-[#DEF3E6] p-2.5 rounded-lg border border-[#BDE5CC] mt-1 break-words";
  } else if (isWarn) {
    elements.inspValidationMsg.className = "text-[11px] text-[#92400E] bg-[#FEF3C7] p-2.5 rounded-lg border border-[#FDE68A] mt-1 break-words";
  } else {
    elements.inspValidationMsg.className = "text-[11px] text-[#991B1B] bg-[#FEE2E2] p-2.5 rounded-lg border border-[#FECACA] mt-1 break-words";
  }
}

function showOcrBlockInspector(block) {
  elements.inspectorEmptyState.classList.add('hidden');
  elements.inspectorDetails.classList.remove('hidden');

  elements.inspFieldName.textContent = "Raw OCR Text Region";
  elements.inspExtractedVal.textContent = block.text;
  elements.inspSynonym.textContent = "PP-OCRv4 Line";
  elements.inspConfidence.textContent = `${(block.confidence * 100).toFixed(1)}%`;
  elements.inspLegalRule.textContent = "Scanned packaging text element";
  elements.inspValidationMsg.textContent = `Raw block: ${block.text}`;
  elements.inspValidationMsg.className = "text-[11px] text-[#171B20] bg-[#F4F2EC] p-2.5 rounded-lg border border-[#D8DAD6] mt-1 break-words";
}

function renderFieldCards() {
  const report = state.currentAnalysis ? state.currentAnalysis.compliance_report : null;
  if (!report) return;

  const fields = report.fields || [];
  const filter = state.activeFilter;

  const filteredFields = fields.filter(f => {
    if (filter === "all") return true;
    if (filter === "PASS") return f.status === "PASS";
    if (filter === "FAIL") return f.status === "FAIL" || f.status === "NOT_FOUND";
    if (filter === "UNREADABLE") return f.status === "UNREADABLE" || f.status === "WARNING";
    return true;
  });

  elements.fieldCardsContainer.innerHTML = filteredFields.map(field => {
    const status = field.status;
    let badgeClass, badgeText, iconName, borderClass;

    if (status === "PASS") {
      badgeClass = "bg-[#DEF3E6] text-[#15803D] border-[#BDE5CC]";
      badgeText = "COMPLIANT";
      iconName = "check-circle-2";
      borderClass = "border-[#D8DAD6] hover:border-[#16A34A]";
    } else if (status === "WARNING") {
      badgeClass = "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]";
      badgeText = "ADVISORY REVIEW";
      iconName = "alert-triangle";
      borderClass = "border-[#F5A25D]/50 bg-[#FEF6EE]/30";
    } else if (status === "UNREADABLE") {
      badgeClass = "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]";
      badgeText = "UNREADABLE";
      iconName = "help-circle";
      borderClass = "border-[#F5A25D]/50 bg-[#FEF6EE]/30";
    } else {
      badgeClass = "bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]";
      badgeText = "NON-COMPLIANT";
      iconName = "x-circle";
      borderClass = "border-rose-300 bg-rose-50/30";
    }

    const hasBbox = field.bounding_box != null;

    return `
      <div id="field-card-${field.field_key}" 
           class="field-card rounded-2xl border ${borderClass} bg-white p-5 space-y-3 shadow-sm transition-all"
           onmouseenter="onFieldCardHover('${field.field_key}')"
           onmouseleave="onFieldCardLeave('${field.field_key}')">
        
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1 min-w-0">
            <div class="flex items-center space-x-2">
              <h4 class="font-heading text-sm font-bold text-[#171B20] truncate">${field.field_name}</h4>
              ${field.is_mandatory ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-[#F4F2EC] text-[#5A626A] font-mono border border-[#D8DAD6] flex-shrink-0">Mandatory</span>` : ''}
            </div>
            <p class="text-[11px] text-[#757E88] leading-tight">${field.legal_rule}</p>
          </div>

          <span class="px-2.5 py-1 text-[10px] font-bold rounded-full border ${badgeClass} flex items-center space-x-1 flex-shrink-0">
            <i data-lucide="${iconName}" class="w-3.5 h-3.5"></i>
            <span>${badgeText}</span>
          </span>
        </div>

        <div class="space-y-1 text-xs">
          <span class="text-[10px] text-[#757E88] uppercase font-mono">Detected Value:</span>
          <div class="p-2.5 rounded-xl bg-[#FCFBF9] border border-[#D8DAD6] font-mono text-xs ${field.extracted_value ? 'text-[#171B20] font-medium' : 'text-[#A8B5AE] italic'} break-words">
            ${field.extracted_value || "(Mandatory declaration missing from packaging)"}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#D8DAD6]">
          <div class="min-w-0">
            <span class="text-[#757E88]">Matched Synonym:</span>
            <p class="font-medium text-[#171B20] truncate">${field.matched_synonym || "—"}</p>
          </div>
          <div>
            <span class="text-[#757E88]">OCR Confidence:</span>
            <p class="font-medium text-[#16A34A] font-mono">${field.confidence_score ? (field.confidence_score * 100).toFixed(1) + '%' : '0.0%'}</p>
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-[#F4F2EC] border border-[#D8DAD6] space-y-1 text-xs">
          <div class="flex items-start space-x-1.5 text-[#171B20] text-[11px]">
            <span class="font-bold text-[#5A626A] flex-shrink-0">Finding:</span>
            <span class="break-words">${field.details}</span>
          </div>
          ${field.warning ? `
            <div class="flex items-start space-x-1.5 text-[#B45309] text-[11px]">
              <span class="font-bold flex-shrink-0">Advisory:</span>
              <span class="break-words">${field.warning}</span>
            </div>
          ` : ''}
        </div>

        ${hasBbox ? `
          <div class="flex items-center justify-end pt-1">
            <button onclick="focusFieldBox('${field.field_key}', ${field.image_index || 0})" type="button" class="text-[11px] text-[#F28B36] hover:text-[#D9711C] flex items-center space-x-1 transition-colors font-semibold">
              <i data-lucide="scan" class="w-3.5 h-3.5"></i>
              <span>Locate on Packaging</span>
            </button>
          </div>
        ` : ''}

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.onFieldCardHover = function(fieldKey) {
  const svgBox = document.getElementById(`svg-box-${fieldKey}`);
  if (svgBox) svgBox.classList.add('active-highlight');
};

window.onFieldCardLeave = function(fieldKey) {
  const svgBox = document.getElementById(`svg-box-${fieldKey}`);
  if (svgBox) svgBox.classList.remove('active-highlight');
};

window.focusFieldBox = function(fieldKey, imageIdx) {
  if (state.activeImageIndex !== imageIdx) {
    switchActiveImage(imageIdx);
  }

  setTimeout(() => {
    const svgBox = document.getElementById(`svg-box-${fieldKey}`);
    if (svgBox) {
      svgBox.classList.add('active-highlight');
      setTimeout(() => svgBox.classList.remove('active-highlight'), 3000);
    }

    const report = state.currentAnalysis ? state.currentAnalysis.compliance_report : null;
    const field = report ? (report.fields || []).find(f => f.field_key === fieldKey) : null;
    if (field) {
      showFieldInspector(field);
    }

    elements.displayPackagingImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 120);
};

function highlightFieldCard(fieldKey) {
  document.querySelectorAll('.field-card').forEach(c => c.classList.remove('active-card'));
  const card = document.getElementById(`field-card-${fieldKey}`);
  if (card) card.classList.add('active-card');
}

function toggleDetailedBreakdown() {
  document.getElementById('detailedAuditSection').scrollIntoView({ behavior: 'smooth' });
}
window.toggleDetailedBreakdown = toggleDetailedBreakdown;

// Modals
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}
window.openModal = openModal;

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}
window.closeModal = closeModal;

function addHistoryRecord(data) {
  const now = new Date();
  const timeStr = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const score = data.compliance_report.compliance_percentage;
  const status = data.compliance_report.overall_status;

  const itemHtml = `
    <div class="p-3 rounded-xl bg-[#FCFBF9] border border-[#D8DAD6] flex items-center justify-between">
      <div>
        <p class="font-bold text-[#171B20]">Inspection Session #${data.session_id}</p>
        <p class="text-[11px] text-[#757E88] font-mono">${timeStr} &bull; ${data.product_type}</p>
      </div>
      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${score >= 80 ? 'bg-[#DEF3E6] text-[#15803D]' : 'bg-[#FEE2E2] text-[#DC2626]'}">
        ${score}% ${status}
      </span>
    </div>
  `;
  elements.historyListContainer.innerHTML = itemHtml + elements.historyListContainer.innerHTML;
}

// Export PDF Report
async function downloadPdfReport() {
  if (!state.currentAnalysis) return;

  try {
    elements.downloadPdfBtn.disabled = true;
    elements.downloadPdfBtn.innerHTML = `<span>Exporting...</span>`;

    const res = await fetch(`${API_BASE}/api/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compliance_report: state.currentAnalysis.compliance_report
      })
    });

    if (!res.ok) throw new Error("Failed to generate PDF");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Legal_Metrology_Compliance_Report_${state.currentAnalysis.session_id || 'audit'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("PDF generation notice: " + err.message + "\n(Ensure backend is running on :8088)");
  } finally {
    elements.downloadPdfBtn.disabled = false;
    elements.downloadPdfBtn.innerHTML = `
      <i data-lucide="file-down" class="w-4 h-4"></i>
      <span>Export PDF Report</span>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

// Export JSON Report
function downloadJsonReport() {
  if (!state.currentAnalysis) return;
  const jsonStr = JSON.stringify(state.currentAnalysis, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Legal_Metrology_Compliance_${state.currentAnalysis.session_id || 'audit'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
