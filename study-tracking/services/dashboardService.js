const dashboardRepository = require('../repositories/dashboardRepository');
const { httpError } = require('../utils/http');

function percentOf(done, total) {
  return total ? Math.round((done * 100) / total) : 0;
}

async function getDashboard(user, query) {
  let days = 14;
  if (query.days !== undefined) {
    days = Number(query.days);
    if (!Number.isInteger(days) || days <= 0 || days > 365) {
      throw httpError(400, 'days must be a whole number between 1 and 365');
    }
  }

  const [courses, deadlines, minutes, goal] = await Promise.all([
    dashboardRepository.courseProgress(user.id),
    dashboardRepository.upcomingDeadlines(user.id, days),
    dashboardRepository.minutesThisWeek(user.id),
    dashboardRepository.weeklyGoalHours(user.id),
  ]);

  const hoursStudied = Math.round((minutes / 60) * 10) / 10;

  return {
    progress: courses.map((c) => ({
      ...c,
      percent: percentOf(c.completed_modules, c.total_modules),
    })),
    upcoming_deadlines: deadlines,
    weekly: {
      minutes_studied: minutes,
      hours_studied: hoursStudied,
      goal_hours: goal,
      percent_of_goal: goal ? Math.round((minutes / 60 / goal) * 100) : null,
    },
  };
}

module.exports = { getDashboard };