/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_StorageAccess_h
#define mozilla_StorageAccess_h

#include <cstdint>

#include "mozilla/MozPromise.h"
#include "mozilla/RefPtr.h"

#include "mozilla/dom/BrowsingContext.h"

class nsIChannel;
class nsICookieJarSettings;
class nsIPrincipal;
class nsIURI;
class nsPIDOMWindowInner;

namespace mozilla {
namespace dom {
class Document;
}

// The order of these entries matters, as we use std::min for total ordering
// of permissions. Private Browsing is considered to be more limiting
// then session scoping
enum class StorageAccess {
  // The storage should be partitioned for third-party resources. if the
  // caller is unable to do it, deny the storage access.
  ePartitionForeignOrDeny = -2,
  // The storage should be partitioned for third-party trackers. if the caller
  // is unable to do it, deny the storage access.
  ePartitionTrackersOrDeny = -1,
  // Don't allow access to the storage
  eDeny = 0,
  // Allow access to the storage, but only if it is secure to do so in a
  // private browsing context.
  ePrivateBrowsing = 1,
  // Allow access to the storage
  eAllow = 3,
  // Keep this at the end.  Used for serialization, but not a valid value.
  eNumValues = 4,
};

/*
 * Checks if storage for the given window is permitted by a combination of
 * the user's preferences, and whether the window is a third-party iframe.
 *
 * This logic is intended to be shared between the different forms of
 * persistent storage which are available to web pages. Cookies don't use
 * this logic, and security logic related to them must be updated separately.
 */
StorageAccess StorageAllowedForWindow(nsPIDOMWindowInner* aWindow,
                                      uint32_t* aRejectedReason = nullptr);

/*
 * Checks if storage for the given document is permitted by a combination of
 * the user's preferences, and whether the document's window is a third-party
 * iframe.
 *
 * Note, this may be used on documents during the loading process where
 * the window's extant document has not been set yet.  The code in
 * StorageAllowedForWindow(), however, will not work in these cases.
 */
StorageAccess StorageAllowedForDocument(const dom::Document* aDoc);

StorageAccess CookieAllowedForDocument(const dom::Document* aDoc);

/*
 * Checks if storage should be allowed for a new window with the given
 * principal, load URI, and parent.
 */
StorageAccess StorageAllowedForNewWindow(nsIPrincipal* aPrincipal, nsIURI* aURI,
                                         nsPIDOMWindowInner* aParent);

/*
 * Checks if storage should be allowed for the given channel.  The check will
 * be based on the channel result principal and, depending on preferences and
 * permissions, mozIThirdPartyUtil.isThirdPartyChannel().
 */
StorageAccess StorageAllowedForChannel(nsIChannel* aChannel);

/*
 * Checks if storage for the given principal is permitted by the user's
 * preferences. This method should be used only by ServiceWorker loading.
 */
StorageAccess StorageAllowedForServiceWorker(
    nsIPrincipal* aPrincipal, nsICookieJarSettings* aCookieJarSettings);

bool ShouldPartitionStorage(StorageAccess aAccess);

bool ShouldPartitionStorage(uint32_t aRejectedReason);

bool StoragePartitioningEnabled(StorageAccess aAccess,
                                nsICookieJarSettings* aCookieJarSettings);

bool StoragePartitioningEnabled(uint32_t aRejectedReason,
                                nsICookieJarSettings* aCookieJarSettings);

// This method returns true if the URI has first party storage access when
// loaded inside the passed 3rd party context tracking resource window.
// If aCookies is true, this considers the permission granted by
// document.requestStorageAccess. Cookies should be the only website state
// that changes its accessibility based upon that permission.
//
// aRejectedReason could be set to one of these values if passed and if the
// storage permission is not granted:
//  * nsIWebProgressListener::STATE_COOKIES_BLOCKED_BY_PERMISSION
//  * nsIWebProgressListener::STATE_COOKIES_BLOCKED_TRACKER
//  * nsIWebProgressListener::STATE_COOKIES_BLOCKED_SOCIALTRACKER
//  * nsIWebProgressListener::STATE_COOKIES_BLOCKED_ALL
//  * nsIWebProgressListener::STATE_COOKIES_BLOCKED_FOREIGN
//
// If you update this function, you almost certainly want to consider
// updating the other overloaded functions
bool ShouldAllowAccessFor(nsPIDOMWindowInner* a3rdPartyTrackingWindow,
                          nsIURI* aURI, bool aCookies,
                          uint32_t* aRejectedReason);

// It returns true if the URI has access to the first party storage.
// aChannel can be a 3rd party channel, or not.
// See ShouldAllowAccessFor(window) to see the possible values of
// aRejectedReason.
//
// If you update this function, you almost certainly want to consider
// updating the other overloaded functions
bool ShouldAllowAccessFor(nsIChannel* aChannel, nsIURI* aURI,
                          uint32_t* aRejectedReason);

// This method checks if the principal has the permission to access to the
// first party storage.
// Warning: only use this function when aPrincipal is first-party.
//
// If you update this function, you almost certainly want to consider
// updating the other overloaded functions
bool ShouldAllowAccessFor(nsIPrincipal* aPrincipal,
                          nsICookieJarSettings* aCookieJarSettings);

namespace detail {
uint32_t CheckCookiePermissionForPrincipal(
    nsICookieJarSettings* aCookieJarSettings, nsIPrincipal* aPrincipal);
}

}  // namespace mozilla

#endif  // mozilla_StorageAccess_h
