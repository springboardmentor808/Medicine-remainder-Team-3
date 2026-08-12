/**
 * Vital Med Tracker (PillSync) Application Logic
 * Clinical Minimalism & High Accessibility Medication Management
 */

// Initial Data State
const DEFAULT_MEDICATIONS = [
  {
    id: 'med-1',
    name: 'Amlodipine',
    dosage: '5mg',
    form: 'Tablet',
    frequency: 'Once Daily',
    timeOfDay: '9:00 PM (Night)',
    foodInstruction: 'Take after meal',
    pillsLeft: 4,
    totalPills: 30,
    prescribingDoc: 'Dr. Sarah Jenkins',
    condition: 'BP Management',
    status: 'low_stock',
    colorHex: '#00685f',
    iconName: 'medication'
  },
  {
    id: 'med-2',
    name: 'Lisinopril',
    dosage: '10mg',
    form: 'Tablet',
    frequency: 'Once Daily',
    timeOfDay: '8:00 AM (Morning)',
    foodInstruction: 'Take with water',
    pillsLeft: 22,
    totalPills: 30,
    prescribingDoc: 'Dr. Sarah Jenkins',
    condition: 'BP Management',
    status: 'normal',
    colorHex: '#006947',
    iconName: 'pill'
  },
  {
    id: 'med-3',
    name: 'Metformin',
    dosage: '500mg',
    form: 'Tablet',
    frequency: 'Twice Daily',
    timeOfDay: '1:00 PM (Afternoon) & 8:00 PM (Night)',
    foodInstruction: 'Take with food',
    pillsLeft: 45,
    totalPills: 60,
    prescribingDoc: 'Dr. Robert Vance',
    condition: 'Diabetes',
    status: 'normal',
    colorHex: '#855300',
    iconName: 'vaccines'
  },
  {
    id: 'med-4',
    name: 'Levothyroxine',
    dosage: '50mcg',
    form: 'Tablet',
    frequency: 'Once Daily',
    timeOfDay: '6:30 AM (Empty Stomach)',
    foodInstruction: '30 mins before breakfast',
    pillsLeft: 18,
    totalPills: 30,
    prescribingDoc: 'Dr. Elena Rostova',
    condition: 'Thyroid',
    status: 'normal',
    colorHex: '#2563eb',
    iconName: 'medical_services'
  }
];

const TODAY_SCHEDULE = [
  { id: 'sched-1', medId: 'med-2', name: 'Lisinopril 10mg', timeSlot: '8:00 AM • Morning', timeLog: 'Taken at 8:05 AM', status: 'taken' },
  { id: 'sched-2', medId: 'med-3', name: 'Metformin 500mg', timeSlot: '1:00 PM • Afternoon', timeLog: 'Taken at 1:12 PM', status: 'taken' },
  { id: 'sched-3', medId: 'med-1', name: 'Amlodipine 5mg', timeSlot: '9:00 PM • Night', timeLog: 'Upcoming', status: 'upcoming' }
];

const KNOWN_INTERACTIONS = [
  {
    pair: ['Amlodipine', 'Lisinopril'],
    severity: 'Moderate',
    description: 'Both medications lower blood pressure. Using them together is common in combination therapy, but monitor for symptoms of hypotension (dizziness, lightheadedness).'
  },
  {
    pair: ['Lisinopril', 'Potassium Supplement'],
    severity: 'High Warning',
    description: 'ACE inhibitors like Lisinopril can increase potassium levels in your blood. Taking potassium supplements may cause hyperkalemia.'
  },
  {
    pair: ['Metformin', 'Alcohol'],
    severity: 'High Warning',
    description: 'Consuming excessive alcohol with Metformin increases the risk of lactic acidosis and hypoglycemia.'
  }
];

class AppState {
  constructor() {
    this.medications = JSON.parse(localStorage.getItem('pillsync_meds')) || DEFAULT_MEDICATIONS;
    this.schedule = JSON.parse(localStorage.getItem('pillsync_sched')) || TODAY_SCHEDULE;
    this.streakDays = parseInt(localStorage.getItem('pillsync_streak')) || 12;
    this.adherenceRate = 92;
    this.dosesTakenToday = this.schedule.filter(s => s.status === 'taken').length;
    this.totalDosesToday = this.schedule.length;
  }

  save() {
    localStorage.setItem('pillsync_meds', JSON.stringify(this.medications));
    localStorage.setItem('pillsync_sched', JSON.stringify(this.schedule));
    localStorage.setItem('pillsync_streak', this.streakDays.toString());
  }

  addMedication(med) {
    this.medications.push(med);
    this.save();
  }

  takeDose(schedId) {
    const item = this.schedule.find(s => s.id === schedId);
    if (item && item.status !== 'taken') {
      item.status = 'taken';
      item.timeLog = `Taken at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      this.dosesTakenToday++;
      
      // Update pills left
      const med = this.medications.find(m => m.id === item.medId);
      if (med && med.pillsLeft > 0) {
        med.pillsLeft--;
        if (med.pillsLeft <= 5) med.status = 'low_stock';
      }
      this.save();
    }
  }

  refillMedication(medId) {
    const med = this.medications.find(m => m.id === medId);
    if (med) {
      med.pillsLeft = med.totalPills;
      med.status = 'normal';
      this.save();
    }
  }
}

const state = new AppState();

// UI Render Helpers
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDashboard();
  initCabinetView();
  initInteractionChecker();
  initScanner();
  initCaregiverView();
  initLiveChat();
  initModals();
  initSearch();
  updateClock();
  setInterval(updateClock, 30000);
});

function updateClock() {
  const dateEl = document.getElementById('current-date-text');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Toast Notifications
function showToast(message, icon = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Navigation Logic
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-item button');
  const sections = document.querySelectorAll('.view-section');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (!targetView) return;

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(sec => {
        if (sec.id === `view-${targetView}`) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });
    });
  });
}

// Dashboard View
function initDashboard() {
  renderDashboardTimeline();
  renderStats();

  const takeNowBtn = document.getElementById('btn-up-next-take');
  if (takeNowBtn) {
    takeNowBtn.addEventListener('click', () => {
      state.takeDose('sched-3');
      renderDashboardTimeline();
      renderStats();
      showToast('Amlodipine 5mg marked as taken!', 'check_circle');
      takeNowBtn.disabled = true;
      takeNowBtn.style.opacity = '0.6';
      takeNowBtn.innerHTML = `<span class="material-symbols-outlined">done</span> Completed`;
    });
  }

  const refillOrderBtn = document.getElementById('btn-order-refill-banner');
  if (refillOrderBtn) {
    refillOrderBtn.addEventListener('click', () => {
      state.refillMedication('med-1');
      const banner = document.getElementById('refill-alert-banner');
      if (banner) banner.style.display = 'none';
      renderCabinetGrid();
      showToast('Refill requested! 30 pills added to Amlodipine.', 'local_pharmacy');
    });
  }
}

function renderStats() {
  const dosesTakenEl = document.getElementById('stat-doses-taken');
  const streakEl = document.getElementById('stat-streak');
  const progressFill = document.getElementById('doses-progress-fill');

  if (dosesTakenEl) dosesTakenEl.textContent = `${state.dosesTakenToday} / ${state.totalDosesToday} taken`;
  if (streakEl) streakEl.textContent = `${state.streakDays} days`;
  if (progressFill) {
    const pct = Math.round((state.dosesTakenToday / state.totalDosesToday) * 100);
    progressFill.style.width = `${pct}%`;
  }
}

function renderDashboardTimeline() {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  container.innerHTML = '';
  state.schedule.forEach(item => {
    const div = document.createElement('div');
    div.className = `timeline-item ${item.status}`;
    div.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div>
          <div class="dose-time">${item.timeSlot}</div>
          <div class="dose-name">${item.name}</div>
        </div>
        <span class="status-chip ${item.status}">
          ${item.status === 'taken' ? '✓ ' + item.timeLog : item.status === 'upcoming' ? '⏳ Upcoming' : '⚠️ Missed'}
        </span>
      </div>
    `;
    container.appendChild(div);
  });
}

// Cabinet View
function initCabinetView() {
  renderCabinetGrid();

  const filterSelect = document.getElementById('cabinet-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      renderCabinetGrid(val);
    });
  }
}

function renderCabinetGrid(filter = 'all') {
  const grid = document.getElementById('cabinet-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const filtered = state.medications.filter(med => {
    if (filter === 'low_stock') return med.pillsLeft <= 5;
    if (filter === 'bp') return med.condition === 'BP Management';
    if (filter === 'diabetes') return med.condition === 'Diabetes';
    return true;
  });

  filtered.forEach(med => {
    const card = document.createElement('div');
    card.className = 'medicine-card';
    const isLow = med.pillsLeft <= 5;

    card.innerHTML = `
      <div class="med-card-top">
        <div class="med-icon-tag" style="background:${med.colorHex}15; color:${med.colorHex}">
          <span class="material-symbols-outlined">${med.iconName}</span>
        </div>
        <span class="status-chip ${isLow ? 'missed' : 'taken'}">
          ${isLow ? `⚠️ Low Stock (${med.pillsLeft} left)` : `✓ In Stock (${med.pillsLeft} left)`}
        </span>
      </div>
      <div class="med-title-group">
        <h3>${med.name} ${med.dosage}</h3>
        <p>${med.condition} • ${med.frequency}</p>
      </div>
      <div class="med-card-meta">
        <div class="meta-row">
          <span class="meta-label">Schedule</span>
          <span class="meta-val">${med.timeOfDay}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Instructions</span>
          <span class="meta-val">${med.foodInstruction}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Prescriber</span>
          <span class="meta-val">${med.prescribingDoc}</span>
        </div>
      </div>
      <div class="med-card-actions">
        <button class="btn-outline" onclick="openEditMedModal('${med.id}')">
          <span class="material-symbols-outlined" style="font-size:18px">edit</span> Details
        </button>
        <button class="btn-primary" onclick="refillMed('${med.id}')">
          <span class="material-symbols-outlined" style="font-size:18px">add_shopping_cart</span> Refill
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.refillMed = function(medId) {
  state.refillMedication(medId);
  renderCabinetGrid();
  renderStats();
  showToast('Refill processed successfully!', 'check_circle');
};

// Drug Interaction Checker
function initInteractionChecker() {
  const med1Select = document.getElementById('interact-med-1');
  const med2Select = document.getElementById('interact-med-2');
  const checkBtn = document.getElementById('btn-run-check');
  const resultBox = document.getElementById('interaction-result-box');

  if (!med1Select || !med2Select || !checkBtn) return;

  // Populate selects
  function populateSelects() {
    med1Select.innerHTML = '<option value="">Select Medication 1</option>';
    med2Select.innerHTML = '<option value="">Select Medication 2</option>';
    
    const allMeds = [...state.medications, { name: 'Potassium Supplement' }, { name: 'Alcohol' }, { name: 'Ibuprofen' }];
    allMeds.forEach(m => {
      med1Select.innerHTML += `<option value="${m.name}">${m.name}</option>`;
      med2Select.innerHTML += `<option value="${m.name}">${m.name}</option>`;
    });
  }
  populateSelects();

  checkBtn.addEventListener('click', () => {
    const val1 = med1Select.value;
    const val2 = med2Select.value;

    if (!val1 || !val2 || val1 === val2) {
      showToast('Please select two different medications to compare.', 'warning');
      return;
    }

    const match = KNOWN_INTERACTIONS.find(item => 
      (item.pair.includes(val1) && item.pair.includes(val2))
    );

    resultBox.style.display = 'block';
    if (match) {
      const isHigh = match.severity.includes('High');
      resultBox.innerHTML = `
        <div style="background:${isHigh ? '#ffdad6' : '#fffeed'}; border:1px solid ${isHigh ? '#ba1a1a' : '#f59e0b'}; padding:20px; border-radius:16px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <span class="material-symbols-outlined" style="color:${isHigh ? '#ba1a1a' : '#855300'}">warning</span>
            <h3 style="font-size:18px; font-weight:700; color:${isHigh ? '#ba1a1a' : '#855300'}">${match.severity} Interaction Detected</h3>
          </div>
          <p style="font-size:14px; color:#111c2d; line-height:1.6;">${match.description}</p>
        </div>
      `;
    } else {
      resultBox.innerHTML = `
        <div style="background:#e0f8ee; border:1px solid #006947; padding:20px; border-radius:16px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <span class="material-symbols-outlined" style="color:#006947">verified</span>
            <h3 style="font-size:18px; font-weight:700; color:#006947">No Major Clinical Interactions Found</h3>
          </div>
          <p style="font-size:14px; color:#111c2d;">No direct adverse drug-drug interactions recorded between ${val1} and ${val2}. Always consult your pharmacist for personalized guidance.</p>
        </div>
      `;
    }
  });
}

// Prescription Scanner Simulator
function initScanner() {
  const dropzone = document.getElementById('scanner-dropzone');
  const resultDiv = document.getElementById('scanner-result');
  const fileInput = document.getElementById('scanner-file-input');

  if (!dropzone) return;

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      simulateScan(fileInput.files[0].name);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.background = '#b2ede6';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.background = 'var(--primary-container)';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.background = 'var(--primary-container)';
    if (e.dataTransfer.files.length > 0) {
      simulateScan(e.dataTransfer.files[0].name);
    }
  });

  function simulateScan(fileName) {
    dropzone.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:40px; animation:spin 1s linear infinite; color:var(--primary)">sync</span>
      <p style="font-weight:700; margin-top:12px;">Scanning Rx Document (${fileName})...</p>
      <p style="font-size:12px; color:var(--on-surface-variant)">Extracting medication info using PillSync Vision OCR</p>
    `;

    setTimeout(() => {
      dropzone.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:48px; color:var(--tertiary)">verified</span>
        <p style="font-weight:700; font-size:16px; margin-top:8px;">Scan Complete!</p>
        <p style="font-size:13px; color:var(--on-surface-variant)">Click to scan another Rx</p>
      `;

      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `
        <div class="panel-card" style="margin-top:20px; border-color:var(--primary)">
          <h3 style="font-size:18px; font-weight:700; color:var(--primary); margin-bottom:12px;">Extracted Prescription Data</h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:14px; margin-bottom:20px;">
            <div><strong>Medication:</strong> Atorvastatin</div>
            <div><strong>Dosage:</strong> 20mg</div>
            <div><strong>Frequency:</strong> Once Daily at Bedtime</div>
            <div><strong>Refills:</strong> 3 Refills Authorized</div>
            <div><strong>Doctor:</strong> Dr. Michael Chang, MD</div>
            <div><strong>Rx #:</strong> 8492041-A</div>
          </div>
          <button class="btn-primary" style="width:100%" onclick="addScannedMed()">
            <span class="material-symbols-outlined">add_circle</span> Add Atorvastatin 20mg to Cabinet
          </button>
        </div>
      `;
    }, 1500);
  }
}

window.addScannedMed = function() {
  const newMed = {
    id: 'med-' + Date.now(),
    name: 'Atorvastatin',
    dosage: '20mg',
    form: 'Tablet',
    frequency: 'Once Daily',
    timeOfDay: '10:00 PM (Bedtime)',
    foodInstruction: 'Take with or without food',
    pillsLeft: 30,
    totalPills: 30,
    prescribingDoc: 'Dr. Michael Chang',
    condition: 'Cholesterol',
    status: 'normal',
    colorHex: '#00685f',
    iconName: 'medication'
  };
  state.addMedication(newMed);
  renderCabinetGrid();
  showToast('Atorvastatin 20mg added to Medicine Cabinet!', 'check_circle');
};

// Caregiver View
function initCaregiverView() {
  const notifyBtn = document.getElementById('btn-test-caregiver-alert');
  if (notifyBtn) {
    notifyBtn.addEventListener('click', () => {
      showToast('SMS Alert Sent to Caregiver (Michael Miller): "Alex Miller adherence OK"', 'send');
    });
  }
}

// Live Chat Simulator
function initLiveChat() {
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('btn-chat-send');
  const chatMessages = document.getElementById('chat-messages');

  if (!chatInput || !chatSendBtn || !chatMessages) return;

  function sendMessage() {
    const txt = chatInput.value.trim();
    if (!txt) return;

    // User Message
    const userMsg = document.createElement('div');
    userMsg.style.cssText = 'align-self:flex-end; background:var(--primary); color:white; padding:10px 16px; border-radius:16px 16px 2px 16px; max-width:80%; margin-bottom:12px; font-size:14px;';
    userMsg.textContent = txt;
    chatMessages.appendChild(userMsg);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Doctor Reply Simulation
    setTimeout(() => {
      const docMsg = document.createElement('div');
      docMsg.style.cssText = 'align-self:flex-start; background:var(--surface-container-low); color:var(--on-surface); padding:10px 16px; border-radius:16px 16px 16px 2px; max-width:80%; margin-bottom:12px; font-size:14px; border:1px solid var(--outline-variant);';
      docMsg.innerHTML = `<strong>Dr. Sarah Jenkins:</strong> Thank you for reaching out regarding "${txt}". Always ensure you take Amlodipine at night with plenty of water. Let me know if you experience any mild dizziness.`;
      chatMessages.appendChild(docMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
  }

  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

// Search Functionality
function initSearch() {
  const searchInput = document.getElementById('global-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return;

    // Filter medication cabinet
    renderCabinetGrid('all');
  });
}

// Modals
function initModals() {
  const addMedModal = document.getElementById('modal-add-med');
  const openAddBtn = document.getElementById('btn-open-add-med');
  const closeBtns = document.querySelectorAll('.modal-close');
  const form = document.getElementById('form-add-med');

  if (openAddBtn && addMedModal) {
    openAddBtn.addEventListener('click', () => {
      addMedModal.classList.add('active');
    });
  }

  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    });
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('input-med-name').value;
      const dosage = document.getElementById('input-med-dosage').value;
      const condition = document.getElementById('input-med-condition').value;
      const doc = document.getElementById('input-med-doc').value;
      const pills = parseInt(document.getElementById('input-med-pills').value) || 30;

      const newMed = {
        id: 'med-' + Date.now(),
        name,
        dosage,
        form: 'Tablet',
        frequency: 'Once Daily',
        timeOfDay: 'Morning',
        foodInstruction: 'With water',
        pillsLeft: pills,
        totalPills: pills,
        prescribingDoc: doc || 'Primary Physician',
        condition: condition || 'General Health',
        status: 'normal',
        colorHex: '#00685f',
        iconName: 'medication'
      };

      state.addMedication(newMed);
      renderCabinetGrid();
      addMedModal.classList.remove('active');
      form.reset();
      showToast(`${name} ${dosage} added to cabinet!`, 'check_circle');
    });
  }
}
