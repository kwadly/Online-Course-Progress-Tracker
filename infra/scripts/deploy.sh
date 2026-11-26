#!/bin/bash
# Rebuilds the whole Course & Enrollment deployment on Floci.
set -e
cd "$(dirname "$0")/../.."

ACCOUNT=000000000000
REGION=us-east-1
FUNCTION=course-enrollment-api
ROLE=course-enrollment-lambda-role
SECRET=course-enrollment/app
BUCKET=course-tracker-web
TOPIC=course-enrollment-events
API_NAME=course-enrollment-http-api
POLICY_BASE=arn:aws:iam::$ACCOUNT:policy

if [ "$(aws sts get-caller-identity --query Account --output text)" != "$ACCOUNT" ]; then
  echo "Not talking to Floci. Start it first."
  exit 1
fi

echo "1/7 Building the zip and the secret file"
(cd course-enrollment && npm run zip)
node course-enrollment/scripts/make-secret-json.js

echo "2/7 IAM role and policies"
if ! aws iam get-role --role-name $ROLE > /dev/null 2>&1; then
  aws iam create-role --role-name $ROLE --assume-role-policy-document file://infra/iam/trust-policy.json > /dev/null
fi
for P in "course-enrollment-logs-policy:lambda-policy.json" "course-enrollment-secrets-policy:secrets-policy.json" "course-enrollment-sns-policy:sns-policy.json"; do
  NAME=${P%%:*}
  FILE=${P##*:}
  if ! aws iam get-policy --policy-arn $POLICY_BASE/$NAME > /dev/null 2>&1; then
    aws iam create-policy --policy-name $NAME --policy-document file://infra/iam/$FILE > /dev/null
  fi
  aws iam attach-role-policy --role-name $ROLE --policy-arn $POLICY_BASE/$NAME
done

echo "3/7 Secrets Manager"
if aws secretsmanager describe-secret --secret-id $SECRET > /dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id $SECRET --secret-string file://course-enrollment/dist/secret.json > /dev/null
else
  aws secretsmanager create-secret --name $SECRET --secret-string file://course-enrollment/dist/secret.json > /dev/null
fi
rm -f course-enrollment/dist/secret.json

echo "4/7 SNS topic and S3 bucket"
TOPIC_ARN=$(aws sns create-topic --name $TOPIC --query TopicArn --output text)
aws s3api head-bucket --bucket $BUCKET > /dev/null 2>&1 || aws s3 mb s3://$BUCKET > /dev/null

echo "5/7 Lambda function"
ENVIRONMENT="Variables={SECRET_NAME=$SECRET,SNS_TOPIC_ARN=$TOPIC_ARN}"
if aws lambda get-function --function-name $FUNCTION > /dev/null 2>&1; then
  aws lambda update-function-code --function-name $FUNCTION --zip-file fileb://course-enrollment/dist/lambda.zip > /dev/null
  aws lambda wait function-updated-v2 --function-name $FUNCTION
  aws lambda update-function-configuration --function-name $FUNCTION --environment "$ENVIRONMENT" > /dev/null
else
  aws lambda create-function --function-name $FUNCTION --runtime nodejs24.x --handler lambda.handler --role arn:aws:iam::$ACCOUNT:role/$ROLE --zip-file fileb://course-enrollment/dist/lambda.zip --timeout 10 --memory-size 256 --environment "$ENVIRONMENT" > /dev/null
fi
aws lambda wait function-updated-v2 --function-name $FUNCTION

echo "6/7 API Gateway"
API_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  API_ID=$(aws apigatewayv2 create-api --name $API_NAME --protocol-type HTTP --query ApiId --output text)
  INTEGRATION_ID=$(aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --payload-format-version 2.0 --integration-uri arn:aws:lambda:$REGION:$ACCOUNT:function:$FUNCTION --query IntegrationId --output text)
  aws apigatewayv2 create-route --api-id $API_ID --route-key "ANY /api/{proxy+}" --target integrations/$INTEGRATION_ID > /dev/null
  aws apigatewayv2 create-stage --api-id $API_ID --stage-name '$default' --auto-deploy > /dev/null
fi
aws lambda add-permission --function-name $FUNCTION --statement-id apigw-invoke-$API_ID --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*" > /dev/null 2>&1 || true

echo "7/7 Done"
echo "API ID:  $API_ID"
echo "API URL: http://$API_ID.execute-api.localhost.floci.io:4566"