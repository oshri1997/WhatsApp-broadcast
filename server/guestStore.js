const fs = require('fs');
const path = require('path');

// Single source of truth for guest state, shared between the HTTP API
// (server/index.js) and the incoming-RSVP-reply handler (server/rsvp.js) so
// both see and mutate the same records. Persisted to disk so a server
// restart doesn't lose who was already invited / how they RSVP'd - without
// this, a restart between sending invites and guests replying would silently
// break RSVP matching (the guest would simply no longer exist in memory).
const DATA_FILE = path.join(__dirname, '..', 'data', 'guests.json');

let guests = [];
let nextId = 1;

function defaults() {
  return {
    rsvpStatus: null, // null | 'yes' | 'no' | 'maybe'
    rsvpCount: null,
    rsvpAwaitingCount: false,
    invited: false,
  };
}

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    guests = Array.isArray(parsed) ? parsed : [];
    nextId = guests.reduce((max, g) => Math.max(max, g.id), 0) + 1;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to load saved guest list, starting empty:', err.message);
    }
    guests = [];
    nextId = 1;
  }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2));
  } catch (err) {
    console.error('Failed to save guest list:', err.message);
  }
}

load();

function getAll() {
  return guests;
}

function setAll(newGuests) {
  guests = newGuests.map((g) => ({ ...defaults(), ...g }));
  nextId = guests.reduce((max, g) => Math.max(max, g.id), 0) + 1;
  save();
}

function add(partial) {
  const guest = { id: nextId++, ...defaults(), ...partial };
  guests.push(guest);
  save();
  return guest;
}

function findById(id) {
  return guests.find((g) => g.id === id) || null;
}

function findByPhone(phone) {
  return guests.find((g) => g.phone === phone) || null;
}

function update(id, patch) {
  const guest = findById(id);
  if (!guest) return null;
  Object.assign(guest, patch);
  save();
  return guest;
}

module.exports = { getAll, setAll, add, findById, findByPhone, update };
