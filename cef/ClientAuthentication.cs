using System;
using System.Collections.Concurrent;
using CefSharp;

namespace KSClient.CefHost;

// Keep OAuth inside the browser profile so the identity provider can return
// its result to Kirka's original window. Never load local files or arbitrary
// external pages through a Kirka popup.
internal static class ClientAuthentication
{
    // Tracks only whether an approved Kirka-originated top-level provider flow
    // is active; never stores OAuth URLs, credentials or provider cookies.
    // Indexed by native CEF browser identity so unrelated pages cannot
    // authorize popups from a different game browser.
    private static readonly ConcurrentDictionary<int, byte> MainFrameAuthChains = new();
    internal static void SetMainFrameAuthChain(IBrowser browser, bool active)
    {
        if(active)MainFrameAuthChains[browser.Identifier]=1;
        else MainFrameAuthChains.TryRemove(browser.Identifier,out _);
    }
    internal static bool HasMainFrameAuthChain(IBrowser browser)
        => MainFrameAuthChains.ContainsKey(browser.Identifier);
    private static readonly HashSet<string> Hosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "accounts.google.com", "consent.google.com", "myaccount.google.com",
        "gsi.google.com", "oauth2.googleapis.com", "accounts.youtube.com",
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
        ".firebaseapp.com", ".web.app", ".auth0.com", ".supabase.co", ".web3auth.io", ".kirka.io"
    };

    // Google (including Gmail/YouTube accounts) can reject embedded OAuth
    // user agents even when Kirka creates a native popup. Do not spoof the
    // user-agent or export provider cookies/tokens; leave provider policy intact.
    private static readonly HashSet<string> GoogleHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "accounts.google.com","consent.google.com","gsi.google.com",
        "myaccount.google.com","oauth2.googleapis.com","accounts.youtube.com"
    };
    internal static bool IsGoogleSignIn(string? target)
    {
        if(!Uri.TryCreate(target,UriKind.Absolute,out var uri) ||
           uri.Scheme!=Uri.UriSchemeHttps || uri.Port!=443 ||
           uri.UserInfo.Length!=0)return false;
        return GoogleHosts.Contains(uri.IdnHost);
    }

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
