(function () {
  'use strict';

  // Mock AI service layer for the prototype.
  // Replace these methods with Gemini/OpenAI API calls when the backend is connected.
  const MockAIService = {
    analyzeResume(candidateName, role, resumeText) {
      const text = (resumeText || '').toLowerCase();
      const skills = [
        'javascript', 'typescript', 'react', 'node', 'sql', 'python',
        'figma', 'product strategy', 'agile', 'ui design', 'problem solving'
      ].filter((skill) => text.includes(skill));

      const fallbackSkills = ['communication', 'ownership', 'cross-functional collaboration'];
      const resolvedSkills = skills.length ? skills.slice(0, 4).map((skill) => skill.replace(/\b\w/g, (c) => c.toUpperCase())) : fallbackSkills;

      const experience = text.includes('senior') || text.includes('lead') ? '6+ years' : text.includes('intern') ? '1-2 years' : '3+ years';
      const education = text.includes('bachelor') || text.includes('bs') || text.includes('be') || text.includes('bsc')
        ? 'Bachelor\'s / degree-backed background'
        : 'Relevant professional and project-based background';

      const projects = text.includes('project') || text.includes('portfolio') || text.includes('dashboard')
        ? 'Portfolio and shipped product work identified'
        : 'Hands-on project experience detected';

      const focusAreas = [
        role.includes('Engineer') ? 'System design and technical depth' : 'Product thinking and communication',
        'Role-specific scenarios and tradeoff discussions',
        'Behavioral and collaboration patterns'
      ];

      return {
        candidateName,
        role,
        skills: resolvedSkills,
        experience,
        education,
        projects,
        focusAreas,
        summary: `${candidateName || 'Candidate'} demonstrates a profile suited for ${role || 'the role'} with strengths in ${resolvedSkills.slice(0, 2).join(' and ')}.`
      };
    },

    generateQuestions(role, resumeText) {
      const text = (resumeText || '').toLowerCase();
      const engineeringPool = [
        'Explain your experience with modern frameworks and how you design scalable solutions in production.',
        'Describe a challenging debugging or performance issue you resolved and the steps you took.',
        'How do you balance code quality, delivery speed, and team collaboration in a fast-moving sprint?'
      ];

      const designPool = [
        'Walk us through a design decision that balanced stakeholder needs with user experience goals.',
        'How do you validate design choices with user research and accessibility standards?',
        'Describe how you collaborate with engineering to maintain consistency between design and implementation.'
      ];

      const productPool = [
        'How do you prioritize roadmap features when business goals and technical constraints are in conflict?',
        'Tell us about a product decision you made using customer feedback and metrics.',
        'How do you align engineering, design, and stakeholders around a high-impact launch?'
      ];

      const analystPool = [
        'Explain your process for cleaning and validating a messy dataset before analysis.',
        'How do you translate complex analytical findings into business-friendly recommendations?',
        'Describe a time you used data to influence a strategic decision or identify a growth opportunity.'
      ];

      let pool = engineeringPool;
      if (role.includes('Designer') || role.includes('UX')) pool = designPool;
      else if (role.includes('Product') || role.includes('Manager')) pool = productPool;
      else if (role.includes('Analyst') || role.includes('Data')) pool = analystPool;

      const skillHints = [
        'react', 'python', 'sql', 'figma', 'node', 'typescript', 'analytics', 'design', 'strategy'
      ].filter((keyword) => text.includes(keyword));

      const customLead = skillHints.length
        ? `Your resume highlights ${skillHints.slice(0, 2).map((item) => item.toUpperCase()).join(' and ')}. Tell us about a project where these skills directly contributed to measurable impact.`
        : 'Tell us about a project that best demonstrates your relevant experience and how you contributed to the result.';

      return [customLead, pool[1], pool[2]];
    },

    evaluateAnswer(question, answer) {
      const text = (answer || '').toLowerCase();
      const wordCount = (answer || '').trim().split(/\s+/).filter(Boolean).length;
      const keywords = ['experience', 'project', 'team', 'user', 'process', 'metrics', 'design', 'data', 'framework', 'scalable', 'system', 'collaboration'];
      const keywordMatches = keywords.filter((item) => text.includes(item)).length;

      let score = 5.2 + Math.min(wordCount / 18, 3) + keywordMatches * 0.4;
      const relevance = Math.min(10, 6 + keywordMatches * 0.5 + (text.length > 80 ? 1.4 : 0.6));
      const technicalDepth = Math.min(10, 4 + (text.includes('framework') || text.includes('system') || text.includes('data') ? 2.5 : 1.2) + (wordCount > 40 ? 1.6 : 0.4));
      const communication = Math.min(10, 5 + (wordCount > 25 ? 2.1 : 0.8) + (text.includes('because') || text.includes('therefore') ? 0.9 : 0.1));

      const finalScore = Number(Math.min(10, score).toFixed(1));
      const relevanceScore = Number(Math.min(10, relevance).toFixed(1));
      const depthScore = Number(Math.min(10, technicalDepth).toFixed(1));
      const communicationScore = Number(Math.min(10, communication).toFixed(1));

      let feedback = 'This answer would benefit from more concrete examples and specific results.';
      if (finalScore >= 8.5) {
        feedback = 'Strong answer with clear structure, relevant examples, and strong evidence of experience.';
      } else if (finalScore >= 6.5) {
        feedback = 'Good response overall. Add more specific metrics or technical depth to make it more compelling.';
      } else if (finalScore >= 4.5) {
        feedback = 'Your answer reflects some understanding, but it needs more detail and clearer examples.';
      }

      return {
        score: finalScore,
        relevance: relevanceScore,
        technicalDepth: depthScore,
        communication: communicationScore,
        feedback
      };
    },

    summarizePerformance(candidateName, role, transcript) {
      const average = transcript.reduce((sum, item) => sum + (typeof item.score === 'number' ? item.score : 0), 0) / (transcript.length || 1);
      const rounded = Number(Math.min(10, average).toFixed(1));

      if (rounded >= 8.5) {
        return `${candidateName} demonstrated strong alignment with the ${role} role, with clear communication and relevant experience. The candidate showed confident domain knowledge and solid examples that map well to the role requirements.`;
      }
      if (rounded >= 6.5) {
        return `${candidateName} showed a solid baseline for the ${role} role. The answers were relevant and structured, but some responses would benefit from deeper examples, more measurable impact, and stronger technical specificity.`;
      }
      return `${candidateName} showed emerging potential for the ${role} role, but answers were light on concrete examples and technical depth. Additional experience-based detail and clearer communication would improve the screening outcome.`;
    }
  };

  window.MockAIService = MockAIService;
})();
