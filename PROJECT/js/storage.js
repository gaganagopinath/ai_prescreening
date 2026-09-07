// js/storage.js
// Handles IndexedDB for files/recordings and LocalStorage for metadata & settings

const DB_NAME = 'PreScreeningAI_DB';
const DB_VERSION = 1;

class DatabaseService {
  constructor() {
    this.db = null;
  }

  // Initialize IndexedDB
  initDB() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store for resume files (stored as Blobs or text content)
        if (!db.objectStoreNames.contains('resumes')) {
          db.createObjectStore('resumes', { keyPath: 'candidateId' });
        }
        
        // Store for video/audio recordings (stored as Blobs)
        if (!db.objectStoreNames.contains('recordings')) {
          db.createObjectStore('recordings', { keyPath: 'candidateId' });
        }
      };
    });
  }

  // Save a resume blob or text
  async saveResume(candidateId, fileContent, fileName, fileType) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['resumes'], 'readwrite');
      const store = transaction.objectStore('resumes');
      
      const record = {
        candidateId,
        content: fileContent, // Can be text or Blob
        fileName,
        fileType,
        uploadedAt: new Date().toISOString()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Retrieve resume
  async getResume(candidateId) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['resumes'], 'readonly');
      const store = transaction.objectStore('resumes');
      const request = store.get(candidateId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Save a video recording Blob
  async saveRecording(candidateId, videoBlob) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recordings'], 'readwrite');
      const store = transaction.objectStore('recordings');
      
      const record = {
        candidateId,
        blob: videoBlob,
        recordedAt: new Date().toISOString()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Retrieve video recording Blob
  async getRecording(candidateId) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recordings'], 'readonly');
      const store = transaction.objectStore('recordings');
      const request = store.get(candidateId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// LocalStorage Controller for Metadata & App State
const StorageService = {
  dbService: new DatabaseService(),

  // Get settings
  getSettings() {
    const defaults = {
      geminiMode: false,
      geminiKey: '',
      voiceLanguage: 'en-US',
      voiceRate: 1.0,
      autoAdvance: true
    };
    const saved = localStorage.getItem('pre_screening_settings');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  },

  // Save settings
  saveSettings(settings) {
    localStorage.setItem('pre_screening_settings', JSON.stringify(settings));
  },

  // Get all candidates
  getCandidates() {
    const list = localStorage.getItem('pre_screening_candidates');
    if (!list) {
      this.prepopulateMockData();
      return JSON.parse(localStorage.getItem('pre_screening_candidates') || '[]');
    }

    try {
      return JSON.parse(list);
    } catch (error) {
      console.warn('Stored candidate data was invalid. Resetting the dashboard list.', error);
      localStorage.removeItem('pre_screening_candidates');
      this.prepopulateMockData();
      return JSON.parse(localStorage.getItem('pre_screening_candidates') || '[]');
    }
  },

  // Save candidate record
  saveCandidate(candidate) {
    const candidates = this.getCandidates();
    const index = candidates.findIndex(c => c.id === candidate.id);
    if (index >= 0) {
      candidates[index] = candidate;
    } else {
      candidates.push(candidate);
    }
    localStorage.setItem('pre_screening_candidates', JSON.stringify(candidates));
  },

  // Delete candidate
  deleteCandidate(candidateId) {
    let candidates = this.getCandidates();
    candidates = candidates.filter(c => c.id !== candidateId);
    localStorage.setItem('pre_screening_candidates', JSON.stringify(candidates));
    // Also remove from DB in background
    this.dbService.initDB().then(db => {
      const t1 = db.transaction(['resumes'], 'readwrite');
      t1.objectStore('resumes').delete(candidateId);
      const t2 = db.transaction(['recordings'], 'readwrite');
      t2.objectStore('recordings').delete(candidateId);
    });
  },

  // Create mock records if empty
  prepopulateMockData() {
    const mockCandidates = [
      {
        id: 'mock_david_chen',
        name: 'David Chen',
        email: 'david.chen@techmail.net',
        role: 'Software Engineer',
        appliedDate: '2026-06-10T14:32:00.000Z',
        resumeText: 'David Chen\nSenior Software Engineer\nExperience: 6 years at InnovateTech, building high-performance frontend interfaces with React, Next.js, and TypeScript.\nSkills: JavaScript, TypeScript, React, Next.js, Node.js, Webpack, TailwindCSS, CSS Architecture, Web Performance Optimization.\nEducation: BS in Computer Science, University of California, Berkeley.',
        overallScore: 9.2,
        summary: 'David displayed exemplary depth in frontend architectures, reacting with advanced technical precision to scaling and optimization questions. His articulation of React hooks and Virtual DOM mechanisms was outstanding.',
        duration: '12m 45s',
        status: 'completed',
        isMock: true,
        mockImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200',
        transcript: [
          {
            questionNum: 1,
            question: "Could you tell us about yourself and what drawn you to this Software Engineer position?",
            answer: "Certainly. I am a frontend developer with over 6 years of experience, primarily focused on building highly responsive React applications. In my previous role at InnovateTech, I led the migration of our main dashboard to Next.js, which improved our Web Vitals scores by 35%. I am drawn to this role because your product is solving complex data visualization challenges at scale, which aligns directly with my engineering interest and background.",
            score: 9.5,
            evaluation: "Strong self-introduction. Explicitly linked his past achievements (35% Web Vitals improvement) to the challenges of our company."
          },
          {
            questionNum: 2,
            question: "How do you approach optimizing the rendering performance of a React application with deep component trees?",
            answer: "First, I identify bottlenecks using Chrome DevTools and the React Profiler. Common issues are unnecessary re-renders. I resolve these by using React.memo for heavy components, and optimizing hooks like useMemo and useCallback to preserve reference equality. If there are massive lists, I implement virtualization using react-window. For state management, I avoid prop-drilling by utilizing context or library selectors that allow fine-grained subscriptions.",
            score: 9.0,
            evaluation: "Excellent technical explanation. Outlined exact debugging tools (DevTools, React Profiler) and multiple resolution strategies (memoization, virtualization, proper state patterns)."
          },
          {
            questionNum: 3,
            question: "Describe a time you had to resolve a production bug under high pressure. What was the issue and how did you handle it?",
            answer: "We had a production bug where checkout operations failed for 15% of mobile users during a product launch. I coordinated with the backend engineer, analyzed our cloud logging tool (Sentry), and traced it to a race condition between local state hydration and the payment gateway callback. I implemented an immediate retry-fallback logic, pushed it through a hotfix branch with automated regression tests, and verified it in staging before deploying within 45 minutes of the alert.",
            score: 9.0,
            evaluation: "Demonstrated clear crisis-handling ability. Used structured debugging, collaborative alignment, and pushed verified hotfixes safely."
          }
        ]
      },
      {
        id: 'mock_sarah_jenkins',
        name: 'Sarah Jenkins',
        email: 'sarah.j@uxdesigners.com',
        role: 'UX Designer',
        appliedDate: '2026-06-11T09:15:00.000Z',
        resumeText: 'Sarah Jenkins\nSenior UX Designer\nExperience: 5 years leading product design at RetailFlow, crafting mobile-first shopping experiences and user journeys.\nSkills: Figma, Adobe XD, Design Systems, User Research, Usability Testing, Interactive Prototyping, CSS/HTML understanding.\nEducation: BFA in Graphic Design, Rhode Island School of Design.',
        overallScore: 8.8,
        summary: 'Sarah showed clear empathy-led thinking. She communicates design frameworks articulately and has a very strong grasp of design-to-development handoffs.',
        duration: '10m 12s',
        status: 'completed',
        isMock: true,
        mockImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200&h=200',
        transcript: [
          {
            questionNum: 1,
            question: "Could you walk us through your design process when starting a brand new user flow?",
            answer: "I always start with research to understand the core user pain point. I conduct quick user interviews or review analytics. Then, I map out user journeys and sketch low-fidelity wireframes. Once aligned with product managers, I transition to high-fidelity prototypes in Figma. I always test these prototypes on 5 to 7 users before finalizing specification details for engineering handoff, ensuring design consistency via our design system.",
            score: 8.5,
            evaluation: "Structured response. Addressed research, journey mapping, prototyping, usability testing, and developer handoff correctly."
          },
          {
            questionNum: 2,
            question: "How do you handle negative feedback from a client or product manager regarding a design choice you are passionate about?",
            answer: "I avoid getting defensive. Instead, I try to understand the 'why' behind the feedback. I ask clarifying questions to see if their concern is related to business goals, technical limits, or user patterns. I then try to validate my choice with user data or usability tests. If the data shows their concern is valid, I happily pivot. Design is about solving user problems, not personal ego.",
            score: 9.0,
            evaluation: "Superb collaborative attitude. Emphasized objective data over subjective arguments, showing mature professional communication."
          },
          {
            questionNum: 3,
            question: "How do you ensure accessibility (a11y) is integrated into your Figma design systems?",
            answer: "I run color contrast checks using tools like Stark. I design distinct visual cues instead of relying solely on colors for status changes. I also draft explicit documentation for screen reader behaviors, including alt text standards and semantic HTML headers, so engineers know how to structure the code when they translate the design.",
            score: 9.0,
            evaluation: "Very thorough understanding of accessibility. Addressed contrast ratios, state changes, and assistive technology annotations."
          }
        ]
      },
      {
        id: 'mock_amanda_ross',
        name: 'Amanda Ross',
        email: 'amanda.ross@productlead.org',
        role: 'Product Manager',
        appliedDate: '2026-06-11T16:05:00.000Z',
        resumeText: 'Amanda Ross\nProduct Manager\nExperience: 4 years as Associate PM at SaaSify, focusing on user growth features and integration workflows.\nSkills: Agile Methodologies, Product Strategy, JIRA, SQL, Amplitude, Customer Discovery, Scrum.\nEducation: BA in Business Administration, Boston University.',
        overallScore: 6.5,
        summary: 'Amanda was clear about Agile and sprint mechanics, but struggled to articulate specific, quantitative product metrics and quantitative frameworks she uses for roadmap prioritization.',
        duration: '11m 02s',
        status: 'completed',
        isMock: true,
        mockImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200',
        transcript: [
          {
            questionNum: 1,
            question: "Tell us about a successful product launch you managed. What were the key metrics you tracked?",
            answer: "We launched a new third-party integrations page at SaaSify. I ran sprint planning, wrote user stories, and kept developers on track. It launched on time. We looked at how many users clicked the page to see if they liked it. The team was happy with the speed of release.",
            score: 6.0,
            evaluation: "Weak metric specification. Focused too heavily on process tracking (sprint planning, launch date) rather than user outcomes, business impact, or concrete usage retention rates."
          },
          {
            questionNum: 2,
            question: "How do you prioritize competing requests on a product roadmap when multiple stakeholders claim their requests are high priority?",
            answer: "I usually set up meetings with the stakeholders and let them discuss it. We look at who has the most urgent customer issue. Sometimes I discuss with the VP of Product to get their final call so that everyone stays happy and aligned.",
            score: 6.0,
            evaluation: "Under-developed prioritization framework. Did not reference standard frameworks like RICE (Reach, Impact, Confidence, Effort) or Kano. Relies heavily on consensus meetings and escalation to management."
          },
          {
            questionNum: 3,
            question: "How do you perform customer discovery for a brand new, unreleased feature?",
            answer: "We talk to existing customers. We ask them what features they feel are missing from our platform. I compile their feedback into a spreadsheet and write design requirements for features that appear multiple times in the conversations.",
            score: 7.5,
            evaluation: "Competent discovery answers. Addressed customer feedback and translation into specs, though lacked mention of quantitative survey validation or visual prototyping iterations."
          }
        ]
      }
    ];
    localStorage.setItem('pre_screening_candidates', JSON.stringify(mockCandidates));
  }
};
window.StorageService = StorageService;
window.DatabaseService = StorageService.dbService;
