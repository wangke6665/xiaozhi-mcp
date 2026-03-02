#!/usr/bin/env python3
from faster_whisper import WhisperModel
import sys

model = WhisperModel("base", device="cpu", compute_type="int8")

audio_file = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read().strip()

segments, info = model.transcribe(audio_file, language="zh")

print("Language detected:", info.language)
print("--------")
for segment in segments:
    print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))