const courseRepository = require('../repositories/courseRepository');
const { httpError } = require('../utils/http');

function checkCourseInput(body) {
  const { title, description } = body || {};
  if (typeof title !== 'string' || !title.trim()) {
    throw httpError(400, 'title is required');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw httpError(400, 'description must be text');
  }
  return { title: title.trim(), description: description ? description.trim() : null };
}

async function requireOwnCourse(user, id, forbiddenMessage) {
  const course = await courseRepository.findById(id);
  if (!course) throw httpError(404, 'Course not found');
  if (course.instructor_id !== user.id) throw httpError(403, forbiddenMessage);
  return course;
}

async function listPublished() {
  return courseRepository.listPublished();
}

async function listMine(user) {
  return courseRepository.listByInstructor(user.id);
}

async function getCourse(user, id) {
  const course = await courseRepository.findById(id);
  // Unpublished courses are visible only to their own instructor
  if (!course || (course.status !== 'published' && course.instructor_id !== user.id)) {
    throw httpError(404, 'Course not found');
  }
  const modules = await courseRepository.listModules(id);
  return { ...course, modules };
}

async function createCourse(user, body) {
  const input = checkCourseInput(body);
  return courseRepository.create({ ...input, instructorId: user.id });
}

async function updateCourse(user, id, body) {
  const input = checkCourseInput(body);
  await requireOwnCourse(user, id, 'You can only edit your own courses');
  return courseRepository.update(id, input);
}

async function changeStatus(user, id, body) {
  const { status } = body || {};
  if (!['published', 'archived'].includes(status)) {
    throw httpError(400, 'status must be published or archived');
  }
  await requireOwnCourse(user, id, 'You can only change your own courses');
  if (status === 'published' && (await courseRepository.countModules(id)) === 0) {
    throw httpError(409, 'A course needs at least one module before it can be published');
  }
  return courseRepository.updateStatus(id, status);
}

module.exports = {
  listPublished,
  listMine,
  getCourse,
  createCourse,
  updateCourse,
  changeStatus,
};