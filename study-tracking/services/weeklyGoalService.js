const repo = require('../repositories/weeklyGoalRepository');
const { httpError } = require('../utils/http');

function format(row) {
  // pg بيرجّع NUMERIC كـ string، فبنحوّله لرقم
  return { hours_per_week: Number(row.hours_per_week), updated_at: row.updated_at };
}

async function setGoal(user, body) {
  const hours = body.hours_per_week;
  const validNumber =
    typeof hours === 'number' &&
    Number.isFinite(hours) &&
    hours > 0 &&
    hours <= 168 &&
    Math.abs(hours * 10 - Math.round(hours * 10)) < 1e-9; // رقم عشري واحد زي NUMERIC(4,1)
  if (!validNumber) {
    throw httpError(400, 'hours_per_week must be a number between 0.1 and 168 with at most one decimal place');
  }
  return format(await repo.upsert(user.id, hours));
}

async function getGoal(user) {
  const row = await repo.findByUser(user.id);
  if (!row) {
    throw httpError(404, 'No weekly goal set yet');
  }
  return format(row);
}

async function getSummary(user) {
  const [goalRow, perCourse] = await Promise.all([
    repo.findByUser(user.id),
    repo.minutesThisWeekByCourse(user.id),
  ]);
  const totalMinutes = perCourse.reduce((sum, r) => sum + r.minutes, 0);
  const goalHours = goalRow ? Number(goalRow.hours_per_week) : null;
  const goalMinutes = goalHours === null ? null : Math.round(goalHours * 60);

  return {
    total_minutes: totalMinutes,
    goal_hours: goalHours,
    goal_minutes: goalMinutes,
    percent_of_goal: goalMinutes ? Math.round((totalMinutes / goalMinutes) * 100) : null,
    remaining_minutes: goalMinutes === null ? null : Math.max(goalMinutes - totalMinutes, 0),
    by_course: perCourse,
  };
}

module.exports = { setGoal, getGoal, getSummary };