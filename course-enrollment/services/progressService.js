const enrollmentRepository = require('../repositories/enrollmentRepository');
const completionRepository = require('../repositories/completionRepository');
const { httpError } = require('../utils/http');

async function completedModules(user, enrollmentId) {
  const enrollment = await enrollmentRepository.findById(enrollmentId);
  if (!enrollment) throw httpError(404, 'Enrollment not found');
  if (enrollment.student_id !== user.id) throw httpError(403, 'This is not your enrollment');
  const ids = await completionRepository.moduleIds(enrollmentId);
  return { enrollment_id: enrollmentId, module_ids: ids };
}

module.exports = { completedModules };