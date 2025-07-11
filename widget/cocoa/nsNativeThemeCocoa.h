/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNativeThemeCocoa_h_
#define nsNativeThemeCocoa_h_

#import <Carbon/Carbon.h>
#import <Cocoa/Cocoa.h>

#include "mozilla/Variant.h"

#include "nsITheme.h"
#include "ThemeCocoa.h"
#include "mozilla/dom/RustTypes.h"

@class MOZCellDrawWindow;
@class MOZCellDrawView;
class nsDeviceContext;

namespace mozilla {
namespace gfx {
class DrawTarget;
}  // namespace gfx
}  // namespace mozilla

class nsNativeThemeCocoa : public mozilla::widget::ThemeCocoa {
  using ThemeCocoa = mozilla::widget::ThemeCocoa;

 public:
  enum class CheckboxOrRadioState : uint8_t { eOff, eOn, eIndeterminate };

  enum class ButtonType : uint8_t {
    eRegularPushButton,
    eDefaultPushButton,
    eSquareBezelPushButton,
    eArrowButton,
    eHelpButton,
    eDisclosureButtonClosed,
    eDisclosureButtonOpen
  };

  enum class OptimumState : uint8_t { eOptimum, eSubOptimum, eSubSubOptimum };

  struct ControlParams {
    ControlParams()
        : disabled(false),
          insideActiveWindow(false),
          pressed(false),
          focused(false),
          rtl(false) {}

    bool disabled : 1;
    bool insideActiveWindow : 1;
    bool pressed : 1;
    bool focused : 1;
    bool rtl : 1;
  };

  struct CheckboxOrRadioParams {
    ControlParams controlParams;
    CheckboxOrRadioState state = CheckboxOrRadioState::eOff;
    float verticalAlignFactor = 0.5f;
  };

  struct ButtonParams {
    ControlParams controlParams;
    ButtonType button = ButtonType::eRegularPushButton;
  };

  struct DropdownParams {
    ControlParams controlParams;
    bool pullsDown = false;
    bool editable = false;
  };

  struct TextFieldParams {
    float verticalAlignFactor = 0.5f;
    bool insideToolbar = false;
    bool disabled = false;
    bool focused = false;
    bool rtl = false;
  };

  enum Widget : uint8_t {
    eCheckbox,            // CheckboxOrRadioParams
    eRadio,               // CheckboxOrRadioParams
    eButton,              // ButtonParams
    eDropdown,            // DropdownParams
    eTextField,           // TextFieldParams
    eMultilineTextField,  // bool
  };

  struct WidgetInfo {
    static WidgetInfo Checkbox(const CheckboxOrRadioParams& aParams) {
      return WidgetInfo(Widget::eCheckbox, aParams);
    }
    static WidgetInfo Radio(const CheckboxOrRadioParams& aParams) {
      return WidgetInfo(Widget::eRadio, aParams);
    }
    static WidgetInfo Button(const ButtonParams& aParams) {
      return WidgetInfo(Widget::eButton, aParams);
    }
    static WidgetInfo Dropdown(const DropdownParams& aParams) {
      return WidgetInfo(Widget::eDropdown, aParams);
    }
    static WidgetInfo TextField(const TextFieldParams& aParams) {
      return WidgetInfo(Widget::eTextField, aParams);
    }
    static WidgetInfo MultilineTextField(bool aParams) {
      return WidgetInfo(Widget::eMultilineTextField, aParams);
    }

    template <typename T>
    T Params() const {
      MOZ_RELEASE_ASSERT(mVariant.is<T>());
      return mVariant.as<T>();
    }

    enum Widget Widget() const { return mWidget; }

   private:
    template <typename T>
    WidgetInfo(enum Widget aWidget, const T& aParams)
        : mVariant(aParams), mWidget(aWidget) {}

    mozilla::Variant<mozilla::gfx::sRGBColor, CheckboxOrRadioParams,
                     ButtonParams, DropdownParams, TextFieldParams, bool>
        mVariant;

    enum Widget mWidget;
  };

  explicit nsNativeThemeCocoa();

  NS_DECL_ISUPPORTS_INHERITED

  // The nsITheme interface.
  void DrawWidgetBackground(gfxContext* aContext, nsIFrame*, StyleAppearance,
                            const nsRect& aRect, const nsRect& aDirtyRect,
                            DrawOverflow) override;
  bool CreateWebRenderCommandsForWidget(
      mozilla::wr::DisplayListBuilder& aBuilder,
      mozilla::wr::IpcResourceUpdateQueue& aResources,
      const mozilla::layers::StackingContextHelper& aSc,
      mozilla::layers::RenderRootStateManager* aManager, nsIFrame*,
      StyleAppearance, const nsRect& aRect) override;
  [[nodiscard]] LayoutDeviceIntMargin GetWidgetBorder(nsDeviceContext* aContext,
                                                      nsIFrame*,
                                                      StyleAppearance) override;

  bool GetWidgetPadding(nsDeviceContext* aContext, nsIFrame*, StyleAppearance,
                        LayoutDeviceIntMargin* aResult) override;

  bool GetWidgetOverflow(nsDeviceContext* aContext, nsIFrame*, StyleAppearance,
                         nsRect* aOverflowRect) override;

  LayoutDeviceIntSize GetMinimumWidgetSize(nsPresContext*, nsIFrame*,
                                           StyleAppearance) override;
  bool WidgetAttributeChangeRequiresRepaint(StyleAppearance,
                                            nsAtom* aAttribute) override;
  bool ThemeSupportsWidget(nsPresContext* aPresContext, nsIFrame*,
                           StyleAppearance) override;
  bool WidgetIsContainer(StyleAppearance) override;
  bool ThemeDrawsFocusForWidget(nsIFrame*, StyleAppearance) override;
  bool ThemeNeedsComboboxDropmarker() override;
  bool WidgetAppearanceDependsOnWindowFocus(StyleAppearance) override;
  ThemeGeometryType ThemeGeometryTypeForWidget(nsIFrame*,
                                               StyleAppearance) override;
  Transparency GetWidgetTransparency(nsIFrame*, StyleAppearance) override;
  mozilla::Maybe<WidgetInfo> ComputeWidgetInfo(nsIFrame*, StyleAppearance,
                                               const nsRect& aRect);

 protected:
  virtual ~nsNativeThemeCocoa();

  LayoutDeviceIntMargin DirectionAwareMargin(const LayoutDeviceIntMargin&,
                                             nsIFrame*);
  ControlParams ComputeControlParams(nsIFrame*, mozilla::dom::ElementState);
  TextFieldParams ComputeTextFieldParams(nsIFrame*, mozilla::dom::ElementState);

  // HITheme drawing routines
  void DrawCheckboxOrRadio(CGContextRef cgContext, bool inCheckbox,
                           const NSRect& inBoxRect,
                           const CheckboxOrRadioParams& aParams);
  void DrawTextField(CGContextRef cgContext, const NSRect& inBoxRect,
                     const TextFieldParams& aParams);
  void DrawPushButton(CGContextRef cgContext, const NSRect& inBoxRect,
                      ButtonType aButtonType, ControlParams aControlParams);
  void DrawSquareBezelPushButton(CGContextRef cgContext,
                                 const NSRect& inBoxRect,
                                 ControlParams aControlParams);
  void DrawHelpButton(CGContextRef cgContext, const NSRect& inBoxRect,
                      ControlParams aControlParams);
  void DrawDisclosureButton(CGContextRef cgContext, const NSRect& inBoxRect,
                            ControlParams aControlParams,
                            NSControlStateValue aState);
  void DrawHIThemeButton(CGContextRef cgContext, const NSRect& aRect,
                         ThemeButtonKind aKind, ThemeButtonValue aValue,
                         ThemeDrawState aState, ThemeButtonAdornment aAdornment,
                         const ControlParams& aParams);
  void DrawButton(CGContextRef context, const NSRect& inBoxRect,
                  const ButtonParams& aParams);
  void DrawDropdown(CGContextRef context, const NSRect& inBoxRect,
                    const DropdownParams& aParams);
  void DrawMultilineTextField(CGContextRef cgContext, const CGRect& inBoxRect,
                              bool aIsFocused);
  void RenderWidget(const WidgetInfo& aWidgetInfo, mozilla::ColorScheme,
                    mozilla::gfx::DrawTarget& aDrawTarget,
                    const mozilla::gfx::Rect& aWidgetRect,
                    const mozilla::gfx::Rect& aDirtyRect, float aScale);

 private:
  NSButtonCell* mDisclosureButtonCell;
  NSButtonCell* mHelpButtonCell;
  NSButtonCell* mPushButtonCell;
  NSButtonCell* mRadioButtonCell;
  NSButtonCell* mCheckboxCell;
  NSTextFieldCell* mTextFieldCell;
  NSPopUpButtonCell* mDropdownCell;
  NSComboBoxCell* mComboBoxCell;
  MOZCellDrawWindow* mCellDrawWindow = nil;
  MOZCellDrawView* mCellDrawView;
};

#endif  // nsNativeThemeCocoa_h_
