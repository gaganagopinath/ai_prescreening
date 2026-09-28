// js/dashboard.js
// Manages recruiter metrics, dynamic SVG charts, candidate search/filter, and detail drawer overlays

class RecruiterDashboard {
  constructor() {
    this.candidates = [];
    this.activeCandidate = null;
    this.videoBlobUrl = null;
    
    // Video player state
    this.isPlaying = false;
    this.videoDuration = 0;
    this.videoTimer = null;

    // DOM Elements
    this.tableBody = document.getElementById('candidates-table-body');
    this.searchInput = document.getElementById('dashboard-search-input');
    this.roleFilter = document.getElementById('filter-role-select');
    this.scoreFilter = document.getElementById('filter-score-select');
    
    this.detailOverlay = document.getElementById('detail-overlay');
    this.detailDrawer = this.detailOverlay?.querySelector('.detail-drawer');
    this.btnCloseDetail = document.getElementById('btn-close-detail');
    this.btnDeleteProfile = document.getElementById('btn-delete-candidate');

    // Video Player DOM
    this.videoPlayer = document.getElementById('detail-video-player');
    this.videoPlaceholder = document.getElementById('detail-video-placeholder');
    this.btnPlayPause = document.getElementById('btn-player-play-pause');
    this.progressParent = document.getElementById('video-progress-parent');
    this.progressBar = document.getElementById('video-progress-fill');
    this.timeDisplay = document.getElementById('video-time-display');
    this.placeholderImage = document.getElementById('detail-placeholder-image');
    this.waveformPlaying = document.getElementById('detail-waveform-active');

    this.initEventListeners();
  }

  initEventListeners() {
    // Search and filters
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.renderCandidatesList());
    }
    if (this.roleFilter) {
      this.roleFilter.addEventListener('change', () => this.renderCandidatesList());
    }
    if (this.scoreFilter) {
      this.scoreFilter.addEventListener('change', () => this.renderCandidatesList());
    }

    // Modal Drawer close
    if (this.btnCloseDetail) {
      this.btnCloseDetail.addEventListener('click', () => this.closeCandidateDetail());
    }
    if (this.detailOverlay) {
      this.detailOverlay.addEventListener('click', (e) => {
        if (e.target === this.detailOverlay) this.closeCandidateDetail();
      });
    }

    // Delete profile
    if (this.btnDeleteProfile) {
      this.btnDeleteProfile.addEventListener('click', () => this.handleDeleteCandidate());
    }

    // Media player events
    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => this.togglePlayback());
    }
    if (this.progressParent) {
      this.progressParent.addEventListener('click', (e) => this.handleProgressClick(e));
    }
    if (this.videoPlayer) {
      this.videoPlayer.addEventListener('timeupdate', () => this.updatePlayerProgress());
      this.videoPlayer.addEventListener('loadedmetadata', () => {
        this.videoDuration = this.videoPlayer.duration;
        this.updateTimeDisplay(0, this.videoDuration);
      });
      this.videoPlayer.addEventListener('ended', () => {
        this.isPlaying = false;
        this.btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
      });
    }
  }

  // Load and refresh dashboard records
  refresh() {
    this.candidates = StorageService.getCandidates();
    if (!this.candidates || this.candidates.length === 0) {
      StorageService.prepopulateMockData();
      this.candidates = StorageService.getCandidates();
    }
    this.renderMetricsSummary();
    this.renderCharts();
    this.renderCandidatesList();
    this.renderHistorySummary();
  }

  renderHistorySummary() {
    const list = document.getElementById('history-summary-list');
    if (!list) return;

    const recent = [...this.candidates]
      .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
      .slice(0, 4);

    if (!recent.length) {
      list.innerHTML = '<div class="history-item empty">No session records available yet.</div>';
      return;
    }

    list.innerHTML = recent.map((candidate) => {
      const scoreClass = candidate.overallScore >= 8 ? 'high' : candidate.overallScore >= 6 ? 'mid' : 'low';
      const date = new Date(candidate.appliedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      return `
        <div class="history-item" data-id="${candidate.id}">
          <div class="history-main">
            <div class="history-name">${candidate.name}</div>
            <div class="history-meta">${candidate.role} • ${date}</div>
          </div>
          <div class="history-badges">
            <span class="status-badge ${candidate.status}">${candidate.status}</span>
            <span class="score-badge ${scoreClass}">${candidate.overallScore.toFixed(1)}</span>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.history-item').forEach((card) => {
      card.addEventListener('click', () => this.openCandidateDetail(card.dataset.id));
    });
  }

  // Calculate high level metrics
  renderMetricsSummary() {
    const total = this.candidates.length;
    let avg = 0;
    let high = 0;
    
    if (total > 0) {
      const sum = this.candidates.reduce((acc, c) => acc + c.overallScore, 0);
      avg = sum / total;
      high = this.candidates.filter(c => c.overallScore >= 8.5).length;
    }

    const totalEl = document.getElementById('metric-total-candidates');
    const avgEl = document.getElementById('metric-average-score');
    const highEl = document.getElementById('metric-high-performers');
    const pendingEl = document.getElementById('metric-pending-review');

    if (totalEl) totalEl.innerText = total;
    if (avgEl) avgEl.innerText = avg.toFixed(1);
    if (highEl) highEl.innerText = high;
    if (pendingEl) pendingEl.innerText = this.candidates.filter(c => c.status !== 'completed').length;
  }

  // Render list of candidates into table
  renderCandidatesList() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    const query = this.searchInput ? this.searchInput.value.toLowerCase().trim() : '';
    const roleVal = this.roleFilter ? this.roleFilter.value : 'ALL';
    const scoreVal = this.scoreFilter ? this.scoreFilter.value : 'ALL';

    // Apply search and dropdown filters
    const filtered = this.candidates.filter(c => {
      // Search matches name, email, or resumeText details
      const matchesQuery = !query || 
        c.name.toLowerCase().includes(query) || 
        c.email.toLowerCase().includes(query) ||
        c.resumeText.toLowerCase().includes(query) ||
        (c.role && c.role.toLowerCase().includes(query));

      const matchesRole = roleVal === 'ALL' || c.role === roleVal;
      
      let matchesScore = true;
      if (scoreVal === 'HIGH') matchesScore = c.overallScore >= 8.0;
      else if (scoreVal === 'MID') matchesScore = c.overallScore >= 6.0 && c.overallScore < 8.0;
      else if (scoreVal === 'LOW') matchesScore = c.overallScore < 6.0;

      return matchesQuery && matchesRole && matchesScore;
    });

    if (filtered.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 3rem 0;">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
            No screening candidates match the selected filters.
          </td>
        </tr>
      `;
      return;
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));

    filtered.forEach(c => {
      const tr = document.createElement('tr');
      
      // Determine score class
      let badgeClass = 'low';
      if (c.overallScore >= 8.0) badgeClass = 'high';
      else if (c.overallScore >= 6.0) badgeClass = 'mid';

      // Format date
      const dateObj = new Date(c.appliedDate);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      tr.innerHTML = `
        <td>
          <div class="candidate-name-cell">
            ${c.name}
            <span class="role">${c.email}</span>
          </div>
        </td>
        <td>${c.role}</td>
        <td>${formattedDate}</td>
        <td>${c.duration || '--'}</td>
        <td style="text-align: center;">
          <div class="score-badge ${badgeClass}">${c.overallScore.toFixed(1)}</div>
        </td>
        <td>
          <span class="status-badge ${c.status}">${c.status.toUpperCase()}</span>
        </td>
      `;

      // Set click listener to open detail view
      tr.addEventListener('click', () => this.openCandidateDetail(c.id));
      this.tableBody.appendChild(tr);
    });
  }

  // Draw pure SVG interactive charts
  renderCharts() {
    this.renderScoreChart();
    this.renderRoleChart();
  }

  // Score Distribution Histogram SVG Chart
  renderScoreChart() {
    const scoreSvg = document.getElementById('score-chart-svg');
    const legendBadge = document.getElementById('score-chart-legend');
    if (!scoreSvg) return;
    scoreSvg.innerHTML = '';

    // Create score bins
    const bins = [
      { label: '< 6.0', count: 0, range: [0, 5.99], colorStart: '#f97316', colorEnd: '#ef4444', tier: 'Needs Review' },
      { label: '6.0-6.9', count: 0, range: [6.0, 6.99], colorStart: '#8b5cf6', colorEnd: '#6366f1', tier: 'Fair' },
      { label: '7.0-7.9', count: 0, range: [7.0, 7.99], colorStart: '#6366f1', colorEnd: '#3b82f6', tier: 'Good' },
      { label: '8.0-8.9', count: 0, range: [8.0, 8.99], colorStart: '#06b6d4', colorEnd: '#10b981', tier: 'High' },
      { label: '9.0-10.0', count: 0, range: [9.0, 10.0], colorStart: '#10b981', colorEnd: '#059669', tier: 'Top Tier' }
    ];

    // Populate counts
    this.candidates.forEach(c => {
      const score = c.overallScore;
      const bin = bins.find(b => score >= b.range[0] && score <= b.range[1]);
      if (bin) bin.count++;
    });

    const totalCandidates = this.candidates.length;
    if (legendBadge) {
      legendBadge.innerText = `${totalCandidates} candidate${totalCandidates !== 1 ? 's' : ''} evaluated`;
    }

    const svgWidth = 460;
    const svgHeight = 220;
    scoreSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    scoreSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Add gradient defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    bins.forEach((bin, i) => {
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      grad.setAttribute('id', `bar-grad-${i}`);
      grad.setAttribute('x1', '0%');
      grad.setAttribute('y1', '0%');
      grad.setAttribute('x2', '0%');
      grad.setAttribute('y2', '100%');

      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', bin.colorStart);

      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', bin.colorEnd);

      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
    });
    scoreSvg.appendChild(defs);

    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 32;
    const paddingBottom = 40;

    const graphWidth = svgWidth - paddingLeft - paddingRight;
    const graphHeight = svgHeight - paddingTop - paddingBottom;
    const colWidth = graphWidth / bins.length;
    const maxCount = Math.max(3, ...bins.map(b => b.count));

    // Y-Axis Gridlines
    const gridSteps = 3;
    for (let i = 0; i <= gridSteps; i++) {
      const y = paddingTop + (graphHeight * i) / gridSteps;
      const val = Math.round(maxCount - (maxCount * i) / gridSteps);

      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', paddingLeft);
      gridLine.setAttribute('y1', y);
      gridLine.setAttribute('x2', svgWidth - paddingRight);
      gridLine.setAttribute('y2', y);
      gridLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
      gridLine.setAttribute('stroke-dasharray', i === gridSteps ? '0' : '4 4');
      gridLine.setAttribute('stroke-width', '1');
      scoreSvg.appendChild(gridLine);

      const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yLabel.setAttribute('x', paddingLeft - 8);
      yLabel.setAttribute('y', y + 4);
      yLabel.setAttribute('fill', 'rgba(148, 163, 184, 0.8)');
      yLabel.setAttribute('font-size', '10px');
      yLabel.setAttribute('font-weight', '500');
      yLabel.setAttribute('text-anchor', 'end');
      yLabel.innerText = val;
      scoreSvg.appendChild(yLabel);
    }

    // Bars
    bins.forEach((bin, idx) => {
      const barW = colWidth * 0.58;
      const colX = paddingLeft + idx * colWidth + (colWidth - barW) / 2;
      const barH = (bin.count / maxCount) * graphHeight;
      const colY = paddingTop + graphHeight - barH;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', colX);
      rect.setAttribute('y', colY);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', Math.max(6, barH));
      rect.setAttribute('rx', 6);
      rect.setAttribute('fill', `url(#bar-grad-${idx})`);
      rect.setAttribute('opacity', bin.count > 0 ? '0.95' : '0.3');
      rect.classList.add('svg-chart-bar');

      // Count badge text above bar
      const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeText.setAttribute('x', colX + barW / 2);
      badgeText.setAttribute('y', colY - 8);
      badgeText.setAttribute('fill', bin.count > 0 ? '#ffffff' : 'rgba(148, 163, 184, 0.4)');
      badgeText.setAttribute('font-size', '12px');
      badgeText.setAttribute('font-weight', 'bold');
      badgeText.setAttribute('text-anchor', 'middle');
      badgeText.innerText = bin.count;
      scoreSvg.appendChild(badgeText);

      // Tooltip listener
      const tooltip = document.getElementById('chart-tooltip');
      rect.addEventListener('mouseover', (e) => {
        rect.setAttribute('opacity', '1');
        if (tooltip) {
          const pct = totalCandidates > 0 ? Math.round((bin.count / totalCandidates) * 100) : 0;
          tooltip.style.display = 'block';
          tooltip.innerHTML = `<strong>Score ${bin.label} (${bin.tier})</strong><br/>Candidate Count: ${bin.count} (${pct}%)`;
        }
      });
      rect.addEventListener('mousemove', (e) => {
        if (tooltip) {
          const containerRect = scoreSvg.getBoundingClientRect();
          tooltip.style.left = `${e.clientX - containerRect.left + 15}px`;
          tooltip.style.top = `${e.clientY - containerRect.top - 15}px`;
        }
      });
      rect.addEventListener('mouseout', () => {
        rect.setAttribute('opacity', bin.count > 0 ? '0.95' : '0.3');
        if (tooltip) tooltip.style.display = 'none';
      });

      scoreSvg.appendChild(rect);

      // X-Axis Labels
      const xText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xText.setAttribute('x', colX + barW / 2);
      xText.setAttribute('y', svgHeight - 12);
      xText.setAttribute('fill', 'var(--color-text-secondary)');
      xText.setAttribute('font-size', '11px');
      xText.setAttribute('font-weight', '500');
      xText.setAttribute('text-anchor', 'middle');
      xText.innerText = bin.label;
      scoreSvg.appendChild(xText);
    });
  }

  // Job Role Breakdown & Statistics List
  renderRoleChart() {
    const listContainer = document.getElementById('role-breakdown-list');
    const totalBadge = document.getElementById('role-chart-total-badge');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Standard list of roles + any custom candidate role
    const defaultRoles = [
      { name: 'Software Engineer', icon: 'fa-code', color: 'linear-gradient(90deg, #6366f1, #8b5cf6)' },
      { name: 'UX Designer', icon: 'fa-pen-ruler', color: 'linear-gradient(90deg, #06b6d4, #3b82f6)' },
      { name: 'Product Manager', icon: 'fa-chart-line', color: 'linear-gradient(90deg, #10b981, #059669)' },
      { name: 'Data Analyst', icon: 'fa-database', color: 'linear-gradient(90deg, #f59e0b, #d97706)' }
    ];

    // Count candidate roles
    const counts = {};
    let totalCandidates = this.candidates.length;

    this.candidates.forEach(c => {
      const roleName = c.role || 'Unspecified Role';
      counts[roleName] = (counts[roleName] || 0) + 1;
    });

    // Merge custom roles found in candidates
    Object.keys(counts).forEach(roleName => {
      if (!defaultRoles.some(r => r.name === roleName)) {
        defaultRoles.push({
          name: roleName,
          icon: 'fa-user-tie',
          color: 'linear-gradient(90deg, #ec4899, #8b5cf6)'
        });
      }
    });

    const activeRolesCount = Object.keys(counts).length;
    if (totalBadge) {
      totalBadge.innerText = `${activeRolesCount} active role${activeRolesCount !== 1 ? 's' : ''}`;
    }

    if (totalCandidates === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--color-text-muted); padding: 2rem 0; font-size: 0.85rem;">
          No candidate applications recorded yet.
        </div>
      `;
      return;
    }

    // Render list items
    defaultRoles.forEach(role => {
      const candidateCount = counts[role.name] || 0;
      const pct = totalCandidates > 0 ? Math.round((candidateCount / totalCandidates) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'role-stat-item';
      item.innerHTML = `
        <div class="role-stat-info">
          <span class="role-stat-name">
            <i class="fa-solid ${role.icon}" style="color: var(--accent-cyan); font-size: 0.8rem;"></i>
            ${role.name}
          </span>
          <span class="role-stat-badge">
            ${candidateCount} candidate${candidateCount !== 1 ? 's' : ''} (${pct}%)
          </span>
        </div>
        <div class="role-stat-track">
          <div class="role-stat-fill" style="width: ${pct}%; background: ${role.color}; opacity: ${candidateCount > 0 ? '1' : '0.25'};"></div>
        </div>
      `;

      listContainer.appendChild(item);
    });
  }

  // Open detail panel for a candidate
  async openCandidateDetail(candidateId) {
    this.activeCandidate = this.candidates.find(c => c.id === candidateId);
    if (!this.activeCandidate) return;

    // Reset Player states
    this.stopPlayback();

    // Set header profile details
    const avatarPlaceholder = document.getElementById('detail-avatar-placeholder');
    if (avatarPlaceholder) {
      if (this.activeCandidate.isMock && this.activeCandidate.mockImage) {
        avatarPlaceholder.innerHTML = `<img src="${this.activeCandidate.mockImage}" style="width:100%; height:100%; object-fit:cover;" alt="Avatar">`;
      } else {
        avatarPlaceholder.innerText = this.activeCandidate.name.charAt(0);
        avatarPlaceholder.style.background = 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))';
      }
    }

    document.getElementById('detail-candidate-name').innerText = this.activeCandidate.name;
    document.getElementById('detail-candidate-role').innerText = this.activeCandidate.role;
    document.getElementById('detail-candidate-email').innerText = this.activeCandidate.email;
    document.getElementById('detail-candidate-duration').innerText = this.activeCandidate.duration || '--';
    
    const dateObj = new Date(this.activeCandidate.appliedDate);
    document.getElementById('detail-candidate-date').innerText = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Score badge color setup
    const scoreBadge = document.getElementById('detail-candidate-score-badge');
    if (scoreBadge) {
      scoreBadge.innerText = this.activeCandidate.overallScore.toFixed(1);
      scoreBadge.className = 'score-badge';
      if (this.activeCandidate.overallScore >= 8.0) scoreBadge.classList.add('high');
      else if (this.activeCandidate.overallScore >= 6.0) scoreBadge.classList.add('mid');
      else scoreBadge.classList.add('low');
    }

    // Summary and Resume preview
    document.getElementById('detail-summary-text').innerText = this.activeCandidate.summary;
    document.getElementById('detail-resume-text').innerText = this.activeCandidate.resumeText || 'No resume text parsed.';

    // Chronological transcript populate
    this.renderTranscriptTimeline();

    // Map recorded video if any, else fallback placeholder
    if (this.videoBlobUrl) {
      URL.revokeObjectURL(this.videoBlobUrl);
      this.videoBlobUrl = null;
    }

    try {
      const mediaRecord = await StorageService.dbService.getRecording(candidateId);
      if (mediaRecord && mediaRecord.blob) {
        this.videoBlobUrl = URL.createObjectURL(mediaRecord.blob);
        this.videoPlayer.src = this.videoBlobUrl;
        this.videoPlayer.style.display = 'block';
        this.videoPlaceholder.style.display = 'none';
      } else {
        // Fallback display
        this.videoPlayer.src = '';
        this.videoPlayer.style.display = 'none';
        this.videoPlaceholder.style.display = 'flex';
        
        // Show candidate picture on playback card if mock candidate
        if (this.activeCandidate.isMock && this.activeCandidate.mockImage) {
          this.placeholderImage.src = this.activeCandidate.mockImage;
          this.placeholderImage.style.display = 'block';
        } else {
          this.placeholderImage.style.display = 'none';
        }
        this.waveformPlaying.style.display = 'none';
      }
    } catch (err) {
      console.warn("Could not query media DB:", err);
      this.videoPlayer.style.display = 'none';
      this.videoPlaceholder.style.display = 'flex';
    }

    // Toggle Overlay active
    if (this.detailOverlay) {
      this.detailOverlay.style.display = 'flex';
      // Force repaint before adding active class for slide transition
      this.detailOverlay.offsetHeight;
      this.detailOverlay.classList.add('active');
    }
  }

  // Draw Q&A transcript items
  renderTranscriptTimeline() {
    const timeline = document.getElementById('detail-transcript-timeline');
    if (!timeline) return;
    timeline.innerHTML = '';

    if (!this.activeCandidate.transcript || this.activeCandidate.transcript.length === 0) {
      timeline.innerHTML = '<div style="color: var(--color-text-muted);">No transcript records for this session.</div>';
      return;
    }

    this.activeCandidate.transcript.forEach(item => {
      const div = document.createElement('div');
      div.className = 'timeline-item';
      
      const qNum = item.questionNum;
      const score = item.score !== null ? item.score.toFixed(1) : '--';
      const evaluationText = item.evaluation || 'Answer recorded. Evaluator review pending.';
      
      let badgeClass = '';
      if (item.score !== null) {
        badgeClass = item.score < 6.0 ? 'low-score' : '';
      }

      div.innerHTML = `
        <div class="timeline-header">
          <div class="timeline-q-num">Q${qNum}: Section Question</div>
          <div class="timeline-q-score"><i class="fa-solid fa-star"></i> Score: ${score}/10</div>
        </div>
        <div class="timeline-question">${item.question}</div>
        <div class="timeline-answer-box">
          <div class="label">${this.activeCandidate.name} Responded:</div>
          <div class="text">"${item.answer}"</div>
        </div>
        <div class="timeline-eval-box ${badgeClass}">
          <div class="title"><i class="fa-solid fa-user-gear"></i> AI Agent Assessment Feedback:</div>
          <div class="content">${evaluationText}</div>
        </div>
      `;

      timeline.appendChild(div);
    });
  }

  // Delete candidate profiles
  async handleDeleteCandidate() {
    if (!this.activeCandidate) return;
    
    if (confirm(`Are you absolutely sure you want to permanently delete the profile, transcripts, and recordings for ${this.activeCandidate.name}?`)) {
      StorageService.deleteCandidate(this.activeCandidate.id);
      this.closeCandidateDetail();
      this.refresh();
    }
  }

  closeCandidateDetail() {
    this.stopPlayback();
    if (this.detailOverlay) {
      this.detailOverlay.classList.remove('active');
      setTimeout(() => {
        this.detailOverlay.style.display = 'none';
      }, 300);
    }
    this.activeCandidate = null;
  }

  // Custom Video Player Controls
  togglePlayback() {
    // Check if real video is playing
    const hasRealVideo = (this.videoPlayer.style.display === 'block');

    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.isPlaying = true;
      this.btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';

      if (hasRealVideo) {
        this.videoPlayer.play();
      } else {
        // Simulated playback loop for mock candidates
        this.waveformPlaying.style.display = 'flex';
        this.videoDuration = 45; // Simulated 45s audio recording
        let currentSec = 0;

        if (this.videoTimer) clearInterval(this.videoTimer);
        
        this.videoTimer = setInterval(() => {
          currentSec++;
          if (currentSec <= this.videoDuration) {
            const percent = (currentSec / this.videoDuration) * 100;
            if (this.progressBar) this.progressBar.style.width = `${percent}%`;
            this.updateTimeDisplay(currentSec, this.videoDuration);
          } else {
            this.stopPlayback();
          }
        }, 1000);
      }
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.btnPlayPause) this.btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    
    // Stop real video
    if (this.videoPlayer && !this.videoPlayer.paused) {
      this.videoPlayer.pause();
    }

    // Stop simulator
    if (this.videoTimer) {
      clearInterval(this.videoTimer);
      this.videoTimer = null;
    }
    
    if (this.waveformPlaying) this.waveformPlaying.style.display = 'none';
    if (this.progressBar) this.progressBar.style.width = '0%';
    this.updateTimeDisplay(0, 0);
  }

  updatePlayerProgress() {
    if (!this.videoPlayer) return;
    const curTime = this.videoPlayer.currentTime;
    const duration = this.videoPlayer.duration || 0;
    
    if (duration > 0) {
      const pct = (curTime / duration) * 100;
      if (this.progressBar) this.progressBar.style.width = `${pct}%`;
      this.updateTimeDisplay(curTime, duration);
    }
  }

  handleProgressClick(e) {
    const containerWidth = this.progressParent.offsetWidth;
    const clickX = e.offsetX;
    const pct = clickX / containerWidth;
    
    const hasRealVideo = (this.videoPlayer.style.display === 'block');

    if (hasRealVideo && this.videoPlayer.duration) {
      this.videoPlayer.currentTime = pct * this.videoPlayer.duration;
    } else if (!hasRealVideo && this.videoDuration) {
      // For mock playback, just skip the counter
      const newSec = Math.floor(pct * this.videoDuration);
      if (this.progressBar) this.progressBar.style.width = `${pct * 100}%`;
      this.updateTimeDisplay(newSec, this.videoDuration);
    }
  }

  updateTimeDisplay(current, duration) {
    if (!this.timeDisplay) return;
    
    const pad = (n) => n < 10 ? '0' + Math.floor(n) : Math.floor(n);
    
    const curM = Math.floor(current / 60);
    const curS = current % 60;
    
    const durM = Math.floor(duration / 60);
    const durS = duration % 60;

    this.timeDisplay.innerText = `${pad(curM)}:${pad(curS)} / ${pad(durM)}:${pad(durS)}`;
  }
}

window.RecruiterDashboard = RecruiterDashboard;
