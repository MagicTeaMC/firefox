// |reftest| shell-option(--enable-temporal) skip-if(!this.hasOwnProperty('Temporal')||!xulRuntime.shell) -- Temporal is not enabled unconditionally, requires shell-options
// Copyright (C) 2022 André Bargull. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-temporal.plaintime.prototype.subtract
description: >
  Duration components are precise mathematical integers.
includes: [temporalHelpers.js]
features: [Temporal]
---*/

let duration = Temporal.Duration.from({
  microseconds: Number.MIN_SAFE_INTEGER,
  nanoseconds: -1000,
});

let time = Temporal.PlainTime.from({
  microsecond: 1,
});

let result = time.subtract(duration);

TemporalHelpers.assertPlainTime(result, 23, 47, 34, 740, 993, 0);

reportCompare(0, 0);
