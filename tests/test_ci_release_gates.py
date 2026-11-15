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
 value={'version':'1.1.7','engine':engine,'exeName':filename,
        'exeSha256':sha256(blob).hexdigest(),'runner':'windows','result':'PASS'}
 add(folder/'ks-smoke-pass.json',json.dumps(value).encode('utf8'))
with TemporaryDirectory() as temp:
 root=Path(temp)
 add(root/'ci/package_offline.py',original.read_bytes())
 for rel in ('KS-Client.exe','Uninstall-KS-Client.exe','README_EN.md','LICENSE',
             'runtime/Electron/electron.exe','runtime/Electron/resources/app/main.cjs',
             'runtime/Electron/resources/app/preload.cjs',
             'runtime/CEF/KS.Cef.Client.exe','runtime/CEF/libcef.dll',
             'runtime/CEF/CefSharp.dll','runtime/CEF/CefSharp.BrowserSubprocess.exe',
             'runtime/CEF/dotnet/dotnet.exe'):
  add(root/rel)
 for framework in ('Microsoft.NETCore.App','Microsoft.WindowsDesktop.App'):
  (root/'runtime/CEF/dotnet/shared'/framework/'10.0.0').mkdir(parents=True)
 (root/'installer').mkdir()
 def run():
  return subprocess.run([sys.executable,str(root/'ci/package_offline.py')],
                        capture_output=True,text=True)
 assert run().returncode!=0,'missing markers must block packaging'
 mark(root/'runtime/Electron','Electron','electron.exe')
 assert run().returncode!=0,'missing CEF marker must block packaging'
 mark(root/'runtime/CEF','CEF','KS.Cef.Client.exe')
 with (root/'runtime/CEF/KS.Cef.Client.exe').open('ab') as f:f.write(b'changed')
 assert run().returncode!=0,'modified EXE must invalidate marker'
 mark(root/'runtime/CEF','CEF','KS.Cef.Client.exe')
 ok=run()
 assert ok.returncode==0,(ok.stdout,ok.stderr)
 assert (root/'KS-Client-alpha-1.1.7-Portable.zip').is_file()
 print('PASS: release requires both current Windows smoke markers')
