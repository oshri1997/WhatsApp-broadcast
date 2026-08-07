const state = {
  guests: [],
  selected: new Set(),
  accounts: [],
  editingGuestId: null,
};

const el = {
  accountsContainer: document.getElementById('accounts-container'),
  addAccountInput: document.getElementById('add-account-input'),
  addAccountBtn: document.getElementById('add-account-btn'),
  fileInput: document.getElementById('file-input'),
  uploadBtn: document.getElementById('upload-btn'),
  uploadError: document.getElementById('upload-error'),
  addNameInput: document.getElementById('add-name-input'),
  addPhoneInput: document.getElementById('add-phone-input'),
  addSideInput: document.getElementById('add-side-input'),
  accountLabelsDatalist: document.getElementById('account-labels'),
  addGuestBtn: document.getElementById('add-guest-btn'),
  addGuestError: document.getElementById('add-guest-error'),
  guestsTableBody: document.querySelector('#guests-table tbody'),
  searchInput: document.getElementById('search-input'),
  selectAllBtn: document.getElementById('select-all-btn'),
  deselectAllBtn: document.getElementById('deselect-all-btn'),
  selectedCount: document.getElementById('selected-count'),
  messageInput: document.getElementById('message-input'),
  templateSelect: document.getElementById('template-select'),
  mediaInput: document.getElementById('media-input'),
  mediaPreviewContainer: document.getElementById('media-preview-container'),
  mediaError: document.getElementById('media-error'),
  sendBtn: document.getElementById('send-btn'),
  sendError: document.getElementById('send-error'),
  progressSection: document.getElementById('progress-section'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  progressCurrent: document.getElementById('progress-current'),
  failedList: document.getElementById('failed-list'),
};

const MESSAGE_TEMPLATES = [
  {
    label: 'אישית עם שם',
    text: 'היי {{שם}}! 💍\nבשמחה רבה אנחנו מזמינים אותך לחתונה שלנו!\nנשמח לראותך בין אורחינו.\nפרטים נוספים יישלחו בקרוב ❤️',
  },
  {
    label: 'כללית בלי שם',
    text: 'הנכם מוזמנים לחגוג איתנו! 💍\nבשמחה רבה אנחנו מתחתנים, ונשמח לראותכם בין אורחינו.\nפרטים נוספים יישלחו בקרוב ❤️',
  },
  {
    label: 'רשמית',
    text: 'בשמחה ובהתרגשות הננו מתכבדים להזמינכם לחתונתנו.\nנשמח מאוד לחגוג יחד איתכם את היום המיוחד הזה.\nפרטי הטקס והאירוע יישלחו בהמשך.\nבברכה,',
  },
  {
    label: 'קלילה/חברים',
    text: 'יאללה חברים 🎉 אנחנו מתחתנים!!\nבואו לרקוד איתנו ולחגוג את היום הכי שמח שלנו 💃🕺\nפרטים בקרוב, תשמרו תאריך!',
  },
  {
    label: 'תזכורת לקראת האירוע',
    text: 'היי {{שם}} 😊\nרק תזכורת קטנה - החתונה שלנו מתקרבת!\nנשמח לדעת שתגיעו, ומחכים לחגוג יחד ❤️',
  },
];

function populateTemplateSelect() {
  el.templateSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- בחירת תבנית --';
  el.templateSelect.appendChild(placeholder);

  MESSAGE_TEMPLATES.forEach((template, idx) => {
    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = template.label;
    el.templateSelect.appendChild(option);
  });
}

el.templateSelect.addEventListener('change', () => {
  const idx = el.templateSelect.value;
  if (idx === '') return;

  const template = MESSAGE_TEMPLATES[Number(idx)];
  const hasContent = el.messageInput.value.trim().length > 0;
  if (hasContent && !confirm('לטעון את התבנית ולהחליף את ההודעה הנוכחית?')) {
    el.templateSelect.value = '';
    return;
  }

  el.messageInput.value = template.text;
  el.templateSelect.value = '';
});

populateTemplateSelect();
el.messageInput.value = MESSAGE_TEMPLATES[0].text;

function statusLabel(status) {
  if (status === 'READY') return '✅ מחובר';
  if (status === 'QR') return 'סרוק QR כדי לחבר';
  if (status === 'AUTHENTICATED') return 'מתחבר...';
  return 'מאתחל...';
}

async function fetchAccounts() {
  const res = await fetch('/api/accounts');
  const data = await res.json();
  state.accounts = data.accounts;

  // Both render functions tear down and rebuild their DOM from scratch, which
  // would wipe out an in-progress edit (guest editor textarea, account rename
  // input) every time this polls. Skip rebuilding whatever the user is
  // actively editing.
  if (!el.accountsContainer.contains(document.activeElement)) {
    renderAccounts();
  }
  if (state.editingGuestId === null) {
    renderGuests(); // side -> account resolution may have changed
  }
}

function renderAccounts() {
  el.accountsContainer.innerHTML = '';

  for (const account of state.accounts) {
    const card = document.createElement('div');
    card.className = 'account-card';

    const header = document.createElement('div');
    header.className = 'account-card-header';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = account.label;
    labelInput.addEventListener('change', async () => {
      await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: labelInput.value }),
      });
      fetchAccounts();
    });

    const status = document.createElement('span');
    status.className = 'status-line';
    status.textContent = statusLabel(account.status);

    header.append(labelInput, status);

    if (account.status === 'READY') {
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'secondary';
      logoutBtn.textContent = 'התנתקות';
      logoutBtn.addEventListener('click', async () => {
        await fetch(`/api/accounts/${account.id}/logout`, { method: 'POST' });
        fetchAccounts();
      });
      header.appendChild(logoutBtn);
    }

    if (state.accounts.length > 1) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'secondary';
      removeBtn.textContent = '🗑️ הסרה';
      removeBtn.addEventListener('click', async () => {
        if (!confirm(`להסיר את החיבור "${account.label}"?`)) return;
        await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
        fetchAccounts();
      });
      header.appendChild(removeBtn);
    }

    card.appendChild(header);

    if (account.status === 'QR' && account.qrDataUrl) {
      const img = document.createElement('img');
      img.src = account.qrDataUrl;
      card.appendChild(img);
    }

    el.accountsContainer.appendChild(card);
  }

  el.accountLabelsDatalist.innerHTML = '';
  for (const account of state.accounts) {
    const option = document.createElement('option');
    option.value = account.label;
    el.accountLabelsDatalist.appendChild(option);
  }
}

el.addAccountBtn.addEventListener('click', async () => {
  const label = el.addAccountInput.value.trim();
  await fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  el.addAccountInput.value = '';
  fetchAccounts();
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
    renderGuests();
  } catch (err) {
    el.uploadError.textContent = 'שגיאה בהעלאת הקובץ: ' + err.message;
  } finally {
    el.uploadBtn.disabled = false;
  }
});

el.addGuestBtn.addEventListener('click', async () => {
  el.addGuestError.textContent = '';
  const name = el.addNameInput.value.trim();
  const phone = el.addPhoneInput.value.trim();
  const side = el.addSideInput.value.trim();

  if (!name || !phone) {
    el.addGuestError.textContent = 'יש להזין שם ומספר טלפון';
    return;
  }

  el.addGuestBtn.disabled = true;
  try {
    const res = await fetch('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, side }),
    });
    const data = await res.json();
    if (!res.ok) {
      el.addGuestError.textContent = data.error || 'שגיאה בהוספת מוזמן';
      return;
    }
    state.guests.push(data.guest);
    if (data.guest.valid) state.selected.add(data.guest.id);
    el.addNameInput.value = '';
    el.addPhoneInput.value = '';
    el.addSideInput.value = '';
    el.addNameInput.focus();
    renderGuests();
  } catch (err) {
    el.addGuestError.textContent = 'שגיאה בהוספת מוזמן: ' + err.message;
  } finally {
    el.addGuestBtn.disabled = false;
  }
});

for (const input of [el.addNameInput, el.addPhoneInput, el.addSideInput]) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.addGuestBtn.click();
  });
}

function renderMediaPreview(dataUrl, kind) {
  el.mediaPreviewContainer.innerHTML = '';
  if (!dataUrl) return;

  const media = document.createElement(kind === 'video' ? 'video' : 'img');
  media.src = dataUrl;
  if (kind === 'video') media.controls = true;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'secondary';
  removeBtn.textContent = 'הסרה';
  removeBtn.addEventListener('click', async () => {
    await fetch('/api/invitation-media', { method: 'DELETE' });
    el.mediaInput.value = '';
    renderMediaPreview(null);
  });

  el.mediaPreviewContainer.append(media, removeBtn);
}

el.mediaInput.addEventListener('change', async () => {
  el.mediaError.textContent = '';
  const file = el.mediaInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('media', file);

  try {
    const res = await fetch('/api/invitation-media', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      el.mediaError.textContent = data.error || 'שגיאה בהעלאת הקובץ';
      return;
    }
    renderMediaPreview(data.dataUrl, data.kind);
  } catch (err) {
    el.mediaError.textContent = 'שגיאה בהעלאת הקובץ: ' + err.message;
  }
});

async function loadExistingMedia() {
  const res = await fetch('/api/invitation-media');
  const data = await res.json();
  renderMediaPreview(data.dataUrl, data.kind);
}

function renderGuests() {
  const query = el.searchInput.value.trim().toLowerCase();
  const filtered = state.guests.filter(
    (g) => g.name.toLowerCase().includes(query) || (g.phoneRaw || '').includes(query)
  );

  const multipleAccounts = state.accounts.length > 1;

  el.guestsTableBody.innerHTML = '';
  for (const guest of filtered) {
    const sideUnresolved = multipleAccounts && !guest.resolvedAccountId;
    const canSend = guest.valid && !sideUnresolved;

    const tr = document.createElement('tr');
    if (!canSend) tr.classList.add('invalid');

    const checkboxCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selected.has(guest.id);
    checkbox.disabled = !canSend;
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

    const sideCell = document.createElement('td');
    if (guest.resolvedAccountId) {
      sideCell.textContent = guest.resolvedAccountLabel;
    } else if (guest.side) {
      sideCell.innerHTML = '';
      const warning = document.createElement('span');
      warning.className = 'side-warning';
      warning.textContent = `⚠️ "${guest.side}" לא מזוהה`;
      sideCell.appendChild(warning);
    } else if (multipleAccounts) {
      const warning = document.createElement('span');
      warning.className = 'side-warning';
      warning.textContent = '⚠️ לא הוגדר צד';
      sideCell.appendChild(warning);
    }

    const editCell = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'secondary';
    editBtn.textContent = '✏️ עריכה';
    editBtn.addEventListener('click', () => {
      state.editingGuestId = state.editingGuestId === guest.id ? null : guest.id;
      renderGuests();
    });
    editCell.appendChild(editBtn);
    if (guest.customMessage) {
      const badge = document.createElement('span');
      badge.className = 'personal-badge';
      badge.textContent = 'הודעה אישית';
      editCell.appendChild(badge);
    }

    const flagCell = document.createElement('td');
    flagCell.textContent = guest.valid ? '' : '⚠️ מספר לא תקין';

    tr.append(checkboxCell, nameCell, phoneCell, sideCell, editCell, flagCell);
    el.guestsTableBody.appendChild(tr);

    if (state.editingGuestId === guest.id) {
      el.guestsTableBody.appendChild(buildEditorRow(guest));
    }
  }

  updateSelectedCount();
}

function buildEditorRow(guest) {
  const editorTr = document.createElement('tr');
  editorTr.classList.add('editing-row');

  const cell = document.createElement('td');
  cell.colSpan = 6;
  cell.className = 'custom-msg-editor';

  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'edit-fields';

  const nameField = document.createElement('div');
  nameField.innerHTML = '<label>שם</label>';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = guest.name;
  nameField.appendChild(nameInput);

  const phoneField = document.createElement('div');
  phoneField.innerHTML = '<label>טלפון</label>';
  const phoneInput = document.createElement('input');
  phoneInput.type = 'text';
  phoneInput.value = guest.phoneRaw || guest.phone || '';
  phoneField.appendChild(phoneInput);

  const sideField = document.createElement('div');
  sideField.innerHTML = '<label>צד</label>';
  const sideInput = document.createElement('input');
  sideInput.type = 'text';
  sideInput.setAttribute('list', 'account-labels');
  sideInput.value = guest.side || '';
  sideField.appendChild(sideInput);

  fieldsGrid.append(nameField, phoneField, sideField);

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'הודעה אישית ל' + guest.name + ' (אם ריק - תישלח ההודעה הכללית)';
  textarea.value = guest.customMessage || '';

  const actions = document.createElement('div');
  actions.className = 'editor-actions';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'שמירה';
  saveBtn.addEventListener('click', () =>
    saveGuestEdits(guest.id, {
      name: nameInput.value,
      phone: phoneInput.value,
      side: sideInput.value,
      customMessage: textarea.value,
    })
  );

  const clearMessageBtn = document.createElement('button');
  clearMessageBtn.className = 'secondary';
  clearMessageBtn.textContent = 'איפוס הודעה להודעה כללית';
  clearMessageBtn.addEventListener('click', () =>
    saveGuestEdits(guest.id, {
      name: nameInput.value,
      phone: phoneInput.value,
      side: sideInput.value,
      customMessage: '',
    })
  );

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'secondary';
  cancelBtn.textContent = 'ביטול';
  cancelBtn.addEventListener('click', () => {
    state.editingGuestId = null;
    renderGuests();
  });

  actions.append(saveBtn, clearMessageBtn, cancelBtn);
  cell.append(fieldsGrid, textarea, actions);
  editorTr.appendChild(cell);
  return editorTr;
}

async function saveGuestEdits(guestId, updates) {
  const res = await fetch(`/api/guests/${guestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (res.ok) {
    const idx = state.guests.findIndex((g) => g.id === guestId);
    if (idx !== -1) state.guests[idx] = data.guest;
  }
  state.editingGuestId = null;
  renderGuests();
}

function updateSelectedCount() {
  el.selectedCount.textContent = `נבחרו ${state.selected.size} מתוך ${state.guests.length}`;
}

el.searchInput.addEventListener('input', renderGuests);

el.selectAllBtn.addEventListener('click', () => {
  const multipleAccounts = state.accounts.length > 1;
  for (const g of state.guests) {
    const sideUnresolved = multipleAccounts && !g.resolvedAccountId;
    if (g.valid && !sideUnresolved) state.selected.add(g.id);
  }
  renderGuests();
});

el.deselectAllBtn.addEventListener('click', () => {
  state.selected.clear();
  renderGuests();
});

el.sendBtn.addEventListener('click', async () => {
  el.sendError.textContent = '';

  const anyReady = state.accounts.some((a) => a.status === 'READY');
  if (!anyReady) {
    el.sendError.textContent = 'יש לחבר לפחות חשבון וואטסאפ אחד לפני השליחה';
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

async function loadExistingGuests() {
  const res = await fetch('/api/guests');
  const data = await res.json();
  state.guests = data.guests;
  state.selected = new Set(data.guests.filter((g) => g.valid).map((g) => g.id));
  renderGuests();
}

loadExistingGuests();
loadExistingMedia();
fetchAccounts();
setInterval(fetchAccounts, 2500);
