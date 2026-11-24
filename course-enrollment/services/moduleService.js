const moduleRepository = require('../repositories/moduleRepository');
const courseRepository = require('../repositories/courseRepository');
const { httpError } = require('../utils/http');

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function checkModuleInput(body) {
  const { title, position, due_date } = body || {};
  if (typeof title !== 'string' || !title.trim()) {
    throw httpError(400, 'title is required');
  }
  if (!Number.isInteger(position) || position < 1) {
    throw httpError(400, 'position must be a whole number, 1 or more');
  }
  if (due_date !== undefined && due_date !== null && !isValidDate(due_date)) {
    throw httpError(400, 'due_date must be a real date written as YYYY-MM-DD');
  }
  return { title: title.trim(), position, dueDate: due_date || null };
}

function positionTaken(err) {
  return err.code === '23505' ? httpError(409, 'That position is already used in this course') : err;
}

async function createModule(user, courseId, body) {
  const input = checkModuleInput(body);
  const course = await courseRepository.findById(courseId);
  if (!course) throw httpError(404, 'Course not found');
  if (course.instructor_id !== user.id) {
    throw httpError(403, 'You can only add modules to your own courses');
  }
  try {
    return await moduleRepository.insert({ courseId, ...input });
  } catch (err) {
    throw positionTaken(err);
  }
}

async function updateModule(user, id, body) {
  const input = checkModuleInput(body);
  const found = await moduleRepository.findWithOwner(id);
  if (!found) throw httpError(404, 'Module not found');
  if (found.instructor_id !== user.id) {
    throw httpError(403, 'You can only edit modules of your own courses');
  }
  try {
    return await moduleRepository.update(id, input);
  } catch (err) {
    throw positionTaken(err);
  }
}

async function deleteModule(user, id) {
  const found = await moduleRepository.findWithOwner(id);
  if (!found) throw httpError(404, 'Module not found');
  if (found.instructor_id !== user.id) {
    throw httpError(403, 'You can only delete modules of your own courses');
  }
  if ((await moduleRepository.countCompletions(id)) > 0) {
    throw httpError(409, 'Students have already completed this module, so it cannot be deleted');
  }
  await moduleRepository.remove(id);
}

async function listUpcoming(user, daysParam) {
  const days = daysParam === undefined ? 14 : Number(daysParam);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw httpError(400, 'days must be a whole number from 1 to 365');
  }
  return moduleRepository.listUpcoming(user.id, days);
}

module.exports = { createModule, updateModule, deleteModule, listUpcoming };