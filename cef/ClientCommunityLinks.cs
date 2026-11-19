using System.Diagnostics;

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
