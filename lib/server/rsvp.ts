import * as guestStore from './guestStore';
import { normalizePhone } from './phone';
import type { RsvpStatus } from '@/lib/types';

const YES_RE = /^(כן|כן בטח|כן ברור|מגיע|מגיעה|מגיעים|נגיע|נגיעה|בטח|ברור|כמובן|בכיף|יאלה כן)/;
const NO_RE = /^(לא|לא נגיע|לא נגיעה|לא מגיע|לא מגיעה|לא נוכל|לצערי לא|לצערנו לא)/;
const MAYBE_RE = /^(אולי|לא בטוח|לא בטוחה|לא יודע|לא יודעת|עוד לא יודע|עוד לא יודעת|נראה|תלוי)/;

function parseYesNoMaybe(text: string): RsvpStatus | null {
  const t = text.trim();
  if (NO_RE.test(t)) return 'no';
  if (YES_RE.test(t)) return 'yes';
  if (MAYBE_RE.test(t)) return 'maybe';
  return null;
}

function parseCount(text: string): number | null {
  const match = text.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Called whenever any connected WhatsApp account receives a message.
// `phone` is the sender's resolved phone number (used to match a guest);
// `chatId` is the original chat's own address, used for the reply itself -
// WhatsApp increasingly addresses chats by an opaque LID rather than the
// phone number, so a reply must go back to `chatId`, not a freshly built
// <phone>@c.us address, or it can silently fail to reach the right chat.
// `sendReply` is that account's own sendRaw(chatId, text).
export async function handleIncomingMessage(
  chatId: string,
  phone: string,
  text: string,
  sendReply: (chatId: string, text: string) => Promise<void>
): Promise<void> {
  if (!text) return;
  const normalizedPhone = normalizePhone(phone);
  const guest = guestStore.findByPhone(normalizedPhone);

  // Only engage with guests we actually sent an invitation to - otherwise the
  // connected number would auto-reply to any random incoming message.
  if (!guest) {
    console.log(`RSVP: message from ${normalizedPhone} does not match any known guest - ignoring.`);
    return;
  }
  if (!guest.invited) {
    console.log(
      `RSVP: message from guest "${guest.name}" (${normalizedPhone}) who was never sent an invite - ignoring.`
    );
    return;
  }
  console.log(`RSVP: message from guest "${guest.name}": "${text}"`);

  const reply = (msg: string) =>
    sendReply(chatId, msg).catch((err: Error) => {
      console.error(`Failed to send RSVP reply to guest ${guest.id}:`, err.message);
    });

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
