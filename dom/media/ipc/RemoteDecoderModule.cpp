/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "RemoteDecoderModule.h"

#ifdef MOZ_AV1
#  include "AOMDecoder.h"
#endif
#include "RemoteAudioDecoder.h"
#include "RemoteMediaManagerChild.h"
#include "RemoteMediaDataDecoder.h"
#include "RemoteVideoDecoder.h"
#include "VideoUtils.h"
#include "gfxConfig.h"
#include "mozilla/RemoteDecodeUtils.h"

namespace mozilla {

using namespace ipc;
using namespace layers;

already_AddRefed<PlatformDecoderModule> RemoteDecoderModule::Create(
    RemoteMediaIn aLocation) {
  MOZ_ASSERT(!XRE_IsGPUProcess() && !XRE_IsRDDProcess(),
             "Should not be created in GPU or RDD process.");
  if (!XRE_IsContentProcess()) {
    // For now, the RemoteDecoderModule is only available in the content
    // process.
    return nullptr;
  }
  return MakeAndAddRef<RemoteDecoderModule>(aLocation);
}

RemoteDecoderModule::RemoteDecoderModule(RemoteMediaIn aLocation)
    : mLocation(aLocation) {}

media::DecodeSupportSet RemoteDecoderModule::SupportsMimeType(
    const nsACString& aMimeType, DecoderDoctorDiagnostics* aDiagnostics) const {
  MOZ_CRASH("Deprecated: Use RemoteDecoderModule::Supports");
}  // namespace mozilla

media::DecodeSupportSet RemoteDecoderModule::Supports(
    const SupportDecoderParams& aParams,
    DecoderDoctorDiagnostics* aDiagnostics) const {
  bool supports =
      RemoteMediaManagerChild::Supports(mLocation, aParams, aDiagnostics);
  // This should only be supported by mf media engine cdm process.
  if (aParams.mMediaEngineId &&
      mLocation != RemoteMediaIn::UtilityProcess_MFMediaEngineCDM) {
    supports = false;
  }
  MOZ_LOG(
      sPDMLog, LogLevel::Debug,
      ("Sandbox %s decoder %s requested type %s", RemoteMediaInToStr(mLocation),
       supports ? "supports" : "rejects", aParams.MimeType().get()));
  if (supports) {
    // TODO: Note that we do not yet distinguish between SW/HW decode support.
    //       Will be done in bug 1754239.
    return media::DecodeSupport::SoftwareDecode;
  }
  return media::DecodeSupportSet{};
}

RefPtr<RemoteDecoderModule::CreateDecoderPromise>
RemoteDecoderModule::AsyncCreateDecoder(const CreateDecoderParams& aParams) {
  if (aParams.mConfig.IsAudio()) {
    // OpusDataDecoder will check this option to provide the same info
    // that IsDefaultPlaybackDeviceMono provides.  We want to avoid calls
    // to IsDefaultPlaybackDeviceMono on RDD because initializing audio
    // backends on RDD will be blocked by the sandbox.
    if (aParams.mConfig.mMimeType.Equals("audio/opus") &&
        IsDefaultPlaybackDeviceMono()) {
      CreateDecoderParams params = aParams;
      params.mOptions += CreateDecoderParams::Option::DefaultPlaybackDeviceMono;
      return RemoteMediaManagerChild::CreateAudioDecoder(params, mLocation);
    }
    return RemoteMediaManagerChild::CreateAudioDecoder(aParams, mLocation);
  }
  return RemoteMediaManagerChild::CreateVideoDecoder(aParams, mLocation);
}

}  // namespace mozilla
