export interface MessageTemplate {
  label: string;
  text: string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
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

export const REMINDER_TEMPLATE = MESSAGE_TEMPLATES[4];

/**
 * Sent as its own follow-up message right after the invitation, not appended
 * to it - guests can answer freely in their own words (the RSVP parser
 * already understands many phrasings), these are just the suggested ones.
 */
export const RSVP_QUESTION_MESSAGE =
  'מגיעים לחתונה? 💍\nאפשר לענות כאן:\n\n✅ כן\n❌ לא\n❓ אולי';
