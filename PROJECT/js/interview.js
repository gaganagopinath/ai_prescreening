// js/interview.js
// Manages the candidate interview, media capture, and server-backed AI evaluation.

class InterviewSessionManager {
  constructor(avatarController) {
    this.avatar = avatarController;
    
    // State variables
    this.candidateId = '';
    this.candidateName = '';
    this.candidateEmail = '';
    this.targetRole = '';
    this.resumeFileName = '';
    this.resumeText = '';
    
    this.currentQuestionIndex = 0; // 0 = self intro, 1+ = custom questions
    this.questionsList = [];
    this.transcript = [];
    this.evaluationRetryPending = false;
    this.sessionDuration = 0; // seconds
    this.durationInterval = null;
    
    // Media objects
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.audioContext = null;
    this.analyser = null;
    this.canvasContext = null;
    this.animationFrameId = null;

    // DOM Elements
    this.videoElement = document.getElementById('webcam-stream');
    this.canvasElement = document.getElementById('soundwave-canvas');
    this.questionDisplay = document.getElementById('interview-question-display');
    this.inputTextarea = document.getElementById('candidate-response-text');
    this.btnSubmit = document.getElementById('btn-submit-answer');
    this.progressCounter = document.getElementById('interview-progress-counter');
    this.micBtn = document.getElementById('btn-mic-toggle');

    this.initEventListeners();
  }

  initEventListeners() {
    // Microphone click
    if (this.micBtn) {
      this.micBtn.addEventListener('click', () => this.handleMicToggle());
    }

    // Input monitoring to enable submit button
    if (this.inputTextarea) {
      this.inputTextarea.addEventListener('input', () => {
        if (this.btnSubmit) {
          this.btnSubmit.disabled = this.inputTextarea.value.trim().length === 0;
        }
      });
    }

    // Camera request fallback
    const btnRequestCam = document.getElementById('btn-request-cam');
    if (btnRequestCam) {
      btnRequestCam.addEventListener('click', () => this.setupWebcam());
    }
  }

  async requestAI(path, body) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'The AI service is unavailable. Please try again.');
    return data;
  }

  // Set up webcam stream & micro
  async setupWebcam() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 400 },
        audio: true
      });
      
      if (this.videoElement) {
        this.videoElement.srcObject = this.mediaStream;
        document.getElementById('webcam-fallback').style.display = 'none';
        
        const webcamCard = document.getElementById('candidate-webcam-card');
        if (webcamCard) webcamCard.classList.add('recording');
        
        const recIndicator = document.getElementById('rec-indicator');
        if (recIndicator) recIndicator.style.display = 'flex';
      }

      this.setupAudioWave();
      this.startRecording();
    } catch (err) {
      console.warn("Could not access camera/mic:", err);
      document.getElementById('webcam-fallback').style.display = 'flex';
      // Proceed text-only fallback gracefully
    }
  }

  // Setup sound wave visualizations
  setupAudioWave() {
    if (!this.mediaStream || !this.canvasElement) return;

    this.canvasContext = this.canvasElement.getContext('2d');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      this.animationFrameId = requestAnimationFrame(draw);
      
      const width = this.canvasElement.width = this.canvasElement.offsetWidth;
      const height = this.canvasElement.height = this.canvasElement.offsetHeight;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      this.canvasContext.clearRect(0, 0, width, height);
      
      // Draw neon wave bar indicators
      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height * 0.8;
        
        // Premium gradient for voice waves
        const grad = this.canvasContext.createLinearGradient(0, height, 0, height - barHeight);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0.05)');
        grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.4)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0.9)');
        
        this.canvasContext.fillStyle = grad;
        this.canvasContext.fillRect(x, height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }
    };

    draw();
  }

  // Start media recording in background
  startRecording() {
    if (!this.mediaStream) return;
    
    this.recordedChunks = [];
    try {
      // Prefer WebM for browser compatibility
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = ''; // Let browser decide defaults
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(1000); // chunk slice every second
    } catch (e) {
      console.warn("MediaRecorder start failed:", e);
    }
  }

  // Stop media recording and save to IndexedDB
  async stopAndSaveRecording() {
    if (this.durationInterval) clearInterval(this.durationInterval);
    
    // Stop audio context
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Stop all media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    const webcamCard = document.getElementById('candidate-webcam-card');
    if (webcamCard) webcamCard.classList.remove('recording');
    const recIndicator = document.getElementById('rec-indicator');
    if (recIndicator) recIndicator.style.display = 'none';

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return new Promise((resolve) => {
        this.mediaRecorder.onstop = async () => {
          if (this.recordedChunks.length > 0) {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            try {
              await StorageService.dbService.saveRecording(this.candidateId, blob);
              console.log('Saved media recording successfully in IndexedDB.');
            } catch (err) {
              console.error('Failed saving video in DB:', err);
            }
          }
          resolve();
        };
        this.mediaRecorder.stop();
      });
    }
  }

  // Toggle Speech Recognition
  handleMicToggle() {
    this.avatar.toggleListening(
      (finalText, interimText) => {
        // Handle STT results
        if (this.inputTextarea) {
          // If we have some final text, append it
          if (finalText) {
            const currentText = this.inputTextarea.value.trim();
            this.inputTextarea.value = (currentText ? currentText + ' ' : '') + finalText;
          }
          // Enable submit if textarea has content
          if (this.btnSubmit) {
            this.btnSubmit.disabled = this.inputTextarea.value.trim().length === 0;
          }
        }
      },
      (error) => {
        console.error('Mic recognition error:', error);
      }
    );
  }

  // Setup interview details
  async initializeSession(name, email, role, resumeName, resumeText) {
    this.candidateId = 'cand_' + Date.now();
    this.candidateName = name;
    this.candidateEmail = email;
    this.targetRole = role;
    this.resumeFileName = resumeName;
    this.resumeText = resumeText || `Candidate uploaded: ${resumeName}. Applied for ${role}.`;
    const { analysis } = await this.requestAI('/api/ai/analysis', {
      candidateName: name,
      role,
      resumeText: this.resumeText
    });
    this.resumeAnalysis = analysis;
    
    this.currentQuestionIndex = 0;
    this.questionsList = [];
    this.transcript = [];
    this.sessionDuration = 0;
    
    // Save resume to DB in background
    try {
      await StorageService.dbService.saveResume(this.candidateId, this.resumeText, resumeName, 'text/plain');
    } catch (err) {
      console.warn("Storage warning for resume upload:", err);
    }

    this.renderResumeAnalysis();
    
    // Compile Questions List
    await this.generateQuestions();

    // Start clock timer
    this.durationInterval = setInterval(() => {
      this.sessionDuration++;
    }, 1000);
  }

  renderResumeAnalysis() {
    const summary = this.resumeAnalysis || {};
    const skillEl = document.getElementById('analysis-skills');
    const experienceEl = document.getElementById('analysis-experience');
    const educationEl = document.getElementById('analysis-education');
    const focusEl = document.getElementById('analysis-focus');

    if (skillEl) skillEl.innerText = (summary.skills || []).slice(0, 4).join(', ') || 'Resume insights ready';
    if (experienceEl) experienceEl.innerText = summary.experience || 'Profile reviewed';
    if (educationEl) educationEl.innerText = summary.education || 'Background assessed';
    if (focusEl) focusEl.innerText = (summary.focusAreas || []).slice(0, 3).join(' • ') || 'Role fit assessment';
  }

  // Generate customized questions based on resume & role
  async generateQuestions() {
    const logsBox = document.getElementById('processing-logs-box');
    if (logsBox) logsBox.innerHTML += '<div class="log-entry">Preparing personalized interview questions...</div>';
    const { questions } = await this.requestAI('/api/ai/questions', {
      candidateName: this.candidateName,
      role: this.targetRole,
      resumeText: this.resumeText
    });
    this.questionsList = questions;
    if (logsBox) logsBox.innerHTML += `<div class="log-entry complete">Prepared ${questions.length} personalized questions.</div>`;
  }

  // Start the interview room dialogue loop
  async beginInterview() {
    this.currentQuestionIndex = 0;
    
    // Setup camera
    await this.setupWebcam();

    // AI Greeting Speech
    const greetingText = `Hello ${this.candidateName}, thank you for joining this session. I am your pre-screening interviewer. I have parsed your resume for the ${this.targetRole} role. To begin, please introduce yourself and summarize your professional background. When you are finished, click the submit button.`;
    
    if (this.questionDisplay) {
      this.questionDisplay.innerText = greetingText;
    }
    if (this.progressCounter) {
      this.progressCounter.innerText = "Candidate Self-Introduction";
    }

    this.avatar.speak(greetingText);
  }

  // Submit current answer and move forward
  async submitAnswer() {
    if (this.evaluationRetryPending) {
      this.evaluationRetryPending = false;
      await this.finishInterview();
      return;
    }

    if (this.avatar.isListening) {
      this.avatar.recognition.stop();
    }

    const candidateAnswerText = this.inputTextarea.value.trim();
    if (!candidateAnswerText) return;

    // Disable button during processing
    if (this.btnSubmit) this.btnSubmit.disabled = true;
    this.avatar.setVisualState('thinking');

    // Save current transcript item
    if (this.currentQuestionIndex === 0) {
      // Self intro
      this.transcript.push({
        questionNum: 1,
        question: "Please introduce yourself and summarize your professional background.",
        answer: candidateAnswerText,
        score: null,
        evaluation: ''
      });
    } else {
      // Custom questions
      this.transcript.push({
        questionNum: this.currentQuestionIndex + 1,
        question: this.questionsList[this.currentQuestionIndex - 1],
        answer: candidateAnswerText,
        score: null,
        evaluation: ''
      });
    }

    // Reset textarea
    this.inputTextarea.value = '';

    // Move state
    this.currentQuestionIndex++;

    if (this.currentQuestionIndex <= this.questionsList.length) {
      // Next Question
      const nextQuestion = this.questionsList[this.currentQuestionIndex - 1];
      
      if (this.questionDisplay) {
        this.questionDisplay.innerText = nextQuestion;
      }
      if (this.progressCounter) {
        this.progressCounter.innerText = `Question ${this.currentQuestionIndex} of ${this.questionsList.length}`;
      }

      await this.avatar.speak(nextQuestion, () => {
        // Auto start listening on setting if autoAdvance enabled
        const settings = StorageService.getSettings();
        if (settings.autoAdvance && this.avatar.recognition) {
          setTimeout(() => {
            if (!this.avatar.isListening) this.handleMicToggle();
          }, 1000);
        }
      });

    } else {
      // Interview completed! Run evaluation and close.
      await this.finishInterview();
    }
  }

  // Evaluate candidate answers & generate report card
  async finishInterview() {
    this.avatar.setVisualState('thinking');
    if (this.questionDisplay) {
      this.questionDisplay.innerText = "Processing evaluations. Please do not close the window...";
    }

    // Stop recording and save stream
    await this.stopAndSaveRecording();

    let result;
    try {
      result = await this.requestAI('/api/ai/evaluation', {
        candidateName: this.candidateName,
        role: this.targetRole,
        resumeText: this.resumeText,
        transcript: this.transcript
      });
    } catch (error) {
      if (this.questionDisplay) this.questionDisplay.innerText = error.message;
      this.avatar.setVisualState('idle');
      this.evaluationRetryPending = true;
      if (this.btnSubmit) this.btnSubmit.disabled = false;
      const retryIcon = this.btnSubmit?.querySelector('i');
      if (retryIcon) retryIcon.className = 'fa-solid fa-rotate-right';
      if (this.btnSubmit) this.btnSubmit.firstChild.textContent = ' Retry evaluation ';
      window.showAppMessage?.(error.message, 'error', 6000);
      return;
    }

    if (this.btnSubmit) this.btnSubmit.innerHTML = 'Submit <i class="fa-solid fa-chevron-right"></i>';

    const overallScore = Math.max(0, Math.min(10, result.overallScore));
    const performanceSummary = result.overallSummary;
    result.evaluations.forEach((evaluation, index) => {
      this.transcript[index].score = Math.max(0, Math.min(10, evaluation.score));
      this.transcript[index].evaluation = evaluation.feedback;
    });

    // Structure Candidate Object
    const pad = (n) => n < 10 ? '0' + n : n;
    const durM = Math.floor(this.sessionDuration / 60);
    const durS = this.sessionDuration % 60;
    
    const candidateRecord = {
      id: this.candidateId,
      name: this.candidateName,
      email: this.candidateEmail,
      role: this.targetRole,
      appliedDate: new Date().toISOString(),
      resumeText: this.resumeText,
      overallScore: Number(overallScore.toFixed(1)),
      summary: performanceSummary,
      duration: `${pad(durM)}m ${pad(durS)}s`,
      status: 'completed',
      isMock: false,
      transcript: this.transcript
    };

    // Save in LocalStorage
    StorageService.saveCandidate(candidateRecord);

    // Switch View to Completed
    document.getElementById('step-interview').classList.remove('active');
    document.getElementById('step-completion').classList.add('active');
    
    // Display results preview
    document.getElementById('comp-candidate-name').innerText = this.candidateName;
    document.getElementById('comp-overall-score').innerText = `${candidateRecord.overallScore} / 10`;

    // Trigger Success smile
    this.avatar.setVisualState('smiling');
    await this.avatar.speak(`Excellent, ${this.candidateName}! You have successfully completed the pre-screening. Your profile and metrics are recorded. Thank you for your time.`);
  }

}

window.InterviewSessionManager = InterviewSessionManager;
