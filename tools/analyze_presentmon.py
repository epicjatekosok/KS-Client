"""Summarize a local PresentMon display capture for one KS process and swapchain."""
import argparse
import csv
import math
from pathlib import Path, PureWindowsPath


def summarize(stream, pid, swapchain):
    reader = csv.DictReader(stream)
    fields = set(reader.fieldnames or ())
    metric = 'DisplayedTime' if 'DisplayedTime' in fields else 'MsBetweenDisplayChange'
    required = {'Application', 'ProcessID', 'SwapChainAddress', metric}
    if not required <= fields:
        raise ValueError('Missing columns: ' + ', '.join(sorted(required - fields)))
    durations = []
    engines = {'electron.exe', 'ks.cef.client.exe', 'cefsharp.browsersubprocess.exe'}
    for row in reader:
        if row['ProcessID'] != str(pid) or row['SwapChainAddress'].lower() != swapchain.lower():
            continue
        if PureWindowsPath(row['Application']).name.lower() not in engines:
            raise ValueError('The selected process is not a KS browser executable.')
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
                p95_ms=percentile(.95), p99_ms=percentile(.99))


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
              'p95 {p95_ms:.2f} ms | p99 {p99_ms:.2f} ms'.format(**stats))
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(1, f'{error}\n')
