cmake_minimum_required(VERSION 3.18.1)

project(appmodules)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_VERBOSE_MAKEFILE ON)

# Resolve workspace roots used by the bundled React Native CMake helpers.
get_filename_component(PROJECT_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../.." ABSOLUTE)
set(NITROGEN_DIR "${PROJECT_ROOT_DIR}/nitrogen")

# The React Native Gradle plugin provides REACT_ANDROID_DIR/PROJECT_BUILD_DIR.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

target_include_directories(
  appmodules
  PRIVATE
  ${NITROGEN_DIR}/generated/android
  ${PROJECT_ROOT_DIR}/node_modules/react-native-nitro-modules/android/build/headers/nitromodules
  ${PROJECT_ROOT_DIR}/node_modules/react-native-nitro-modules/cpp
)

# ---- Morse Nitro native module -------------------------------------------------

add_library(morseNitro SHARED
  nitro/cpp-adapter.cpp
  ${NITROGEN_DIR}/generated/android/c++/OutputsAudio.cpp
)

target_include_directories(
  morseNitro
  PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
)

include(${NITROGEN_DIR}/generated/android/morseNitro+autolinking.cmake)

find_package(oboe REQUIRED CONFIG)
find_library(log-lib log)
find_library(android-lib android)

target_link_libraries(
  morseNitro
  ${log-lib}
  ${android-lib}
  oboe::oboe
)
