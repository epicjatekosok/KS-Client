#!/usr/bin/env python3
"""Build a PE/COFF .syso embedding RT_ICON/RT_GROUP_ICON/RT_VERSION.
Uses only Python and Pillow; no external Windows SDK required.
The resulting .syso is understood by Go's Windows linker.
"""
from pathlib import Path
import sys
from PIL import Image
import io, struct

root=Path(__file__).resolve().parents[1]
variant=sys.argv[1] if len(sys.argv)>1 else 'launcher'
assert variant in ('launcher','installer','uninstaller','engine-setup')
targetName={'launcher':'KS-Client.exe','installer':'KS-Client-alpha-1.1.10-Setup.exe','uninstaller':'Uninstall-KS-Client.exe','engine-setup':'KS-Engine-Setup.exe'}[variant]
desc={'launcher':'KS Client Launcher','installer':'KS Client Setup','uninstaller':'KS Client Uninstaller','engine-setup':'KS Client Browser Engine Setup'}[variant]
image=Image.open(root/'resources'/'ks-logo.png').convert('RGBA')
image.save(root/'resources'/'ks-logo.ico', format='ICO', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
ico=(root/'resources'/'ks-logo.ico').read_bytes()
reserved,typ,count=struct.unpack_from('<HHH',ico)
assert reserved==0 and typ==1 and count>0
icons=[]; groups=[]
for n in range(count):
  w,h,c,res,planes,bits,length,offset=struct.unpack_from('<BBBBHHII',ico,6+16*n)
  chunk=ico[offset:offset+length]
  assert len(chunk)==length
  icons.append(chunk)
  groups.append(struct.pack('<BBBBHHIH',w,h,c,res,planes,bits,length,n+1))
group=struct.pack('<HHH',0,1,count)+b''.join(groups)

# VERSIONINFO displayed by Explorer: KS Client, alpha 1.1.10.
def wstr(s):return s.encode('utf-16le')+b'\0\0'
def align4(b):return b+b'\0'*((-len(b))%4)
def vblock(key,value=b'',children=(),text=False):
  start=struct.pack('<HHH',0,(len(value)//2 if text else len(value)),1 if text else 0)+wstr(key)
  start=align4(start)+value
  start=align4(start)+b''.join(children)
  return struct.pack('<H',len(start))+start[2:]
fileinfo=struct.pack('<13I', 0xFEEF04BD,0x00010000,0x00010001,0x00070000,0x00010001,0x00070000,0x3f,0,0x40004,1,0,0,0)
strings={'CompanyName':'KS Client', 'FileDescription':desc, 'FileVersion':'1.1.10.0', 'InternalName':'KS Client', 'OriginalFilename':targetName, 'ProductName':'KS Client', 'ProductVersion':'alpha 1.1.10', 'LegalCopyright':'Unofficial Kirka.io client'}
stri=vblock('StringFileInfo',children=[vblock('040904B0',children=[vblock(k,wstr(v),text=True) for k,v in strings.items()])])
trans=vblock('VarFileInfo',children=[vblock('Translation',struct.pack('<HH',0x409,1200))])
version=vblock('VS_VERSION_INFO',fileinfo,[stri,trans])

# Top-> type -> ID -> lang -> leaf
resources={3:{i+1:{0x409:data} for i,data in enumerate(icons)},14:{1:{0x409:group}},16:{1:{0x409:version}}}
tree=bytearray(); reloc=[]; payload=bytearray()

def align_tree():
  while len(tree)%4:tree.append(0)
def put_dir(entries):
  align_tree(); off=len(tree)
  tree.extend(struct.pack('<IIHHHH',0,0,0,0,0,len(entries)))
  tree.extend(b'\0'*(len(entries)*8))
  for idx,(key,child) in enumerate(sorted(entries.items())):
    if isinstance(child,dict):
      ptr=put_dir(child)|0x80000000
    else:
      align_tree();ptr=len(tree)
      while len(payload)%4:payload.append(0)
      datoff=len(payload);payload.extend(child)
      tree.extend(struct.pack('<IIII',datoff,len(child),1200,0))
      reloc.append(ptr)
    struct.pack_into('<II',tree,off+16+idx*8,key,ptr)
  return off
# Replace deliberate no-op expression in source with plain value for readability.
put_dir(resources)

# Two sections (.rsrc$01 directory tree, .rsrc$02 data). The linker adds
# the appropriate RVA to every IMAGE_REL_AMD64_ADDR32NB relocation.
sec1=bytes(tree); sec2=bytes(payload)
num_rel=len(reloc)
coffhdr_size=20+2*40
raw1=coffhdr_size
rel1=raw1+len(sec1)
raw2=rel1+10*num_rel
symboloff=raw2+len(sec2)
# symbol offsets: 0 (.rsrc$01), 2 (.rsrc$02), 4 ($R000000)
sec_sym=4
headers=[
  struct.pack('<8sIIIIIIHHI',b'.rsrc$01',0,0,len(sec1),raw1,rel1,0,num_rel,0,0x40000040),
  struct.pack('<8sIIIIIIHHI',b'.rsrc$02',0,0,len(sec2),raw2,0,0,0,0,0x40000040)
]
recs=b''.join(struct.pack('<IIH',n,sec_sym,0x0003) for n in reloc)
def sym(name,val,section,aux=0):
  return struct.pack('<8sIhHBB',name.encode('ascii').ljust(8,b'\0'),val,section,0,3,aux)
def aux_sym(length,nrel):
  return struct.pack('<IHHLhBBH',length,nrel,0,0,0,0,0,0)
syms=b''.join([
  sym('.rsrc$01',0,1,1),aux_sym(len(sec1),num_rel),
  sym('.rsrc$02',0,2,1),aux_sym(len(sec2),0),
  sym('$R000000',0,2,0)
])
header=struct.pack('<HHIIIHH',0x8664,2,0,symboloff,5,0,0)
blob=header+b''.join(headers)+sec1+recs+sec2+syms+struct.pack('<I',4)
out=root/variant/'ks_icon_windows_amd64.syso';out.write_bytes(blob)
print(f'Created {out.name}: {len(blob)} bytes, {count} icon sizes, {num_rel} relocations, Explorer icon and version resource')
