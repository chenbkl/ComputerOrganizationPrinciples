ARCHS = arm64
TARGET := iphone:clang:latest:7.0
#INSTALL_TARGET_PROCESSES = SpringBoard


include $(THEOS)/makefiles/common.mk

TWEAK_NAME = imagenthook


imagenthook_FILES = Tweak.xm
imagenthook_CFLAGS = -fobjc-arc

include $(THEOS_MAKE_PATH)/tweak.mk
