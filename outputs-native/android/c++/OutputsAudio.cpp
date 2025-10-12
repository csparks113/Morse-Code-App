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
constexpr double kToneStartLeadMs = 20.0;
constexpr double kMinDispatchOffsetMs = 12.0;

inline float clampGain(float value) {
  return std::clamp(value, kMinGain, kMaxGain);
}

inline std::chrono::microseconds toMicros(double milliseconds) {
  return std::chrono::duration_cast<std::chrono::microseconds>(
      std::chrono::duration<double, std::milli>(milliseconds));
}

inline double toMillis(const std::chrono::steady_clock::time_point& timePoint) {
  return std::chrono::duration<double, std::milli>(timePoint.time_since_epoch()).count();
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
      mPatternStartTimestampMs(0.0),
      mToneActive(false),
      mToneStartLogged(false),
      mToneSteadyLogged(false),
      mToneStopLogged(false),
      mToneStartRequestedMs(0.0),
      mToneActualStartMs(0.0) {
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

  const double requestedAtMs = toMillis(std::chrono::steady_clock::now());
  mToneStartRequestedMs.store(requestedAtMs, std::memory_order_relaxed);
  mToneActualStartMs.store(0.0, std::memory_order_relaxed);
  mToneStartLogged.store(false, std::memory_order_relaxed);
  mToneSteadyLogged.store(false, std::memory_order_relaxed);
  mToneStopLogged.store(false, std::memory_order_relaxed);

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
  mToneActive.store(true, std::memory_order_release);

  logEvent("start", "hz=%.1f gain=%.3f attack=%.2f release=%.2f",
           options.toneHz,
           gain,
           envelope.attackMs,
           envelope.releaseMs);
  logEvent("tone.request", "hz=%.1f gain=%.3f requestedAt=%.3f",
           options.toneHz,
           gain,
           requestedAtMs);
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
  mToneActive.store(false, std::memory_order_release);
  mToneSteadyLogged.store(false, std::memory_order_relaxed);
  mToneStopLogged.store(false, std::memory_order_relaxed);
  logEvent("stop", "gain=%.3f release=%.2f", current, mEnvelopeConfig.releaseMs);
}

void OutputsAudio::cancelPlaybackThread(bool join) {
  std::thread localThread;
  {
    std::lock_guard<std::mutex> lock(mPlaybackMutex);
    if (!mPlaybackThread.joinable()) {
      mPlaybackRunning.store(false, std::memory_order_release);
      mPlaybackCancel.store(false, std::memory_order_release);
      resetSymbolInfo();
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
  resetSymbolInfo();
}

void OutputsAudio::resetSymbolInfo() {
  {
    std::lock_guard<std::mutex> lock(mSymbolInfoMutex);
    mSymbolSequence = 0;
    mPatternStartTimestampMs = 0.0;
    mSymbolSnapshots.clear();
  }
  {
    std::lock_guard<std::mutex> scheduleLock(mScheduleMutex);
    mScheduledSymbols.clear();
  }
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

  const auto patternStart = std::chrono::steady_clock::now();
  const double patternStartMs = toMillis(patternStart);
  std::vector<ScheduledSymbol> scheduledSymbols;
  scheduledSymbols.reserve(request.pattern.size());
  double expectedOffsetMs = 0.0;
  uint64_t scheduledSequence = 0;
  for (std::size_t i = 0; i < request.pattern.size(); ++i) {
    const PlaybackSymbol symbol = request.pattern[i];
    const int symbolValue = static_cast<int>(symbol);
    const bool isDash = symbolValue == 1;
    const bool isDot = symbolValue == 0;

    if (!isDash && !isDot) {
      expectedOffsetMs += request.unitMs * 3.0;
      continue;
    }

    const double symbolDurationMs =
        request.unitMs * (isDash ? static_cast<double>(kDashUnits) : 1.0);

    ScheduledSymbol info;
    info.sequence = ++scheduledSequence;
    info.symbol = symbol;
    info.expectedTimestampMs = patternStartMs + expectedOffsetMs;
    info.durationMs = symbolDurationMs;
    info.offsetMs = expectedOffsetMs;
    scheduledSymbols.push_back(info);

    expectedOffsetMs += symbolDurationMs;
    if (i + 1 < request.pattern.size()) {
      expectedOffsetMs += request.unitMs * static_cast<double>(kSymbolGapUnits);
    }
  }
  {
    std::lock_guard<std::mutex> scheduleLock(mScheduleMutex);
    mScheduledSymbols = std::move(scheduledSymbols);
  }
  {
    std::lock_guard<std::mutex> infoLock(mSymbolInfoMutex);
    mPatternStartTimestampMs = patternStartMs;
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
         unitMs = request.unitMs,
         patternStart]() mutable {
          runPattern(std::move(pattern), toneHz, gain, unitMs, patternStart);
        });
  }
}

void OutputsAudio::runPattern(std::vector<PlaybackSymbol> pattern,
                              double toneHz,
                              float gain,
                              double unitMs,
                              std::chrono::steady_clock::time_point patternStart) {
  logEvent("playMorse.start", "count=%zu unit=%.1f", pattern.size(), unitMs);

  const auto sleepUntil = [&](const std::chrono::steady_clock::time_point& deadline) {
    while (!mPlaybackCancel.load(std::memory_order_acquire) &&
           std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(kSleepQuantum);
    }
  };
  const double patternStartMs = toMillis(patternStart);
  double expectedOffsetMs = 0.0;
  double previousExpectedStartMs = patternStartMs;
  double previousActualStartMs = patternStartMs;
  double previousExpectedEndOffsetMs = 0.0;
  bool isFirstSymbol = true;

  {
    std::lock_guard<std::mutex> infoLock(mSymbolInfoMutex);
    mPatternStartTimestampMs = patternStartMs;
  }

  for (std::size_t i = 0; i < pattern.size(); ++i) {
    if (mPlaybackCancel.load(std::memory_order_acquire)) {
      break;
    }

    const int symbolValue = static_cast<int>(pattern[i]);
    const bool isDash = symbolValue == 1;
    const bool isDot = symbolValue == 0;

    if (!isDash && !isDot) {
      const double invalidGapMs = unitMs * 3.0;
      expectedOffsetMs += invalidGapMs;
      const auto gapDeadline = std::chrono::steady_clock::now() + toMicros(invalidGapMs);
      sleepUntil(gapDeadline);
      continue;
    }

    const double symbolDurationMs = unitMs * (isDash ? static_cast<double>(kDashUnits) : 1.0);
    const double expectedStartOffsetMs = expectedOffsetMs;
    const double availableGapLead = std::max(0.0, expectedStartOffsetMs - previousExpectedEndOffsetMs);
    const double maxLeadFromGap = std::max(0.0, availableGapLead - kMinDispatchOffsetMs);
    double leadCandidate = std::min(kToneStartLeadMs, expectedStartOffsetMs);
    leadCandidate = std::min(leadCandidate, maxLeadFromGap);
    const double leadMs = std::max(0.0, leadCandidate);
    const double dispatchOffsetMs = expectedStartOffsetMs - leadMs;
    const auto dispatchTime = patternStart + toMicros(dispatchOffsetMs);
    const double dispatchTimestampMs = patternStartMs + dispatchOffsetMs;
    const uint64_t upcomingSequence = mSymbolSequence + 1;
    logEvent("playMorse.dispatch",
             "sequence=%llu symbol=%c offset=%.3f lead=%.3f dispatchAt=%.3f gapLead=%.3f",
             static_cast<unsigned long long>(upcomingSequence),
             isDash ? '-' : '.',
             expectedStartOffsetMs,
             leadMs,
             dispatchTimestampMs,
             availableGapLead);
    sleepUntil(dispatchTime);

    ToneStartOptions startOptions;
    startOptions.toneHz = toneHz;
    startOptions.gain = static_cast<double>(gain);
    ToneEnvelopeOptions envelope;
    envelope.attackMs = static_cast<double>(mEnvelopeConfig.attackMs);
    envelope.releaseMs = static_cast<double>(mEnvelopeConfig.releaseMs);
    startOptions.envelope = envelope;
    startToneInternal(startOptions, false);

    const auto startedAt = std::chrono::steady_clock::now();
    const double startedAtMs = toMillis(startedAt);
    const double expectedStartMs = patternStartMs + expectedStartOffsetMs;
    const double audioStartMs = startedAtMs + leadMs;
    const double startSkewMs = audioStartMs - expectedStartMs;
    const double batchElapsedMs = audioStartMs - patternStartMs;
    const double expectedSincePriorMs =
        isFirstSymbol ? 0.0 : (expectedStartMs - previousExpectedStartMs);
    const double sincePriorMs = isFirstSymbol ? 0.0 : (audioStartMs - previousActualStartMs);
    uint64_t sequenceValue = 0;
    {
      std::lock_guard<std::mutex> infoLock(mSymbolInfoMutex);
      mSymbolSequence += 1;
      sequenceValue = mSymbolSequence;
      SymbolSnapshot snapshot;
      snapshot.sequence = sequenceValue;
      snapshot.symbol = isDash ? PlaybackSymbol::Dash : PlaybackSymbol::Dot;
      snapshot.timestampMs = audioStartMs;
      snapshot.durationMs = symbolDurationMs;
      snapshot.patternStartMs = patternStartMs;
      snapshot.expectedTimestampMs = expectedStartMs;
      snapshot.startSkewMs = startSkewMs;
      snapshot.batchElapsedMs = batchElapsedMs;
      snapshot.expectedSincePriorMs = expectedSincePriorMs;
      snapshot.sincePriorMs = sincePriorMs;
      mSymbolSnapshots.emplace_back(std::move(snapshot));
      constexpr std::size_t kMaxSnapshots = 64;
      while (mSymbolSnapshots.size() > kMaxSnapshots) {
        mSymbolSnapshots.pop_front();
      }
    }
    logEvent("playMorse.symbol.start",
             "sequence=%llu symbol=%c expected=%.3f actual=%.3f skew=%.3f batchElapsed=%.3f",
             static_cast<unsigned long long>(sequenceValue),
             isDash ? '-' : '.',
             expectedStartMs,
             audioStartMs,
             startSkewMs,
             batchElapsedMs);

    previousExpectedStartMs = expectedStartMs;
    previousActualStartMs = audioStartMs;
    isFirstSymbol = false;

    const auto symbolDeadline = startedAt + toMicros(leadMs + symbolDurationMs);
    sleepUntil(symbolDeadline);

    stopTone();

    const double expectedEndOffsetMs = expectedStartOffsetMs + symbolDurationMs;
    expectedOffsetMs += symbolDurationMs;
    if (i + 1 < pattern.size()) {
      expectedOffsetMs += unitMs * static_cast<double>(kSymbolGapUnits);
      const double gapTargetMs = patternStartMs + expectedOffsetMs;
      logEvent("playMorse.gap",
               "sequence=%llu nextOffset=%.3f gapTarget=%.3f",
               static_cast<unsigned long long>(sequenceValue),
               expectedOffsetMs,
               gapTargetMs);
    }
    previousExpectedEndOffsetMs = expectedEndOffsetMs;
  }

  stopTone();
  mPlaybackRunning.store(false, std::memory_order_release);
  const bool cancelled = mPlaybackCancel.load(std::memory_order_acquire);
  mPlaybackCancel.store(false, std::memory_order_release);
  if (cancelled) {
    resetSymbolInfo();
  }
  logEvent("playMorse.end", "cancelled=%d", cancelled ? 1 : 0);
}

std::string OutputsAudio::getLatestSymbolInfo() {
  const double fetchedAtMs =
      std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now().time_since_epoch())
          .count();
  std::lock_guard<std::mutex> lock(mSymbolInfoMutex);
  if (mSymbolSnapshots.empty()) {
    return {};
  }
  const SymbolSnapshot snapshot = mSymbolSnapshots.front();
  mSymbolSnapshots.pop_front();
  const char symbolChar = snapshot.symbol == PlaybackSymbol::Dash ? '-' : '.';
  const double ageMs = std::max(0.0, fetchedAtMs - snapshot.timestampMs);
  std::ostringstream stream;
  stream.setf(std::ios::fixed, std::ios::floatfield);
  stream << "{\"sequence\":" << snapshot.sequence
         << ",\"symbol\":\"" << symbolChar << "\""
         << ",\"timestampMs\":" << std::setprecision(3) << snapshot.timestampMs
         << ",\"durationMs\":" << std::setprecision(3) << snapshot.durationMs
         << ",\"patternStartMs\":" << std::setprecision(3) << snapshot.patternStartMs
         << ",\"expectedTimestampMs\":" << std::setprecision(3) << snapshot.expectedTimestampMs
         << ",\"startSkewMs\":" << std::setprecision(3) << snapshot.startSkewMs
         << ",\"batchElapsedMs\":" << std::setprecision(3) << snapshot.batchElapsedMs
         << ",\"expectedSincePriorMs\":" << std::setprecision(3) << snapshot.expectedSincePriorMs
         << ",\"sincePriorMs\":" << std::setprecision(3) << snapshot.sincePriorMs
         << ",\"ageMs\":" << std::setprecision(3) << ageMs
         << "}";
  logEvent("symbol.info",
           "sequence=%llu symbol=%c timestamp=%.3f duration=%.3f expected=%.3f skew=%.3f age=%.3f",
           static_cast<unsigned long long>(snapshot.sequence),
           symbolChar,
           snapshot.timestampMs,
           snapshot.durationMs,
           snapshot.expectedTimestampMs,
           snapshot.startSkewMs,
           ageMs);
  return stream.str();
}

std::string OutputsAudio::getScheduledSymbols() {
  std::lock_guard<std::mutex> lock(mScheduleMutex);
  if (mScheduledSymbols.empty()) {
    return {};
  }

  std::ostringstream stream;
  stream.setf(std::ios::fixed, std::ios::floatfield);
  stream << "[";
  for (std::size_t i = 0; i < mScheduledSymbols.size(); ++i) {
    const auto& entry = mScheduledSymbols[i];
    const char symbolChar = entry.symbol == PlaybackSymbol::Dash ? '-' : '.';
    stream << "{\"sequence\":" << entry.sequence
           << ",\"symbol\":\"" << symbolChar << "\""
           << ",\"expectedTimestampMs\":" << std::setprecision(3) << entry.expectedTimestampMs
           << ",\"offsetMs\":" << std::setprecision(3) << entry.offsetMs
           << ",\"durationMs\":" << std::setprecision(3) << entry.durationMs
           << "}";
    if (i + 1 < mScheduledSymbols.size()) {
      stream << ",";
    }
  }
  stream << "]";
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
  const bool toneActive = mToneActive.load(std::memory_order_acquire);
  bool toneStartLogged = mToneStartLogged.load(std::memory_order_relaxed);
  bool toneSteadyLogged = mToneSteadyLogged.load(std::memory_order_relaxed);
  bool toneStopLogged = mToneStopLogged.load(std::memory_order_relaxed);

  for (int32_t frame = 0; frame < numFrames; ++frame) {
    if (gain < targetGain) {
      gain = std::min(targetGain, gain + rampUp);
    } else if (gain > targetGain) {
      gain = std::max(targetGain, gain - rampDown);
    }

    if (toneActive && !toneStartLogged && gain > 0.0005f) {
      const double actualStartMs = toMillis(std::chrono::steady_clock::now());
      mToneActualStartMs.store(actualStartMs, std::memory_order_relaxed);
      mToneStartLogged.store(true, std::memory_order_relaxed);
      toneStartLogged = true;
      const double requestedMs = mToneStartRequestedMs.load(std::memory_order_relaxed);
      logEvent("tone.start.actual",
               "actual=%.3f requested=%.3f delta=%.3f",
               actualStartMs,
               requestedMs,
               actualStartMs - requestedMs);
    }

    if (toneActive && !toneSteadyLogged && std::abs(gain - targetGain) <= 0.0005f) {
      const double steadyMs = toMillis(std::chrono::steady_clock::now());
      const double actualStartMs = mToneActualStartMs.load(std::memory_order_relaxed);
      mToneSteadyLogged.store(true, std::memory_order_relaxed);
      toneSteadyLogged = true;
      logEvent("tone.gain.steady",
               "target=%.3f reachedAt=%.3f delta=%.3f",
               targetGain,
               steadyMs,
               actualStartMs > 0.0 ? (steadyMs - actualStartMs) : 0.0);
    }

    if (!toneActive && !toneStopLogged && gain <= 0.0005f && targetGain <= 0.0005f) {
      const double stopMs = toMillis(std::chrono::steady_clock::now());
      mToneStopLogged.store(true, std::memory_order_relaxed);
      toneStopLogged = true;
      logEvent("tone.stop.actual", "stoppedAt=%.3f", stopMs);
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



