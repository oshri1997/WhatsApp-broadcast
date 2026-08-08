// Single source of truth for guest state, shared between the HTTP API
// (server/index.js) and the incoming-RSVP-reply handler (server/rsvp.js) so
// both see and mutate the same records.
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

function getAll() {
  return guests;
}

function setAll(newGuests) {
  guests = newGuests.map((g) => ({ ...defaults(), ...g }));
  nextId = guests.reduce((max, g) => Math.max(max, g.id), 0) + 1;
}

function add(partial) {
  const guest = { id: nextId++, ...defaults(), ...partial };
  guests.push(guest);
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
  return guest;
}

module.exports = { getAll, setAll, add, findById, findByPhone, update };
