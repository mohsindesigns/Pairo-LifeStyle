import dbConnect from './db';
import SizeConfirmation from '@/models/SizeConfirmation';

/**
 * Pulls customer replies to size confirmation emails out of the support
 * mailbox over IMAP and attaches them to the matching SizeConfirmation.
 *
 * Config (env):
 *   IMAP_HOST   required — e.g. imap.hostinger.com
 *   IMAP_PORT   default 993 (TLS)
 *   IMAP_USER   mailbox login (falls back to EMAIL_USER)
 *   IMAP_PASS   mailbox password (falls back to EMAIL_PASS)
 *
 * Replies are matched by the In-Reply-To / References headers (exact), or —
 * as a fallback for clients that drop them — by "Order #<number>" in the
 * subject coming from the customer's own address.
 */

const LOOKBACK_DAYS = 60;
const MIN_SYNC_GAP_MS = 20 * 1000;

let lastSyncAt = 0;
let syncInFlight = null;

export function isInboxConfigured() {
  return Boolean(process.env.IMAP_HOST);
}

function imapSettings() {
  const port = parseInt(process.env.IMAP_PORT || '993', 10);
  return {
    host: process.env.IMAP_HOST,
    port,
    secure: port === 993,
    auth: {
      user: process.env.IMAP_USER || process.env.EMAIL_USER,
      pass: process.env.IMAP_PASS || process.env.EMAIL_PASS,
    },
    logger: false,
    tls: { rejectUnauthorized: false },
  };
}

/** Drops the quoted history / signature so only what the customer typed remains. */
export function extractReplyText(raw = '') {
  const lines = String(raw).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    if (/^>/.test(line)) break;
    if (/^On .+wrote:\s*$/i.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    if (/^From:\s.+/i.test(line) && out.length > 0 && !out[out.length - 1].trim()) break;
    out.push(line);
  }
  return out.join('\n').trim().slice(0, 5000);
}

function headerIds(value) {
  if (!value) return [];
  return String(value).match(/<[^>]+>/g) || [];
}

function parseHeaderBlock(buf) {
  const text = buf ? buf.toString('utf8') : '';
  const unfolded = text.replace(/\r?\n[ \t]+/g, ' ');
  const get = (name) => {
    const m = unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'));
    return m ? m[1].trim() : '';
  };
  return {
    messageId: get('message-id'),
    inReplyTo: get('in-reply-to'),
    references: get('references'),
  };
}

async function runSync() {
  await dbConnect();

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await SizeConfirmation.find({ sentAt: { $gte: since } });
  if (candidates.length === 0) return { newReplies: 0, checked: 0 };

  const byMessageId = new Map(candidates.map((c) => [c.messageId, c]));
  const oldest = candidates.reduce((min, c) => (c.sentAt < min ? c.sentAt : min), new Date());
  const searchSince = new Date(oldest.getTime() - 24 * 60 * 60 * 1000);

  // Loaded lazily so the app still builds/runs when the deps aren't installed.
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');

  const client = new ImapFlow(imapSettings());
  client.on('error', (err) => console.error('[SizeInbox] IMAP error:', err.message));
  await client.connect();

  let newReplies = 0;
  let checked = 0;

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = (await client.search({ since: searchSince }, { uid: true })) || [];
      const recent = uids.slice(-300);

      const matches = [];
      for await (const msg of client.fetch(
        recent,
        { uid: true, envelope: true, headers: ['message-id', 'in-reply-to', 'references'] },
        { uid: true }
      )) {
        checked++;
        const hdr = parseHeaderBlock(msg.headers);
        const fromEmail = (msg.envelope?.from?.[0]?.address || '').toLowerCase();
        const subject = msg.envelope?.subject || '';

        let conf = null;
        for (const id of [...headerIds(hdr.inReplyTo), ...headerIds(hdr.references)]) {
          if (byMessageId.has(id)) { conf = byMessageId.get(id); break; }
        }
        if (!conf) {
          // Fallback for clients that drop reply headers: same sender + order number in the
          // subject, and only mail sent after the size email (1 min tolerance for clock skew).
          const msgDate = msg.envelope?.date ? new Date(msg.envelope.date).getTime() : null;
          conf = candidates.find(
            (c) =>
              c.customerEmail === fromEmail &&
              subject.includes(`Order #${c.orderNumber}`) &&
              (msgDate === null || msgDate >= new Date(c.sentAt).getTime() - 60 * 1000)
          ) || null;
        }
        if (!conf) continue;
        // Ignore our own outgoing copy if it shows up in this mailbox.
        if (hdr.messageId && hdr.messageId === conf.messageId) continue;

        matches.push({ uid: msg.uid, confId: conf._id, messageId: hdr.messageId || `uid-${msg.uid}` });
      }

      for (const m of matches) {
        const already = await SizeConfirmation.exists({ _id: m.confId, 'replies.messageId': m.messageId });
        if (already) continue;

        const full = await client.fetchOne(m.uid, { source: true }, { uid: true });
        if (!full?.source) continue;
        const parsed = await simpleParser(full.source);

        const text = extractReplyText(parsed.text || '') || '(no text content)';
        const reply = {
          messageId: m.messageId,
          fromEmail: (parsed.from?.value?.[0]?.address || '').toLowerCase(),
          fromName: parsed.from?.value?.[0]?.name || '',
          text,
          receivedAt: parsed.date || new Date(),
          read: false,
        };

        const res = await SizeConfirmation.updateOne(
          { _id: m.confId, 'replies.messageId': { $ne: m.messageId } },
          {
            $push: { replies: reply },
            $inc: { unreadReplies: 1 },
            $set: { lastReplyAt: reply.receivedAt },
          }
        );
        if (res.modifiedCount) {
          newReplies++;
          // Don't downgrade an already-Confirmed record.
          await SizeConfirmation.updateOne(
            { _id: m.confId, status: 'Awaiting Reply' },
            { $set: { status: 'Replied' } }
          );
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { newReplies, checked };
}

/**
 * Throttled, de-duplicated sync: concurrent callers share one run, and calls
 * within MIN_SYNC_GAP_MS of the last finished run are skipped (unless forced).
 */
export async function syncSizeConfirmationReplies({ force = false } = {}) {
  if (!isInboxConfigured()) {
    return { configured: false, newReplies: 0, skipped: true };
  }
  if (syncInFlight) return syncInFlight;
  if (!force && Date.now() - lastSyncAt < MIN_SYNC_GAP_MS) {
    return { configured: true, newReplies: 0, skipped: true };
  }

  syncInFlight = runSync()
    .then((r) => ({ configured: true, ...r }))
    .catch((err) => {
      console.error('[SizeInbox] sync failed:', err.message);
      return { configured: true, newReplies: 0, error: err.message };
    })
    .finally(() => {
      lastSyncAt = Date.now();
      syncInFlight = null;
    });
  return syncInFlight;
}
