using System;

namespace KSClient.CefHost;

// Keep OAuth inside the browser profile so the identity provider can return
// its result to Kirka's original window. Never load local files or arbitrary
// external pages through a Kirka popup.
internal static class ClientAuthentication
{
    private static readonly HashSet<string> Hosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "accounts.google.com", "consent.google.com", "myaccount.google.com",
        "facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com",
        "appleid.apple.com", "idmsa.apple.com",
        "login.microsoftonline.com", "login.live.com", "account.live.com",
        "github.com", "www.github.com", "discord.com", "www.discord.com",
        "twitter.com", "www.twitter.com", "x.com", "www.x.com",
        "api.twitter.com", "id.twitch.tv", "www.twitch.tv",
        "steamcommunity.com", "store.steampowered.com",
        "auth.kirka.io", "accounts.kirka.io"
    };
    private static readonly string[] Suffixes =
    {
        ".firebaseapp.com", ".auth0.com", ".supabase.co", ".web3auth.io"
    };

    internal static bool IsAllowed(string? target, bool allowBlank = false)
    {
        if(allowBlank && (string.IsNullOrWhiteSpace(target) ||
             string.Equals(target, "about:blank", StringComparison.OrdinalIgnoreCase))) return true;
        if(!Uri.TryCreate(target,UriKind.Absolute,out var uri) ||
           !string.Equals(uri.Scheme,Uri.UriSchemeHttps,StringComparison.OrdinalIgnoreCase) ||
           uri.Port!=443 || uri.UserInfo.Length!=0) return false;
        if(ClientForm.Trust(uri.AbsoluteUri,gameOnly:true)) return true;
        var host=uri.IdnHost;
        return Hosts.Contains(host) || Suffixes.Any(s=>host.EndsWith(s,StringComparison.OrdinalIgnoreCase));
    }
}
