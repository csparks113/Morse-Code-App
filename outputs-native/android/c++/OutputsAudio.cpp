#include "OutputsAudio.hpp"

#include <android/log.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <iomanip>
#include <sstream>
#include <thread>
#include <utility>

namespace margelo::nitro::morse {


void OutputsAudio::StreamDeleter::operator()(oboe::AudioStream* stream) const {
  if (stream != nullptr) {
    stream->close();
    delete stream;
  }
}

namespace {
constexpr const char* kLogPrefix = "[outputs-audio]";
constexpr const char* kTag = "OutputsAudio";
constexpr float kDefaultGain = 1.0f;
constexpr float kMinGain = 0.0f;
constexpr float kMaxGain = 1.0f;
constexpr float kDefaultAttackMs = 2.5f;
constexpr float kDefaultReleaseMs = 6.0f;
constexpr double kTwoPi = 6.283185307179586476925286766559;
constexpr std::chrono::milliseconds kSleepQuantum(1);
constexpr int kDashUnits = 3;
constexpr int kSymbolGapUnits = 1;

inline float clampGain(float value) {
  return std::clamp(value, kMinGain, kMaxGain);
}

inline std::chrono::microseconds toMicros(double milliseconds) {
  return std::chrono::duration_cast<std::chrono::microseconds>(
      std::chrono::duration<double, std::milli>(milliseconds));
}
} // namespace

OutputsAudio::OutputsAudio()
    : HybridOutputsAudioSpec(), margelo::nitro::HybridObject(HybridOutputsAudioSpec::TAG), mStream(nullptr),
      mSampleRate(48000.0),
      mFrequency(600.0),
      mTargetGain(0.0f),
      mCurrentGain(0.0f),
      mGainStepUp(0.001f),
      mGainStepDown(0.001f),
      mStreamReady(false),
      mSupportKnown(false),
      mSupported(false),
      mEnvelopeConfig{ kDefaultAttackMs, kDefaultReleaseMs },
      mPhase(0.0),
      mPlaybackCancel(false),
      mPlaybackRunning(false),
      mSymbolSequence(0),
      mSymbolSequenceConsumed(0),
      mLatestSymbolKind(PlaybackSymbol::Dot),
      mLatestSymbolTimestampMs(0.0),
      mLatestSymbolDurationMs(0.0) {
  logEvent("constructor");
}

OutputsAudio::~OutputsAudio() {
  teardown();
}

void OutputsAudio::logEvent(const char* event, const char* fmt, ...) const {
  if (event == nullptr) {
    return;
  }

  if (fmt == nullptr) {
    __android_log_print(ANDROID_LOG_DEBUG, kTag, "%s %s", kLogPrefix, event);
    return;
  }

  char formatted[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(formatted, sizeof(formatted), fmt, args);
  va_end(args);
  __android_log_print(ANDROID_LOG_DEBUG, kTag, "%s %s %s", kLogPrefix, event, formatted);
}

bool OutputsAudio::isSupported() {
  if (mSupportKnown.load(std::memory_order_acquire)) {
    return mSupported;
  }

  std::lock_guard<std::mutex> lock(mStreamMutex);
  if (!mSupportKnown.load(std::memory_order_relaxed)) {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output);
    builder.setPerformanceMode(oboe::PerformanceMode::LowLatency);
    builder.setSharingMode(oboe::SharingMode::Exclusive);
    builder.setChannelCount(1);
    builder.setFormat(oboe::AudioFormat::Float);

    oboe::AudioStream* testStream = nullptr;
    const oboe::Result result = builder.openStream(&testStream);
    if (result == oboe::Result::OK && testStream != nullptr) {
      mSupported = true;
      testStream->close();
      testStream = nullptr;
    } else {
      mSupported = false;
      logEvent("isSupported.failed", "error=%s", oboe::convertToText(result));
    }
    mSupportKnown.store(true, std::memory_order_release);
  }

  return mSupported;
}

void OutputsAudio::ensureStreamLocked(double toneHz) {
  if (mStreamReady.load(std::memory_order_acquire) && mStream) {
    return;
  }

  if (mStream) {
    mStream.reset();
  }

  oboe::AudioStreamBuilder builder;
  builder.setDirection(oboe::Direction::Output);
  builder.setPerformanceMode(oboe::PerformanceMode::LowLatency);
  builder.setSharingMode(oboe::SharingMode::Exclusive);
  builder.setUsage(oboe::Usage::Game);
  builder.setContentType(oboe::ContentType::Sonification);
  builder.setChannelCount(1);
  builder.setFormat(oboe::AudioFormat::Float);
  builder.setCallback(this);
  builder.setErrorCallback(this);

  oboe::AudioStream* rawStream = nullptr;
  const oboe::Result result = builder.openStream(&rawStream);
  if (result != oboe::Result::OK || rawStream == nullptr) {
    logEvent("stream.open.failed", "error=%s", oboe::convertToText(result));
    if (rawStream != nullptr) {
      rawStream->close();
      delete rawStream;
    }
    mStreamReady.store(false, std::memory_order_release);
    return;
  }

  mStream = StreamPtr(rawStream);
  auto* stream = mStream.get();
  mSampleRate = static_cast<double>(stream->getSampleRate());
  mPhase = 0.0;
  mFrequency.store(toneHz, std::memory_order_relaxed);
  mTargetGain.store(0.0f, std::memory_order_relaxed);
  mCurrentGain.store(0.0f, std::memory_order_relaxed);

  const int32_t burst = stream->getFramesPerBurst();
  if (burst > 0) {
    stream->setBufferSizeInFrames(burst);
  }

  logEvent("stream.open", "sampleRate=%.1f burst=%d api=%d",
           mSampleRate,
           burst,
           static_cast<int>(stream->getAudioApi()));

  startStreamLocked();
}

void OutputsAudio::startStreamLocked() {
  auto* stream = mStream.get();
  if (stream == nullptr) {
    return;
  }

  const oboe::Result result = stream->requestStart();
  if (result != oboe::Result::OK) {
    logEvent("stream.start.failed", "error=%s", oboe::convertToText(result));
    mStreamReady.store(false, std::memory_order_release);
    return;
  }

  mStreamReady.store(true, std::memory_order_release);
}

void OutputsAudio::closeStreamLocked() {
  auto* stream = mStream.get();
  if (stream == nullptr) {
    return;
  }

  if (mStreamReady.load(std::memory_order_acquire)) {
    const oboe::Result stopResult = stream->requestStop();
    if (stopResult != oboe::Result::OK) {
      logEvent("stream.stop.failed", "error=%s", oboe::convertToText(stopResult));
    }
  }

  mStream.reset();
  mStreamReady.store(false, std::memory_order_release);
  mTargetGain.store(0.0f, std::memory_order_relaxed);
  mCurrentGain.store(0.0f, std::memory_order_relaxed);
  mPhase = 0.0;
}

float OutputsAudio::resolveGain(const std::optional<double>& gainOpt) const {
  if (gainOpt.has_value() && std::isfinite(gainOpt.value())) {
    return clampGain(static_cast<float>(gainOpt.value()));
  }
  return kDefaultGain;
}

OutputsAudio::EnvelopeConfig OutputsAudio::resolveEnvelope(
    const std::optional<ToneEnvelopeOptions>& envelopeOpt) const {
  EnvelopeConfig config{ kDefaultAttackMs, kDefaultReleaseMs };
  if (envelopeOpt.has_value()) {
    if (envelopeOpt->attackMs.has_value() && std::isfinite(envelopeOpt->attackMs.value())) {
      config.attackMs = std::max(0.0f, static_cast<float>(envelopeOpt->attackMs.value()));
    }
    if (envelopeOpt->releaseMs.has_value() && std::isfinite(envelopeOpt->releaseMs.value())) {
      config.releaseMs = std::max(0.0f, static_cast<float>(envelopeOpt->releaseMs.value()));
    }
  }
  return config;
}

float OutputsAudio::computeRampStep(float magnitude, float durationMs) const {
  if (durationMs <= 0.0f || mSampleRate <= 0.0) {
    return magnitude;
  }
  const double frames = std::max(1.0, (mSampleRate * static_cast<double>(durationMs)) / 1000.0);
  return magnitude / static_cast<float>(frames);
}

void OutputsAudio::startToneInternal(const ToneStartOptions& options, bool cancelPlayback) {
  if (!isSupported()) {
    return;
  }

  if (cancelPlayback) {
    cancelPlaybackThread(true);
  }

  std::lock_guard<std::mutex> lock(mStreamMutex);
  ensureStreamLocked(options.toneHz);
  if (!mStreamReady.load(std::memory_order_acquire)) {
    return;
  }

  const float gain = resolveGain(options.gain);
  const EnvelopeConfig envelope = resolveEnvelope(options.envelope);
  mEnvelopeConfig = envelope;

  const float current = mCurrentGain.load(std::memory_order_relaxed);
  const float gainDelta = std::max(0.0f, gain - current);
  const float rampUpStep = computeRampStep(gainDelta > 0.0f ? gainDelta : gain, envelope.attackMs);
  const float rampDownStep = computeRampStep(std::max(gain, current), envelope.releaseMs);

  mGainStepUp.store(rampUpStep, std::memory_order_relaxed);
  mGainStepDown.store(rampDownStep, std::memory_order_relaxed);
  mFrequency.store(options.toneHz, std::memory_order_relaxed);
  mTargetGain.store(gain, std::memory_order_release);

  logEvent("start", "hz=%.1f gain=%.3f attack=%.2f release=%.2f",
           options.toneHz,
           gain,
           envelope.attackMs,
           envelope.releaseMs);
}

void OutputsAudio::warmup(const ToneStartOptions& options) {
  if (!isSupported()) {
    return;
  }
  std::lock_guard<std::mutex> lock(mStreamMutex);
  ensureStreamLocked(options.toneHz);
  if (!mStreamReady.load(std::memory_order_acquire)) {
    return;
  }
  mFrequency.store(options.toneHz, std::memory_order_relaxed);
  mTargetGain.store(0.0f, std::memory_order_relaxed);
  mCurrentGain.store(0.0f, std::memory_order_relaxed);
  logEvent("warmup", "hz=%.1f", options.toneHz);
}

void OutputsAudio::startTone(const ToneStartOptions& options) {
  startToneInternal(options, true);
}

void OutputsAudio::stopTone() {
  if (!isSupported()) {
    return;
  }

  std::lock_guard<std::mutex> lock(mStreamMutex);
  if (!mStreamReady.load(std::memory_order_acquire)) {
    return;
  }

  const float current = mCurrentGain.load(std::memory_order_relaxed);
  const float rampDownStep = computeRampStep(std::max(current, 0.0f), mEnvelopeConfig.releaseMs);
  mGainStepDown.store(rampDownStep, std::memory_order_relaxed);
  mTargetGain.store(0.0f, std::memory_order_release);
  logEvent("stop", "gain=%.3f release=%.2f", current, mEnvelopeConfig.releaseMs);
}

void OutputsAudio::cancelPlaybackThread(bool join) {
  std::thread localThread;
  {
    std::lock_guard<std::mutex> lock(mPlaybackMutex);
    if (!mPlaybackThread.joinable()) {
      mPlaybackRunning.store(false, std::memory_order_release);
      mPlaybackCancel.store(false, std::memory_order_release);
      return;
    }
    mPlaybackCancel.store(true, std::memory_order_release);
    localThread = std::move(mPlaybackThread);
  }

  if (localThread.joinable()) {
    if (join && localThread.get_id() != std::this_thread::get_id()) {
      localThread.join();
    } else {
      localThread.detach();
    }
  }

  mPlaybackRunning.store(false, std::memory_order_release);
  mPlaybackCancel.store(false, std::memory_order_release);
}

void OutputsAudio::playMorse(const PlaybackRequest& request) {
  if (!isSupported()) {
    logEvent("playMorse.skip", "unsupported=1");
    return;
  }

  if (request.pattern.empty()) {
    return;
  }

  const float gain = resolveGain(request.gain);
  {
    std::lock_guard<std::mutex> lock(mStreamMutex);
    ensureStreamLocked(request.toneHz);
    if (!mStreamReady.load(std::memory_order_acquire)) {
      logEvent("playMorse.skip", "stream=closed");
      return;
    }
  }

  cancelPlaybackThread(true);

  {
    std::lock_guard<std::mutex> lock(mPlaybackMutex);
    mPlaybackCancel.store(false, std::memory_order_release);
    mPlaybackRunning.store(true, std::memory_order_release);
    mPlaybackThread = std::thread(
        [this,
         pattern = request.pattern,
         toneHz = request.toneHz,
         gain,
         unitMs = request.unitMs]() mutable {
          runPattern(std::move(pattern), toneHz, gain, unitMs);
        });
  }
}

void OutputsAudio::runPattern(std::vector<PlaybackSymbol> pattern,
                              double toneHz,
                              float gain,
                              double unitMs) {
  logEvent("playMorse.start", "count=%zu unit=%.1f", pattern.size(), unitMs);

  const auto sleepUntil = [&](const std::chrono::steady_clock::time_point& deadline) {
    while (!mPlaybackCancel.load(std::memory_order_acquire) &&
           std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(kSleepQuantum);
    }
  };

  for (std::size_t i = 0; i < pattern.size(); ++i) {
    if (mPlaybackCancel.load(std::memory_order_acquire)) {
      break;
    }

    const int symbolValue = static_cast<int>(pattern[i]);
    const bool isDash = symbolValue == 1;
    const bool isDot = symbolValue == 0;

    if (!isDash && !isDot) {
      const auto gapDeadline = std::chrono::steady_clock::now() + toMicros(unitMs * 3.0);
      sleepUntil(gapDeadline);
      continue;
    }

    const double symbolDurationMs = unitMs * (isDash ? static_cast<double>(kDashUnits) : 1.0);

    ToneStartOptions startOptions;
    startOptions.toneHz = toneHz;
    startOptions.gain = static_cast<double>(gain);
    ToneEnvelopeOptions envelope;
    envelope.attackMs = static_cast<double>(mEnvelopeConfig.attackMs);
    envelope.releaseMs = static_cast<double>(mEnvelopeConfig.releaseMs);
    startOptions.envelope = envelope;
    startToneInternal(startOptions, false);

    const auto startedAt = std::chrono::steady_clock::now();
    const double startedAtMs = std::chrono::duration<double, std::milli>(startedAt.time_since_epoch()).count();
    {
      std::lock_guard<std::mutex> infoLock(mSymbolInfoMutex);
      mSymbolSequence += 1;
      mLatestSymbolKind = isDash ? PlaybackSymbol::Dash : PlaybackSymbol::Dot;
      mLatestSymbolTimestampMs = startedAtMs;
      mLatestSymbolDurationMs = symbolDurationMs;
    }

    const auto symbolDeadline = startedAt + toMicros(symbolDurationMs);
    sleepUntil(symbolDeadline);

    stopTone();

    const auto gapDeadline = std::chrono::steady_clock::now() + toMicros(unitMs * kSymbolGapUnits);
    sleepUntil(gapDeadline);
  }

  stopTone();
  mPlaybackRunning.store(false, std::memory_order_release);
  const bool cancelled = mPlaybackCancel.load(std::memory_order_acquire);
  mPlaybackCancel.store(false, std::memory_order_release);
  logEvent("playMorse.end", "cancelled=%d", cancelled ? 1 : 0);
}

std::string OutputsAudio::getLatestSymbolInfo() {
  std::lock_guard<std::mutex> lock(mSymbolInfoMutex);
  if (mSymbolSequenceConsumed == mSymbolSequence) {
    return {};
  }
  mSymbolSequenceConsumed = mSymbolSequence;
  const char symbolChar = mLatestSymbolKind == PlaybackSymbol::Dash ? '-' : '.';
  std::ostringstream stream;
  stream.setf(std::ios::fixed, std::ios::floatfield);
  stream << "{\"sequence\":" << mSymbolSequence
         << ",\"symbol\":\"" << symbolChar << "\""
         << ",\"timestampMs\":" << std::setprecision(3) << mLatestSymbolTimestampMs
         << ",\"durationMs\":" << std::setprecision(3) << mLatestSymbolDurationMs
         << "}";
  return stream.str();
}

oboe::DataCallbackResult OutputsAudio::onAudioReady(oboe::AudioStream* stream,
                                                   void* audioData,
                                                   int32_t numFrames) {
  if (stream == nullptr || audioData == nullptr || numFrames <= 0) {
    return oboe::DataCallbackResult::Continue;
  }

  auto* floatData = static_cast<float*>(audioData);
  const int32_t channelCount = std::max(1, stream->getChannelCount());
  const double sampleRate = stream->getSampleRate() > 0 ? stream->getSampleRate() : mSampleRate;
  double phase = mPhase;
  const double frequency = mFrequency.load(std::memory_order_relaxed);
  float gain = mCurrentGain.load(std::memory_order_relaxed);
  const float targetGain = mTargetGain.load(std::memory_order_relaxed);
  const float rampUp = mGainStepUp.load(std::memory_order_relaxed);
  const float rampDown = mGainStepDown.load(std::memory_order_relaxed);
  const double phaseIncrement = kTwoPi * frequency / std::max(sampleRate, 1.0);

  for (int32_t frame = 0; frame < numFrames; ++frame) {
    if (gain < targetGain) {
      gain = std::min(targetGain, gain + rampUp);
    } else if (gain > targetGain) {
      gain = std::max(targetGain, gain - rampDown);
    }

    const float sample = gain * static_cast<float>(std::sin(phase));
    for (int32_t channel = 0; channel < channelCount; ++channel) {
      floatData[frame * channelCount + channel] = sample;
    }

    phase += phaseIncrement;
    if (phase >= kTwoPi) {
      phase -= kTwoPi;
    }
  }

  mPhase = phase;
  mCurrentGain.store(gain, std::memory_order_relaxed);
  return oboe::DataCallbackResult::Continue;
}

void OutputsAudio::onErrorAfterClose(oboe::AudioStream*, oboe::Result error) {
  logEvent("stream.error", "error=%s", oboe::convertToText(error));
  std::lock_guard<std::mutex> lock(mStreamMutex);
  mStream.reset();
  mStreamReady.store(false, std::memory_order_release);
}

void OutputsAudio::teardown() {
  cancelPlaybackThread(true);
  std::lock_guard<std::mutex> lock(mStreamMutex);
  closeStreamLocked();
}

} // namespace margelo::nitro::morse








