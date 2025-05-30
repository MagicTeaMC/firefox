/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

const {
  LocalizationProvider,
  Localized,
} = require("resource://devtools/client/shared/vendor/fluent-react.js");

import React, { PureComponent } from "devtools/client/shared/vendor/react";
import { div, span } from "devtools/client/shared/vendor/react-dom-factories";
import PropTypes from "devtools/client/shared/vendor/react-prop-types";
import { connect } from "devtools/client/shared/vendor/react-redux";
import AccessibleImage from "../shared/AccessibleImage";
import actions from "../../actions/index";

const Reps = ChromeUtils.importESModule(
  "resource://devtools/client/shared/components/reps/index.mjs"
);
const {
  REPS: { Rep },
  MODE,
} = Reps;

import { getPauseReason } from "../../utils/pause/index";
import {
  getCurrentThread,
  getPauseCommand,
  getPaneCollapse,
  getPauseReason as getWhy,
  getVisibleSelectedFrame,
} from "../../selectors/index";

const classnames = require("resource://devtools/client/shared/classnames.js");

class WhyPaused extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { hideWhyPaused: true };
  }

  static get propTypes() {
    return {
      delay: PropTypes.number.isRequired,
      endPanelCollapsed: PropTypes.bool.isRequired,
      highlightDomElement: PropTypes.func.isRequired,
      openElementInInspector: PropTypes.func.isRequired,
      unHighlightDomElement: PropTypes.func.isRequired,
      why: PropTypes.object,
    };
  }

  componentDidUpdate() {
    const { delay } = this.props;

    if (delay) {
      setTimeout(() => {
        this.setState({ hideWhyPaused: true });
      }, delay);
    } else {
      this.setState({ hideWhyPaused: false });
    }
  }

  renderExceptionSummary(exception) {
    if (typeof exception === "string") {
      return exception;
    }

    const { preview } = exception;
    if (!preview || !preview.name || !preview.message) {
      return null;
    }

    return `${preview.name}: ${preview.message}`;
  }

  renderMessage(why) {
    const { type, exception, message } = why;

    if (type == "exception" && exception) {
      // Our types for 'Why' are too general because 'type' can be 'string'.
      // $FlowFixMe - We should have a proper discriminating union of reasons.
      const summary = this.renderExceptionSummary(exception);
      return div(
        {
          className: "message error",
        },
        summary
      );
    }

    if (type === "mutationBreakpoint" && why.nodeGrip) {
      const { nodeGrip, ancestorGrip, action } = why;
      const {
        openElementInInspector,
        highlightDomElement,
        unHighlightDomElement,
      } = this.props;

      const targetRep = Rep({
        object: nodeGrip,
        mode: MODE.TINY,
        onDOMNodeClick: () => openElementInInspector(nodeGrip),
        onInspectIconClick: () => openElementInInspector(nodeGrip),
        onDOMNodeMouseOver: () => highlightDomElement(nodeGrip),
        onDOMNodeMouseOut: () => unHighlightDomElement(),
      });

      const ancestorRep = ancestorGrip
        ? Rep({
            object: ancestorGrip,
            mode: MODE.TINY,
            onDOMNodeClick: () => openElementInInspector(ancestorGrip),
            onInspectIconClick: () => openElementInInspector(ancestorGrip),
            onDOMNodeMouseOver: () => highlightDomElement(ancestorGrip),
            onDOMNodeMouseOut: () => unHighlightDomElement(),
          })
        : null;
      return div(
        null,
        div(
          {
            className: "message",
          },
          why.message
        ),
        div(
          {
            className: "mutationNode",
          },
          ancestorRep,
          ancestorGrip
            ? span(
                {
                  className: "why-paused-ancestor",
                },
                React.createElement(Localized, {
                  id:
                    action === "remove"
                      ? "whypaused-mutation-breakpoint-removed"
                      : "whypaused-mutation-breakpoint-added",
                }),
                targetRep
              )
            : targetRep
        )
      );
    }

    if (typeof message == "string") {
      return div(
        {
          className: "message",
        },
        message
      );
    }

    return null;
  }

  renderLocation() {
    const { visibleSelectedFrame } = this.props;
    if (!visibleSelectedFrame || !visibleSelectedFrame.location?.source) {
      return null;
    }
    const { location, displayName } = visibleSelectedFrame;
    let pauseLocation = "";
    if (visibleSelectedFrame.displayName) {
      pauseLocation += `${displayName} - `;
    }
    pauseLocation += `${location.source.displayURL?.filename}:${location.line}:${location.column}`;
    return div({ className: "location" }, pauseLocation);
  }

  render() {
    const { endPanelCollapsed, why } = this.props;
    const { fluentBundles } = this.context;
    const reason = getPauseReason(why);

    let content = "";
    if (!why || !reason) {
      if (this.state.hideWhyPaused) {
        content = null;
      }
    } else {
      content = div(
        null,
        div(
          {
            className: "info icon",
          },
          React.createElement(AccessibleImage, {
            className: "info",
          })
        ),
        div(
          {
            className: "pause reason",
          },
          div(
            {},
            React.createElement(Localized, {
              id: reason,
            })
          ),
          this.renderLocation(),
          this.renderMessage(why)
        )
      );
    }

    return (
      // We're rendering the LocalizationProvider component from here and not in an upper
      // component because it does set a new context, overriding the context that we set
      // in the first place in <App>, which breaks some components.
      // This should be fixed in Bug 1743155.
      React.createElement(
        LocalizationProvider,
        {
          bundles: fluentBundles || [],
        },
        // Always render the component so the live region works as expected
        div(
          {
            className: classnames("pane why-paused", {
              hidden: content == null || endPanelCollapsed,
            }),
            "aria-live": "polite",
          },
          content
        )
      )
    );
  }
}

WhyPaused.contextTypes = { fluentBundles: PropTypes.array };

// Checks if user is in debugging mode and adds a delay preventing
// excessive vertical 'jumpiness'
function getDelay(state, thread) {
  const inPauseCommand = !!getPauseCommand(state, thread);

  if (!inPauseCommand) {
    return 100;
  }

  return 0;
}

const mapStateToProps = state => {
  const thread = getCurrentThread(state);

  return {
    delay: getDelay(state, thread),
    endPanelCollapsed: getPaneCollapse(state, "end"),
    why: getWhy(state, thread),
    visibleSelectedFrame: getVisibleSelectedFrame(state),
  };
};

export default connect(mapStateToProps, {
  openElementInInspector: actions.openElementInInspectorCommand,
  highlightDomElement: actions.highlightDomElement,
  unHighlightDomElement: actions.unHighlightDomElement,
})(WhyPaused);
