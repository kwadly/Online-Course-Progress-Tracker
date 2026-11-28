const enrollmentRepository = require('../repositories/enrollmentRepository');
const courseRepository = require('../repositories/courseRepository');
const { httpError } = require('../utils/http');
const { publishEvent } = require('../utils/events');

function percentOf(done, total) {
  return total ? Math.round((done * 100) / total) : 0;
}

async function progressOf(enrollmentId, courseId) {
  const { total, done } = await enrollmentRepository.getProgress(enrollmentId, courseId);
  return { total_modules: total, completed_modules: done, percent: percentOf(done, total) };
}

// Loads an enrollment and checks that it belongs to the logged-in student
async function requireOwnEnrollment(user, id) {
  const enrollment = await enrollmentRepository.findById(id);
  if (!enrollment) throw httpError(404, 'Enrollment not found');
  if (enrollment.student_id !== user.id) throw httpError(403, 'This is not your enrollment');
  return enrollment;
}

// Returns { created, enrollment } so the route can answer 201 or 200
async function enroll(user, courseId) {
  const course = await courseRepository.findById(courseId);
  if (!course || course.status !== 'published') {
    throw httpError(404, 'Course not found');
  }
  const existing = await enrollmentRepository.findByStudentAndCourse(user.id, courseId);
  if (existing) {
    if (existing.status !== 'dropped') {
      throw httpError(409, 'You are already enrolled in this course');
    }
    // Re-enrolling after a drop brings the old enrollment back
    const back = await enrollmentRepository.reactivate(existing.id);
    await publishEvent('student_enrolled', { student_id: user.id, course_id: courseId, enrollment_id: existing.id });
    return { created: false, enrollment: back };
  }
  try {
    const created = await enrollmentRepository.create(user.id, courseId);
    await publishEvent('student_enrolled', { student_id: user.id, course_id: courseId, enrollment_id: created.id });
    return { created: true, enrollment: created };
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'You are already enrolled in this course');
    throw err;
  }
}

async function drop(user, id) {
  const enrollment = await requireOwnEnrollment(user, id);
  if (enrollment.status !== 'active') {
    throw httpError(409, 'Only an active enrollment can be dropped');
  }
    const dropped = await enrollmentRepository.setStatus(id, 'dropped');
    await publishEvent('student_dropped', { student_id: user.id, course_id: enrollment.course_id, enrollment_id: id });
    return dropped;
}

async function listMine(user) {
  const rows = await enrollmentRepository.listForStudent(user.id);
  return rows.map((r) => ({ ...r, percent: percentOf(r.completed_modules, r.total_modules) }));
}

async function completeModule(user, id, moduleId) {
  const enrollment = await requireOwnEnrollment(user, id);
  if (enrollment.status !== 'active') {
    throw httpError(409, 'Only an active enrollment can be changed');
  }
  if (!(await enrollmentRepository.moduleBelongsToCourse(moduleId, enrollment.course_id))) {
    throw httpError(404, 'Module not found in this course');
  }
  try {
    await enrollmentRepository.addCompletion(id, moduleId);
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'This module is already marked as done');
    throw err;
  }
  const progress = await progressOf(id, enrollment.course_id);
  let status = 'active';
  // Finishing the last module completes the whole enrollment
  if (progress.total_modules > 0 && progress.completed_modules === progress.total_modules) {
    await enrollmentRepository.setStatus(id, 'completed');
    status = 'completed';
  }
    await publishEvent('module_completed', { student_id: user.id, course_id: enrollment.course_id, enrollment_id: id, module_id: moduleId, percent: progress.percent });
    if (status === 'completed') {
      await publishEvent('course_completed', { student_id: user.id, course_id: enrollment.course_id, enrollment_id: id });
    }
    return { enrollment_id: id, module_id: moduleId, enrollment_status: status, ...progress };
}

async function undoModule(user, id, moduleId) {
  const enrollment = await requireOwnEnrollment(user, id);
  if (enrollment.status === 'dropped') {
    throw httpError(409, 'A dropped enrollment cannot be changed');
  }
  if (!(await enrollmentRepository.removeCompletion(id, moduleId))) {
    throw httpError(404, 'This module was not marked as done');
  }
  let status = enrollment.status;
  // Undoing a module reopens a completed enrollment
  if (status === 'completed') {
    await enrollmentRepository.setStatus(id, 'active');
    status = 'active';
  }
  const progress = await progressOf(id, enrollment.course_id);
  return { enrollment_id: id, module_id: moduleId, enrollment_status: status, ...progress };
}

async function courseStats(user, courseId) {
  const course = await courseRepository.findById(courseId);
  if (!course) throw httpError(404, 'Course not found');
  if (course.instructor_id !== user.id) {
    throw httpError(403, 'You can only see stats for your own courses');
  }
  const totalModules = await courseRepository.countModules(courseId);
  const counts = await enrollmentRepository.courseCounts(courseId);
  const rows = await enrollmentRepository.activeProgress(courseId);
  let average = 0;
  if (totalModules > 0 && rows.length > 0) {
    const sum = rows.reduce((acc, r) => acc + (r.done * 100) / totalModules, 0);
    average = Math.round(sum / rows.length);
  }
  return {
    course_id: courseId,
    title: course.title,
    total_modules: totalModules,
    ...counts,
    average_progress_percent: average,
  };
}

module.exports = { enroll, drop, listMine, completeModule, undoModule, courseStats };