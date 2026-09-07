// js/avatar.js
// Handles visual SVG avatar states, animations, Text-To-Speech (TTS), and Speech-To-Text (STT)

class AIAvatarController {
  constructor() {
    // DOM Elements
    this.svg = document.getElementById('avatar-svg');
    this.mouth = document.getElementById('avatar-mouth');
    this.eyeLeft = document.getElementById('avatar-eye-left')?.querySelector('ellipse');
    this.eyeRight = document.getElementById('avatar-eye-right')?.querySelector('ellipse');
    this.browLeft = document.getElementById('avatar-brow-left');
    this.browRight = document.getElementById('avatar-brow-right');
    
    this.statusDot = document.getElementById('ai-status-dot');
    this.statusText = document.getElementById('ai-status-text');

    // Speech synthesis & recognition
    this.synth = window.speechSynthesis;
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    
    // Animation timers
    this.blinkTimer = null;
    this.speakInterval = null;
    this.soundwaveTimer = null;

    // TTS Settings defaults
    this.voiceLanguage = 'en-US';
    this.voiceRate = 1.0;

    // Start idle animations
    this.initIdleLoop();
    this.initSpeechRecognition();
  }

  // Set visual states: 'idle', 'thinking', 'listening', 'speaking', 'smiling'
  setVisualState(state) {
    if (!this.statusDot || !this.statusText) return;

    // Reset indicator classes
    this.statusDot.className = 'status-dot';
    
    // Stop speaking mouth loop if changing state from speaking
    if (state !== 'speaking' && this.isSpeaking) {
      this.stopSpeakingAnimation();
    }

    switch(state) {
      case 'idle':
        this.statusDot.classList.add('idle');
        this.statusText.innerText = 'Interviewer is Idle';
        this.setFacialExpression('idle');
        break;
      case 'thinking':
        this.statusDot.classList.add('thinking');
        this.statusText.innerText = 'AI is Thinking...';
        this.setFacialExpression('thinking');
        break;
      case 'listening':
        this.statusDot.classList.add('listening');
        this.statusText.innerText = 'AI is Listening...';
        this.setFacialExpression('listening');
        break;
      case 'speaking':
        this.statusDot.classList.add('speaking');
        this.statusText.innerText = 'AI is Speaking';
        this.setFacialExpression('speaking');
        this.startSpeakingAnimation();
        break;
      case 'smiling':
        this.statusDot.classList.add('speaking');
        this.statusText.innerText = 'Interview Completed';
        this.setFacialExpression('smiling');
        break;
    }
  }

  // Morph SVG Face paths
  setFacialExpression(expression) {
    if (!this.mouth) return;

    // Define shapes
    const shapes = {
      idle: {
        mouth: "M 80 125 Q 100 125 120 125",
        browL: "M 65 78 Q 75 78 85 81",
        browR: "M 135 78 Q 125 78 115 81",
        eyeY: 8
      },
      thinking: {
        mouth: "M 80 128 Q 100 120 120 128",
        browL: "M 65 80 Q 75 74 85 76",
        browR: "M 135 76 Q 125 74 115 80",
        eyeY: 7
      },
      listening: {
        mouth: "M 80 125 Q 100 123 120 125",
        browL: "M 65 76 Q 75 77 85 80",
        browR: "M 135 76 Q 125 77 115 80",
        eyeY: 9
      },
      smiling: {
        mouth: "M 80 120 Q 100 138 120 120",
        browL: "M 65 75 Q 75 74 85 78",
        browR: "M 135 75 Q 125 74 115 78",
        eyeY: 6
      }
    };

    const target = shapes[expression] || shapes.idle;
    
    // Apply expression
    this.mouth.setAttribute('d', target.mouth);
    if (this.browLeft) this.browLeft.setAttribute('d', target.browL);
    if (this.browRight) this.browRight.setAttribute('d', target.browR);
    if (this.eyeLeft) this.eyeLeft.setAttribute('ry', target.eyeY);
    if (this.eyeRight) this.eyeRight.setAttribute('ry', target.eyeY);
  }

  // Blink logic
  initIdleLoop() {
    const performBlink = () => {
      if (!this.isSpeaking && this.eyeLeft && this.eyeRight) {
        // Remember original heights
        const prevL = this.eyeLeft.getAttribute('ry');
        const prevR = this.eyeRight.getAttribute('ry');
        
        // Close eyes
        this.eyeLeft.setAttribute('ry', 1);
        this.eyeRight.setAttribute('ry', 1);
        
        setTimeout(() => {
          this.eyeLeft.setAttribute('ry', prevL);
          this.eyeRight.setAttribute('ry', prevR);
        }, 120);
      }
      
      // Schedule next blink randomly (3 to 6 seconds)
      this.blinkTimer = setTimeout(performBlink, 3000 + Math.random() * 3000);
    };
    
    this.blinkTimer = setTimeout(performBlink, 2000);
  }

  // Morphing mouth during speech
  startSpeakingAnimation() {
    this.isSpeaking = true;
    let tick = 0;
    
    if (this.speakInterval) clearInterval(this.speakInterval);

    this.speakInterval = setInterval(() => {
      tick++;
      // Generate randomized speaking mouth curves
      const height = 125 + (Math.sin(tick * 0.8) * 10) + (Math.random() * 6);
      const curve = `M 80 125 Q 100 ${height} 120 125`;
      if (this.mouth) this.mouth.setAttribute('d', curve);
      
      // Vibrate eyes slightly for digital effect
      const shift = Math.sin(tick * 0.5) * 0.4;
      if (this.eyeLeft) this.eyeLeft.setAttribute('cx', 75 + shift);
      if (this.eyeRight) this.eyeRight.setAttribute('cx', 125 - shift);
    }, 90);
  }

  stopSpeakingAnimation() {
    this.isSpeaking = false;
    if (this.speakInterval) {
      clearInterval(this.speakInterval);
      this.speakInterval = null;
    }
    // Restore default eye positions
    if (this.eyeLeft) this.eyeLeft.setAttribute('cx', 75);
    if (this.eyeRight) this.eyeRight.setAttribute('cx', 125);
    this.setFacialExpression('idle');
  }

  // Text-To-Speech UTTERANCE
  speak(text, onStartCallback = null) {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('SpeechSynthesis not supported on this browser.');
        // Graceful text-only simulation fallback
        this.setVisualState('speaking');
        setTimeout(() => {
          this.setVisualState('idle');
          resolve();
        }, Math.max(2000, text.length * 50));
        return;
      }

      // Cancel any ongoing speaking
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Find matching voice language
      const voices = this.synth.getVoices();
      let chosenVoice = null;
      
      // Prefer English voices matching our setting
      if (voices.length > 0) {
        chosenVoice = voices.find(v => v.lang.startsWith(this.voiceLanguage)) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      }
      
      if (chosenVoice) utterance.voice = chosenVoice;
      utterance.rate = this.voiceRate;

      utterance.onstart = () => {
        this.setVisualState('speaking');
        if (onStartCallback) onStartCallback();
      };

      utterance.onend = () => {
        this.setVisualState('idle');
        resolve();
      };

      utterance.onerror = (e) => {
        console.error('SpeechSynthesis utterance error:', e);
        this.setVisualState('idle');
        resolve(); // resolve anyway to avoid stuck flow
      };

      this.synth.speak(utterance);
    });
  }

  // Initialize Speech-To-Text (Recognition)
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported on this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.voiceLanguage;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.setVisualState('listening');
      const micBtn = document.getElementById('btn-mic-toggle');
      if (micBtn) {
        micBtn.classList.add('listening');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
      }
      const transIndicator = document.getElementById('transcription-indicator');
      if (transIndicator) {
        transIndicator.innerHTML = '<i class="fa-solid fa-circle-nodes" style="color: var(--accent-cyan); animation: blinkRed 1s infinite alternate;"></i> AI Listening... Speak clearly into your mic.';
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      // If visual state is still listening, restore to idle
      const curText = this.statusText.innerText;
      if (curText.includes('Listening')) {
        this.setVisualState('idle');
      }

      const micBtn = document.getElementById('btn-mic-toggle');
      if (micBtn) {
        micBtn.classList.remove('listening');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      }
      
      const transIndicator = document.getElementById('transcription-indicator');
      if (transIndicator) {
        transIndicator.innerHTML = '<i class="fa-solid fa-keyboard"></i> Typing mode active. Click microphone to speak.';
      }
    };
  }

  // Toggle listening
  toggleListening(onResultCallback, onErrorCallback) {
    if (!this.recognition) {
      if (typeof window.showAppMessage === 'function') {
        window.showAppMessage('Voice input is not available in this browser. Please type your answer instead.', 'info');
      } else {
        console.warn('Speech-to-text is not supported in this browser. Please type your response directly in the text input box.');
      }
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      // Setup result callbacks dynamically
      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (onResultCallback) {
          onResultCallback(finalTranscript, interimTranscript);
        }
      };

      this.recognition.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        if (onErrorCallback) onErrorCallback(event.error);
        this.recognition.stop();
      };

      // Restart speaking stops to listen
      if (this.synth.speaking) {
        this.synth.cancel();
      }

      this.recognition.start();
    }
  }

  // Force stop all synthesis or recognition activity
  shutdown() {
    if (this.synth) this.synth.cancel();
    if (this.recognition && this.isListening) this.recognition.stop();
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    if (this.speakInterval) clearInterval(this.speakInterval);
    this.setVisualState('idle');
  }
}

// Attach to global window
window.AIAvatarController = AIAvatarController;
