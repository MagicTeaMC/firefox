#!/usr/bin/env python
import json
import pathlib

import jsonschema
import mozunit
import pytest

from mozperftest.environment import METRICS
from mozperftest.metrics.exceptions import PerfherderValidDataError
from mozperftest.metrics.notebook.transforms.single_json import SingleJsonRetriever
from mozperftest.metrics.utils import metric_fields
from mozperftest.tests.support import (
    BT_DATA,
    EXAMPLE_TEST,
    HERE,
    MOCHITEST_DATA,
    get_running_env,
    temp_file,
)
from mozperftest.utils import silence, temp_dir


class PerfherderTransformer(SingleJsonRetriever):
    """Used for testing the summarization transforms."""

    def summary(self, suite):
        return 0

    def subtest_summary(self, subtest):
        return -1


def setup_env(options):
    mach_cmd, metadata, env = get_running_env(**options)
    runs = []

    def _run_process(*args, **kw):
        runs.append((args, kw))

    mach_cmd.run_process = _run_process
    metrics = env.layers[METRICS]
    env.set_arg("tests", [EXAMPLE_TEST])
    metadata.add_result({"results": str(BT_DATA), "name": "browsertime"})
    return metrics, metadata, env


def test_perfherder():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("firstPaint")],
        "perfherder-timestamp": 1.0,
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Check some metadata
    assert output["application"]["name"] == "firefox"
    assert output["framework"]["name"] == "mozperftest"
    assert output["pushTimestamp"] == 1.0

    # Check some numbers in our data
    assert len(output["suites"]) == 1
    assert len(output["suites"][0]["subtests"]) == 10
    assert not any("value" in suite for suite in output["suites"])

    # Check if only firstPaint metrics were obtained
    for subtest in output["suites"][0]["subtests"]:
        assert "firstPaint" in subtest["name"]


def test_perfherder_test_settings():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [
            metric_fields(
                "name:mochitest-metric1,shouldAlert:True,lowerIsBetter:False,unit:cli-unit"
            ),
            metric_fields("mochitest-metric2"),
            metric_fields("name:mochitest-metric3,lowerIsBetter:True"),
            metric_fields("mochitest-metric4"),
            metric_fields("mochitest-metric5"),
        ],
        "perfherder-timestamp": 1.0,
    }

    print(options)
    metrics, metadata, env = setup_env(options)

    metadata.clear_results()
    with MOCHITEST_DATA.open() as f:
        metadata.add_result(json.loads(f.read()))

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Check some metadata
    assert output["application"]["name"] == "firefox"
    assert output["framework"]["name"] == "mozperftest"
    assert output["pushTimestamp"] == 1.0

    # Check some numbers in our data
    assert len(output["suites"]) == 1
    assert len(output["suites"][0]["subtests"]) == 5
    assert not any("value" in suite for suite in output["suites"])

    # Check if only mochitest metrics were obtained
    checked = 0
    for subtest in output["suites"][0]["subtests"]:
        assert "mochitest-metric" in subtest["name"]

        if subtest["name"] == "mochitest-metric1":
            assert subtest.get("value") == 227.67
            assert subtest.get("unit") == "cli-unit"
            assert subtest.get("shouldAlert")
            assert not subtest.get("lowerIsBetter")
            checked += 1
        elif subtest["name"] == "mochitest-metric2":
            # Default with no CLI arg is False
            assert subtest.get("value") == 1662.995
            assert subtest.get("unit") == "metric-unit"
            checked += 1
        elif subtest["name"] == "mochitest-metric3":
            # CLI args should be overriden
            assert not subtest.get("shouldAlert")
            assert not subtest.get("lowerIsBetter")
            checked += 1
        elif subtest["name"] == "mochitest-metric4":
            # Setting from test should be False
            assert not subtest.get("shouldAlert")
            assert subtest.get("lowerIsBetter")
            checked += 1
        elif subtest["name"] == "mochitest-metric5":
            # Setting from test should be True
            assert subtest.get("shouldAlert")
            checked += 1

    assert checked == 5


def test_perfherder_simple_names():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("firstPaint"), metric_fields("resource")],
        "perfherder-simplify-names": True,
        "perfherder-simplify-exclude": ["statistics"],
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Check some metadata
    assert output["application"]["name"] == "firefox"
    assert output["framework"]["name"] == "mozperftest"

    # Check some numbers in our data
    assert len(output["suites"]) == 1
    assert "value" not in output["suites"][0]
    assert any(r > 0 for r in output["suites"][0]["subtests"][0]["replicates"])

    # Check if only firstPaint/resource metrics were obtained and
    # that simplifications occurred
    assert all(
        [
            "firstPaint" in subtest["name"]
            or "duration" in subtest["name"]
            or "count" in subtest["name"]
            for subtest in output["suites"][0]["subtests"]
        ]
    )

    found_all = {"firstPaint": False, "count": False, "duration": False}
    for subtest in output["suites"][0]["subtests"]:
        if subtest["name"] in found_all:
            found_all[subtest["name"]] = True
            continue
        assert any([name in subtest["name"] for name in found_all.keys()])
        # Statistics are not simplified so any metric that isn't
        # in the list of known metrics must be a statistic
        assert "statistics" in subtest["name"]

    for entry, value in found_all.items():
        assert found_all[entry], f"Failed finding metric simplification for {entry}"

    # Statistics are not simplified by default
    assert (
        len(
            [
                subtest
                for subtest in output["suites"][0]["subtests"]
                if "statistics" in subtest["name"]
            ]
        )
        == 27
    )
    assert (
        len(
            [
                subtest
                for subtest in output["suites"][0]["subtests"]
                if "statistics" not in subtest["name"]
            ]
        )
        == 3
    )


def test_perfherder_names_simplified_with_no_exclusions():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("firstPaint"), metric_fields("resource")],
        "perfherder-simplify-names": True,
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Check some metadata
    assert output["application"]["name"] == "firefox"
    assert output["framework"]["name"] == "mozperftest"

    # Check some numbers in our data
    assert len(output["suites"]) == 1
    assert "value" not in output["suites"][0]
    assert any(r > 0 for r in output["suites"][0]["subtests"][0]["replicates"])

    # In this case, some metrics will be called "median", "mean", etc.
    # since those are the simplifications of the first statistics entries
    # that were found.
    assert not all(
        [
            "firstPaint" in subtest["name"]
            or "duration" in subtest["name"]
            or "count" in subtest["name"]
            for subtest in output["suites"][0]["subtests"]
        ]
    )

    found_all = {"firstPaint": False, "count": False, "duration": False}
    for subtest in output["suites"][0]["subtests"]:
        if subtest["name"] in found_all:
            found_all[subtest["name"]] = True
            continue

    for entry, value in found_all.items():
        assert found_all[entry], f"Failed finding metric simplification for {entry}"

    # Only a portion of the metrics should still have statistics in
    # their name due to a naming conflict that only emits a warning
    assert (
        len(
            [
                subtest
                for subtest in output["suites"][0]["subtests"]
                if "statistics" in subtest["name"]
            ]
        )
        == 18
    )
    assert (
        len(
            [
                subtest
                for subtest in output["suites"][0]["subtests"]
                if "statistics" not in subtest["name"]
            ]
        )
        == 12
    )


def test_perfherder_with_extra_metadata_options():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [
            metric_fields("name:firstPaint,extraOptions:['option']"),
            metric_fields("name:resource,extraOptions:['second-option']"),
        ],
    }

    metrics, metadata, env = setup_env(options)
    metadata.add_extra_options(["simpleperf"])

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    assert len(output["suites"]) == 1
    assert sorted(output["suites"][0]["extraOptions"]) == sorted(
        ["option", "second-option", "simpleperf"]
    )


def test_perfherder_with_extra_options():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [
            metric_fields("name:firstPaint,extraOptions:['option']"),
            metric_fields("name:resource,extraOptions:['second-option']"),
        ],
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    assert len(output["suites"]) == 1
    assert sorted(output["suites"][0]["extraOptions"]) == sorted(
        ["option", "second-option"]
    )


def test_perfherder_with_alerting():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [
            metric_fields("name:firstPaint,extraOptions:['option']"),
            metric_fields("name:resource,shouldAlert:True"),
        ],
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    assert len(output["suites"]) == 1
    assert sorted(output["suites"][0]["extraOptions"]) == sorted(["option"])
    assert all(
        [
            subtest["shouldAlert"]
            for subtest in output["suites"][0]["subtests"]
            if "resource" in subtest["name"]
        ]
    )
    assert not all(
        [
            subtest["shouldAlert"]
            for subtest in output["suites"][0]["subtests"]
            if "firstPaint" in subtest["name"]
        ]
    )


def test_perfherder_with_subunits():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [
            metric_fields("name:firstPaint,extraOptions:['option']"),
            metric_fields("name:resource,shouldAlert:True,unit:a-unit"),
        ],
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    assert len(output["suites"]) == 1
    assert all(
        [
            subtest["unit"] == "a-unit"
            for subtest in output["suites"][0]["subtests"]
            if "resource" in subtest["name"]
        ]
    )
    assert all(
        [
            subtest["unit"] == "ms"
            for subtest in output["suites"][0]["subtests"]
            if "firstPaint" in subtest["name"]
        ]
    )


def test_perfherder_with_supraunits():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [
            metric_fields("name:browsertime,unit:new-unit"),
            metric_fields("name:firstPaint,extraOptions:['option']"),
            metric_fields("name:resource,shouldAlert:True,unit:a-unit"),
        ],
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    assert len(output["suites"]) == 1
    assert output["suites"][0]["unit"] == "new-unit"
    assert all(
        [
            subtest["unit"] == "a-unit"
            for subtest in output["suites"][0]["subtests"]
            if "resource" in subtest["name"]
        ]
    )
    assert all(
        [
            subtest["unit"] == "new-unit"
            for subtest in output["suites"][0]["subtests"]
            if "firstPaint" in subtest["name"]
        ]
    )


def test_perfherder_transforms():
    options = {
        "perfherder": True,
        "perfherder-stats": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("name:firstPaint")],
        "perfherder-transformer": "mozperftest.tests.test_perfherder:PerfherderTransformer",
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    assert len(output["suites"]) == 1
    assert output["suites"][0]["unit"] == "ms"
    assert all([subtest["value"] == -1 for subtest in output["suites"][0]["subtests"]])
    assert "value" in output["suites"][0]
    assert output["suites"][0]["value"] == 0


def test_perfherder_logcat():
    options = {
        "perfherder": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("TimeToDisplayed")],
    }

    metrics, metadata, env = setup_env(options)
    metadata.clear_results()

    def processor(groups):
        """Parses the time from a displayed time string into milliseconds."""
        return (float(groups[0]) * 1000) + float(groups[1])

    re_w_group = r".*Displayed.*org\.mozilla\.fennec_aurora.*\+([\d]+)s([\d]+)ms.*"
    metadata.add_result(
        {
            "results": str(HERE / "data" / "home_activity.txt"),
            "transformer": "LogCatTimeTransformer",
            "transformer-options": {
                "first-timestamp": re_w_group,
                "processor": processor,
                "transform-subtest-name": "TimeToDisplayed",
            },
            "name": "LogCat",
        }
    )

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m:  # , silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Check some metadata
    assert output["application"]["name"] == "firefox"
    assert output["framework"]["name"] == "mozperftest"

    # Check some numbers in our data
    assert len(output["suites"]) == 1
    assert len(output["suites"][0]["subtests"]) == 1
    assert "value" not in output["suites"][0]
    assert any(r > 0 for r in output["suites"][0]["subtests"][0]["replicates"])

    # Check if only the TimeToDisplayd metric was obtained
    for subtest in output["suites"][0]["subtests"]:
        assert "TimeToDisplayed" in subtest["name"]


def test_perfherder_validation_failure():
    options = {"perfherder": True, "perfherder-prefix": ""}

    metrics, metadata, env = setup_env(options)

    # Perfherder schema has limits on min/max data values. Having
    # no metrics in the options will cause a failure because of the
    # timestamps that are picked up from browsertime.
    with pytest.raises(jsonschema.ValidationError):
        with temp_dir() as output:
            env.set_arg("output", output)
            with metrics as m, silence():
                m(metadata)


def test_perfherder_missing_data_failure():
    options = {"perfherder": True, "perfherder-prefix": ""}

    metrics, metadata, env = setup_env(options)
    metadata.clear_results()

    with temp_dir() as tmpdir:
        nodatajson = pathlib.Path(tmpdir, "baddata.json")
        with nodatajson.open("w") as f:
            json.dump({"bad data": "here"}, f)

        metadata.add_result({"results": str(nodatajson), "name": "browsertime"})

        with pytest.raises(PerfherderValidDataError):
            with temp_file() as output:
                env.set_arg("output", output)
                with metrics as m, silence():
                    m(metadata)


def test_perfherder_metrics_filtering():
    options = {
        "perfherder": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("I shouldn't match a metric")],
    }

    metrics, metadata, env = setup_env(options)
    metadata.clear_results()

    with temp_dir() as tmpdir:
        nodatajson = pathlib.Path(tmpdir, "nodata.json")
        with nodatajson.open("w") as f:
            json.dump({}, f)

        metadata.add_result({"results": str(nodatajson), "name": "browsertime"})

        with temp_dir() as output:
            env.set_arg("output", output)
            with metrics as m, silence():
                m(metadata)

            assert not pathlib.Path(output, "perfherder-data.json").exists()


def test_perfherder_exlude_stats():
    options = {
        "perfherder": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("firstPaint")],
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Check some numbers in our data
    assert len(output["suites"]) == 1
    assert len(output["suites"][0]["subtests"]) == 1
    assert "value" not in output["suites"][0]
    assert any(r > 0 for r in output["suites"][0]["subtests"][0]["replicates"])

    # Check if only firstPaint metric was obtained with 2 replicates
    assert len(output["suites"][0]["subtests"][0]["replicates"]) == 2
    assert (
        "browserScripts.timings.firstPaint"
        == output["suites"][0]["subtests"][0]["name"]
    )


def test_perfherder_app_name():
    options = {
        "app": "fenix",
        "perfherder": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("firstPaint")],
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Make sure that application setting is correct
    assert output["application"]["name"] == "fenix"
    assert "version" not in output["application"]


def test_perfherder_split_by():
    options = {
        "app": "fenix",
        "perfherder": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("firstPaint")],
        "perfherder-split-by": "browserScripts.pageinfo.url",
    }

    metrics, metadata, env = setup_env(options)

    with temp_file() as output:
        env.set_arg("output", output)
        with metrics as m, silence():
            m(metadata)
        output_file = metadata.get_output()
        with open(output_file) as f:
            output = json.loads(f.read())

    # Sanity check
    assert len(output["suites"]) == 1

    # We should have 2 subtests (1 per URL)
    assert len(output["suites"][0]["subtests"]) == 2

    # Check to make sure that they were properly split
    names = [subtest["name"] for subtest in output["suites"][0]["subtests"]]
    assert sorted(names) == [
        "browserScripts.timings.firstPaint https://www.mozilla.org/en-US/",
        "browserScripts.timings.firstPaint https://www.sitespeed.io/",
    ]
    for i in range(2):
        assert len(output["suites"][0]["subtests"][i]["replicates"]) == 1


def test_perfherder_bad_app_name():
    options = {
        "app": "this is not an app",
        "perfherder": True,
        "perfherder-prefix": "",
        "perfherder-metrics": [metric_fields("firstPaint")],
    }

    metrics, metadata, env = setup_env(options)

    # This will raise an error because the options method
    # we use in tests skips the `choices` checks.
    with pytest.raises(jsonschema.ValidationError):
        with temp_file() as output:
            env.set_arg("output", output)
            with metrics as m, silence():
                m(metadata)


if __name__ == "__main__":
    mozunit.main()
