# Third-party notices

The KS Client source uses the MIT license in [LICENSE](LICENSE). Components used alongside KS Client have their own terms.

| Component | Use and license |
| --- | --- |
| Electron 45.3.2 and bundled Chromium, Node.js and runtime dependencies | The official Windows x64 distribution is fetched during the build and retained in Windows downloads. See [Electron's MIT license](https://github.com/electron/electron/blob/v45.3.2/LICENSE) and the full `runtime/Electron/LICENSE` and `runtime/Electron/LICENSES.chromium.html` files installed with the client. |
| Go runtime and standard library | The Windows launcher, installer and uninstaller incorporate portions of Go. The Go license is reproduced below. |
| Pillow, Playwright, and Gitleaks | Developer build, test and source-verification tools downloaded separately. See [Pillow terms](https://github.com/python-pillow/Pillow/blob/main/LICENSE), [Playwright Python terms](https://github.com/microsoft/playwright-python/blob/main/LICENSE), and [Gitleaks MIT terms](https://github.com/gitleaks/gitleaks/blob/v8.24.3/LICENSE). |
| Kirka.io, Discord and the public data providers | Kirka.io game content is loaded from the service. Public statistics and price data are fetched from KirkaStats, KirkaHub, KirkaTrades and Kirka.io. Those services and their data retain their own terms. |

The project documentation refers to Dawn, Redline, Helium and Celeste as design references. The KS Client license grants rights only to KS Client material covered by it. See each referenced project's own terms for its material.

## Go license

```text
Copyright (c) 2009 The Go Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```


## NVIDIA NVAPI

The optional Windows frame-rate helper links the official NVIDIA x64 NVAPI library. The client only edits the dedicated KS Client application setting. SDK revision `51e5aae4bc40c3ccd3fb7d4dfd94256e7bfc496e`.

nvapi.lib, nvapi64.lib, nvapia64.lib and nvapia64ec.lib are licensed under the following terms:

SPDX-FileCopyrightText: Copyright (c) 2024 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
SPDX-License-Identifier: MIT

Permission is hereby granted, free of charge, to any person obtaining a 
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

