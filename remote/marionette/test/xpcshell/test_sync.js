/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const {
  DebounceCallback,
  PollPromise,
  Sleep,
  waitForMessage,
  waitForObserverTopic,
} = ChromeUtils.importESModule(
  "chrome://remote/content/marionette/sync.sys.mjs"
);

/**
 * Mimic a message manager for sending messages.
 */
class MessageManager {
  constructor() {
    this.func = null;
    this.message = null;
  }

  addMessageListener(message, func) {
    this.func = func;
    this.message = message;
  }

  removeMessageListener() {
    this.func = null;
    this.message = null;
  }

  send(message, data) {
    if (this.func) {
      this.func({
        data,
        message,
        target: this,
      });
    }
  }
}

/**
 * Mimics nsITimer, but instead of using a system clock you can
 * preprogram it to invoke the callback after a given number of ticks.
 */
class MockTimer {
  constructor(ticksBeforeFiring) {
    this.goal = ticksBeforeFiring;
    this.ticks = 0;
    this.cancelled = false;
  }

  initWithCallback(cb) {
    this.ticks++;
    if (this.ticks >= this.goal) {
      cb();
    }
  }

  cancel() {
    this.cancelled = true;
  }
}

add_task(function test_PollPromise_funcTypes() {
  for (let type of ["foo", 42, null, undefined, true, [], {}]) {
    Assert.throws(() => new PollPromise(type), /TypeError/);
  }
  new PollPromise(() => {});
  new PollPromise(function () {});
});

add_task(function test_PollPromise_timeoutTypes() {
  for (let timeout of ["foo", true, [], {}]) {
    Assert.throws(() => new PollPromise(() => {}, { timeout }), /TypeError/);
  }
  for (let timeout of [1.2, -1]) {
    Assert.throws(() => new PollPromise(() => {}, { timeout }), /RangeError/);
  }
  for (let timeout of [null, undefined, 42]) {
    new PollPromise(resolve => resolve(1), { timeout });
  }
});

add_task(function test_PollPromise_intervalTypes() {
  for (let interval of ["foo", null, true, [], {}]) {
    Assert.throws(() => new PollPromise(() => {}, { interval }), /TypeError/);
  }
  for (let interval of [1.2, -1]) {
    Assert.throws(() => new PollPromise(() => {}, { interval }), /RangeError/);
  }
  new PollPromise(() => {}, { interval: 42 });
});

add_task(async function test_PollPromise_retvalTypes() {
  for (let typ of [true, false, "foo", 42, [], {}]) {
    strictEqual(typ, await new PollPromise(resolve => resolve(typ)));
  }
});

add_task(async function test_PollPromise_rethrowError() {
  let nevals = 0;
  let err;
  try {
    await PollPromise(() => {
      ++nevals;
      throw new Error();
    });
  } catch (e) {
    err = e;
  }
  equal(1, nevals);
  ok(err instanceof Error);
});

add_task(async function test_PollPromise_noTimeout() {
  let nevals = 0;
  await new PollPromise((resolve, reject) => {
    ++nevals;
    nevals < 100 ? reject() : resolve();
  });
  equal(100, nevals);
});

add_task(async function test_PollPromise_zeroTimeout() {
  // run at least once when timeout is 0
  let nevals = 0;
  let start = new Date().getTime();
  await new PollPromise(
    (resolve, reject) => {
      ++nevals;
      reject();
    },
    { timeout: 0 }
  );
  let end = new Date().getTime();
  equal(1, nevals);
  less(end - start, 500);
});

add_task(async function test_PollPromise_timeoutElapse() {
  let nevals = 0;
  let start = new Date().getTime();
  await new PollPromise(
    (resolve, reject) => {
      ++nevals;
      reject();
    },
    { timeout: 100 }
  );
  let end = new Date().getTime();
  lessOrEqual(nevals, 11);
  greaterOrEqual(end - start, 100);
});

add_task(async function test_PollPromise_interval() {
  let nevals = 0;
  await new PollPromise(
    (resolve, reject) => {
      ++nevals;
      reject();
    },
    { timeout: 100, interval: 100 }
  );
  equal(2, nevals);
});

add_task(async function test_Sleep() {
  await Sleep(0);
  for (let type of ["foo", true, null, undefined]) {
    Assert.throws(() => new Sleep(type), /TypeError/);
  }
  Assert.throws(() => new Sleep(1.2), /RangeError/);
  Assert.throws(() => new Sleep(-1), /RangeError/);
});

add_task(function test_DebounceCallback_constructor() {
  for (let cb of [42, "foo", true, null, undefined, [], {}]) {
    Assert.throws(() => new DebounceCallback(cb), /TypeError/);
  }
  for (let timeout of ["foo", true, [], {}, () => {}]) {
    Assert.throws(
      () => new DebounceCallback(() => {}, { timeout }),
      /TypeError/
    );
  }
  for (let timeout of [-1, 2.3, NaN]) {
    Assert.throws(
      () => new DebounceCallback(() => {}, { timeout }),
      /RangeError/
    );
  }
});

add_task(async function test_DebounceCallback_repeatedCallback() {
  let uniqueEvent = {};
  let ncalls = 0;

  let cb = ev => {
    ncalls++;
    equal(ev, uniqueEvent);
  };
  let debouncer = new DebounceCallback(cb);
  debouncer.timer = new MockTimer(3);

  // flood the debouncer with events,
  // we only expect the last one to fire
  debouncer.handleEvent(uniqueEvent);
  debouncer.handleEvent(uniqueEvent);
  debouncer.handleEvent(uniqueEvent);

  equal(ncalls, 1);
  ok(debouncer.timer.cancelled);
});

add_task(async function test_waitForMessage_messageManagerAndMessageTypes() {
  let messageManager = new MessageManager();

  for (let manager of ["foo", 42, null, undefined, true, [], {}]) {
    Assert.throws(() => waitForMessage(manager, "message"), /TypeError/);
  }

  for (let message of [42, null, undefined, true, [], {}]) {
    Assert.throws(() => waitForMessage(messageManager, message), /TypeError/);
  }

  let data = { foo: "bar" };
  let sent = waitForMessage(messageManager, "message");
  messageManager.send("message", data);
  equal(data, await sent);
});

add_task(async function test_waitForMessage_checkFnTypes() {
  let messageManager = new MessageManager();

  for (let checkFn of ["foo", 42, true, [], {}]) {
    Assert.throws(
      () => waitForMessage(messageManager, "message", { checkFn }),
      /TypeError/
    );
  }

  let data1 = { fo: "bar" };
  let data2 = { foo: "bar" };

  for (let checkFn of [null, undefined, msg => "foo" in msg.data]) {
    let expected_data = checkFn == null ? data1 : data2;

    messageManager = new MessageManager();
    let sent = waitForMessage(messageManager, "message", { checkFn });
    messageManager.send("message", data1);
    messageManager.send("message", data2);
    equal(expected_data, await sent);
  }
});

add_task(async function test_waitForObserverTopic_topicTypes() {
  for (let topic of [42, null, undefined, true, [], {}]) {
    Assert.throws(() => waitForObserverTopic(topic), /TypeError/);
  }

  let data = { foo: "bar" };
  let sent = waitForObserverTopic("message");
  Services.obs.notifyObservers(this, "message", data);
  let result = await sent;
  equal(this, result.subject);
  equal(data, result.data);
});

add_task(async function test_waitForObserverTopic_checkFnTypes() {
  for (let checkFn of ["foo", 42, true, [], {}]) {
    Assert.throws(
      () => waitForObserverTopic("message", { checkFn }),
      /TypeError/
    );
  }

  let data1 = { fo: "bar" };
  let data2 = { foo: "bar" };

  for (let checkFn of [null, undefined, (subject, data) => data == data2]) {
    let expected_data = checkFn == null ? data1 : data2;

    let sent = waitForObserverTopic("message");
    Services.obs.notifyObservers(this, "message", data1);
    Services.obs.notifyObservers(this, "message", data2);
    let result = await sent;
    equal(expected_data, result.data);
  }
});

add_task(async function test_waitForObserverTopic_timeoutTypes() {
  for (let timeout of ["foo", true, [], {}]) {
    Assert.throws(
      () => waitForObserverTopic("message", { timeout }),
      /TypeError/
    );
  }
  for (let timeout of [1.2, -1]) {
    Assert.throws(
      () => waitForObserverTopic("message", { timeout }),
      /RangeError/
    );
  }
  for (let timeout of [null, undefined, 42]) {
    let data = { foo: "bar" };
    let sent = waitForObserverTopic("message", { timeout });
    Services.obs.notifyObservers(this, "message", data);
    let result = await sent;
    equal(this, result.subject);
    equal(data, result.data);
  }
});

add_task(async function test_waitForObserverTopic_timeoutElapse() {
  try {
    await waitForObserverTopic("message", { timeout: 0 });
    ok(false, "Expected Timeout error not raised");
  } catch (e) {
    ok(
      e.message.includes("waitForObserverTopic timed out after"),
      "Expected error received"
    );
  }
});
