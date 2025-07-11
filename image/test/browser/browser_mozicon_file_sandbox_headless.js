/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

add_task(async function test_mozicon_file_with_sandbox() {
  assertFileProcess();
  // Note that the sandbox is always "headless" now.
  await createMozIconInFile("txt");
  await createMozIconInFile("exe");
  await createMozIconInFile("non-existent-bidule");
});
