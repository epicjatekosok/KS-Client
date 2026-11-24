"""Anonymous observations of known public Kirka texture assets. No account or game API."""
from concurrent.futures import ThreadPoolExecutor
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.error import HTTPError, URLError

class DirectOnly(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def inspect(pair):
    weapon, digest = pair
    outcomes = []
    for ext in ('webp', 'png'):
        url = f'https://kirka.io/assets/img/texture.{digest}.{ext}'
        try:
            request = Request(url, headers={'Range':'bytes=0-31','User-Agent':'KS-Client-Compatibility/1.0'})
            with build_opener(DirectOnly()).open(request, timeout=5) as res:
                header = res.read(32)
            if header.startswith(b'\x89PNG\r\n\x1a\n') or header[:4]==b'RIFF' and header[8:12]==b'WEBP':
                return f'{weapon}: image bytes verified at {url}'
            outcomes.append(f'{ext}: response is not an image')
        except HTTPError as exc:
            outcomes.append(f'{ext}: HTTP {exc.code}')
        except (OSError, URLError, TimeoutError):
            outcomes.append(f'{ext}: network unavailable')
    return f'{weapon}: ' + ', '.join(outcomes)

if __name__ == '__main__':
    fingerprints={'SCAR':'b3fc7981','AR-9':'1794de31','MAC-10':'36d894bd','M60':'b658c822',
                  'Tomahawk':'397a3f05','VITA':'b2a49027','Shark':'6c8a6582','Revolver':'0bed9187',
                  'Bayonet':'76c24e59','LAR':'d97db214','Weatie':'212a85fe'}
    print('Public asset observations only. Match rendering requires an in-game check.')
    with ThreadPoolExecutor(max_workers=3) as workers:
        for observation in workers.map(inspect, fingerprints.items()):
            print(observation)
