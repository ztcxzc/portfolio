#!/usr/bin/env python3
"""
ADB MJPEG bridge for ADB Device Monitor.
Spawns: adb screenrecord (H264) | ffmpeg -> MJPEG frames -> stdout

Usage: python3 mjpeg_bridge.py <adb_path> <ffmpeg_path> <device_serial>

The parent Node.js process reads concatenated JPEG frames (FF D8 ... FF D9)
from this process's stdout and decodes them.
"""
import subprocess
import sys
import signal
import time

ADB    = sys.argv[1]
FFMPEG = sys.argv[2]
DEVICE = sys.argv[3]

signal.signal(signal.SIGPIPE, signal.SIG_DFL)
signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))
signal.signal(signal.SIGINT,  lambda *a: sys.exit(0))

out = sys.stdout.buffer


def run():
    adb = subprocess.Popen(
        [ADB, '-s', DEVICE, 'exec-out',
         'screenrecord', '--output-format=h264', '--bit-rate=2000000', '/dev/stdout'],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL)

    ffmpeg = subprocess.Popen(
        [FFMPEG, '-loglevel', 'quiet',
         '-probesize', '100000',         # 100 KB (default is 5 MB — causes 25s delay)
         '-analyzeduration', '100000',   # 100 ms
         '-f', 'h264',
         '-i', 'pipe:0',
         '-f', 'image2pipe',
         '-vcodec', 'mjpeg',
         '-q:v', '5',
         'pipe:1'],
        stdin=adb.stdout,               # OS-level fd hand-off — no Node stream in middle
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL)
    adb.stdout.close()                  # give ownership to ffmpeg

    try:
        while True:
            # read1() issues exactly ONE os.read() syscall:
            # blocks until ANY bytes arrive, returns immediately without
            # waiting to fill a buffer — delivers each chunk as soon as produced
            chunk = ffmpeg.stdout.read1(65536)
            if not chunk:
                break
            out.write(chunk)
            out.flush()
    except (BrokenPipeError, IOError):
        pass
    finally:
        try:
            ffmpeg.kill()
        except Exception:
            pass
        try:
            adb.kill()
        except Exception:
            pass


# screenrecord has a 3-minute hard limit — loop forever with auto-restart
while True:
    run()
    time.sleep(0.3)
