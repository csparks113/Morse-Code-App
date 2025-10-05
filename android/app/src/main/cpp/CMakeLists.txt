cmake_minimum_required(VERSION 3.18.1)

project(appmodules)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_VERBOSE_MAKEFILE ON)

# Resolve workspace roots used by the bundled React Native CMake helpers.
get_filename_component(PROJECT_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../.." ABSOLUTE)
set(NITROGEN_DIR "${PROJECT_ROOT_DIR}/nitrogen")
set(OUTPUTS_NATIVE_DIR "${PROJECT_ROOT_DIR}/outputs-native")
set(NITROGEN_GENERATED_DIR "${NITROGEN_DIR}/generated")
set(NITROGEN_GENERATED_ANDROID_DIR "${NITROGEN_GENERATED_DIR}/android")
set(NITROGEN_GENERATED_ANDROID_CPP_DIR "${NITROGEN_GENERATED_ANDROID_DIR}/c++")
set(NITROGEN_GENERATED_SHARED_CPP_DIR "${NITROGEN_GENERATED_DIR}/shared/c++")

# Mirror Nitrogen's autolinking flags
add_definitions(-DBUILDING_MORSENITRO_WITH_GENERATED_CMAKE_PROJECT)
add_definitions(-DRN_SERIALIZABLE_STATE)

# The React Native Gradle plugin provides REACT_ANDROID_DIR/PROJECT_BUILD_DIR.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

target_include_directories(
  appmodules
  PRIVATE
  ${NITROGEN_GENERATED_ANDROID_DIR}
  ${OUTPUTS_NATIVE_DIR}/android/c++
  ${PROJECT_ROOT_DIR}/node_modules/react-native-nitro-modules/android/build/headers/nitromodules
  ${PROJECT_ROOT_DIR}/node_modules/react-native-nitro-modules/cpp
)

# ---- Morse Nitro native module -------------------------------------------------

add_library(morseNitro SHARED
  nitro/cpp-adapter.cpp
  ${OUTPUTS_NATIVE_DIR}/android/c++/OutputsAudio.cpp
)

target_include_directories(
  morseNitro
  PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${OUTPUTS_NATIVE_DIR}/android/c++
  ${NITROGEN_GENERATED_SHARED_CPP_DIR}
  ${NITROGEN_GENERATED_ANDROID_CPP_DIR}
  ${NITROGEN_GENERATED_ANDROID_DIR}
)

target_sources(
  morseNitro
  PRIVATE
  ${NITROGEN_GENERATED_ANDROID_DIR}/morseNitroOnLoad.cpp
  ${NITROGEN_GENERATED_SHARED_CPP_DIR}/HybridOutputsAudioSpec.cpp
  ${NITROGEN_GENERATED_SHARED_CPP_DIR}/HybridHapticsSpec.cpp
  ${NITROGEN_GENERATED_ANDROID_CPP_DIR}/JHybridHapticsSpec.cpp
)

find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)
find_package(react-native-nitro-modules REQUIRED CONFIG)

find_package(oboe REQUIRED CONFIG)
find_library(log-lib log)
find_library(android-lib android)

target_link_libraries(
  morseNitro
  ${log-lib}
  ${android-lib}
  oboe::oboe
  fbjni::fbjni
  ReactAndroid::jsi
  react-native-nitro-modules::NitroModules
)

# Link react-native (different prefab between RN 0.75 and RN 0.76)
if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
    target_link_libraries(
        morseNitro
        ReactAndroid::reactnative                 # <-- RN: Native Modules umbrella prefab
    )
else()
    target_link_libraries(
        morseNitro
        ReactAndroid::react_nativemodule_core     # <-- RN: TurboModules Core
    )
endif()
