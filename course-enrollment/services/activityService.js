const courseRepository = require('../repositories/courseRepository');
const activityRepository = require('../repositories/activityRepository');
const { httpError } = require('../utils/http');

async function courseActivity(user, courseId) {
  const course = await courseRepository.findById(courseId);
  if (!course) throw httpError(404, 'Course not found');
  if (course.instructor_id !== user.id) {
    throw httpError(403, 'You can only see activity for your own courses');
  }
  const events = await activityRepository.listForCourse(courseId, 50);
  return { course_id: courseId, title: course.title, events };
}

module.exports = { courseActivity };