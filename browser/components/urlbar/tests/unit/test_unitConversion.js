/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Unit test for unit conversion module.
 */

ChromeUtils.defineESModuleGetters(this, {
  UrlbarProviderUnitConversion:
    "resource:///modules/UrlbarProviderUnitConversion.sys.mjs",
});

const TEST_DATA = [
  {
    category: "angle",
    cases: [
      { queryString: "1 d to d", expected: "1 deg" },
      { queryString: "-1 d to d", expected: "-1 deg" },
      { queryString: "1 d in d", expected: "1 deg" },
      { queryString: "1 d = d", expected: "1 deg" },
      { queryString: "1 D=D", expected: "1 deg" },
      { queryString: "1 d to degree", expected: "1 deg" },
      { queryString: "2 d to degree", expected: "2 deg" },
      {
        queryString: "1 d to radian",
        expected: "0.01745329252 radian",
      },
      {
        queryString: "2 d to radian",
        expected: "0.03490658504 radian",
      },
      {
        queryString: "1 d to rad",
        expected: "0.01745329252 radian",
      },
      { queryString: "1 d to r", expected: "0.01745329252 radian" },
      { queryString: "1 d to gradian", expected: "1.1111111111 gradian" },
      { queryString: "1 d to g", expected: "1.1111111111 gradian" },
      { queryString: "1 d to minute", expected: "60 min" },
      { queryString: "1 d to min", expected: "60 min" },
      { queryString: "1 d to m", expected: "60 min" },
      { queryString: "1 d to second", expected: "3,600 sec" },
      { queryString: "1 d to sec", expected: "3,600 sec" },
      { queryString: "1 d to s", expected: "3,600 sec" },
      { queryString: "1 d to sign", expected: "0.03333333333 sign" },
      { queryString: "1 d to mil", expected: "17.7777777778 mil" },
      {
        queryString: "1 d to revolution",
        expected: "0.002777777778 revolution",
      },
      { queryString: "1 d to circle", expected: "0.002777777778 circle" },
      { queryString: "1 d to turn", expected: "0.002777777778 turn" },
      {
        queryString: "1 d to quadrant",
        expected: "0.01111111111 quadrant",
      },
      {
        queryString: "1 d to rightangle",
        expected: "0.01111111111 rightangle",
      },
      { queryString: "1 d to sextant", expected: "0.01666666667 sextant" },
      { queryString: "1 degree to d", expected: "1 deg" },
      {
        queryString: "1 radian to d",
        expected: "57.2957795131 deg",
      },
      {
        queryString: "1 r to g",
        expected: "63.6619772368 gradian",
      },
    ],
  },
  {
    category: "force",
    cases: [
      { queryString: "1 n to n", expected: "1 newton" },
      { queryString: "-1 n to n", expected: "-1 newton" },
      { queryString: "1 n in n", expected: "1 newton" },
      { queryString: "1 n = n", expected: "1 newton" },
      { queryString: "1 N=N", expected: "1 newton" },
      { queryString: "1 n to newton", expected: "1 newton" },
      { queryString: "1 n to kilonewton", expected: "0.001 kilonewton" },
      { queryString: "1 n to kn", expected: "0.001 kilonewton" },
      {
        queryString: "1 n to gram-force",
        expected: "101.9716213 gram-force",
      },
      {
        queryString: "1 n to gf",
        expected: "101.9716213 gram-force",
      },
      {
        queryString: "1 n to kilogram-force",
        expected: "0.1019716213 kilogram-force",
      },
      {
        queryString: "1 n to kgf",
        expected: "0.1019716213 kilogram-force",
      },
      {
        queryString: "1 n to ton-force",
        expected: "0.0001019716213 ton-force",
      },
      {
        queryString: "1 n to tf",
        expected: "0.0001019716213 ton-force",
      },
      {
        queryString: "1 n to exanewton",
        expected: "1.0e-18 exanewton",
      },
      { queryString: "1 n to en", expected: "1.0e-18 exanewton" },
      {
        queryString: "1 n to petanewton",
        expected: "1.0e-15 petanewton",
      },
      { queryString: "1 n to PN", expected: "1.0e-15 petanewton" },
      { queryString: "1 n to Pn", expected: "1.0e-15 petanewton" },
      {
        queryString: "1 n to teranewton",
        expected: "1.0e-12 teranewton",
      },
      { queryString: "1 n to tn", expected: "1.0e-12 teranewton" },
      {
        queryString: "1 n to giganewton",
        expected: "1.0e-9 giganewton",
      },
      { queryString: "1 n to gn", expected: "1.0e-9 giganewton" },
      {
        queryString: "1 n to meganewton",
        expected: "1.0e-6 meganewton",
      },
      { queryString: "1 n to MN", expected: "1.0e-6 meganewton" },
      { queryString: "1 n to Mn", expected: "1.0e-6 meganewton" },
      { queryString: "1 n to hectonewton", expected: "0.01 hectonewton" },
      { queryString: "1 n to hn", expected: "0.01 hectonewton" },
      { queryString: "1 n to dekanewton", expected: "0.1 dekanewton" },
      { queryString: "1 n to dan", expected: "0.1 dekanewton" },
      { queryString: "1 n to decinewton", expected: "10 decinewton" },
      { queryString: "1 n to dn", expected: "10 decinewton" },
      { queryString: "1 n to centinewton", expected: "100 centinewton" },
      { queryString: "1 n to cn", expected: "100 centinewton" },
      { queryString: "1 n to millinewton", expected: "1,000 millinewton" },
      { queryString: "1 n to mn", expected: "1,000 millinewton" },
      { queryString: "1 n to micronewton", expected: "1,000,000 micronewton" },
      { queryString: "1 n to µn", expected: "1,000,000 micronewton" },
      {
        queryString: "1 n to nanonewton",
        expected: "1,000,000,000 nanonewton",
      },
      {
        queryString: "1 n to nn",
        expected: "1,000,000,000 nanonewton",
      },
      {
        queryString: "1 n to piconewton",
        expected: "1.0e12 piconewton",
      },
      {
        queryString: "1 n to pn",
        expected: "1.0e12 piconewton",
      },
      {
        queryString: "1 n to femtonewton",
        expected: "1.0e15 femtonewton",
      },
      {
        queryString: "1 n to fn",
        expected: "1.0e15 femtonewton",
      },
      {
        queryString: "1 n to attonewton",
        expected: "1.0e18 attonewton",
      },
      {
        queryString: "1 n to an",
        expected: "1.0e18 attonewton",
      },
      { queryString: "1 n to dyne", expected: "100,000 dyne" },
      { queryString: "1 n to dyn", expected: "100,000 dyne" },
      { queryString: "1 n to joule/meter", expected: "1 joule/meter" },
      { queryString: "1 n to j/m", expected: "1 joule/meter" },
      {
        queryString: "1 n to joule/centimeter",
        expected: "100 joule/centimeter",
      },
      { queryString: "1 n to j/cm", expected: "100 joule/centimeter" },
      {
        queryString: "1 n to ton-force-short",
        expected: "0.0001124045 ton-force-short",
      },
      {
        queryString: "1 n to short",
        expected: "0.0001124045 ton-force-short",
      },
      {
        queryString: "1 n to ton-force-long",
        expected: "0.0001003611 ton-force-long",
      },
      {
        queryString: "1 n to tonf",
        expected: "0.0001003611 ton-force-long",
      },
      {
        queryString: "1 n to kip-force",
        expected: "0.0002248089 kip-force",
      },
      {
        queryString: "1 n to kipf",
        expected: "0.0002248089 kip-force",
      },
      {
        queryString: "1 n to pound-force",
        expected: "0.2248089431 pound-force",
      },
      {
        queryString: "1 n to lbf",
        expected: "0.2248089431 pound-force",
      },
      {
        queryString: "1 n to ounce-force",
        expected: "3.5969430896 ounce-force",
      },
      {
        queryString: "1 n to ozf",
        expected: "3.5969430896 ounce-force",
      },
      {
        queryString: "1 n to poundal",
        expected: "7.2330138512 poundal",
      },
      {
        queryString: "1 n to pdl",
        expected: "7.2330138512 poundal",
      },
      { queryString: "1 n to pond", expected: "101.9716213 pond" },
      { queryString: "1 n to p", expected: "101.9716213 pond" },
      {
        queryString: "1 n to kilopond",
        expected: "0.1019716213 kilopond",
      },
      {
        queryString: "1 n to kp",
        expected: "0.1019716213 kilopond",
      },
      { queryString: "1 kilonewton to n", expected: "1,000 newton" },
    ],
  },
  {
    category: "length",
    cases: [
      { queryString: "1 meter to meter", expected: "1 m" },
      { queryString: "-1 meter to meter", expected: "-1 m" },
      { queryString: "1 meter in meter", expected: "1 m" },
      { queryString: "1 meter = meter", expected: "1 m" },
      { queryString: "1 METER=METER", expected: "1 m" },
      { queryString: "1 m to meter", expected: "1 m" },
      { queryString: "1 m to nanometer", expected: "1,000,000,000 nanometer" },
      { queryString: "1 m to micrometer", expected: "1,000,000 micrometer" },
      { queryString: "1 m to millimeter", expected: "1,000 mm" },
      { queryString: "1 m to mm", expected: "1,000 mm" },
      { queryString: "1 m to centimeter", expected: "100 cm" },
      { queryString: "1 m to cm", expected: "100 cm" },
      { queryString: "1 m to kilometer", expected: "0.001 km" },
      { queryString: "1 m to km", expected: "0.001 km" },
      { queryString: "1 m to mile", expected: "0.0006213689 mi" },
      { queryString: "1 m to mi", expected: "0.0006213689 mi" },
      { queryString: "1 m to yard", expected: "1.0936132983 yd" },
      { queryString: "1 m to yd", expected: "1.0936132983 yd" },
      { queryString: "1 m to foot", expected: "3.280839895 ft" },
      { queryString: "1 m to ft", expected: "3.280839895 ft" },
      { queryString: "1 m to inch", expected: "39.37007874 in" },
      { queryString: "1 inch to m", expected: "0.0254 m" },
    ],
  },
  {
    category: "mass",
    cases: [
      { queryString: "1 kg to kg", expected: "1 kg" },
      { queryString: "-1 kg to kg", expected: "-1 kg" },
      { queryString: "1 kg in kg", expected: "1 kg" },
      { queryString: "1 kg = kg", expected: "1 kg" },
      { queryString: "1 KG=KG", expected: "1 kg" },
      { queryString: "1 kg to kilogram", expected: "1 kg" },
      { queryString: "1 kg to gram", expected: "1,000 g" },
      { queryString: "1 kg to g", expected: "1,000 g" },
      { queryString: "1 kg to milligram", expected: "1,000,000 milligram" },
      { queryString: "1 kg to mg", expected: "1,000,000 milligram" },
      { queryString: "1 kg to ton", expected: "0.001 ton" },
      { queryString: "1 kg to t", expected: "0.001 ton" },
      {
        queryString: "1 kg to longton",
        expected: "0.0009842073 longton",
      },
      {
        queryString: "1 kg to l.t.",
        expected: "0.0009842073 longton",
      },
      {
        queryString: "1 kg to l/t",
        expected: "0.0009842073 longton",
      },
      {
        queryString: "1 kg to shortton",
        expected: "0.0011023122 shortton",
      },
      {
        queryString: "1 kg to s.t.",
        expected: "0.0011023122 shortton",
      },
      {
        queryString: "1 kg to s/t",
        expected: "0.0011023122 shortton",
      },
      {
        queryString: "1 kg to pound",
        expected: "2.2046244202 lb",
      },
      { queryString: "1 kg to lbs", expected: "2.2046244202 lb" },
      {
        queryString: "1 kg to lb",
        expected: "2.2046244202 lb",
      },
      {
        queryString: "1 kg to ounce",
        expected: "35.273990723 oz",
      },
      { queryString: "1 kg to oz", expected: "35.273990723 oz" },
      { queryString: "1 kg to carat", expected: "5,000 carat" },
      { queryString: "1 kg to ffd", expected: "5,000 ffd" },
      { queryString: "1 ffd to kg", expected: "0.0002 kg" },
    ],
  },
  {
    category: "temperature",
    cases: [
      { queryString: "0 c to c", expected: "0°C" },
      { queryString: "0 c in c", expected: "0°C" },
      { queryString: "0 c = c", expected: "0°C" },
      { queryString: "0 C=C", expected: "0°C" },
      { queryString: "0 c to celsius", expected: "0°C" },
      { queryString: "0 c to kelvin", expected: "273.15 kelvin" },
      { queryString: "0 c to k", expected: "273.15 kelvin" },
      { queryString: "10 c to k", expected: "283.15 kelvin" },
      { queryString: "0 c to fahrenheit", expected: "32°F" },
      { queryString: "0 c to f", expected: "32°F" },
      { queryString: "10 c to f", expected: "50°F" },
      {
        queryString: "10 f to kelvin",
        expected: `260.9277777778 kelvin`,
      },
      { queryString: "-10 c to f", expected: "14°F" },
    ],
  },
  {
    category: "timezone",
    cases: [
      { queryString: "0 utc to utc", expected: "00:00 UTC" },
      { queryString: "0 utc in utc", expected: "00:00 UTC" },
      { queryString: "0 utc = utc", expected: "00:00 UTC" },
      { queryString: "0 UTC=UTC", expected: "00:00 UTC" },
      { queryString: "11 pm utc to utc", expected: "11:00 PM UTC" },
      { queryString: "11 am utc to utc", expected: "11:00 AM UTC" },
      { queryString: "11:30 utc to utc", expected: "11:30 UTC" },
      { queryString: "11:30 PM utc to utc", expected: "11:30 PM UTC" },
      { queryString: "1 utc to idlw", expected: "13:00 IDLW" },
      { queryString: "1 pm utc to idlw", expected: "1:00 AM IDLW" },
      { queryString: "1 am utc to idlw", expected: "1:00 PM IDLW" },
      { queryString: "1 utc to idlw", expected: "13:00 IDLW" },
      { queryString: "1 PM utc to idlw", expected: "1:00 AM IDLW" },
      { queryString: "0 utc to nt", expected: "13:00 NT" },
      { queryString: "0 utc to hst", expected: "14:00 HST" },
      { queryString: "0 utc to akst", expected: "15:00 AKST" },
      { queryString: "0 utc to pst", expected: "16:00 PST" },
      { queryString: "0 utc to akdt", expected: "16:00 AKDT" },
      { queryString: "0 utc to mst", expected: "17:00 MST" },
      { queryString: "0 utc to pdt", expected: "17:00 PDT" },
      { queryString: "0 utc to cst", expected: "18:00 CST" },
      { queryString: "0 utc to mdt", expected: "18:00 MDT" },
      { queryString: "0 utc to est", expected: "19:00 EST" },
      { queryString: "0 utc to cdt", expected: "19:00 CDT" },
      { queryString: "0 utc to edt", expected: "20:00 EDT" },
      { queryString: "0 utc to ast", expected: "20:00 AST" },
      { queryString: "0 utc to guy", expected: "21:00 GUY" },
      { queryString: "0 utc to adt", expected: "21:00 ADT" },
      { queryString: "0 utc to at", expected: "22:00 AT" },
      { queryString: "0 utc to gmt", expected: "00:00 GMT" },
      { queryString: "0 utc to z", expected: "00:00 Z" },
      { queryString: "0 utc to wet", expected: "00:00 WET" },
      { queryString: "0 utc to west", expected: "01:00 WEST" },
      { queryString: "0 utc to cet", expected: "01:00 CET" },
      { queryString: "0 utc to bst", expected: "01:00 BST" },
      { queryString: "0 utc to ist", expected: "01:00 IST" },
      { queryString: "0 utc to cest", expected: "02:00 CEST" },
      { queryString: "0 utc to eet", expected: "02:00 EET" },
      { queryString: "0 utc to eest", expected: "03:00 EEST" },
      { queryString: "0 utc to msk", expected: "03:00 MSK" },
      { queryString: "0 utc to msd", expected: "04:00 MSD" },
      { queryString: "0 utc to zp4", expected: "04:00 ZP4" },
      { queryString: "0 utc to zp5", expected: "05:00 ZP5" },
      { queryString: "0 utc to zp6", expected: "06:00 ZP6" },
      { queryString: "0 utc to wast", expected: "07:00 WAST" },
      { queryString: "0 utc to awst", expected: "08:00 AWST" },
      { queryString: "0 utc to wst", expected: "08:00 WST" },
      { queryString: "0 utc to jst", expected: "09:00 JST" },
      { queryString: "0 utc to acst", expected: "09:30 ACST" },
      { queryString: "0 utc to aest", expected: "10:00 AEST" },
      { queryString: "0 utc to acdt", expected: "10:30 ACDT" },
      { queryString: "0 utc to aedt", expected: "11:00 AEDT" },
      { queryString: "0 utc to nzst", expected: "12:00 NZST" },
      { queryString: "0 utc to idle", expected: "12:00 IDLE" },
      { queryString: "0 utc to nzd", expected: "13:00 NZD" },
      { queryString: "9:00 jst to utc", expected: "00:00 UTC" },
      { queryString: "8:00 jst to utc", expected: "23:00 UTC" },
      { queryString: "8:00 am jst to utc", expected: "11:00 PM UTC" },
      { queryString: "9:00 jst to pdt", expected: "17:00 PDT" },
      { queryString: "12 pm pst to cet", expected: "9:00 PM CET" },
      { queryString: "12 am pst to cet", expected: "9:00 AM CET" },
      { queryString: "12:30 pm pst to cet", expected: "9:30 PM CET" },
      { queryString: "12:30 am pst to cet", expected: "9:30 AM CET" },
      { queryString: "23 pm pst to cet", expected: "8:00 AM CET" },
      { queryString: "23:30 pm pst to cet", expected: "8:30 AM CET" },
      {
        queryString: "10:00 JST to here",
        timezone: "UTC",
        expected: "01:00 UTC-000",
      },
      {
        queryString: "1:00 to JST",
        timezone: "UTC",
        expected: "10:00 JST",
      },
      {
        queryString: "1 am to JST",
        timezone: "UTC",
        expected: "10:00 AM JST",
      },
      {
        queryString: "now to JST",
        timezone: "UTC",
        assertResult: output => {
          const outputRegexResult = /([0-9]+):([0-9]+)/.exec(output);
          const outputMinutes =
            parseInt(outputRegexResult[1]) * 60 +
            parseInt(outputRegexResult[2]);
          const nowDate = new Date();
          // Apply JST time difference.
          nowDate.setHours(nowDate.getHours() + 9);
          let nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
          // When we cross the day between the unit converter calculation and the
          // assertion here.
          nowMinutes =
            outputMinutes > nowMinutes ? nowMinutes + 1440 : nowMinutes;
          Assert.lessOrEqual(nowMinutes - outputMinutes, 1);
        },
      },
      {
        queryString: "now to here",
        timezone: "UTC",
        assertResult: output => {
          const outputRegexResult = /([0-9]+):([0-9]+)/.exec(output);
          const outputMinutes =
            parseInt(outputRegexResult[1]) * 60 +
            parseInt(outputRegexResult[2]);
          const nowDate = new Date();
          let nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
          nowMinutes =
            outputMinutes > nowMinutes ? nowMinutes + 1440 : nowMinutes;
          Assert.lessOrEqual(nowMinutes - outputMinutes, 1);
        },
      },
    ],
  },
  {
    category: "invalid",
    cases: [
      { queryString: "1 to cm" },
      { queryString: "1cm to newton" },
      { queryString: "1cm to foo" },
      { queryString: "0:00:00 utc to jst" },
    ],
  },
];

add_task(async function () {
  // Enable unit conversion.
  Services.prefs.setBoolPref("browser.urlbar.unitConversion.enabled", true);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("browser.urlbar.unitConversion.enabled");
  });

  for (const { category, cases } of TEST_DATA) {
    for (const { queryString, timezone, expected, assertResult } of cases) {
      info(`Test "${queryString}" in ${category}`);

      if (timezone) {
        info(`Set timezone ${timezone}`);
        Cu.getJSTestingFunctions().setTimeZone(timezone);
      }

      const context = createContext(queryString);
      const isActive = await UrlbarProviderUnitConversion.isActive(context);
      Assert.equal(isActive, !!expected || !!assertResult);

      if (isActive) {
        UrlbarProviderUnitConversion.startQuery(context, (module, result) => {
          Assert.equal(result.type, UrlbarUtils.RESULT_TYPE.DYNAMIC);
          Assert.equal(result.source, UrlbarUtils.RESULT_SOURCE.OTHER_LOCAL);
          Assert.equal(result.suggestedIndex, 1);
          Assert.equal(result.payload.input, queryString);

          if (expected) {
            Assert.equal(result.payload.output, expected);
          } else {
            assertResult(result.payload.output);
          }
        });
      }

      if (timezone) {
        // Reset timezone to default
        Cu.getJSTestingFunctions().setTimeZone(undefined);
      }
    }
  }
});
