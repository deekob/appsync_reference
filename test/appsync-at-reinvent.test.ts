import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AppsyncAtReinvent from '../lib/appsync-at-reinvent-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AppsyncAtReinvent.AppsyncAtReinventStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
