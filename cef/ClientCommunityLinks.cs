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

    internal const string PublicReleases="https://github.com/epicjatekosok/KS-Client-Updates/releases";

    private static bool OpenFixedHttps(string address,string label)
    {
        // Call this only with a constant owned by KS Client. No renderer-provided
        // URL, OAuth token or auth callback may be passed into Process.Start.
        try
        {
            using var process=Process.Start(new ProcessStartInfo {
                FileName=address, UseShellExecute=true, Verb="open"
            });
            if(process is null) {
                Program.Log(label+": Windows did not return a browser process");
                return false;
            }
            Program.Log(label+": default browser launch requested");
            return true;
        }
        catch(Exception ex)
        {
            Program.Log(label+": could not open default browser: "+ex.Message);
            return false;
        }
    }
    internal static bool OpenInvite()=>OpenFixedHttps(Invite,"KS Discord");
    internal static bool OpenPublicReleases()=>OpenFixedHttps(PublicReleases,"KS Releases");
}
