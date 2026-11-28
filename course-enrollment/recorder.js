const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const TYPES = ['student_enrolled', 'student_dropped', 'module_completed', 'course_completed'];
let activityRepository;

async function init() {
  const client = new SecretsManagerClient({});
  const result = await client.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME })
  );
  process.env.DATABASE_URL = JSON.parse(result.SecretString).DATABASE_URL;
  activityRepository = require('./repositories/activityRepository');
}

module.exports.handler = async (event) => {
  if (!activityRepository) await init();
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    if (!TYPES.includes(message.type) || !message.student_id || !message.course_id) {
      console.error('activity skipped: bad event');
      continue;
    }
    await activityRepository.insert(message);
    console.log('activity recorded ' + message.type);
  }
};