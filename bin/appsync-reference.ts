#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { AppsyncReferenceStack as AppsyncReferenceStack } from '../lib/appsync-reference-stack'

const app = new cdk.App()

new AppsyncReferenceStack(app, 'AppsyncReferenceStackGo')
