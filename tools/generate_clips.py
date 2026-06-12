"""Build-time voice clip generator.

Renders every phrase the app can speak into public/clips/<id>.wav using
Kokoro TTS (local, free). Run it again whenever you change the name or the
word list. The app works without these clips (it falls back to the browser's
built-in voice), but pre-rendered clips give a warmer, identical voice every
time — which matters for predictability.

Usage:
    pip install kokoro soundfile
    python tools/generate_clips.py --name Alex --words apple ball up more

Optional: --voice af_heart (see Kokoro docs for voice ids), --speed 0.85
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "clips"

# Keep these in sync with src/engine/phrases.ts
PRAISE_LINES = {
    "praise-01": "I heard you! Wonderful!",
    "praise-02": "Yes! That was great!",
    "praise-03": "Beautiful try! I love it!",
    "praise-04": "You did it! Amazing!",
    "praise-05": "Wow, what a great sound!",
    "praise-06": "That made me so happy!",
    "praise-07": "Super! You are doing so well!",
    "praise-08": "I saw that! Fantastic!",
    "praise-09": "Yay! Great talking!",
    "praise-10": "You are awesome!",
    "praise-11": "What a wonderful try!",
    "praise-12": "I love hearing your voice!",
    "praise-13": "High five! That was great!",
    "praise-14": "So good! You did that all by yourself!",
    "praise-15": "Hooray! Lovely sound!",
    "praise-16": "That was brilliant!",
    "praise-17": "You are such a great talker!",
    "praise-18": "I am so proud of you!",
    "praise-19": "Yes yes yes! Wonderful!",
    "praise-20": "Great job! That was lovely!",
}

ENCOURAGE_LINES = {
    "encourage-01": "That is okay! I love spending time with you.",
    "encourage-02": "Great sitting with me! Let us look at another one.",
    "encourage-03": "You are doing great just being here.",
    "encourage-04": "No worries at all. Here comes a new one!",
    "encourage-05": "Thank you for listening so nicely!",
}

END_LINES = {
    "end-01": "All done! You did wonderful work today!",
    "end-02": "That was so much fun! See you next time!",
}


def slug(word: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", word.lower())


def build_phrases(name: str, words: list[str]) -> dict[str, str]:
    phrases: dict[str, str] = {}
    phrases.update(PRAISE_LINES)
    phrases.update(ENCOURAGE_LINES)
    phrases.update(END_LINES)
    for word in words:
        cap = word.capitalize()
        phrases[f"prompt-{slug(word)}"] = f"{name}, can you say {word}?"
        # The pause between repetitions is part of the modelling.
        phrases[f"model-{slug(word)}"] = f"{cap}. ... {cap}."
    return phrases


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="Alex", help="Name used in prompts")
    parser.add_argument("--words", nargs="+", default=["apple", "ball", "up", "more"])
    parser.add_argument("--voice", default="af_heart", help="Kokoro voice id")
    parser.add_argument("--speed", type=float, default=0.85, help="Slower = calmer")
    args = parser.parse_args()

    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError as exc:
        print(f"Missing dependency: {exc}. Run: pip install kokoro soundfile numpy")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pipeline = KPipeline(lang_code="a")  # American English
    phrases = build_phrases(args.name, args.words)

    for clip_id, text in phrases.items():
        out = OUT_DIR / f"{clip_id}.wav"
        print(f"  {clip_id}: {text!r}")
        chunks = [audio for _, _, audio in pipeline(text, voice=args.voice, speed=args.speed)]
        sf.write(out, np.concatenate(chunks), 24000)

    print(f"\nWrote {len(phrases)} clips to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
