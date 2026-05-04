/* ══════════════════════════════════════════════════════════
   InterviewPro AI - Frontend Application Logic
   ══════════════════════════════════════════════════════════ */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : '';

// ── State ──
const state = {
    currentPage: 'dashboard',
    userIdentity: localStorage.getItem('iv_user_identity') || 'default_user',
    interviews: [],
    stats: null,
    resumeData: null,
    connected: false,
    interviewStartTime: null,
    durationInterval: null,
};

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploadZone();
    initUserIdentity();
    initInterviewControls();
    loadDashboard();
});

// ══════════════════════════════════════════════════════════
// Navigation
// ══════════════════════════════════════════════════════════

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    document.getElementById('btn-start-interview').addEventListener('click', () => {
        navigateTo('interview');
    });
}

function navigateTo(page) {
    state.currentPage = page;

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const activePage = document.getElementById(`page-${page}`);
    if (activePage) activePage.classList.add('active');

    // Load page data
    if (page === 'dashboard') loadDashboard();
    if (page === 'history') loadHistory();
    if (page === 'stats') loadStats();
}

// ══════════════════════════════════════════════════════════
// User Identity
// ══════════════════════════════════════════════════════════

function initUserIdentity() {
    const input = document.getElementById('user-identity');
    input.value = state.userIdentity;

    input.addEventListener('change', () => {
        state.userIdentity = input.value.trim() || 'default_user';
        localStorage.setItem('iv_user_identity', state.userIdentity);
        document.getElementById('user-avatar').textContent = state.userIdentity[0].toUpperCase();
        loadDashboard();
    });

    document.getElementById('user-avatar').textContent = state.userIdentity[0].toUpperCase();
}

// ══════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════

async function loadDashboard() {
    const name = state.userIdentity !== 'default_user' ? `, ${state.userIdentity}` : '';
    document.getElementById('greeting-name').textContent = name;

    try {
        // Load stats
        const statsRes = await fetch(`${API_BASE}/api/stats/${state.userIdentity}`);
        if (statsRes.ok) {
            const stats = await statsRes.json();
            state.stats = stats;
            animateCounter('stat-total-value', stats.total_interviews);
            animateCounter('stat-completed-value', stats.completed_interviews);
            animateCounter('stat-score-value', stats.average_score, true);
            animateCounter('stat-questions-value', stats.total_questions_answered);
        }
    } catch (e) {
        console.log('Stats API not available yet');
    }

    try {
        // Load resume status
        const resumeRes = await fetch(`${API_BASE}/api/resume/${state.userIdentity}`);
        if (resumeRes.ok) {
            const resume = await resumeRes.json();
            state.resumeData = resume;
            showResumeInfo(resume);
        }
    } catch (e) {
        console.log('Resume API not available yet');
    }

    try {
        // Load recent interviews
        const ivRes = await fetch(`${API_BASE}/api/interviews?user_identity=${state.userIdentity}&limit=5`);
        if (ivRes.ok) {
            const data = await ivRes.json();
            renderRecentInterviews(data.interviews);
        }
    } catch (e) {
        console.log('Interviews API not available yet');
    }
}

function animateCounter(elementId, target, isDecimal = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const duration = 1000;
    const start = performance.now();
    const initial = 0;

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = initial + (target - initial) * eased;
        el.textContent = isDecimal ? current.toFixed(1) : Math.round(current);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function showResumeInfo(resume) {
    document.getElementById('upload-zone').classList.add('hidden');
    document.getElementById('resume-info').classList.remove('hidden');
    document.getElementById('resume-status-badge').textContent = 'Uploaded';
    document.getElementById('resume-status-badge').className = 'badge badge-success';
    document.getElementById('resume-filename').textContent = resume.filename;

    const pd = resume.parsed_data;
    document.getElementById('parsed-skills').textContent = (pd.skills || []).length;
    document.getElementById('parsed-experience').textContent = (pd.experience || []).length;
    document.getElementById('parsed-projects').textContent = (pd.projects || []).length;

    document.getElementById('btn-reupload').addEventListener('click', () => {
        document.getElementById('upload-zone').classList.remove('hidden');
        document.getElementById('resume-info').classList.add('hidden');
        document.getElementById('resume-status-badge').textContent = 'No Resume';
        document.getElementById('resume-status-badge').className = 'badge';
    });
}

function renderRecentInterviews(interviews) {
    const container = document.getElementById('recent-list');
    if (!interviews || interviews.length === 0) {
        container.innerHTML = `<div class="empty-state"><p class="text-muted">No interviews yet. Start your first one!</p></div>`;
        return;
    }

    container.innerHTML = interviews.map(iv => `
        <div class="recent-item" data-id="${iv.id}" onclick="viewInterviewDetail(${iv.id})">
            <div class="recent-item-left">
                <span class="recent-item-date">${formatDate(iv.created_at)}</span>
                <span class="recent-item-type">${iv.interview_type || 'general'} interview</span>
            </div>
            <div class="recent-item-right">
                <span class="badge ${iv.status === 'completed' ? 'badge-success' : 'badge-warning'}">${iv.status}</span>
                <span class="recent-item-score" style="color: ${getScoreColor(iv.overall_score)}">${iv.overall_score ? iv.overall_score.toFixed(1) : '--'}/10</span>
            </div>
        </div>
    `).join('');
}

// ══════════════════════════════════════════════════════════
// Resume Upload
// ══════════════════════════════════════════════════════════

function initUploadZone() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('resume-file-input');
    const browseBtn = document.getElementById('btn-browse-file');

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    zone.addEventListener('click', () => fileInput.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) uploadResume(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) uploadResume(fileInput.files[0]);
    });
}

async function uploadResume(file) {
    showToast(`Uploading ${file.name}...`, 'info');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_identity', state.userIdentity);

    try {
        const res = await fetch(`${API_BASE}/api/resume/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Upload failed');
        }

        const data = await res.json();
        showToast(`Resume parsed: ${data.parsed.skills_count} skills, ${data.parsed.experience_count} experiences found`, 'success');

        // Refresh dashboard
        loadDashboard();
    } catch (e) {
        showToast(`Upload failed: ${e.message}`, 'error');
    }
}

// ══════════════════════════════════════════════════════════
// Interview Controls
// ══════════════════════════════════════════════════════════

function initInterviewControls() {
    document.getElementById('btn-connect').addEventListener('click', startInterview);
    document.getElementById('btn-disconnect').addEventListener('click', endInterview);
}

async function startInterview() {
    const orb = document.getElementById('voice-orb');
    const statusEl = document.getElementById('voice-status');
    const connectBtn = document.getElementById('btn-connect');
    const disconnectBtn = document.getElementById('btn-disconnect');
    const liveBadge = document.getElementById('badge-live');

    // Update UI to connecting state
    statusEl.textContent = 'Connecting to interview room...';
    orb.classList.add('active');
    connectBtn.disabled = true;

    try {
        // In production, this would use the LiveKit client SDK to connect
        // For now, we simulate the connection flow
        await new Promise(resolve => setTimeout(resolve, 1500));

        state.connected = true;
        state.interviewStartTime = Date.now();

        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        liveBadge.classList.remove('hidden');
        statusEl.textContent = 'Connected — InterviewPro is speaking...';
        orb.classList.add('speaking');

        document.getElementById('iv-status').textContent = 'Active';

        // Start duration counter
        state.durationInterval = setInterval(updateDuration, 1000);

        // Add welcome message to transcript
        addTranscriptMessage('agent', 'Welcome! I am InterviewPro, your AI interview assistant. Let me check if you have any existing sessions...');

        showToast('Connected to interview room', 'success');

        // Simulate agent interaction for demo
        setTimeout(() => {
            orb.classList.remove('speaking');
            statusEl.textContent = 'Listening...';
        }, 3000);

    } catch (e) {
        showToast('Failed to connect: ' + e.message, 'error');
        connectBtn.disabled = false;
        orb.classList.remove('active');
        statusEl.textContent = 'Connection failed. Try again.';
    }
}

function endInterview() {
    state.connected = false;
    clearInterval(state.durationInterval);

    const orb = document.getElementById('voice-orb');
    orb.classList.remove('active', 'speaking');

    document.getElementById('voice-status').textContent = 'Interview ended';
    document.getElementById('btn-connect').classList.remove('hidden');
    document.getElementById('btn-disconnect').classList.add('hidden');
    document.getElementById('badge-live').classList.add('hidden');
    document.getElementById('iv-status').textContent = 'Ended';

    showToast('Interview session ended', 'info');
}

function updateDuration() {
    if (!state.interviewStartTime) return;
    const elapsed = Math.floor((Date.now() - state.interviewStartTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('iv-duration').textContent = `${mins}:${secs}`;
}

function addTranscriptMessage(role, text) {
    const container = document.getElementById('transcript-messages');
    // Clear empty state
    const empty = container.querySelector('.empty-state');
    if (empty) empty.remove();

    const msg = document.createElement('div');
    msg.className = `msg msg-${role}`;
    msg.innerHTML = `<div class="msg-label">${role === 'agent' ? 'InterviewPro' : 'You'}</div><div>${text}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// ══════════════════════════════════════════════════════════
// History Page
// ══════════════════════════════════════════════════════════

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/interviews?user_identity=${state.userIdentity}&limit=50`);
        if (!res.ok) return;

        const data = await res.json();
        state.interviews = data.interviews;
        renderHistory(data.interviews);
    } catch (e) {
        console.log('History API not available');
    }
}

function renderHistory(interviews) {
    const container = document.getElementById('history-list');

    if (!interviews || interviews.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No interviews found</p><p class="text-muted">Complete interviews will appear here</p></div>`;
        return;
    }

    container.innerHTML = interviews.map(iv => {
        const score = iv.overall_score || 0;
        const dashoffset = 138.2 - (138.2 * score / 10);
        return `
        <div class="history-item" onclick="viewInterviewDetail(${iv.id})">
            <div>
                <div class="history-item-title">${capitalize(iv.interview_type || 'General')} Interview</div>
                <div class="history-item-meta">${formatDate(iv.created_at)} · ${iv.questions_asked || 0}/${iv.total_questions || 0} questions</div>
            </div>
            <span class="badge ${iv.status === 'completed' ? 'badge-success' : 'badge-warning'}">${iv.status}</span>
            <div class="score-ring">
                <svg viewBox="0 0 48 48">
                    <circle class="bg" cx="24" cy="24" r="22"/>
                    <circle class="fg" cx="24" cy="24" r="22" style="stroke-dashoffset: ${dashoffset}; stroke: ${getScoreColor(score)}"/>
                </svg>
                <span class="score-text" style="color: ${getScoreColor(score)}">${score.toFixed(1)}</span>
            </div>
        </div>`;
    }).join('');
}

async function viewInterviewDetail(id) {
    try {
        const res = await fetch(`${API_BASE}/api/interviews/${id}`);
        if (!res.ok) return;

        const data = await res.json();
        renderInterviewModal(data);
    } catch (e) {
        showToast('Could not load interview details', 'error');
    }
}

function renderInterviewModal(data) {
    const modal = document.getElementById('interview-detail-modal');
    const body = document.getElementById('modal-body');

    const iv = data.interview;
    const answers = data.answers || [];

    let html = `
        <div style="display:flex;gap:1.5rem;margin-bottom:1.5rem;flex-wrap:wrap;">
            <div><strong>Type:</strong> ${capitalize(iv.interview_type || 'General')}</div>
            <div><strong>Status:</strong> <span class="badge ${iv.status === 'completed' ? 'badge-success' : 'badge-warning'}">${iv.status}</span></div>
            <div><strong>Score:</strong> <span style="color:${getScoreColor(iv.overall_score)};font-weight:700">${(iv.overall_score || 0).toFixed(1)}/10</span></div>
            <div><strong>Date:</strong> ${formatDate(iv.created_at)}</div>
        </div>
        <h3 style="margin-bottom:1rem;font-size:1rem;">Questions & Answers</h3>
    `;

    if (answers.length === 0) {
        html += `<div class="empty-state"><p class="text-muted">No answers recorded for this interview</p></div>`;
    } else {
        html += answers.map((a, i) => `
            <div class="qa-item">
                <div class="qa-question">Q${i+1}: ${a.question_text}</div>
                <div class="qa-answer">${a.answer_text}</div>
                <div class="qa-meta">
                    <span class="qa-score">Score: ${a.score}/10</span>
                    <span class="qa-feedback">${a.feedback || ''}</span>
                </div>
            </div>
        `).join('');
    }

    body.innerHTML = html;
    modal.classList.remove('hidden');

    document.getElementById('modal-close').onclick = () => modal.classList.add('hidden');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

// ══════════════════════════════════════════════════════════
// Statistics Page
// ══════════════════════════════════════════════════════════

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/api/stats/${state.userIdentity}`);
        if (!res.ok) return;

        const stats = await res.json();
        renderScoreTrend(stats.recent_scores || []);
        renderCategoryBars(stats.category_scores || []);
    } catch (e) {
        console.log('Stats API not available');
    }
}

function renderScoreTrend(scores) {
    const canvas = document.getElementById('score-canvas');
    if (!canvas || scores.length === 0) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Reversed for chronological order
    const data = [...scores].reverse();
    const maxScore = 10;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = pad.top + (plotH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText((maxScore - (maxScore / 5) * i).toFixed(0), pad.left - 8, y + 4);
    }

    if (data.length < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '13px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Need more data for trend chart', w / 2, h / 2);
        return;
    }

    // Draw line
    const stepX = plotW / (data.length - 1);

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    gradient.addColorStop(0, 'rgba(99,102,241,0.3)');
    gradient.addColorStop(1, 'rgba(99,102,241,0)');

    // Fill area
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + plotH);
    data.forEach((d, i) => {
        const x = pad.left + stepX * i;
        const y = pad.top + plotH - (d.overall_score / maxScore) * plotH;
        ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + stepX * (data.length - 1), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((d, i) => {
        const x = pad.left + stepX * i;
        const y = pad.top + plotH - (d.overall_score / maxScore) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    data.forEach((d, i) => {
        const x = pad.left + stepX * i;
        const y = pad.top + plotH - (d.overall_score / maxScore) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.strokeStyle = '#0a0a0f';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function renderCategoryBars(categories) {
    const container = document.getElementById('category-bars');
    if (!categories || categories.length === 0) {
        container.innerHTML = `<div class="empty-state"><p class="text-muted">Complete interviews to see category scores</p></div>`;
        return;
    }

    const colors = {
        technical: '#6366f1',
        behavioral: '#10b981',
        experience: '#f59e0b',
        project: '#ec4899',
        problem_solving: '#8b5cf6',
    };

    container.innerHTML = categories.map(cat => {
        const pct = (cat.avg_score / 10) * 100;
        const color = colors[cat.category] || '#6366f1';
        return `
        <div class="cat-bar-item">
            <div class="cat-bar-header">
                <span class="cat-bar-name">${cat.category.replace('_', ' ')}</span>
                <span class="cat-bar-score">${cat.avg_score.toFixed(1)}/10</span>
            </div>
            <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════
// Utilities
// ══════════════════════════════════════════════════════════

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function getScoreColor(score) {
    if (!score) return 'var(--text-muted)';
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Make viewInterviewDetail globally accessible
window.viewInterviewDetail = viewInterviewDetail;
