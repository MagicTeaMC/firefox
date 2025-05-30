/* -*- Mode: c++; c-basic-offset: 2; indent-tabs-mode: nil; tab-width: 4; -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef SHARED_SURFACE_ANGLE_H_
#define SHARED_SURFACE_ANGLE_H_

#include <windows.h>
#include <memory>

#include "mozilla/layers/LayersTypes.h"
#include "SharedSurface.h"

struct IDXGIKeyedMutex;
struct ID3D11Device;
struct ID3D11Texture2D;

namespace mozilla {

namespace gfx {
class FileHandleWrapper;
}  // namespace gfx

namespace layers {
class FenceD3D11;
}  // namespace layers

namespace gl {

class GLContext;
class EglDisplay;

class SharedSurface_ANGLEShareHandle final : public SharedSurface {
 public:
  const RefPtr<ID3D11Device> mDevice;
  const std::weak_ptr<EglDisplay> mEGL;
  const EGLSurface mPBuffer;
  const RefPtr<gfx::FileHandleWrapper> mSharedHandle;
  const Maybe<layers::CompositeProcessFencesHolderId> mFencesHolderId;
  const RefPtr<layers::FenceD3D11> mWriteFence;
  const RefPtr<IDXGIKeyedMutex> mKeyedMutex;

  static UniquePtr<SharedSurface_ANGLEShareHandle> Create(
      const SharedSurfaceDesc&);

 private:
  SharedSurface_ANGLEShareHandle(
      const SharedSurfaceDesc&, const RefPtr<ID3D11Device> aDevice,
      const std::weak_ptr<EglDisplay>& egl, EGLSurface pbuffer,
      RefPtr<gfx::FileHandleWrapper>&& aSharedHandle,
      const Maybe<layers::CompositeProcessFencesHolderId> aFencesHolderId,
      const RefPtr<layers::FenceD3D11>& aWriteFence,
      const RefPtr<IDXGIKeyedMutex>& keyedMutex);

 public:
  virtual ~SharedSurface_ANGLEShareHandle();

  virtual void LockProdImpl() override;
  virtual void UnlockProdImpl() override;

  virtual void ProducerAcquireImpl() override;
  virtual void ProducerReleaseImpl() override;
  virtual void ProducerReadAcquireImpl() override;
  virtual void ProducerReadReleaseImpl() override;

  Maybe<layers::SurfaceDescriptor> ToSurfaceDescriptor() override;
};

class SurfaceFactory_ANGLEShareHandle final : public SurfaceFactory {
 public:
  static UniquePtr<SurfaceFactory_ANGLEShareHandle> Create(GLContext& gl);

 private:
  explicit SurfaceFactory_ANGLEShareHandle(const PartialSharedSurfaceDesc& desc)
      : SurfaceFactory(desc) {}

  virtual UniquePtr<SharedSurface> CreateSharedImpl(
      const SharedSurfaceDesc& desc) override {
    return SharedSurface_ANGLEShareHandle::Create(desc);
  }
};

}  // namespace gl
} /* namespace mozilla */

#endif /* SHARED_SURFACE_ANGLE_H_ */
