"""Self-contained release gating test; no native Windows binaries are needed."""
from pathlib import Path
from tempfile import TemporaryDirectory
from hashlib import sha256
import json, subprocess, sys

original=Path(__file__).resolve().parents[1]/'ci'/'package_offline.py'
def add(path,content=b'test'):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_bytes(content)
def mark(folder,engine,filename):
 blob=(folder/filename).read_bytes()
 value={'version':'1.0.24','engine':engine,'exeName':filename,
        'exeSha256':sha256(blob).hexdigest(),'runner':'windows','result':'PASS'}
 add(folder/'ks-smoke-pass.json',json.dumps(value).encode('utf8'))
with TemporaryDirectory() as temp:
 root=Path(temp)
 add(root/'ci/package_offline.py',original.read_bytes())
 for rel in ('KS-Client.exe','Uninstall-KS-Client.exe','README_EN.md','LICENSE',
             'runtime/Electron/electron.exe','runtime/Electron/resources/app/main.cjs',
             'runtime/Electron/resources/app/preload.cjs','runtime/Electron/resources/app/game-resolution.cjs',
             'runtime/Electron/resources/app/assets/loading.html',
             'runtime/Electron/resources/app/assets/ks-logo.png',
             'runtime/Electron/resources/app/overlay/native_login_gate.js',
             'runtime/Electron/resources/app/overlay/workshop.js',
             'runtime/Electron/resources/app/overlay/integration_core.js',
             'runtime/Electron/resources/app/overlay/game_runtime.js',
             'runtime/Electron/resources/app/overlay/render_telemetry.js',
             'runtime/Electron/resources/app/overlay/integration_bootstrap.js',
             'runtime/Electron/resources/app/overlay/webgl_cosmetics.js',
             'runtime/Electron/resources/app/overlay/advanced_integration.js',
             'runtime/Electron/resources/app/overlay/freeze_guard.js',
             'runtime/Electron/resources/app/swapper.cjs', 'runtime/Electron/resources/app/overlay/game_extras.js',
             'runtime/Electron/resources/app/overlay/frame_pacer.js','runtime/Electron/resources/app/overlay/overlay.js'):
  add(root/rel)
 (root/'installer').mkdir()
 def run():
  return subprocess.run([sys.executable,str(root/'ci/package_offline.py')],
                        capture_output=True,text=True)
 assert run().returncode!=0,'missing markers must block packaging'
 mark(root/'runtime/Electron','Electron','electron.exe')
 with (root/'runtime/Electron/electron.exe').open('ab') as f:f.write(b'changed')
 assert run().returncode!=0,'modified EXE must invalidate marker'
 mark(root/'runtime/Electron','Electron','electron.exe')
 ok=run()
 assert ok.returncode==0,(ok.stdout,ok.stderr)
 assert (root/'KS-Client-beta-1.0.24-Portable.zip').is_file()
 print('PASS: release requires a matching Electron Windows smoke marker')
