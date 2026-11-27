const reminderRepository = require('../repositories/reminderRepository');
const { fetchOverview } = require('./overviewClient');
const { formatReminder, sendDiscord } = require('./notificationService');
const { httpError } = require('../utils/http');

const WINDOW_DAYS = 7;

function daysLeft(dueDate) {
  const today = new Date().toISOString().slice(0, 10);
  const due = String(dueDate).slice(0, 10);
  return Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
}

function riskFor(left, studiedMinutes) {
  if (left < 0) return 'high';
  if (left <= 2 && studiedMinutes < 60) return 'high';
  if (left <= 5 && studiedMinutes < 120) return 'medium';
  if (left <= 7 && studiedMinutes < 60) return 'low';
  return null;
}

async function listMine(user, query) {
  let type = null;
  if (query.type !== undefined) {
    if (!['deadline_reminder', 'at_risk_alert'].includes(query.type)) {
      throw httpError(400, 'type must be deadline_reminder or at_risk_alert');
    }
    type = query.type;
  }
  return reminderRepository.listForUser(user.id, type);
}

async function runJob() {
  const summary = { created: 0, skipped: 0, sent: 0, failed: 0 };
  const enrollments = await fetchOverview(WINDOW_DAYS);
  const studiedByUser = new Map();

  for (const e of enrollments) {
    const userId = e.student_id;
    if (!userId) continue;

    if (!studiedByUser.has(userId)) {
      const rows = await reminderRepository.minutesLast7Days(userId);
      studiedByUser.set(userId, new Map(rows.map((r) => [r.course_id, r.minutes])));
    }

    const studied = studiedByUser.get(userId).get(e.course_id) || 0;

    for (const m of e.unfinished_modules || []) {
      if (!m.due_date) continue;
      const left = daysLeft(m.due_date);
      if (left > WINDOW_DAYS) continue;

      const risk = riskFor(left, studied);
      const type = risk ? 'at_risk_alert' : 'deadline_reminder';
      const row = await reminderRepository.insertIfNew(userId, m.module_id, type, risk);

      if (row) summary.created++;
      else summary.skipped++;
    }
  }

  for (const r of await reminderRepository.listPending()) {
    try {
      await sendDiscord(formatReminder(r));
      await reminderRepository.markSent(r.id);
      summary.sent++;
    } catch (err) {
      console.error('Could not send reminder ' + r.id + ': ' + err.message);
      summary.failed++;
    }
  }

  console.log('Reminder job finished:', JSON.stringify(summary));
  return summary;
}

module.exports = { listMine, runJob, riskFor };