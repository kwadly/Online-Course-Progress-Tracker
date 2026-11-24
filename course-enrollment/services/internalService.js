const internalRepository = require('../repositories/internalRepository');
const { httpError } = require('../utils/http');

async function overview(daysParam) {
  const days = daysParam === undefined ? 14 : Number(daysParam);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw httpError(400, 'days must be a whole number from 1 to 365');
  }
  const enrollments = await internalRepository.listActiveEnrollments();
  const due = await internalRepository.listDueModules(days);
  const dueByEnrollment = new Map();
  for (const m of due) {
    if (!dueByEnrollment.has(m.enrollment_id)) dueByEnrollment.set(m.enrollment_id, []);
    dueByEnrollment.get(m.enrollment_id).push({
      module_id: m.module_id,
      title: m.title,
      due_date: m.due_date,
      overdue: m.overdue,
    });
  }
  return enrollments.map((e) => ({
    ...e,
    remaining_modules: e.total_modules - e.completed_modules,
    percent: e.total_modules ? Math.round((e.completed_modules * 100) / e.total_modules) : 0,
    due_modules: dueByEnrollment.get(e.enrollment_id) || [],
  }));
}

module.exports = { overview };