const studyPlanRepository = require('../repositories/studyPlanRepository');
const { httpError } = require('../utils/http');

function weightOf(c) {
  if (c.remaining_modules <= 0) return 0;
  let urgency = 0;
  if (c.days_to_deadline !== null) {
    urgency = c.days_to_deadline <= 0 ? 1 : Math.max(0, (14 - c.days_to_deadline) / 14);
  }
  return c.remaining_modules * (1 + urgency);
}

async function generate(user) {
  const goal = await studyPlanRepository.goalHours(user.id);
  if (goal === null) {
    throw httpError(400, 'Set a weekly goal first (PUT /api/weekly-goal)');
  }

  const courses = await studyPlanRepository.courseLoad(user.id);
  if (courses.length === 0) {
    throw httpError(409, 'You have no active enrollments to plan for');
  }

  const total = Math.round(goal * 60);
  let weights = courses.map(weightOf);
  if (weights.reduce((a, b) => a + b, 0) === 0) weights = courses.map(() => 1);

  const sum = weights.reduce((a, b) => a + b, 0);
  const minutes = weights.map((w) => Math.floor((total * w) / sum));
  minutes[weights.indexOf(Math.max(...weights))] += total - minutes.reduce((a, b) => a + b, 0);

  const rows = courses.map((c, i) => ({
    course_id: c.course_id,
    title: c.title,
    planned_minutes: minutes[i],
    remaining_modules: c.remaining_modules,
    days_to_deadline: c.days_to_deadline,
  }));

  const week = await studyPlanRepository.weekStart();
  await studyPlanRepository.replacePlan(user.id, week, rows);

  return { week_start: week, total_minutes: total, plan: rows };
}

async function current(user) {
  const rows = await studyPlanRepository.currentPlan(user.id);
  if (rows.length === 0) {
    throw httpError(404, 'No plan for this week yet (POST /api/study-plans/generate)');
  }

  return {
    week_start: rows[0].week_start,
    total_minutes: rows.reduce((a, r) => a + r.planned_minutes, 0),
    plan: rows.map(({ course_id, title, planned_minutes }) => ({ course_id, title, planned_minutes })),
  };
}

module.exports = { generate, current };