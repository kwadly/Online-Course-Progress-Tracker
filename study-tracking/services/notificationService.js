function formatReminder(r) {
  const due = r.due_date ? ' (due ' + r.due_date + ')' : '';
  if (r.type === 'at_risk_alert') {
    return '⚠️ AT RISK [' + r.risk_level + '] ' + r.student_name + ': module "' +
      r.module_title + '" in "' + r.course_title + '"' + due + ' and little study time lately.';
  }
  return '⏰ Deadline reminder for ' + r.student_name + ': module "' +
    r.module_title + '" in "' + r.course_title + '"' + due + '.';
}

async function sendDiscord(text) {
  if (!process.env.DISCORD_WEBHOOK_URL) {
    throw new Error('DISCORD_WEBHOOK_URL is not set in .env');
  }
  const res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });
  if (!res.ok) throw new Error('Discord answered ' + res.status);
}

module.exports = { formatReminder, sendDiscord };