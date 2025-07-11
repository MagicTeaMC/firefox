/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.fenix.extension

import android.widget.TextView
import androidx.core.view.isVisible
import androidx.navigation.NavController
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.spyk
import io.mockk.verify
import mozilla.components.browser.state.action.WebExtensionAction.UpdatePromptRequestWebExtensionAction
import mozilla.components.browser.state.state.extension.WebExtensionPromptRequest
import mozilla.components.browser.state.store.BrowserStore
import mozilla.components.concept.engine.webextension.WebExtensionInstallException
import mozilla.components.feature.addons.Addon
import mozilla.components.support.ktx.android.content.appVersionName
import mozilla.components.support.test.ext.joinBlocking
import mozilla.components.support.test.robolectric.testContext
import mozilla.components.support.test.rule.MainCoroutineRule
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.spy
import org.mozilla.fenix.BuildConfig
import org.mozilla.fenix.R
import org.mozilla.fenix.addons.AddonsManagementFragmentDirections
import org.mozilla.fenix.settings.SupportUtils
import org.mozilla.fenix.utils.LinkTextView
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class WebExtensionPromptFeatureTest {

    private lateinit var webExtensionPromptFeature: WebExtensionPromptFeature
    private lateinit var store: BrowserStore

    private val onLinkClicked: (String, Boolean) -> Unit = spyk()
    private val navController: NavController = mockk(relaxed = true)

    @get:Rule
    val coroutinesTestRule = MainCoroutineRule()

    @Before
    fun setup() {
        store = BrowserStore()
        webExtensionPromptFeature = spyk(
            WebExtensionPromptFeature(
                store = store,
                context = testContext,
                fragmentManager = mockk(relaxed = true),
                onLinkClicked = onLinkClicked,
                navController = navController,
                addonManager = mockk(relaxed = true),
            ),
        )
    }

    @Test
    fun `WHEN InstallationFailed is dispatched THEN handleInstallationFailedRequest is called`() {
        webExtensionPromptFeature.start()

        every { webExtensionPromptFeature.handleInstallationFailedRequest(any()) } returns null

        store.dispatch(
            UpdatePromptRequestWebExtensionAction(
                WebExtensionPromptRequest.BeforeInstallation.InstallationFailed(
                    mockk(),
                    mockk(),
                ),
            ),
        ).joinBlocking()

        verify { webExtensionPromptFeature.handleInstallationFailedRequest(any()) }
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with network error THEN showDialog with the correct message`() {
        val expectedTitle = testContext.getString(R.string.mozac_feature_addons_cant_install_extension)
        val exception = WebExtensionInstallException.NetworkFailure(
            extensionName = "name",
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(
                R.string.mozac_feature_addons_extension_failed_to_install_network_error,
                "name",
            )

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with Blocklisted error THEN showDialog with the correct message`() {
        val expectedTitle = testContext.getString(R.string.mozac_feature_addons_cant_install_extension)
        val extensionId = "extensionId"
        val extensionName = "extensionName"
        val extensionVersion = "extensionVersion"
        val exception = WebExtensionInstallException.Blocklisted(
            extensionId = extensionId,
            extensionName = extensionName,
            extensionVersion = extensionVersion,
            throwable = Exception(),
        )
        val appName = testContext.getString(R.string.app_name)
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_blocklisted_2, extensionName, appName)
        val expectedUrl = "${BuildConfig.AMO_BASE_URL}/android/blocked-addon/$extensionId/$extensionVersion/"

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage, expectedUrl) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertTrue(linkView!!.isVisible)

        // Click the link, then verify.
        linkView.performClick()
        verify {
            onLinkClicked(expectedUrl, true)
            dialog.dismiss()
        }
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with UserCancelled error THEN do not showDialog`() {
        val expectedTitle = ""
        val extensionName = "extensionName"
        val exception = WebExtensionInstallException.UserCancelled(
            extensionName = extensionName,
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_failed_to_install, extensionName)

        webExtensionPromptFeature.handleInstallationFailedRequest(
            exception = exception,
        )

        verify(exactly = 0) { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with Unknown error THEN showDialog with the correct message`() {
        val expectedTitle = ""
        val extensionName = "extensionName"
        val exception = WebExtensionInstallException.Unknown(
            extensionName = extensionName,
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_failed_to_install, extensionName)

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with Unknown error and no extension name THEN showDialog with the correct message`() {
        val expectedTitle = ""
        val exception = WebExtensionInstallException.Unknown(
            extensionName = null,
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_extension_failed_to_install)

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with CorruptFile error THEN showDialog with the correct message`() {
        val expectedTitle = testContext.getString(R.string.mozac_feature_addons_cant_install_extension)
        val exception = WebExtensionInstallException.CorruptFile(
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_extension_failed_to_install_corrupt_error)

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with NotSigned error THEN showDialog with the correct message`() {
        val expectedTitle = testContext.getString(R.string.mozac_feature_addons_cant_install_extension)
        val exception = WebExtensionInstallException.NotSigned(
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_extension_failed_to_install_not_signed_error)

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with Incompatible error THEN showDialog with the correct message`() {
        val expectedTitle = testContext.getString(R.string.mozac_feature_addons_cant_install_extension)
        val extensionName = "extensionName"
        val exception = WebExtensionInstallException.Incompatible(
            extensionName = extensionName,
            throwable = Exception(),
        )
        val appName = testContext.getString(R.string.app_name)
        val version = testContext.appVersionName
        val expectedMessage =
            testContext.getString(
                R.string.mozac_feature_addons_failed_to_install_incompatible_error,
                extensionName,
                appName,
                version,
            )

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN AfterInstallation is dispatched THEN handleAfterInstallationRequest is called`() {
        webExtensionPromptFeature.start()

        every { webExtensionPromptFeature.handleAfterInstallationRequest(any()) } returns mockk()

        store.dispatch(
            UpdatePromptRequestWebExtensionAction(
                WebExtensionPromptRequest.AfterInstallation.Permissions.Optional(
                    mockk(relaxed = true),
                    mockk(),
                    mockk(),
                    mockk(),
                    mockk(),
                ),
            ),
        ).joinBlocking()

        verify { webExtensionPromptFeature.handleAfterInstallationRequest(any()) }
    }

    @Test
    fun `GIVEN Optional Permissions WHEN handleAfterInstallationRequest is called THEN handleOptionalPermissionsRequest is called`() {
        webExtensionPromptFeature.start()
        val request = mockk<WebExtensionPromptRequest.AfterInstallation.Permissions.Optional>(relaxed = true)

        webExtensionPromptFeature.handleAfterInstallationRequest(request)

        verify { webExtensionPromptFeature.handleOptionalPermissionsRequest(any(), any()) }
    }

    @Test
    fun `WHEN calling handleOptionalPermissionsRequest with permissions THEN call showPermissionDialog`() {
        val addon: Addon = mockk(relaxed = true)
        val promptRequest = WebExtensionPromptRequest.AfterInstallation.Permissions.Optional(
            extension = mockk(),
            permissions = listOf("tabs"),
            origins = emptyList(),
            dataCollectionPermissions = emptyList(),
            onConfirm = mockk(),
        )

        webExtensionPromptFeature.handleOptionalPermissionsRequest(addon = addon, promptRequest = promptRequest)

        verify {
            webExtensionPromptFeature.showPermissionDialog(
                eq(addon),
                eq(promptRequest),
                eq(true),
                eq(promptRequest.permissions),
                eq(promptRequest.origins),
                eq(promptRequest.dataCollectionPermissions),
            )
        }
    }

    @Test
    fun `WHEN calling handleOptionalPermissionsRequest with a permission that doesn't have a description THEN do not call showPermissionDialog`() {
        val addon: Addon = mockk(relaxed = true)
        val onConfirm: ((Boolean) -> Unit) = mockk()
        every { onConfirm(any()) } just runs
        val promptRequest = WebExtensionPromptRequest.AfterInstallation.Permissions.Optional(
            extension = mockk(),
            // The "scripting" API permission doesn't have a description so we should not show a dialog for it.
            permissions = listOf("scripting"),
            origins = emptyList(),
            dataCollectionPermissions = emptyList(),
            onConfirm = onConfirm,
        )

        webExtensionPromptFeature.handleOptionalPermissionsRequest(addon = addon, promptRequest = promptRequest)

        verify(exactly = 0) {
            webExtensionPromptFeature.showPermissionDialog(any(), any(), any(), any(), any(), any())
        }
        verify(exactly = 1) { onConfirm(true) }
    }

    @Test
    fun `WHEN calling handleOptionalPermissionsRequest with host permissions along with permissions that don't have a description THEN call showPermissionDialog`() {
        val addon: Addon = mockk(relaxed = true)
        val onConfirm: ((Boolean) -> Unit) = mockk()
        every { onConfirm(any()) } just runs
        val promptRequest = WebExtensionPromptRequest.AfterInstallation.Permissions.Optional(
            extension = mockk(),
            // The "scripting" API permission doesn't have a description so we should not show a dialog for it.
            permissions = listOf("scripting"),
            origins = listOf("*://developer.mozilla.org/*"),
            dataCollectionPermissions = emptyList(),
            onConfirm = onConfirm,
        )

        webExtensionPromptFeature.handleOptionalPermissionsRequest(addon = addon, promptRequest = promptRequest)

        verify {
            webExtensionPromptFeature.showPermissionDialog(
                eq(addon),
                eq(promptRequest),
                eq(true),
                eq(promptRequest.permissions),
                eq(promptRequest.origins),
                eq(promptRequest.dataCollectionPermissions),
            )
        }

        verify(exactly = 0) { onConfirm(true) }
    }

    @Test
    fun `WHEN calling handleOptionalPermissionsRequest with no permissions THEN do not call showPermissionDialog`() {
        val addon: Addon = mockk(relaxed = true)
        val onConfirm: ((Boolean) -> Unit) = mockk()
        every { onConfirm(any()) } just runs
        val promptRequest = WebExtensionPromptRequest.AfterInstallation.Permissions.Optional(
            extension = mockk(),
            permissions = emptyList(),
            origins = emptyList(),
            dataCollectionPermissions = emptyList(),
            onConfirm = onConfirm,
        )

        webExtensionPromptFeature.handleOptionalPermissionsRequest(addon = addon, promptRequest = promptRequest)

        verify(exactly = 0) {
            webExtensionPromptFeature.showPermissionDialog(any(), any(), any(), any(), any(), any())
        }
        verify(exactly = 1) { onConfirm(true) }
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with UnsupportedAddonType error THEN showDialog with the correct message`() {
        val expectedTitle = ""
        val extensionName = "extensionName"
        val exception = WebExtensionInstallException.UnsupportedAddonType(
            extensionName = extensionName,
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_failed_to_install, extensionName)

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with AdminInstallOnly error THEN showDialog with the correct message`() {
        val expectedTitle = testContext.getString(R.string.mozac_feature_addons_cant_install_extension)
        val extensionName = "extensionName"
        val exception = WebExtensionInstallException.AdminInstallOnly(
            extensionName = extensionName,
            throwable = Exception(),
        )
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_admin_install_only, extensionName)

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertFalse(linkView!!.isVisible)
    }

    @Test
    fun `WHEN calling handleInstallationFailedRequest with SoftBlocked error THEN showDialog with the correct message`() {
        val expectedTitle = testContext.getString(R.string.mozac_feature_addons_cant_install_extension)
        val extensionId = "extensionId"
        val extensionName = "extensionName"
        val extensionVersion = "extensionVersion"
        val exception = WebExtensionInstallException.SoftBlocked(
            extensionId = extensionId,
            extensionName = extensionName,
            extensionVersion = extensionVersion,
            throwable = Exception(),
        )
        val appName = testContext.getString(R.string.app_name)
        val expectedMessage =
            testContext.getString(R.string.mozac_feature_addons_soft_blocked_1, extensionName, appName)
        val expectedUrl = "${BuildConfig.AMO_BASE_URL}/android/blocked-addon/$extensionId/$extensionVersion/"

        val dialog = webExtensionPromptFeature.handleInstallationFailedRequest(exception = exception)

        verify { webExtensionPromptFeature.showDialog(expectedTitle, expectedMessage, expectedUrl) }
        val linkView = dialog?.findViewById<LinkTextView>(R.id.link)
        assertTrue(linkView!!.isVisible)

        // Click the link, then verify.
        linkView.performClick()
        verify {
            onLinkClicked(expectedUrl, true)
            dialog.dismiss()
        }
    }

    @Test
    fun `WHEN clicking Learn More on the Permissions Dialog THEN open the correct SUMO page in a custom tab`() {
        val addon: Addon = mockk(relaxed = true)
        val fragment = spy(
            webExtensionPromptFeature.showPermissionDialog(
                addon = addon,
                promptRequest = mockk(),
                forOptionalPermissions = false,
                permissions = emptyList(),
                origins = emptyList(),
                dataCollectionPermissions = emptyList(),
            ),
        )
        doReturn(testContext).`when`(fragment)?.requireContext()

        val dialog = fragment?.onCreateDialog(null)
        dialog?.findViewById<TextView>(R.id.learn_more_link)?.performClick()

        val expectedUrl = SupportUtils.getSumoURLForTopic(
            testContext,
            SupportUtils.SumoTopic.EXTENSION_PERMISSIONS,
        )
        verify { onLinkClicked(expectedUrl, false) }
    }

    @Test
    fun `WHEN clicking the link in the description THEN navigates to the add-on detail view`() {
        val addon: Addon = mockk(relaxed = true)
        val fragment = spy(webExtensionPromptFeature.showPostInstallationDialog(addon = addon))

        // Simulate a click to the link in the description.
        fragment?.onExtensionSettingsLinkClicked?.invoke(addon)

        verify {
            navController.navigate(
                AddonsManagementFragmentDirections.actionGlobalToInstalledAddonDetailsFragment(addon),
            )
        }
    }
}
