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
    internal const string Game = "https://kirka.io/";
    // Only the fixed game URL is passed to the system browser. Never transfer
    // OAuth tokens, authorization codes or browser cookies across profiles.
    internal static bool OpenGameSignIn()
    {
        try {
            using var p=Process.Start(new ProcessStartInfo {FileName=Game,UseShellExecute=true});
            if(p is null){Program.Log("External Kirka browser returned no process");return false;}
            Program.Log("User opened Kirka in default browser for account sign-in");
            return true;
        }catch(Exception ex){Program.Log("External Kirka browser failed: "+ex.Message);return false;}
    }


    internal static bool IsDiscordTarget(string? value)
    {
        if(!Uri.TryCreate(value,UriKind.Absolute,out var uri) ||
           !uri.Scheme.Equals(Uri.UriSchemeHttps,StringComparison.OrdinalIgnoreCase))return false;
        return uri.Host.ToLowerInvariant() is "discord.gg" or "discord.com"
            or "www.discord.com" or "discordapp.com" or "www.discordapp.com";
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
    private readonly Action requestGoogleHelp;
    internal ClientCommunityPopupHandler(Action requestGoogleHelp)
        => this.requestGoogleHelp=requestGoogleHelp;
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
        // Google explicitly prohibits account login in CEF. Prompt for the
        // real Windows browser; do not open a Google credential form inside KS.
        // Existing third-party providers retain native opener/popup behavior.
        bool trusted=ClientForm.Trust(chromiumWebBrowser.Address,gameOnly:true) ||
            (browser.IsPopup && ClientAuthentication.IsAllowed(frame.Url,allowBlank:true));
        if(trusted && ClientAuthentication.IsGoogleSignIn(targetUrl)){
            Program.Log("CEF Google embedded popup blocked (provider policy)");
            requestGoogleHelp();
            return true;
        }
        // Kirka's OAuth providers need a real popup with window.opener intact.
        // Non-HTTPS/unrecognized destinations stay blocked.
        // A provider may create a temporary about:blank document and navigate
        // it only after the user selects an account. Popups are created solely
        // from the trusted Kirka browser by this lifetime handler.
        bool trustedOpener=ClientForm.Trust(frame.Url,gameOnly:true) ||
            (browser.IsPopup && (ClientAuthentication.IsAllowed(frame.Url,allowBlank:true)));
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
