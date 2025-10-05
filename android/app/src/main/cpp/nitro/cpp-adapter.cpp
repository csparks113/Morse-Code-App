#include <jni.h>
#include "morseNitroOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::morse::initialize(vm);
}
