"""Compare native presentation and displayed intervals for one KS swap chain."""
import argparse
import csv
import json
import math
from pathlib import Path, PureWindowsPath
from statistics import median, fmean, pstdev

ENGINES = {'ksclientgame.exe', 'electron.exe'}
MISSING = {'', 'NA', 'N/A'}


def interval(row, name):
    raw = (row.get(name) or '').strip()
    if raw in MISSING:
        return None
    value = float(raw)
    if not math.isfinite(value) or value < 0:
        raise ValueError(f'Invalid {name} interval')
    return value if value > 0 else None


def summarize(stream, pid, swapchain):
    reader = csv.DictReader(stream)
    columns = set(reader.fieldnames or ())
    if not {'Application', 'ProcessID', 'SwapChainAddress'} <= columns:
        raise ValueError('Missing process or swap chain columns')
    display = 'DisplayedTime' if 'DisplayedTime' in columns else 'MsBetweenDisplayChange'
    presented, displayed = [], []
    dropped = 0 if 'Dropped' in columns else None
    matched = 0
    for row in reader:
        if row['ProcessID'] != str(pid) or row['SwapChainAddress'].lower() != swapchain.lower():
            continue
        if PureWindowsPath(row['Application']).name.lower() not in ENGINES:
            raise ValueError('Select the KS Electron process')
        matched += 1
        dt = interval(row, 'MsBetweenPresents')
        if dt is not None:
            presented.append(dt)
        if (row.get('Dropped') or '').lower() in ('1', 'true'):
            dropped += 1
            continue
        dt = interval(row, display)
        if dt is not None:
            displayed.append(dt)
    if not matched:
        raise ValueError('No rows match this process and swap chain')
    ordered = sorted(displayed)
    def percentile(p):
        return ordered[math.ceil(p * len(ordered))-1] if ordered else None
    def low(p):
        size = math.ceil(len(ordered)*p)
        return 1000 / fmean(ordered[-size:]) if len(ordered)*p >= 1 else None
    mid = median(ordered) if ordered else None
    return dict(samples=len(ordered), fps=1000/fmean(ordered) if ordered else None,
                application_fps=1000/fmean(presented) if presented else None,
                mean_ms=fmean(ordered) if ordered else None, p50_ms=mid,
                p95_ms=percentile(.95), p99_ms=percentile(.99),
                displayed_1pct_low_fps=low(.01), displayed_01pct_low_fps=low(.001),
                stddev_ms=pstdev(ordered) if ordered else None,
                long_intervals=sum(v > 1.5*mid for v in ordered) if ordered else None,
                dropped=dropped)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path)
    parser.add_argument('--pid', type=int)
    parser.add_argument('--swapchain')
    parser.add_argument('--all-chains', action='store_true', help='Summarize each KS process and swap chain separately')
    args = parser.parse_args()
    try:
        with args.csv.open(encoding='utf-8-sig', newline='') as capture:
            if args.pid is None and args.swapchain is None:
                groups = {}
                for row in csv.DictReader(capture):
                    if PureWindowsPath(row['Application']).name.lower() in ENGINES:
                        key=(row['ProcessID'],row['SwapChainAddress'])
                        groups[key]=groups.get(key,0)+1
                if not groups and args.all_chains:
                    print('No KS swap chain observed; native FPS unavailable')
                for (pid, chain), rows in groups.items():
                    if args.all_chains:
                        capture.seek(0)
                        print(json.dumps(dict(process=pid, swapchain=chain, **summarize(capture,pid,chain)), allow_nan=False))
                        continue
                    print(f'--pid {pid} --swapchain {chain}   ({rows} capture rows)')
            elif args.pid is None or args.swapchain is None:
                parser.error('Select both --pid and --swapchain')
            else:
                print(json.dumps(summarize(capture,args.pid,args.swapchain),indent=2,allow_nan=False))
    except (OSError, ValueError, KeyError, csv.Error) as error:
        parser.exit(1,f'{error}\n')
