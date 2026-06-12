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
    this.renderMetricsSummary();
    this.renderCharts();
    this.renderCandidatesList();
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

  // Bar Chart: Score Distribution
  renderScoreChart() {
    const scoreSvg = document.getElementById('score-chart-svg');
    if (!scoreSvg) return;
    scoreSvg.innerHTML = '';

    // Create 5 score bins
    const bins = [
      { label: '< 6.0', count: 0, range: [0, 5.99] },
      { label: '6.0-6.9', count: 0, range: [6.0, 6.99] },
      { label: '7.0-7.9', count: 0, range: [7.0, 7.99] },
      { label: '8.0-8.9', count: 0, range: [8.0, 8.99] },
      { label: '9.0-10.0', count: 0, range: [9.0, 10.0] }
    ];

    // Populate bins
    this.candidates.forEach(c => {
      const score = c.overallScore;
      const bin = bins.find(b => score >= b.range[0] && score <= b.range[1]);
      if (bin) bin.count++;
    });

    const maxCount = Math.max(1, ...bins.map(b => b.count));
    const svgWidth = scoreSvg.clientWidth || 500;
    const svgHeight = scoreSvg.clientHeight || 240;
    
    scoreSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    // Layout configuration
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 40;

    const graphWidth = svgWidth - paddingLeft - paddingRight;
    const graphHeight = svgHeight - paddingTop - paddingBottom;
    const colWidth = graphWidth / bins.length;

    // Draw horizontal gridlines & axis indicators
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const y = paddingTop + (graphHeight * i) / gridCount;
      const value = Math.round(maxCount - (maxCount * i) / gridCount);
      
      // Line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', paddingLeft);
      line.setAttribute('y1', y);
      line.setAttribute('x2', svgWidth - paddingRight);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
      line.setAttribute('stroke-width', 1);
      scoreSvg.appendChild(line);

      // Y-axis Label
      const yText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yText.setAttribute('x', paddingLeft - 10);
      yText.setAttribute('y', y + 4);
      yText.setAttribute('fill', 'var(--color-text-muted)');
      yText.setAttribute('font-size', '10px');
      yText.setAttribute('text-anchor', 'end');
      yText.innerText = value;
      scoreSvg.appendChild(yText);
    }

    // Draw bars
    bins.forEach((bin, idx) => {
      const colX = paddingLeft + idx * colWidth + colWidth * 0.15;
      const barW = colWidth * 0.7;
      const barH = (bin.count / maxCount) * graphHeight;
      const colY = paddingTop + graphHeight - barH;

      // Draw standard SVG bar rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', colX);
      rect.setAttribute('y', colY);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', Math.max(2, barH));
      rect.setAttribute('rx', 4);
      
      // Accent gradient depending on bin index
      const glowColor = idx >= 3 ? 'var(--color-success)' : (idx >= 1 ? 'var(--accent-indigo)' : 'var(--color-error)');
      rect.setAttribute('fill', glowColor);
      rect.setAttribute('opacity', 0.8);
      rect.classList.add('svg-chart-bar');
      
      // Mouse interactions for Tooltip
      const tooltip = document.getElementById('chart-tooltip');
      rect.addEventListener('mouseover', (e) => {
        rect.setAttribute('opacity', 1);
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.innerHTML = `<strong>${bin.label}</strong>: ${bin.count} candidate${bin.count !== 1 ? 's' : ''}`;
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
        rect.setAttribute('opacity', 0.8);
        if (tooltip) tooltip.style.display = 'none';
      });

      scoreSvg.appendChild(rect);

      // Draw bottom X label
      const xText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xText.setAttribute('x', paddingLeft + idx * colWidth + colWidth / 2);
      xText.setAttribute('y', svgHeight - 15);
      xText.setAttribute('fill', 'var(--color-text-muted)');
      xText.setAttribute('font-size', '11px');
      xText.setAttribute('text-anchor', 'middle');
      xText.innerText = bin.label;
      scoreSvg.appendChild(xText);
    });
  }

  // Donut Chart: Applications by Role
  renderRoleChart() {
    const roleSvg = document.getElementById('role-chart-svg');
    if (!roleSvg) return;
    roleSvg.innerHTML = '';

    // Count candidates by role
    const counts = {};
    this.candidates.forEach(c => {
      counts[c.role] = (counts[c.role] || 0) + 1;
    });

    const roles = Object.keys(counts).map(role => ({
      name: role,
      count: counts[role]
    }));

    const total = roles.reduce((sum, r) => sum + r.count, 0);
    const svgWidth = roleSvg.clientWidth || 300;
    const svgHeight = roleSvg.clientHeight || 240;
    roleSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    if (total === 0) {
      // Empty display
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', svgWidth / 2);
      text.setAttribute('y', svgHeight / 2);
      text.setAttribute('fill', 'var(--color-text-muted)');
      text.setAttribute('text-anchor', 'middle');
      text.innerText = 'No Data Available';
      roleSvg.appendChild(text);
      return;
    }

    // Coordinates configuration
    const centerX = svgWidth * 0.35;
    const centerY = svgHeight / 2;
    const radius = 60;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;

    // Palette gradients
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b'];

    let currentOffset = 0;

    // Render donut circle segments
    roles.forEach((role, idx) => {
      const percentage = role.count / total;
      const strokeLength = percentage * circumference;
      const strokeOffset = circumference - strokeLength + currentOffset;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', centerX);
      circle.setAttribute('cy', centerY);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', 'transparent');
      circle.setAttribute('stroke', colors[idx % colors.length]);
      circle.setAttribute('stroke-width', strokeWidth);
      circle.setAttribute('stroke-dasharray', circumference);
      circle.setAttribute('stroke-dashoffset', strokeOffset);
      circle.setAttribute('transform', `rotate(-90 ${centerX} ${centerY})`);
      
      // hover visual changes
      circle.setAttribute('style', 'transition: stroke-width 0.2s ease; cursor: pointer;');
      circle.addEventListener('mouseover', () => circle.setAttribute('stroke-width', strokeWidth + 4));
      circle.addEventListener('mouseout', () => circle.setAttribute('stroke-width', strokeWidth));

      roleSvg.appendChild(circle);
      currentOffset -= strokeLength;
    });

    // Inner center text (Display total candidates)
    const centerValText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerValText.setAttribute('x', centerX);
    centerValText.setAttribute('y', centerY + 4);
    centerValText.setAttribute('fill', '#ffffff');
    centerValText.setAttribute('font-size', '16px');
    centerValText.setAttribute('font-weight', 'bold');
    centerValText.setAttribute('text-anchor', 'middle');
    centerValText.innerText = total;
    roleSvg.appendChild(centerValText);

    const centerLabelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerLabelText.setAttribute('x', centerX);
    centerLabelText.setAttribute('y', centerY + 18);
    centerLabelText.setAttribute('fill', 'var(--color-text-muted)');
    centerLabelText.setAttribute('font-size', '9px');
    centerLabelText.setAttribute('text-anchor', 'middle');
    centerLabelText.innerText = 'TOTAL';
    roleSvg.appendChild(centerLabelText);

    // Draw Legend panel on the right
    const legendX = svgWidth * 0.72;
    const legendStartY = centerY - (roles.length * 20) / 2;

    roles.forEach((role, idx) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // Color dot
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', legendX);
      rect.setAttribute('y', legendStartY + idx * 20);
      rect.setAttribute('width', 10);
      rect.setAttribute('height', 10);
      rect.setAttribute('rx', 2);
      rect.setAttribute('fill', colors[idx % colors.length]);
      g.appendChild(rect);

      // Label text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', legendX + 16);
      text.setAttribute('y', legendStartY + idx * 20 + 9);
      text.setAttribute('fill', 'var(--color-text-secondary)');
      text.setAttribute('font-size', '11px');
      
      // Smart abbreviation of roles if too long
      let displayName = role.name;
      if (displayName.length > 15) displayName = displayName.substring(0, 12) + '...';
      text.innerText = `${displayName} (${role.count})`;
      
      g.appendChild(text);
      roleSvg.appendChild(g);
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
