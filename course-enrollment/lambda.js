const serverless = require('serverless-http');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let handler;

async function init() {
  if (process.env.SECRET_NAME) {
    const client = new SecretsManagerClient({});
    const result = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME })
    );
    const values = JSON.parse(result.SecretString);
    process.env.DATABASE_URL = values.DATABASE_URL;
    process.env.JWT_SECRET = values.JWT_SECRET;
    process.env.INTERNAL_API_KEY = values.INTERNAL_API_KEY;
  }
  const app = require('./app');
  handler = serverless(app);
}

module.exports.handler = async (event, context) => {
  if (!handler) await init();
  return handler(event, context);
};