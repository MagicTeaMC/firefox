/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// protocol.js uses objects as exceptions in order to define
// error packets.
/* eslint-disable no-throw-literal */

const { Actor, Pool } = require("resource://devtools/shared/protocol.js");
const { rootSpec } = require("resource://devtools/shared/specs/root.js");

const {
  LazyPool,
  createExtraActors,
} = require("resource://devtools/shared/protocol/lazy-pool.js");
const {
  DevToolsServer,
} = require("resource://devtools/server/devtools-server.js");
const Resources = require("resource://devtools/server/actors/resources/index.js");

loader.lazyRequireGetter(
  this,
  "ProcessDescriptorActor",
  "resource://devtools/server/actors/descriptors/process.js",
  true
);

/* Root actor for the remote debugging protocol. */

/**
 * Create a remote debugging protocol root actor.
 *
 * @param conn
 *     The DevToolsServerConnection whose root actor we are constructing.
 *
 * @param parameters
 *     The properties of |parameters| provide backing objects for the root
 *     actor's requests; if a given property is omitted from |parameters|, the
 *     root actor won't implement the corresponding requests or notifications.
 *     Supported properties:
 *
 *     - tabList: a live list (see below) of target actors for tabs. If present,
 *       the new root actor supports the 'listTabs' request, providing the live
 *       list's elements as its target actors, and sending 'tabListChanged'
 *       notifications when the live list's contents change. One actor in
 *       this list must have a true '.selected' property.
 *
 *     - addonList: a live list (see below) of addon actors. If present, the
 *       new root actor supports the 'listAddons' request, providing the live
 *       list's elements as its addon actors, and sending 'addonListchanged'
 *       notifications when the live list's contents change.
 *
 *     - globalActorFactories: an object |A| describing further actors to
 *       attach to the 'listTabs' reply. This is the type accumulated by
 *       ActorRegistry.addGlobalActor. For each own property |P| of |A|,
 *       the root actor adds a property named |P| to the 'listTabs'
 *       reply whose value is the name of an actor constructed by
 *       |A[P]|.
 *
 *     - onShutdown: a function to call when the root actor is destroyed.
 *
 * Instance properties:
 *
 * - applicationType: the string the root actor will include as the
 *      "applicationType" property in the greeting packet. By default, this
 *      is "browser".
 *
 * Live lists:
 *
 * A "live list", as used for the |tabList|, is an object that presents a
 * list of actors, and also notifies its clients of changes to the list. A
 * live list's interface is two properties:
 *
 * - getList: a method that returns a promise to the contents of the list.
 *
 * - onListChanged: a handler called, with no arguments, when the set of
 *             values the iterator would produce has changed since the last
 *             time 'iterator' was called. This may only be set to null or a
 *             callable value (one for which the typeof operator returns
 *             'function'). (Note that the live list will not call the
 *             onListChanged handler until the list has been iterated over
 *             once; if nobody's seen the list in the first place, nobody
 *             should care if its contents have changed!)
 *
 * When the list changes, the list implementation should ensure that any
 * actors yielded in previous iterations whose referents (tabs) still exist
 * get yielded again in subsequent iterations. If the underlying referent
 * is the same, the same actor should be presented for it.
 *
 * The root actor registers an 'onListChanged' handler on the appropriate
 * list when it may need to send the client 'tabListChanged' notifications,
 * and is careful to remove the handler whenever it does not need to send
 * such notifications (including when it is destroyed). This means that
 * live list implementations can use the state of the handler property (set
 * or null) to install and remove observers and event listeners.
 *
 * Note that, as the only way for the root actor to see the members of the
 * live list is to begin an iteration over the list, the live list need not
 * actually produce any actors until they are reached in the course of
 * iteration: alliterative lazy live lists.
 */
class RootActor extends Actor {
  constructor(conn, parameters) {
    super(conn, rootSpec);

    this._parameters = parameters;
    this._onTabListChanged = this.onTabListChanged.bind(this);
    this._onAddonListChanged = this.onAddonListChanged.bind(this);
    this._onWorkerListChanged = this.onWorkerListChanged.bind(this);
    this._onServiceWorkerRegistrationListChanged =
      this.onServiceWorkerRegistrationListChanged.bind(this);
    this._onProcessListChanged = this.onProcessListChanged.bind(this);

    this._extraActors = {};

    this._globalActorPool = new LazyPool(this.conn);

    this.applicationType = "browser";

    // Compute the list of all supported Root Resources
    const supportedResources = {};
    for (const resourceType in Resources.RootResources) {
      supportedResources[resourceType] = true;
    }

    this.traits = {
      networkMonitor: true,
      resources: supportedResources,
      // @backward-compat { version 84 } Expose the pref value to the client.
      // Services.prefs is undefined in xpcshell tests.
      workerConsoleApiMessagesDispatchedToMainThread: Services.prefs
        ? Services.prefs.getBoolPref(
            "dom.worker.console.dispatch_events_to_main_thread"
          )
        : true,
      // @backward-compat { version 142 } Process Descriptor's `getWatcher()`
      // supports a new 'enableWindowGlobalThreadActors' flag to enable
      // the WindowGlobal's thread actors when debugging the whole browser.
      // This was actually changed in 137, but we support it for VSCode until
      // ESR 140 is the only ESR available.
      // This should happen when Firefox 143 gets released.
      // Contact Holger Benl (hbenl) to make sure the VS Code extension is
      // updated.
      supportsEnableWindowGlobalThreadActors: true,
      // @backward-compat { version 140 } Use the bulk API to transfer the
      // performance profile data.
      useBulkTransferForPerformanceProfile: true,
    };
  }

  /**
   * Return a 'hello' packet as specified by the Remote Debugging Protocol.
   */
  sayHello() {
    return {
      from: this.actorID,
      applicationType: this.applicationType,
      /* This is not in the spec, but it's used by tests. */
      testConnectionPrefix: this.conn.prefix,
      traits: this.traits,
    };
  }

  forwardingCancelled(prefix) {
    return {
      from: this.actorID,
      type: "forwardingCancelled",
      prefix,
    };
  }

  /**
   * Destroys the actor from the browser window.
   */
  destroy() {
    Resources.unwatchAllResources(this);

    super.destroy();

    /* Tell the live lists we aren't watching any more. */
    if (this._parameters.tabList) {
      this._parameters.tabList.destroy();
    }
    if (this._parameters.addonList) {
      this._parameters.addonList.onListChanged = null;
    }
    if (this._parameters.workerList) {
      this._parameters.workerList.destroy();
    }
    if (this._parameters.serviceWorkerRegistrationList) {
      this._parameters.serviceWorkerRegistrationList.onListChanged = null;
    }
    if (this._parameters.processList) {
      this._parameters.processList.onListChanged = null;
    }
    if (typeof this._parameters.onShutdown === "function") {
      this._parameters.onShutdown();
    }
    // Cleanup Actors on destroy
    if (this._tabDescriptorActorPool) {
      this._tabDescriptorActorPool.destroy();
    }
    if (this._processDescriptorActorPool) {
      this._processDescriptorActorPool.destroy();
    }
    if (this._globalActorPool) {
      this._globalActorPool.destroy();
    }
    if (this._addonTargetActorPool) {
      this._addonTargetActorPool.destroy();
    }
    if (this._workerDescriptorActorPool) {
      this._workerDescriptorActorPool.destroy();
    }
    if (this._frameDescriptorActorPool) {
      this._frameDescriptorActorPool.destroy();
    }

    if (this._serviceWorkerRegistrationActorPool) {
      this._serviceWorkerRegistrationActorPool.destroy();
    }
    this._extraActors = null;
    this._tabDescriptorActorPool = null;
    this._globalActorPool = null;
    this._parameters = null;
  }

  /**
   * Method called by the client right after the root actor is communicated to it,
   * with information about the frontend.
   *
   * For now this is used by Servo which implements different backend APIs,
   * based on the frontend version. (backward compat to support many frontend versions
   * on the same backend revision)
   */
  // eslint-disable-next-line no-unused-vars
  connect({ frontendVersion }) {}

  /**
   * Gets the "root" form, which lists all the global actors that affect the entire
   * browser.
   */
  getRoot() {
    // Create global actors
    if (!this._globalActorPool) {
      this._globalActorPool = new LazyPool(this.conn);
    }
    const actors = createExtraActors(
      this._parameters.globalActorFactories,
      this._globalActorPool,
      this
    );

    return actors;
  }

  /* The 'listTabs' request and the 'tabListChanged' notification. */

  /**
   * Handles the listTabs request. The actors will survive until at least
   * the next listTabs request.
   */
  async listTabs() {
    const tabList = this._parameters.tabList;
    if (!tabList) {
      throw {
        error: "noTabs",
        message: "This root actor has no browser tabs.",
      };
    }

    // Now that a client has requested the list of tabs, we reattach the onListChanged
    // listener in order to be notified if the list of tabs changes again in the future.
    tabList.onListChanged = this._onTabListChanged;

    // Walk the tab list, accumulating the array of target actors for the reply, and
    // moving all the actors to a new Pool. We'll replace the old tab target actor
    // pool with the one we build here, thus retiring any actors that didn't get listed
    // again, and preparing any new actors to receive packets.
    const newActorPool = new Pool(this.conn, "listTabs-tab-descriptors");

    const tabDescriptorActors = await tabList.getList();
    for (const tabDescriptorActor of tabDescriptorActors) {
      newActorPool.manage(tabDescriptorActor);
    }

    // Drop the old actorID -> actor map. Actors that still mattered were added to the
    // new map; others will go away.
    if (this._tabDescriptorActorPool) {
      this._tabDescriptorActorPool.destroy();
    }
    this._tabDescriptorActorPool = newActorPool;

    return tabDescriptorActors;
  }

  /**
   * Return the tab descriptor actor for the tab identified by one of the IDs
   * passed as argument.
   *
   * See BrowserTabList.prototype.getTab for the definition of these IDs.
   */
  async getTab({ browserId }) {
    const tabList = this._parameters.tabList;
    if (!tabList) {
      throw {
        error: "noTabs",
        message: "This root actor has no browser tabs.",
      };
    }
    if (!this._tabDescriptorActorPool) {
      this._tabDescriptorActorPool = new Pool(
        this.conn,
        "getTab-tab-descriptors"
      );
    }

    let descriptorActor;
    try {
      descriptorActor = await tabList.getTab({
        browserId,
      });
    } catch (error) {
      if (error.error) {
        // Pipe expected errors as-is to the client
        throw error;
      }
      throw {
        error: "noTab",
        message: "Unexpected error while calling getTab(): " + error,
      };
    }

    descriptorActor.parentID = this.actorID;
    this._tabDescriptorActorPool.manage(descriptorActor);

    return descriptorActor;
  }

  onTabListChanged() {
    this.conn.send({ from: this.actorID, type: "tabListChanged" });
    /* It's a one-shot notification; no need to watch any more. */
    this._parameters.tabList.onListChanged = null;
  }

  /**
   * This function can receive the following option from devtools client.
   *
   * @param {Object} option
   *        - iconDataURL: {boolean}
   *            When true, make data url from the icon of addon, then make possible to
   *            access by iconDataURL in the actor. The iconDataURL is useful when
   *            retrieving addons from a remote device, because the raw iconURL might not
   *            be accessible on the client.
   */
  async listAddons(option) {
    const addonList = this._parameters.addonList;
    if (!addonList) {
      throw {
        error: "noAddons",
        message: "This root actor has no browser addons.",
      };
    }

    // Reattach the onListChanged listener now that a client requested the list.
    addonList.onListChanged = this._onAddonListChanged;

    const addonTargetActors = await addonList.getList();
    const addonTargetActorPool = new Pool(this.conn, "addon-descriptors");
    for (const addonTargetActor of addonTargetActors) {
      if (option.iconDataURL) {
        await addonTargetActor.loadIconDataURL();
      }

      addonTargetActorPool.manage(addonTargetActor);
    }

    if (this._addonTargetActorPool) {
      this._addonTargetActorPool.destroy();
    }
    this._addonTargetActorPool = addonTargetActorPool;

    return addonTargetActors;
  }

  onAddonListChanged() {
    this.conn.send({ from: this.actorID, type: "addonListChanged" });
    this._parameters.addonList.onListChanged = null;
  }

  listWorkers() {
    const workerList = this._parameters.workerList;
    if (!workerList) {
      throw {
        error: "noWorkers",
        message: "This root actor has no workers.",
      };
    }

    // Reattach the onListChanged listener now that a client requested the list.
    workerList.onListChanged = this._onWorkerListChanged;

    return workerList.getList().then(actors => {
      const pool = new Pool(this.conn, "worker-targets");
      for (const actor of actors) {
        pool.manage(actor);
      }

      // Do not destroy the pool before transfering ownership to the newly created
      // pool, so that we do not accidently destroy actors that are still in use.
      if (this._workerDescriptorActorPool) {
        this._workerDescriptorActorPool.destroy();
      }

      this._workerDescriptorActorPool = pool;

      return {
        workers: actors,
      };
    });
  }

  onWorkerListChanged() {
    this.conn.send({ from: this.actorID, type: "workerListChanged" });
    this._parameters.workerList.onListChanged = null;
  }

  listServiceWorkerRegistrations() {
    const registrationList = this._parameters.serviceWorkerRegistrationList;
    if (!registrationList) {
      throw {
        error: "noServiceWorkerRegistrations",
        message: "This root actor has no service worker registrations.",
      };
    }

    // Reattach the onListChanged listener now that a client requested the list.
    registrationList.onListChanged =
      this._onServiceWorkerRegistrationListChanged;

    return registrationList.getList().then(actors => {
      const pool = new Pool(this.conn, "service-workers-registrations");
      for (const actor of actors) {
        pool.manage(actor);
      }

      if (this._serviceWorkerRegistrationActorPool) {
        this._serviceWorkerRegistrationActorPool.destroy();
      }
      this._serviceWorkerRegistrationActorPool = pool;

      return {
        registrations: actors,
      };
    });
  }

  onServiceWorkerRegistrationListChanged() {
    this.conn.send({
      from: this.actorID,
      type: "serviceWorkerRegistrationListChanged",
    });
    this._parameters.serviceWorkerRegistrationList.onListChanged = null;
  }

  listProcesses() {
    const { processList } = this._parameters;
    if (!processList) {
      throw {
        error: "noProcesses",
        message: "This root actor has no processes.",
      };
    }
    processList.onListChanged = this._onProcessListChanged;
    const processes = processList.getList();
    const pool = new Pool(this.conn, "process-descriptors");
    for (const metadata of processes) {
      let processDescriptor = this._getKnownDescriptor(
        metadata.id,
        this._processDescriptorActorPool
      );
      if (!processDescriptor) {
        processDescriptor = new ProcessDescriptorActor(this.conn, metadata);
      }
      pool.manage(processDescriptor);
    }
    // Do not destroy the pool before transfering ownership to the newly created
    // pool, so that we do not accidently destroy actors that are still in use.
    if (this._processDescriptorActorPool) {
      this._processDescriptorActorPool.destroy();
    }
    this._processDescriptorActorPool = pool;
    return [...this._processDescriptorActorPool.poolChildren()];
  }

  onProcessListChanged() {
    this.conn.send({ from: this.actorID, type: "processListChanged" });
    this._parameters.processList.onListChanged = null;
  }

  async getProcess(id) {
    if (!DevToolsServer.allowChromeProcess) {
      throw {
        error: "forbidden",
        message: "You are not allowed to debug chrome.",
      };
    }
    if (typeof id != "number") {
      throw {
        error: "wrongParameter",
        message: "getProcess requires a valid `id` attribute.",
      };
    }
    this._processDescriptorActorPool =
      this._processDescriptorActorPool ||
      new Pool(this.conn, "process-descriptors");

    let processDescriptor = this._getKnownDescriptor(
      id,
      this._processDescriptorActorPool
    );
    if (!processDescriptor) {
      // The parent process has id == 0, based on ProcessActorList::getList implementation
      const options = { id, parent: id === 0 };
      processDescriptor = new ProcessDescriptorActor(this.conn, options);
      this._processDescriptorActorPool.manage(processDescriptor);
    }
    return processDescriptor;
  }

  _getKnownDescriptor(id, pool) {
    // if there is no pool, then we do not have any descriptors
    if (!pool) {
      return null;
    }
    for (const descriptor of pool.poolChildren()) {
      if (descriptor.id === id) {
        return descriptor;
      }
    }
    return null;
  }

  /**
   * Remove the extra actor (added by ActorRegistry.addGlobalActor or
   * ActorRegistry.addTargetScopedActor) name |name|.
   */
  removeActorByName(name) {
    if (name in this._extraActors) {
      const actor = this._extraActors[name];
      if (this._globalActorPool.has(actor.actorID)) {
        actor.destroy();
      }
      if (this._tabDescriptorActorPool) {
        // Iterate over WindowGlobalTargetActor instances to also remove target-scoped
        // actors created during listTabs for each document.
        for (const tab in this._tabDescriptorActorPool.poolChildren()) {
          tab.removeActorByName(name);
        }
      }
      delete this._extraActors[name];
    }
  }

  /**
   * Start watching for a list of resource types.
   *
   * See WatcherActor.watchResources.
   */
  async watchResources(resourceTypes) {
    await Resources.watchResources(this, resourceTypes);
  }

  /**
   * Stop watching for a list of resource types.
   *
   * See WatcherActor.unwatchResources.
   */
  unwatchResources(resourceTypes) {
    Resources.unwatchResources(this, resourceTypes);
  }

  /**
   * Clear resources of a list of resource types.
   *
   * See WatcherActor.clearResources.
   */
  clearResources(resourceTypes) {
    Resources.clearResources(this, resourceTypes);
  }

  /**
   * Called by Resource Watchers, when new resources are available, updated or destroyed.
   *
   * @param String updateType
   *        Can be "available", "updated" or "destroyed"
   * @param String resourceType
   *        The type of resources to be notified about.
   * @param Array<json> resources
   *        List of all resources. A resource is a JSON object piped over to the client.
   *        It can contain actor IDs.
   *        It can also be or contain an actor form, to be manually marshalled by the client.
   *        (i.e. the frontend would have to manually instantiate a Front for the given actor form)
   */
  notifyResources(updateType, resourceType, resources) {
    if (resources.length === 0) {
      // Don't try to emit if the resources array is empty.
      return;
    }

    switch (updateType) {
      case "available":
        this.emit(`resources-available-array`, [[resourceType, resources]]);
        break;
      case "updated":
        this.emit(`resources-updated-array`, [[resourceType, resources]]);
        break;
      case "destroyed":
        this.emit(`resources-destroyed-array`, [[resourceType, resources]]);
        break;
      default:
        throw new Error("Unsupported update type: " + updateType);
    }
  }
}

exports.RootActor = RootActor;
