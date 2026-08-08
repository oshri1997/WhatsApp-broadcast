const guestStore = require('./guestStore');

const YES_RE = /^(כן|כן בטח|כן ברור|מגיע|מגיעה|מגיעים|נגיע|נגיעה|בטח|ברור|כמובן|בכיף|יאלה כן)/;
const NO_RE = /^(לא|לא נגיע|לא נגיעה|לא מגיע|לא מגיעה|לא נוכל|לצערי לא|לצערנו לא)/;
const MAYBE_RE = /^(אולי|לא בטוח|לא בטוחה|לא יודע|לא יודעת|עוד לא יודע|עוד לא יודעת|נראה|תלוי)/;

function normalizePhoneFromChatId(chatId) {
  return String(chatId).replace(/@c\.us$/, '').replace(/\D/g, '');
}

function parseYesNoMaybe(text) {
  const t = text.trim();
  if (NO_RE.test(t)) return 'no';
  if (YES_RE.test(t)) return 'yes';
  if (MAYBE_RE.test(t)) return 'maybe';
  return null;
}

function parseCount(text) {
  const match = text.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Called whenever any connected WhatsApp account receives a message.
// `sendReply` is that account's own sendMessage(phone, text) - replies must
// go out from the same number the guest is chatting with.
async function handleIncomingMessage(accountId, chatId, text, sendReply) {
  if (!text) return;
  const phone = normalizePhoneFromChatId(chatId);
  const guest = guestStore.findByPhone(phone);

  // Only engage with guests we actually sent an invitation to - otherwise
  // the connected number would auto-reply to any random incoming message.
  if (!guest || !guest.invited) return;

  const reply = (msg) => sendReply(phone, msg).catch(() => {});

  if (guest.rsvpAwaitingCount) {
    const count = parseCount(text);
    if (count != null) {
      guestStore.update(guest.id, { rsvpCount: count, rsvpAwaitingCount: false });
      await reply(`תודה רבה! נרשמו ${count} אורחים מגיעים 🎉`);
    } else {
      await reply('לא הבנתי - כמה אנשים בסך הכל מגיעים? (אפשר לענות רק במספר)');
    }
    return;
  }

  const status = parseYesNoMaybe(text);
  if (status === 'yes') {
    guestStore.update(guest.id, { rsvpStatus: 'yes', rsvpAwaitingCount: true });
    await reply('איזה כיף! כמה אנשים בסך הכל מגיעים (כולל אותך)?');
  } else if (status === 'no') {
    guestStore.update(guest.id, { rsvpStatus: 'no', rsvpCount: 0, rsvpAwaitingCount: false });
    await reply('תודה רבה על העדכון, נתגעגע! 💔');
  } else if (status === 'maybe') {
    guestStore.update(guest.id, { rsvpStatus: 'maybe', rsvpAwaitingCount: false });
    await reply('בסדר גמור, נשמח לעדכון כשתדעו/י יותר 🙏');
  } else if (!guest.rsvpStatus) {
    // Only nudge if they've never answered - avoid pestering guests who
    // already RSVP'd and are just sending an unrelated follow-up message.
    await reply('היי! רק לוודא שקיבלת את ההזמנה - מגיעים? אפשר לענות כן / לא / אולי 🙂');
  }
}

module.exports = { handleIncomingMessage };
