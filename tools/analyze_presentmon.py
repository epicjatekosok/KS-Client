"""Summarize a local PresentMon display capture for one KS process and swapchain."""
import argparse
import csv
import math
from statistics import median
from pathlib import Path, PureWindowsPath


def summarize(stream, pid, swapchain):
    reader = csv.DictReader(stream)
    fields = set(reader.fieldnames or ())
    metric = 'DisplayedTime' if 'DisplayedTime' in fields else 'MsBetweenDisplayChange'
    required = {'Application', 'ProcessID', 'SwapChainAddress', metric}
    if not required <= fields:
        raise ValueError('Missing columns: ' + ', '.join(sorted(required - fields)))
    durations = []
    submissions = []
    submit_metric = 'FrameTime' if 'FrameTime' in fields else 'MsBetweenPresents'
    engines = {'ksclientgame.exe', 'electron.exe', 'ks.cef.client.exe', 'cefsharp.browsersubprocess.exe'}
    for row in reader:
        if row['ProcessID'] != str(pid) or row['SwapChainAddress'].lower() != swapchain.lower():
            continue
        if PureWindowsPath(row['Application']).name.lower() not in engines:
            raise ValueError('The selected process is not a KS browser executable.')
        submitted = row.get(submit_metric, '').strip()
        if submitted not in ('', 'NA', 'N/A'):
            interval = float(submitted)
            if not math.isfinite(interval) or interval < 0:
                raise ValueError('Invalid application frame interval.')
            if interval > 0:
                submissions.append(interval)
        raw = row[metric].strip()
        if raw in ('', 'NA', 'N/A') or row.get('Dropped', '').lower() in ('1', 'true'):
            continue
        duration = float(raw)
        if not math.isfinite(duration) or duration < 0:
            raise ValueError('Invalid display interval.')
        if duration > 0:
            durations.append(duration)
    if len(durations) < 2:
        raise ValueError('At least two displayed intervals from one matching swapchain are required.')
    durations.sort()
    def percentile(fraction):
        return durations[math.ceil(len(durations) * fraction) - 1]
    return dict(samples=len(durations), fps=1000 * len(durations) / sum(durations),
                p50_ms=median(durations), p95_ms=percentile(.95), p99_ms=percentile(.99),
                application_fps=1000 * len(submissions) / sum(submissions) if submissions else None)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path)
    parser.add_argument('--pid', type=int, required=True)
    parser.add_argument('--swapchain', required=True)
    args = parser.parse_args()
    try:
        with args.csv.open(encoding='utf-8-sig', newline='') as capture:
            stats = summarize(capture, args.pid, args.swapchain)
        print('{samples} displayed intervals | {fps:.1f} displayed FPS | '
              'median {p50_ms:.2f} ms | p95 {p95_ms:.2f} ms | p99 {p99_ms:.2f} ms'.format(**stats))
        rate = stats['application_fps']
        print(f'Application frame rate: {rate:.1f} FPS' if rate else 'Application frame rate unavailable')
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(1, f'{error}\n')
