#pragma once

#include <cstdint>
#include <atomic>
#include <memory>
#include <mutex>
#include <optional>
#include <thread>
#include <string>
#include <vector>

#include <oboe/Oboe.h>

#include "HybridOutputsAudioSpec.hpp"
#include "ToneStartOptions.hpp"
#include "PlaybackRequest.hpp"
#include "ToneEnvelopeOptions.hpp"
#include "PlaybackSymbol.hpp"

namespace margelo::nitro::morse {

class OutputsAudio final : public HybridOutputsAudioSpec,
                           public oboe::AudioStreamCallback {
 public:
  OutputsAudio();
  ~OutputsAudio() override;

  bool isSupported() override;
  void warmup(const ToneStartOptions& options) override;
  void startTone(const ToneStartOptions& options) override;
  void stopTone() override;
  void playMorse(const PlaybackRequest& request) override;
  std::string getLatestSymbolInfo() override;
  void teardown() override;

  oboe::DataCallbackResult onAudioReady(oboe::AudioStream* stream,
                                        void* audioData,
                                        int32_t numFrames) override;
  void onErrorAfterClose(oboe::AudioStream* stream, oboe::Result error) override;

 private:
  struct EnvelopeConfig {
    float attackMs;
    float releaseMs;
  };

  struct StreamDeleter {
    void operator()(oboe::AudioStream* stream) const;
  };
  using StreamPtr = std::unique_ptr<oboe::AudioStream, StreamDeleter>;

  void ensureStreamLocked(double toneHz);
  void startStreamLocked();
  void closeStreamLocked();
  void startToneInternal(const ToneStartOptions& options, bool cancelPlayback);
  float resolveGain(const std::optional<double>& gainOpt) const;
  EnvelopeConfig resolveEnvelope(const std::optional<ToneEnvelopeOptions>& envelopeOpt) const;
  float computeRampStep(float magnitude, float durationMs) const;
  void cancelPlaybackThread(bool join);
  void resetSymbolInfo();
  void runPattern(std::vector<PlaybackSymbol> pattern,
                  double toneHz,
                  float gain,
                  double unitMs);
  void logEvent(const char* event, const char* fmt = nullptr, ...) const;

  std::mutex mStreamMutex;
  StreamPtr mStream;
  double mSampleRate;
  std::atomic<double> mFrequency;
  std::atomic<float> mTargetGain;
  std::atomic<float> mCurrentGain;
  std::atomic<float> mGainStepUp;
  std::atomic<float> mGainStepDown;
  std::atomic<bool> mStreamReady;
  std::atomic<bool> mSupportKnown;
  bool mSupported;
  EnvelopeConfig mEnvelopeConfig;
  double mPhase;

  std::mutex mSymbolInfoMutex;
  uint64_t mSymbolSequence;
  uint64_t mSymbolSequenceConsumed;
  PlaybackSymbol mLatestSymbolKind;
  double mLatestSymbolTimestampMs;
  double mLatestSymbolDurationMs;
  std::thread mPlaybackThread;
  std::mutex mPlaybackMutex;
  std::atomic<bool> mPlaybackCancel;
  std::atomic<bool> mPlaybackRunning;
};

} // namespace margelo::nitro::morse
