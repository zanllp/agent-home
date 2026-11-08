// Interpolate only the display copy. No navigation, claims or job completion here.
export function playbackBuffer() {
  let previous,
    current,
    at = 0,
    span = 100;
  return {
    push(frame, now, changed = true) {
      previous =
        changed &&
        current &&
        !frame.paused &&
        (frame.body.moving ||
          frame.walk.mode === "turn" ||
          ["approaching", "entering", "leaving"].includes(frame.phase) ||
          (frame.phase === "active" &&
            (["draw", "play"].includes(frame.pose) || (frame.pose === "sleep" && current.gait?.sleepSide !== frame.gait?.sleepSide)))) &&
        current.jobId === frame.jobId &&
        current.phase === frame.phase &&
        Math.hypot(
          frame.body.x - current.body.x,
          frame.body.z - current.body.z
        ) < 0.4
          ? current
          : null;
      current = frame;
      span = Math.min(180, Math.max(33, now - at));
      at = now;
    },
    sample(now) {
      if (!current || now - at > 6000) return null;
      const t = Math.min(1, Math.max(0, (now - at) / span));
      if (!previous || t === 1) return current;
      const mix = (a, b) => a + (b - a) * t,
        lerpObj = (a, b, keys) => {
          const v = { ...b };
          for (const k of keys)
            if (Number.isFinite(a[k]) && Number.isFinite(b[k]))
              v[k] =
                k === "yaw"
                  ? a[k] +
                    Math.atan2(Math.sin(b[k] - a[k]), Math.cos(b[k] - a[k])) * t
                  : mix(a[k], b[k]);
          return v;
        };
      return {
        ...current,
        gait:
          previous.gait && current.gait
            ? lerpObj(previous.gait, current.gait, [
                "time",
                "weight",
                "turn",
                "poseTime",
                "sleepSide",
              ])
            : current.gait,
        walk: lerpObj(previous.walk, current.walk, [
          "x",
          "z",
          "yaw",
          "phase",
          "speed",
          "runBlend",
        ]),
        body: lerpObj(previous.body, current.body, ["x", "y", "z", "yaw"]),
        contact:
          previous.contact && current.contact
            ? lerpObj(previous.contact, current.contact, [
                "x",
                "y",
                "z",
                "yaw",
                "pitch",
                "sit",
                "sleep",
                "read",
                "draw",
                "play",
              ])
            : current.contact,
      };
    },
  };
}
