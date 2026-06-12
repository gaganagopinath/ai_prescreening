// js/app.js
// Orchestrates navigation, file upload parsing, scanning animations, settings modal updates, and ties everything together

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Controllers
  const avatar = new AIAvatarController();
  const interview = new InterviewSessionManager(avatar);
  const dashboard = new RecruiterDashboard();

  // Initialize DB and Preload Mocks
  StorageService.getCandidates(); // triggers prepopulating if empty
  dashboard.refresh();

  // Global variables
  let uploadedFileBlob = null;
  let uploadedFileName = '';
  let uploadedFileText = '';

  // DOM Elements - Navigation
  const navCandidate = document.getElementById('nav-btn-candidate');
  const navRecruiter = document.getElementById('nav-btn-recruiter');
  const viewCandidate = document.getElementById('candidate-portal');
  const viewRecruiter = document.getElementById('recruiter-portal');
  
  // DOM Elements - Settings Modal
  const settingsBtn = document.getElementById('nav-btn-settings');
  const settingsOverlay = document.getElementById('api-config-overlay');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const engineSwitch = document.getElementById('settings-engine-switch');
  const autoadvanceSwitch = document.getElementById('settings-autoadvance-switch');
  const geminiKeyGroup = document.getElementById('gemini-key-group');
  const settingsGeminiKey = document.getElementById('settings-gemini-key');
  const btnToggleKeyVis = document.getElementById('btn-toggle-key-visibility');
  const voiceRateInput = document.getElementById('settings-voice-rate');
  const voiceRateVal = document.getElementById('settings-voice-rate-val');
  const voiceLangSelect = document.getElementById('settings-voice-lang');

  // DOM Elements - Form Step 1
  const inputName = document.getElementById('candidate-name');
  const inputEmail = document.getElementById('candidate-email');
  const selectRole = document.getElementById('target-role');
  const dropZone = document.getElementById('resume-drop-zone');
  const fileInput = document.getElementById('resume-file-input');
  const fileContainer = document.getElementById('uploaded-file-container');
  const fileNameDisplay = document.getElementById('uploaded-file-name');
  const fileSizeDisplay = document.getElementById('uploaded-file-size');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const btnStartScreening = document.getElementById('btn-start-screening');

  // DOM Elements - Interview Controls
  const btnSubmitAnswer = document.getElementById('btn-submit-answer');
  const btnViewResults = document.getElementById('btn-view-results-dashboard');

  // --- PORTAL ROUTING / SWITCHING ---
  function switchView(target) {
    if (target === 'candidate') {
      navCandidate.classList.add('active');
      navRecruiter.classList.remove('active');
      viewCandidate.classList.add('active');
      viewRecruiter.classList.remove('active');
      
      // Reset candidate flow to step 1
      showCandidateStep('step-upload');
    } else {
      navCandidate.classList.remove('active');
      navRecruiter.classList.add('active');
      viewCandidate.classList.remove('active');
      viewRecruiter.classList.add('active');
      
      // Stop any active streams
      interview.stopAndSaveRecording();
      avatar.shutdown();
      
      // Refresh dashboard list/charts
      dashboard.refresh();
    }
  }

  navCandidate.addEventListener('click', () => switchView('candidate'));
  navRecruiter.addEventListener('click', () => switchView('recruiter'));
  if (btnViewResults) {
    btnViewResults.addEventListener('click', () => switchView('recruiter'));
  }

  // Helper to change wizard steps in Candidate Portal
  function showCandidateStep(stepId) {
    const steps = ['step-upload', 'step-processing', 'step-interview', 'step-completion'];
    steps.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === stepId) el.style.display = 'block';
        else el.style.display = 'none';
      }
    });
  }

  // --- SETTINGS CONTROLLER ---
  function loadSettingsIntoModal() {
    const settings = StorageService.getSettings();
    
    // Set Gemini mode
    if (settings.geminiMode) {
      engineSwitch.classList.add('checked');
      geminiKeyGroup.style.display = 'block';
    } else {
      engineSwitch.classList.remove('checked');
      geminiKeyGroup.style.display = 'none';
    }

    // Set Auto-advance mode
    if (settings.autoAdvance) {
      autoadvanceSwitch.classList.add('checked');
    } else {
      autoadvanceSwitch.classList.remove('checked');
    }

    settingsGeminiKey.value = settings.geminiKey || '';
    voiceRateInput.value = settings.voiceRate || 1.0;
    voiceRateVal.innerText = voiceRateInput.value;
    voiceLangSelect.value = settings.voiceLanguage || 'en-US';
  }

  settingsBtn.addEventListener('click', () => {
    loadSettingsIntoModal();
    settingsOverlay.style.display = 'flex';
    settingsOverlay.offsetHeight;
    settingsOverlay.classList.add('active');
  });

  const hideSettings = () => {
    settingsOverlay.classList.remove('active');
    setTimeout(() => {
      settingsOverlay.style.display = 'none';
    }, 300);
  };

  btnCloseSettings.addEventListener('click', hideSettings);
  btnCancelSettings.addEventListener('click', hideSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) hideSettings();
  });

  // Toggle API engine selector switch
  engineSwitch.addEventListener('click', () => {
    const isChecked = engineSwitch.classList.toggle('checked');
    geminiKeyGroup.style.display = isChecked ? 'block' : 'none';
  });

  // Toggle auto-advance switch
  autoadvanceSwitch.addEventListener('click', () => {
    autoadvanceSwitch.classList.toggle('checked');
  });

  // Speak rate slider interaction
  voiceRateInput.addEventListener('input', () => {
    voiceRateVal.innerText = voiceRateInput.value;
  });

  // API key eye toggle
  btnToggleKeyVis.addEventListener('click', () => {
    const type = settingsGeminiKey.getAttribute('type') === 'password' ? 'text' : 'password';
    settingsGeminiKey.setAttribute('type', type);
    btnToggleKeyVis.querySelector('i').classList.toggle('fa-eye');
    btnToggleKeyVis.querySelector('i').classList.toggle('fa-eye-slash');
  });

  // Save Settings click
  btnSaveSettings.addEventListener('click', () => {
    const settings = {
      geminiMode: engineSwitch.classList.contains('checked'),
      geminiKey: settingsGeminiKey.value.trim(),
      voiceLanguage: voiceLangSelect.value,
      voiceRate: parseFloat(voiceRateInput.value),
      autoAdvance: autoadvanceSwitch.classList.contains('checked')
    };

    StorageService.saveSettings(settings);
    
    // Apply changes to live avatar settings
    avatar.voiceLanguage = settings.voiceLanguage;
    avatar.voiceRate = settings.voiceRate;
    if (avatar.recognition) {
      avatar.recognition.lang = settings.voiceLanguage;
    }

    hideSettings();
  });


  // --- FILE UPLOADER & FORM INPUT CONTROLS ---

  // Trigger file browser on click
  dropZone.addEventListener('click', () => fileInput.click());

  // Input triggers validation
  const validateStartForm = () => {
    const nameVal = inputName.value.trim();
    const emailVal = inputEmail.value.trim();
    // Allow proceeding without a resume file; just require name and email
    btnStartScreening.disabled = !(nameVal && emailVal);
  };

  inputName.addEventListener('input', validateStartForm);
  inputEmail.addEventListener('input', validateStartForm);

  // Drag over effects
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  // Handle click browse selection
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  // Remove File pill click
  btnRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadedFileBlob = null;
    uploadedFileName = '';
    uploadedFileText = '';
    fileInput.value = '';
    
    fileContainer.classList.remove('active');
    dropZone.style.display = 'block';
    validateStartForm();
  });

  function handleFileSelected(file) {
    uploadedFileBlob = file;
    uploadedFileName = file.name;

    // Set file size
    let sz = `${(file.size / 1024).toFixed(0)} KB`;
    if (file.size > 1024 * 1024) {
      sz = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    }
    
    fileNameDisplay.innerText = file.name;
    fileSizeDisplay.innerText = sz;

    // Display PDF icon or Word icon
    const icon = fileContainer.querySelector('.file-pill-icon');
    if (file.name.endsWith('.pdf')) {
      icon.className = 'fa-solid fa-file-pdf file-pill-icon';
      icon.style.color = 'var(--color-error)';
    } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      icon.className = 'fa-solid fa-file-word file-pill-icon';
      icon.style.color = '#3b82f6';
    } else {
      icon.className = 'fa-solid fa-file-lines file-pill-icon';
      icon.style.color = 'var(--color-text-secondary)';
    }

    // Hide upload zone, show pill
    dropZone.style.display = 'none';
    fileContainer.classList.add('active');

    // Parse Text content if txt, else build simulated text placeholder
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedFileText = e.target.result;
        validateStartForm();
      };
      reader.readAsText(file);
    } else {
      // Simulate binary text extraction based on profile metadata
      uploadedFileText = ''; // compiled on start
      validateStartForm();
    }
  }


  // --- INTERVIEW FLOW KICKOFF ---

  btnStartScreening.addEventListener('click', async () => {
    const name = inputName.value.trim();
    const email = inputEmail.value.trim();
    const role = selectRole.value;

    // If PDF/DOCX was uploaded, compile dynamic simulated text based on their targeted position
    if (!uploadedFileText) {
      uploadedFileText = `${name}\nEmail: ${email}\nPosition Targeted: ${role}\nExperience: 5 years of professional experience in development and system engineering environments.\nSkills: Highly proficient in core standards, visual layouts, and collaboration tools.\nEducation: BS in Computer Applications.`;
    }

    // Switch view to Step 2: Processing screen
    showCandidateStep('step-processing');

    const logsBox = document.getElementById('processing-logs-box');
    const fill = document.getElementById('processing-progress-fill');
    
    logsBox.innerHTML = '<div class="log-entry">Opening resume file stream...</div>';
    fill.style.width = '10%';

    const runLog = (msg, pct, delay) => {
      return new Promise(resolve => {
        setTimeout(() => {
          logsBox.innerHTML += `<div class="log-entry">${msg}</div>`;
          logsBox.scrollTop = logsBox.scrollHeight;
          fill.style.width = `${pct}%`;
          resolve();
        }, delay);
      });
    };

    // Step-by-step scanner visual log timeline
    await runLog("Verifying integrity headers...", 30, 800);
    await runLog("Extracting raw resume text...", 55, 600);
    await runLog("Scanning experience blocks & credential tokens...", 70, 700);
    
    // Initialize interview variables and questions (Simulated or Gemini)
    await interview.initializeSession(name, email, role, uploadedFileName, uploadedFileText);
    
    await runLog("Compiling customized behavioral screening tasks...", 90, 800);
    await runLog("Initiating AI holographic avatar interface...", 100, 500);

    setTimeout(() => {
      // Transition to Step 3: Interview Room
      showCandidateStep('step-interview');
      interview.beginInterview();
    }, 400);
  });

  // Submit Answer timeline
  if (btnSubmitAnswer) {
    btnSubmitAnswer.addEventListener('click', () => {
      interview.submitAnswer();
    });
  }

  // Keyboard shortcut: Ctrl + Enter triggers submit answer
  document.addEventListener('keydown', (e) => {
    const stepInterview = document.getElementById('step-interview');
    const isActive = stepInterview && stepInterview.style.display === 'block';
    
    if (isActive && e.ctrlKey && e.key === 'Enter') {
      const val = document.getElementById('candidate-response-text').value.trim();
      if (val && !btnSubmitAnswer.disabled) {
        interview.submitAnswer();
      }
    }
  });

});
