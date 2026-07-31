const state = {
  guests: [],
  selected: new Set(),
  ready: false,
};

const el = {
  connectionStatus: document.getElementById('connection-status'),
  qrContainer: document.getElementById('qr-container'),
  logoutBtn: document.getElementById('logout-btn'),
  fileInput: document.getElementById('file-input'),
  uploadBtn: document.getElementById('upload-btn'),
  uploadError: document.getElementById('upload-error'),
  guestsSection: document.getElementById('guests-section'),
  guestsTableBody: document.querySelector('#guests-table tbody'),
  searchInput: document.getElementById('search-input'),
  selectAllBtn: document.getElementById('select-all-btn'),
  deselectAllBtn: document.getElementById('deselect-all-btn'),
  selectedCount: document.getElementById('selected-count'),
  messageSection: document.getElementById('message-section'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  sendError: document.getElementById('send-error'),
  progressSection: document.getElementById('progress-section'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  progressCurrent: document.getElementById('progress-current'),
  failedList: document.getElementById('failed-list'),
};

el.messageInput.value =
  'היי {{שם}}! 💍\nבשמחה רבה אנחנו מזמינים אותך לחתונה שלנו!\nנשמח לראותך בין אורחינו.\nפרטים נוספים יישלחו בקרוב ❤️';

async function fetchStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  renderStatus(data);
}

function renderStatus(data) {
  state.ready = data.status === 'READY';

  if (data.status === 'READY') {
    el.connectionStatus.textContent = '✅ מחובר לוואטסאפ';
    el.qrContainer.innerHTML = '';
    el.logoutBtn.hidden = false;
  } else if (data.status === 'QR' && data.qrDataUrl) {
    el.connectionStatus.textContent = 'סרוק את קוד ה-QR עם הוואטסאפ בטלפון שלך (הגדרות > מכשירים מקושרים)';
    el.qrContainer.innerHTML = `<img src="${data.qrDataUrl}" alt="QR" />`;
    el.logoutBtn.hidden = true;
  } else if (data.status === 'AUTHENTICATED') {
    el.connectionStatus.textContent = 'מתחבר...';
    el.qrContainer.innerHTML = '';
  } else {
    el.connectionStatus.textContent = 'מתחיל חיבור לוואטסאפ...';
    el.qrContainer.innerHTML = '';
    el.logoutBtn.hidden = true;
  }
}

el.logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
});

el.uploadBtn.addEventListener('click', async () => {
  el.uploadError.textContent = '';
  const file = el.fileInput.files[0];
  if (!file) {
    el.uploadError.textContent = 'יש לבחור קובץ קודם';
    return;
  }
  const formData = new FormData();
  formData.append('file', file);

  el.uploadBtn.disabled = true;
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      el.uploadError.textContent = data.error || 'שגיאה בהעלאת הקובץ';
      return;
    }
    state.guests = data.guests;
    state.selected = new Set(data.guests.filter((g) => g.valid).map((g) => g.id));
    el.guestsSection.hidden = false;
    el.messageSection.hidden = false;
    renderGuests();
  } catch (err) {
    el.uploadError.textContent = 'שגיאה בהעלאת הקובץ: ' + err.message;
  } finally {
    el.uploadBtn.disabled = false;
  }
});

function renderGuests() {
  const query = el.searchInput.value.trim().toLowerCase();
  const filtered = state.guests.filter(
    (g) => g.name.toLowerCase().includes(query) || (g.phoneRaw || '').includes(query)
  );

  el.guestsTableBody.innerHTML = '';
  for (const guest of filtered) {
    const tr = document.createElement('tr');
    if (!guest.valid) tr.classList.add('invalid');

    const checkboxCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selected.has(guest.id);
    checkbox.disabled = !guest.valid;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selected.add(guest.id);
      else state.selected.delete(guest.id);
      updateSelectedCount();
    });
    checkboxCell.appendChild(checkbox);

    const nameCell = document.createElement('td');
    nameCell.textContent = guest.name;

    const phoneCell = document.createElement('td');
    phoneCell.textContent = guest.phoneRaw || guest.phone || '';

    const flagCell = document.createElement('td');
    flagCell.textContent = guest.valid ? '' : '⚠️ מספר לא תקין';

    tr.append(checkboxCell, nameCell, phoneCell, flagCell);
    el.guestsTableBody.appendChild(tr);
  }

  updateSelectedCount();
}

function updateSelectedCount() {
  el.selectedCount.textContent = `נבחרו ${state.selected.size} מתוך ${state.guests.length}`;
}

el.searchInput.addEventListener('input', renderGuests);

el.selectAllBtn.addEventListener('click', () => {
  for (const g of state.guests) {
    if (g.valid) state.selected.add(g.id);
  }
  renderGuests();
});

el.deselectAllBtn.addEventListener('click', () => {
  state.selected.clear();
  renderGuests();
});

el.sendBtn.addEventListener('click', async () => {
  el.sendError.textContent = '';

  if (!state.ready) {
    el.sendError.textContent = 'יש לחבר את הוואטסאפ לפני השליחה';
    return;
  }
  if (state.selected.size === 0) {
    el.sendError.textContent = 'יש לבחור לפחות מוזמן אחד';
    return;
  }

  const confirmed = confirm(`לשלוח הודעה ל-${state.selected.size} מוזמנים?`);
  if (!confirmed) return;

  el.sendBtn.disabled = true;
  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestIds: Array.from(state.selected),
        message: el.messageInput.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      el.sendError.textContent = data.error || 'שגיאה בשליחה';
      el.sendBtn.disabled = false;
      return;
    }
    el.progressSection.hidden = false;
    pollProgress(data.jobId);
  } catch (err) {
    el.sendError.textContent = 'שגיאה בשליחה: ' + err.message;
    el.sendBtn.disabled = false;
  }
});

function pollProgress(jobId) {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/send/${jobId}/progress`);
    const job = await res.json();
    if (job.error && !job.total) {
      clearInterval(interval);
      return;
    }

    const done = job.sent + job.failed.length;
    const percent = job.total ? Math.round((done / job.total) * 100) : 0;
    el.progressFill.style.width = percent + '%';
    el.progressText.textContent = `נשלחו ${job.sent} מתוך ${job.total} (נכשלו: ${job.failed.length})`;
    el.progressCurrent.textContent = job.current ? `שולח כעת אל: ${job.current}` : '';

    el.failedList.innerHTML = '';
    for (const f of job.failed) {
      const li = document.createElement('li');
      li.textContent = `${f.name} (${f.phone}) - ${f.reason}`;
      el.failedList.appendChild(li);
    }

    if (job.status === 'done') {
      clearInterval(interval);
      el.sendBtn.disabled = false;
      el.progressCurrent.textContent = 'השליחה הסתיימה ✅';
    }
  }, 1500);
}

fetchStatus();
setInterval(fetchStatus, 2500);
