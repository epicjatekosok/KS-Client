using CefSharp;
using CefSharp.Enums;
using CefSharp.Structs;
using System.Runtime.InteropServices;

namespace KSClient.CefHost;

/// <summary>
/// Let Chromium handle genuine mouse capture and relative mouse movement.
/// After the actual DOM pointerlockchange event reports success, stop native
/// Chromium cursor updates that otherwise leave the OS arrow visible.
/// Never fake movement, capture outside the browser or hide the cursor on a
/// mere game URL / untrusted synthetic event.
/// </summary>
internal sealed class KSGameCursorHandler : CefSharp.Handler.DisplayHandler
{
    private readonly Func<bool> locked;
    internal KSGameCursorHandler(Func<bool> locked) => this.locked = locked;

    protected override bool OnCursorChange(IWebBrowser chromiumWebBrowser,
        IBrowser browser, IntPtr cursor, CursorType type, CursorInfo customCursorInfo)
    {
        if (!locked()) return false;
        // CEF display callbacks run on the CEF UI thread; no WinForms controls
        // are accessed here. A real pointerlockchange unlock restores defaults.
        NativeCursor.SetCursor(IntPtr.Zero);
        return true;
    }
}

internal static class NativeCursor
{
    [DllImport("user32.dll", ExactSpelling=true)]
    internal static extern IntPtr SetCursor(IntPtr cursor);

    [DllImport("user32.dll", ExactSpelling=true)]
    internal static extern IntPtr SetFocus(IntPtr hwnd);
}
