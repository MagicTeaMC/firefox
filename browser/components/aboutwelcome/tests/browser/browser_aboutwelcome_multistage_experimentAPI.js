"use strict";

const { ExperimentAPI } = ChromeUtils.importESModule(
  "resource://nimbus/ExperimentAPI.sys.mjs"
);
const { NimbusTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/NimbusTestUtils.sys.mjs"
);
const { TelemetryTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TelemetryTestUtils.sys.mjs"
);

/**
 * Test the zero onboarding using ExperimentAPI
 */
add_task(async function test_multistage_zeroOnboarding_experimentAPI() {
  await setAboutWelcomePref(true);
  await ExperimentAPI.ready();
  let doExperimentCleanup = await NimbusTestUtils.enrollWithFeatureConfig({
    featureId: "aboutwelcome",
    value: { enabled: false },
  });

  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:welcome",
    true
  );

  registerCleanupFunction(() => {
    BrowserTestUtils.removeTab(tab);
  });

  const browser = tab.linkedBrowser;

  await test_screen_content(
    browser,
    // When about:welcome is disabled, we should redirect to about:home
    "home",
    // Expected selectors:
    ["div.search-wrapper", "body.activity-stream"],
    // Unexpected selectors:
    ["div.onboardingContainer", "main.AW_STEP1"]
  );

  doExperimentCleanup();
});

/**
 * Test the multistage welcome UI with test content theme as first screen
 */
add_task(async function test_multistage_aboutwelcome_experimentAPI() {
  const TEST_CONTENT = [
    {
      id: "AW_STEP1",
      content: {
        title: "Step 1",
        tiles: {
          type: "theme",
          action: {
            theme: "<event>",
          },
          data: [
            {
              theme: "automatic",
              label: "theme-1",
              tooltip: "test-tooltip",
            },
            {
              theme: "dark",
              label: "theme-2",
            },
          ],
        },
        primary_button: {
          label: "Next",
          action: {
            navigate: true,
          },
        },
        secondary_button: {
          label: "link",
        },
        secondary_button_top: {
          label: "link top",
          action: {
            type: "SHOW_FIREFOX_ACCOUNTS",
            data: { entrypoint: "test" },
          },
        },
        has_noodles: true,
      },
    },
    {
      id: "AW_STEP2",
      content: {
        zap: true,
        title: "Step 2 test",
        primary_button: {
          label: "Next",
          action: {
            navigate: true,
          },
        },
        secondary_button: {
          label: "link",
        },
        has_noodles: true,
      },
    },
    {
      id: "AW_STEP3",
      content: {
        logo: {},
        title: "Step 3",
        primary_button: {
          label: "Next",
          action: {
            navigate: true,
          },
        },
        secondary_button: {
          label: "Import",
          action: {
            type: "SHOW_MIGRATION_WIZARD",
            data: { source: "chrome" },
          },
        },
        has_noodles: true,
      },
    },
  ];
  const sandbox = sinon.createSandbox();
  NimbusFeatures.aboutwelcome._didSendExposureEvent = false;
  await setAboutWelcomePref(true);
  await ExperimentAPI.ready();

  let doExperimentCleanup = await NimbusTestUtils.enrollWithFeatureConfig({
    featureId: "aboutwelcome",
    enabled: true,
    value: {
      id: "my-mochitest-experiment",
      screens: TEST_CONTENT,
    },
  });

  Services.telemetry.clearScalars();
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:welcome",
    true
  );

  const browser = tab.linkedBrowser;

  let aboutWelcomeActor = await getAboutWelcomeParent(browser);
  // Stub AboutWelcomeParent Content Message Handler
  sandbox.spy(aboutWelcomeActor, "onContentMessage");
  registerCleanupFunction(() => {
    BrowserTestUtils.removeTab(tab);
    sandbox.restore();
  });

  // Test first (theme) screen.
  await test_screen_content(
    browser,
    "multistage step 1",
    // Expected selectors:
    [
      "div.onboardingContainer",
      "main.AW_STEP1",
      "div.secondary-cta",
      "div.secondary-cta.top",
      "button[value='secondary_button']",
      "button[value='secondary_button_top']",
      "label.select-item",
      "input[type='radio']",
    ],
    // Unexpected selectors:
    ["main.AW_STEP2", "main.AW_STEP3", "div.tiles-container.info"]
  );

  await onButtonClick(browser, "button.primary");

  const { callCount } = aboutWelcomeActor.onContentMessage;
  Assert.greaterOrEqual(callCount, 1, `${callCount} Stub was called`);
  let clickCall;
  for (let i = 0; i < callCount; i++) {
    const call = aboutWelcomeActor.onContentMessage.getCall(i);
    info(`Call #${i}: ${call.args[0]} ${JSON.stringify(call.args[1])}`);
    if (call.calledWithMatch("", { event: "CLICK_BUTTON" })) {
      clickCall = call;
    }
  }

  Assert.equal(
    clickCall.args[0],
    "AWPage:TELEMETRY_EVENT",
    "send telemetry event"
  );

  Assert.equal(
    clickCall.args[1].message_id,
    "MY-MOCHITEST-EXPERIMENT_0_AW_STEP1",
    "Telemetry should join id defined in feature value with screen"
  );

  await test_screen_content(
    browser,
    "multistage step 2",
    // Expected selectors:
    [
      "div.onboardingContainer",
      "main.AW_STEP2",
      "button[value='secondary_button']",
    ],
    // Unexpected selectors:
    ["main.AW_STEP1", "main.AW_STEP3", "div.secondary-cta.top"]
  );
  await onButtonClick(browser, "button.primary");
  await test_screen_content(
    browser,
    "multistage step 3",
    // Expected selectors:
    [
      "div.onboardingContainer",
      "main.AW_STEP3",
      "img.brand-logo",
      "div.welcome-text",
    ],
    // Unexpected selectors:
    ["main.AW_STEP1", "main.AW_STEP2"]
  );
  await onButtonClick(browser, "button.primary");
  await test_screen_content(
    browser,
    "home",
    // Expected selectors:
    ["body.activity-stream"],
    // Unexpected selectors:
    ["div.onboardingContainer"]
  );

  doExperimentCleanup();
});

/* Test multistage custom backdrop
 */
add_task(async function test_multistage_aboutwelcome_backdrop() {
  const sandbox = sinon.createSandbox();
  const TEST_BACKDROP = "blue";

  const TEST_CONTENT = [
    {
      id: "TEST_SCREEN",
      content: {
        position: "split",
        logo: {},
        title: "test",
      },
    },
  ];
  await setAboutWelcomePref(true);
  await ExperimentAPI.ready();
  await pushPrefs(["browser.aboutwelcome.backdrop", TEST_BACKDROP]);

  const doExperimentCleanup = await NimbusTestUtils.enrollWithFeatureConfig({
    featureId: "aboutwelcome",
    value: {
      id: "my-mochitest-experiment",
      screens: TEST_CONTENT,
    },
  });

  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:welcome",
    true
  );

  const browser = tab.linkedBrowser;

  registerCleanupFunction(() => {
    BrowserTestUtils.removeTab(tab);
    sandbox.restore();
  });

  await test_screen_content(
    browser,
    "multistage step 1",
    // Expected selectors:
    [`div.outer-wrapper.onboardingContainer[style*='${TEST_BACKDROP}']`]
  );

  doExperimentCleanup();
});

add_task(async function test_multistage_aboutwelcome_utm_term() {
  const sandbox = sinon.createSandbox();

  const TEST_CONTENT = [
    {
      id: "TEST_SCREEN",
      content: {
        position: "split",
        logo: {},
        title: "test",
        secondary_button_top: {
          label: "test",
          style: "link",
          action: {
            type: "OPEN_URL",
            data: {
              args: "https://www.mozilla.org/",
            },
          },
        },
      },
    },
  ];
  await setAboutWelcomePref(true);
  await ExperimentAPI.ready();

  const doExperimentCleanup = await NimbusTestUtils.enrollWithFeatureConfig({
    featureId: "aboutwelcome",
    value: {
      id: "my-mochitest-experiment",
      screens: TEST_CONTENT,
      UTMTerm: "test",
    },
  });

  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:welcome",
    true
  );

  const browser = tab.linkedBrowser;
  const aboutWelcomeActor = await getAboutWelcomeParent(browser);

  sandbox.stub(aboutWelcomeActor, "onContentMessage");

  await onButtonClick(browser, "button[value='secondary_button_top']");

  let actionCall;

  const { callCount } = aboutWelcomeActor.onContentMessage;
  for (let i = 0; i < callCount; i++) {
    const call = aboutWelcomeActor.onContentMessage.getCall(i);
    info(`Call #${i}: ${call.args[0]} ${JSON.stringify(call.args[1])}`);
    if (call.calledWithMatch("SPECIAL")) {
      actionCall = call;
    }
  }

  Assert.equal(
    actionCall.args[1].data.args,
    "https://www.mozilla.org/?utm_source=activity-stream&utm_campaign=firstrun&utm_medium=referral&utm_term=test-screen",
    "UTMTerm set in mobile"
  );

  registerCleanupFunction(() => {
    sandbox.restore();
    BrowserTestUtils.removeTab(tab);
  });

  doExperimentCleanup();
});
