using CefSharp;
using System.Diagnostics;
using System.Threading.Tasks;

namespace KSClient.CefHost;

// Only the immutable, user-requested KS Discord invite ever leaves the client.
// A navigation/pop-up target may identify Discord, but never supplies a URL to
// Process.Start. UseShellExecute=true delegates HTTPS to Windows' configured
// default browser (starting it even when no browser window is currently open).
internal static class ClientCommunityLinks
{
    internal const string Invite = "https://discord.gg/cxP386yGjk";
    internal static bool IsDiscordTarget(string? value)
    {
        if(!Uri.TryCreate(value,UriKind.Absolute,out var uri) ||
           !uri.Scheme.Equals(Uri.UriSchemeHttps,StringComparison.OrdinalIgnoreCase))return false;
        // A Discord OAuth page is NOT a community invitation. Previously every
        // discord.com URL was redirected to KS's community invite, preventing
        // Kirka's own Discord login popup from completing.
        var host=uri.IdnHost.ToLowerInvariant();
        var path=uri.AbsolutePath;
        if(host=="discord.gg")return path.Length>1 && path.Trim('/').IndexOf('/')<0;
        return (host is "discord.com" or "www.discord.com" or "discordapp.com" or "www.discordapp.com") &&
            (path.StartsWith("/invite/",StringComparison.OrdinalIgnoreCase) ||
             path.StartsWith("/channels/",StringComparison.OrdinalIgnoreCase));
    }

    internal static bool OpenInvite()
    {
        try {
            var p=Process.Start(new ProcessStartInfo {FileName=Invite,UseShellExecute=true});
            if(p is null){Program.Log("KS Discord: Windows returned no default browser process");return false;}
            p.Dispose();
            return true;
        }catch(Exception ex){Program.Log("KS Discord default browser failed: "+ex.Message);return false;}
    }
}

internal sealed class ClientCommunityPopupHandler : CefSharp.Handler.LifeSpanHandler
{
    protected override bool OnBeforePopup(
        IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame,
        string targetUrl,string targetFrameName,WindowOpenDisposition targetDisposition,
        bool userGesture,IPopupFeatures popupFeatures,IWindowInfo windowInfo,
        IBrowserSettings browserSettings,ref bool noJavascriptAccess,out IWebBrowser newBrowser)
    {
        newBrowser=null!;
        // Game clicks may open in a popup instead of navigating the main frame.
        // Never trust arbitrary popup URLs, browser redirects or unsolicited JS.
        if(userGesture && ClientForm.Trust(chromiumWebBrowser.Address,gameOnly:true)
            && ClientCommunityLinks.IsDiscordTarget(targetUrl))
        {
            _=Task.Run(()=>ClientCommunityLinks.OpenInvite());
            return true;
        }
        // Keep account popups inside the persistent CEF profile. Google's own
        // OAuth page may reject an embedded user agent; never spoof the browser
        // or redirect the user to a separate game running in Windows Chrome.
        if(ClientAuthentication.IsGoogleSignIn(targetUrl))
            Program.Log("CEF provider popup: Google may reject embedded user agents");
        // Kirka's OAuth providers need a real popup with window.opener intact.
        // Non-HTTPS/unrecognized destinations stay blocked.
        // A provider may create a temporary about:blank document and navigate
        // it only after the user selects an account. Popups are created solely
        // from the trusted Kirka browser by this lifetime handler.
        bool trustedOpener=ClientForm.Trust(frame.Url,gameOnly:true) ||
            (browser.IsPopup && ClientAuthentication.IsAllowed(frame.Url,allowBlank:true)) ||
            // Kirka may navigate its MAIN frame to the Google/other provider,
            // whose account picker can then create a secondary OAuth popup.
            // Only allow this when Kirka previously initiated a trusted
            // top-level HTTPS provider navigation in this exact CEF browser.
            (!browser.IsPopup && ClientAuthentication.HasMainFrameAuthChain(browser) &&
             ClientAuthentication.IsAllowed(frame.Url));
        if(trustedOpener && ClientAuthentication.IsAllowed(targetUrl,allowBlank:userGesture))
        {
            noJavascriptAccess=false; // Required for OAuth popup result -> opener.
            Program.Log("CEF allowed trusted OAuth popup");
            return false;
        }
        Program.Log("CEF blocked non-authentication popup");
        return true;
    }
}
