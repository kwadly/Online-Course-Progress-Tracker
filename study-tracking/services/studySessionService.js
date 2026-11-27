const studySessionRepository = require('../repositories/studySessionRepository');
const { httpError, parseId } = require('../utils/http');

async function logSession(user, body) {
  const courseId = parseId(body.course_id);
  if (!courseId) {
    throw httpError(400, 'course_id must be a positive whole number');
  }
  const minutes = body.minutes;
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw httpError(400, 'minutes must be a positive whole number');
  }
  const enrollment = await studySessionRepository.findActiveEnrollment(user.id, courseId);
  if (!enrollment) {
    throw httpError(403, 'You must be actively enrolled in this course');
  }
  return studySessionRepository.create(user.id, courseId, minutes);
}

async function listMine(user, query) {
  let courseId = null;
  if (query.course_id !== undefined) {
    courseId = parseId(query.course_id);
    if (!courseId) {
      throw httpError(400, 'course_id must be a positive whole number');
    }
  }
  return studySessionRepository.listForUser(user.id, courseId);
}

module.exports = { logSession, listMine };