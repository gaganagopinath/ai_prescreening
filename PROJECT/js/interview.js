// js/interview.js
// Manages the candidate interview steps, webcam, audio wave drawing, recording, and evaluation algorithms (Simulated / Gemini API)

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
    this.resumeAnalysis = window.MockAIService ? window.MockAIService.analyzeResume(name, role, this.resumeText) : {
      skills: ['Resume analysis ready'],
      experience: 'Profile reviewed',
      education: 'Degree and experience assessed',
      projects: 'Portfolio reviewed',
      focusAreas: ['Role fit', 'Problem solving', 'Communication']
    };
    
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
    const settings = StorageService.getSettings();
    
    if (settings.geminiMode && settings.geminiKey) {
      document.getElementById('processing-logs-box').innerHTML += '<div class="log-entry">Connecting to Gemini Live API...</div>';
      try {
        const questions = await this.callGeminiForQuestions(settings.geminiKey);
        this.questionsList = questions;
        document.getElementById('processing-logs-box').innerHTML += `<div class="log-entry complete">Gemini generated ${questions.length} customized questions!</div>`;
        return;
      } catch (err) {
        console.error("Gemini Qs generation failed, switching to local simulator:", err);
        document.getElementById('processing-logs-box').innerHTML += '<div class="log-entry" style="color: var(--color-error);">Gemini connection failed. Deploying High-Fidelity local simulator...</div>';
      }
    }
    
    // Local simulator mode fallback
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate thinking delay
    this.questionsList = window.MockAIService && window.MockAIService.generateQuestions
      ? window.MockAIService.generateQuestions(this.targetRole, this.resumeText)
      : this.getSimulatedQuestions(this.targetRole, this.resumeText);
    document.getElementById('processing-logs-box').innerHTML += `<div class="log-entry complete">Local AI engine generated ${this.questionsList.length} customized questions based on resume.</div>`;
  }

  // Local simulated questions logic
  getSimulatedQuestions(role, text) {
    const normalizedText = text.toLowerCase();
    
    // Default pools based on target roles
    const engineeringPool = [
      "Explain your experience with modern frameworks. In your resume, you highlighted skills relevant to code architectures. How do you approach scalability?",
      "How do you handle debugging issues when working with high concurrency or visual layout layers?",
      "Describe your standard Git workflow and test automation routine before deploying a script to production."
    ];

    const designPool = [
      "In your resume, you listed design prototyping. How do you integrate user research insights directly into your early sketches and wireframes?",
      "Can you walk us through how you collaborate with developers to make sure design tokens, colors, and layout ratios translate perfectly in production?",
      "Explain your approach to implementing accessibility standards in your design systems."
    ];

    const managementPool = [
      "Roadmap prioritization is a key challenge. How do you resolve conflicts when engineering limits conflict with urgent stakeholder requests?",
      "Tell us about a time you analyzed user funnel analytics (e.g., in dashboards) and discovered a pain point. What steps did you take to fix it?",
      "Explain your process for defining and tracking KPIs for a newly released workflow feature."
    ];

    const analystPool = [
      "When working with dirty or raw data sets, what is your standard cleaning and pipeline routing process?",
      "How do you communicate complicated statistical findings to business executives who lack technical analytical training?",
      "Describe a time you used predictive modeling or SQL aggregate operations to solve a complex business forecasting challenge."
    ];

    // Pick pool
    let pool = engineeringPool;
    if (role.includes('Designer') || role.includes('UX')) pool = designPool;
    else if (role.includes('Product') || role.includes('Manager')) pool = managementPool;
    else if (role.includes('Analyst') || role.includes('Data')) pool = analystPool;

    // We customize the questions dynamically with parsed elements from their resume text
    const customized = [];
    
    // Try to extract skills
    const possibleSkills = ['react', 'vue', 'angular', 'node', 'typescript', 'figma', 'sketch', 'agile', 'scrum', 'sql', 'python', 'excel', 'tableau', 'jira', 'next.js', 'css'];
    const foundSkills = possibleSkills.filter(s => normalizedText.includes(s));
    const skillText = foundSkills.length > 0 ? foundSkills.slice(0, 2).map(s => s.toUpperCase()).join(" and ") : "your technical stack";

    // Custom question 1
    customized.push(`Looking at your resume, you have experience in ${skillText}. Could you tell us about a complex project where you applied these skills to achieve a major result?`);
    
    // General question 2 & 3
    customized.push(pool[1]);
    customized.push(pool[2]);

    return customized;
  }

  // LLM API Call for Questions
  async classCallGemini(key, endpoint, payload) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`API status ${response.status}`);
    return await response.json();
  }

  async callGeminiForQuestions(apiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `You are a professional recruitment coordinator. I am conducting a pre-screening interview for a Candidate named "${this.candidateName}" applying for the role of "${this.targetRole}".
Their resume text is:
"""
${this.resumeText}
"""

Please analyze their resume and generate exactly 3 customized, high-quality interview questions.
- Question 1 MUST directly reference a specific skill, company, or achievement mentioned in their resume.
- Question 2 should focus on a core technical/conceptual challenge for the "${this.targetRole}" position.
- Question 3 should evaluate situational decision-making or team collaboration.

You MUST respond ONLY with a valid JSON array of strings containing these 3 questions, with no markdown code blocks or additional text. Example:
["Question 1", "Question 2", "Question 3"]`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3
      }
    };

    const data = await this.classCallGemini(apiKey, endpoint, payload);
    const textResponse = data.candidates[0].content.parts[0].text;
    
    // Clean JSON wrapper if any
    const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.slice(0, 3);
    }
    throw new Error("Invalid response shape");
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

    // Compile evaluation scores
    const settings = StorageService.getSettings();
    let overallScore = 0;
    let performanceSummary = '';

    if (settings.geminiMode && settings.geminiKey) {
      try {
        const result = await this.callGeminiForEvaluation(settings.geminiKey);
        overallScore = result.overallScore;
        performanceSummary = result.overallSummary;
        
        // Map scores back to transcript
        for (let i = 0; i < this.transcript.length; i++) {
          if (result.evaluations && result.evaluations[i]) {
            this.transcript[i].score = result.evaluations[i].score;
            this.transcript[i].evaluation = result.evaluations[i].feedback;
          } else {
            // fallback for missing items
            this.assignLocalGradeForItem(this.transcript[i]);
          }
        }
      } catch (err) {
        console.error("Gemini evaluation failed, grading locally:", err);
        // Fallback to local grader
        const localResults = this.gradeLocally();
        overallScore = localResults.overallScore;
        performanceSummary = localResults.summary;
      }
    } else {
      // Simulated Mode
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulation delay
      const localResults = this.gradeLocally();
      overallScore = localResults.overallScore;
      performanceSummary = localResults.summary;
    }

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

  // Local Grader algorithm
  gradeLocally() {
    let totalScore = 0;
    
    this.transcript.forEach((item) => {
      this.assignLocalGradeForItem(item);
      totalScore += item.score;
    });

    const average = totalScore / this.transcript.length;
    const rounded = Number(average.toFixed(1));

    const serviceSummary = window.MockAIService && window.MockAIService.summarizePerformance
      ? window.MockAIService.summarizePerformance(this.candidateName, this.targetRole, this.transcript)
      : `${this.candidateName} completed the screening with a score of ${rounded}/10 for the ${this.targetRole} position.`;

    return {
      overallScore: rounded,
      summary: serviceSummary
    };
  }

  // Grade individual answer locally
  assignLocalGradeForItem(item) {
    const evaluation = window.MockAIService && window.MockAIService.evaluateAnswer
      ? window.MockAIService.evaluateAnswer(item.question, item.answer)
      : {
          score: 6.5,
          relevance: 6.5,
          technicalDepth: 6.5,
          communication: 6.5,
          feedback: 'Answer is acceptable but could be stronger with more detail.'
        };

    item.score = Number(Math.min(10, evaluation.score).toFixed(1));
    item.evaluation = evaluation.feedback;
    item.relevance = evaluation.relevance;
    item.technicalDepth = evaluation.technicalDepth;
    item.communication = evaluation.communication;
  }

  // LLM API Call for grading
  async callGeminiForEvaluation(apiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // Build QA transcript string
    let transcriptBlock = '';
    this.transcript.forEach((t, i) => {
      transcriptBlock += `Q${t.questionNum}: ${t.question}\nA: ${t.answer}\n\n`;
    });

    const prompt = `You are a Senior Recruiter and Hiring Manager evaluating candidate responses to a pre-screening interview for the role of "${this.targetRole}".
The candidate's resume is:
"""
${this.resumeText}
"""

Here is the dialogue transcript:
"""
${transcriptBlock}
"""

Please grade their answers. You must rate each answer out of 10.0, write constructive feedback, generate a total overall score out of 10.0, and write a detailed performance summary of the candidate's capabilities.
Return ONLY a valid JSON object matching the following structure exactly, with no markdown wrapping or additional text:
{
  "evaluations": [
    {
      "questionNum": 1,
      "score": 8.5,
      "feedback": "Feedback for question 1"
    },
    {
      "questionNum": 2,
      "score": 7.0,
      "feedback": "Feedback for question 2"
    },
    {
      "questionNum": 3,
      "score": 9.0,
      "feedback": "Feedback for question 3"
    },
    {
      "questionNum": 4,
      "score": 8.0,
      "feedback": "Feedback for question 4"
    }
  ],
  "overallScore": 8.1,
  "overallSummary": "A summary of strengths and areas for improvement."
}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    };

    const data = await this.classCallGemini(apiKey, endpoint, payload);
    const textResponse = data.candidates[0].content.parts[0].text;
    const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  }
}

window.InterviewSessionManager = InterviewSessionManager;
