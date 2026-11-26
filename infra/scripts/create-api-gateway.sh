#!/bin/bash
# Creates the HTTP API in front of the course-enrollment-api Lambda.
set -e

FUNCTION=course-enrollment-api
ACCOUNT=000000000000
REGION=us-east-1

API_ID=$(aws apigatewayv2 create-api --name course-enrollment-http-api --protocol-type HTTP --query ApiId --output text)

INTEGRATION_ID=$(aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --payload-format-version 2.0 --integration-uri arn:aws:lambda:$REGION:$ACCOUNT:function:$FUNCTION --query IntegrationId --output text)

aws apigatewayv2 create-route --api-id $API_ID --route-key "ANY /api/{proxy+}" --target integrations/$INTEGRATION_ID --query RouteKey --output text

aws apigatewayv2 create-stage --api-id $API_ID --stage-name '$default' --auto-deploy > /dev/null

aws lambda add-permission --function-name $FUNCTION --statement-id apigw-invoke-$API_ID --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*" > /dev/null

echo "API ID: $API_ID"
echo "API URL: http://$API_ID.execute-api.localhost.floci.io:4566"