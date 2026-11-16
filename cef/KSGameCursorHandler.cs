using CefSharp;
using CefSharp.Enums;
using CefSharp.Structs;

namespace KSClient.CefHost;

// Reserved for non-invasive display diagnostics. KS no longer installs a
// DisplayHandler because Chromium must handle WM_SETCURSOR and true pointer
// lock itself. Returning true after SetCursor(NULL) only hides the pointer;
// it does NOT grant real relative mouse movement or focus.
internal sealed class KSGameCursorHandler : CefSharp.Handler.DisplayHandler
{
    protected override bool OnCursorChange(IWebBrowser chromiumWebBrowser, IBrowser browser,
        IntPtr cursor, CursorType type, CursorInfo customCursorInfo)
        => false; // Always let Chromium apply the real cursor changes.
}
