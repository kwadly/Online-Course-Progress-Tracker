const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

let client;

async function publishEvent(type, data) {
  if (!process.env.SNS_TOPIC_ARN) return;
  try {
    if (!client) client = new SNSClient({});
    const result = await client.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify({ type, ...data, at: new Date().toISOString() }),
      MessageAttributes: { eventType: { DataType: 'String', StringValue: type } }
    }));
    console.log('event published ' + type + ' ' + result.MessageId);
  } catch (err) {
    console.error('event publish failed ' + type + ' ' + err.name);
  }
}

module.exports = { publishEvent };