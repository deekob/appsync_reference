#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { AppsyncAtReinventStack } from '../lib/appsync-at-reinvent-stack'

const app = new cdk.App()
new AppsyncAtReinventStack(app, 'AppsyncAtReinventStackGo')
