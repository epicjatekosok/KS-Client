using CefSharp;
using System.Text.Json;
namespace KSClient.CefHost;

// Local, explicit /assets replacement only. Game logic, scripts, API and
// account requests are NEVER intercepted.
internal static class KSResourceSwap
{
    private static readonly string Settings=Path.Combine(Program.Root,"resource-swap.json");
    private static readonly string Assets=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"KSClient","Swapper","assets");
    private static readonly Dictionary<string,string> Mime=new(StringComparer.OrdinalIgnoreCase){
      [".png"]="image/png",[".jpg"]="image/jpeg",[".jpeg"]="image/jpeg",[".webp"]="image/webp",
      [".gif"]="image/gif",[".svg"]="image/svg+xml",[".woff"]="font/woff",[".woff2"]="font/woff2",[".ttf"]="font/ttf",[".otf"]="font/otf",[".mp3"]="audio/mpeg",
      [".wav"]="audio/wav",[".ogg"]="audio/ogg",[".css"]="text/css"
    };
    private static readonly Dictionary<string,string[]> Types=new(StringComparer.Ordinal){
      ["img"]=new[]{".png",".jpg",".jpeg",".webp",".gif",".svg"},
      ["textures"]=new[]{".png",".jpg",".jpeg",".webp",".gif"},
      ["skins"]=new[]{".png",".jpg",".jpeg",".webp"},
      ["ui"]=new[]{".png",".jpg",".jpeg",".webp",".gif",".svg"},
      ["audio"]=new[]{".mp3",".wav",".ogg"},
      ["fonts"]=new[]{".woff",".woff2",".ttf",".otf"},
      ["media"]=new[]{".mp3",".wav",".ogg"},
      ["css"]=new[]{".css"}
    };
    private static readonly object settingsLock=new();
    private static long readAfter, served, unmatched;
    private static bool cachedEnabled;
    internal static bool Enabled()
    {
        lock(settingsLock){
            if(Environment.TickCount64<readAfter)return cachedEnabled;
            try{
                using var doc=JsonDocument.Parse(File.ReadAllText(Settings));
                cachedEnabled=doc.RootElement.TryGetProperty("enabled",out var state)&&state.ValueKind==JsonValueKind.True;
            }catch{cachedEnabled=false;}
            readAfter=Environment.TickCount64+1000;
            return cachedEnabled;
        }
    }
    internal static void SetEnabled(bool enabled)
    {
        lock(settingsLock){
            Directory.CreateDirectory(Program.Root);
            File.WriteAllText(Settings,JsonSerializer.Serialize(new{enabled}));
            readAfter=0;
        }
    }
    internal static void Served()=>Interlocked.Increment(ref served);
    internal static string Folder()
    {
        foreach(var x in Types.Keys)Directory.CreateDirectory(Path.Combine(Assets,x));
        return Assets;
    }
    internal static object Scan()
    {
        Folder();int count=0;long bytes=0;
        foreach(var sub in Types.Keys)
        {
            foreach(var file in Directory.EnumerateFiles(Path.Combine(Assets,sub),"*",SearchOption.AllDirectories).Take(500))
            {
                try{
                    var f=new FileInfo(file);
                    if(!f.Attributes.HasFlag(FileAttributes.ReparsePoint)&&Types[sub].Contains(f.Extension,StringComparer.OrdinalIgnoreCase)){
                        count++;bytes+=f.Length;
                    }
                }catch{}
            }
        }
        return new{count,bytes,enabled=Enabled(),folder=Assets,served=Interlocked.Read(ref served),unmatched=Interlocked.Read(ref unmatched)};
    }
    internal static string? Match(string url, string initiator)
    {
        if(!Uri.TryCreate(url,UriKind.Absolute,out var uri)||uri.Scheme!="https"||
            (uri.Host!="kirka.io"&&uri.Host!="www.kirka.io")||uri.Port!=443)return null;
        if(!Uri.TryCreate(initiator,UriKind.Absolute,out var from)||from.Scheme!="https"||
            (from.Host!="kirka.io"&&from.Host!="www.kirka.io"))return null;
        var parts=uri.AbsolutePath.Split('/',StringSplitOptions.RemoveEmptyEntries)
            .Select(Uri.UnescapeDataString).ToArray();
        if(parts.Length<3||parts[0]!="assets"||!Types.TryGetValue(parts[1],out var allowed))return null;
        if(!Enabled())return null;
        if(parts.Any(x=>x is "." or ".."||x.Contains('/')||x.Contains('\\')||x.Contains('\0')||x.Contains(':')))return null;
        var candidate=Path.GetFullPath(Path.Combine(new[]{Assets}.Concat(parts.Skip(1)).ToArray()));
        if(!candidate.StartsWith(Path.GetFullPath(Assets)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))return null;
        try{
            // Resolve all existing path segments to prevent reparse-point escapes.
            var part=Path.GetFullPath(Assets);
            foreach(var segment in parts.Skip(1)){
                part=Path.Combine(part,segment);
                if(File.Exists(part)||Directory.Exists(part)){
                    var attr=File.GetAttributes(part);
                    if(attr.HasFlag(FileAttributes.ReparsePoint))return null;
                }
            }
            var ext=Path.GetExtension(candidate);
            if(!allowed.Contains(ext,StringComparer.OrdinalIgnoreCase))return null;
            if(!File.Exists(candidate)){
                var name=Path.GetFileName(candidate);
                var stable=System.Text.RegularExpressions.Regex.Replace(name,@"[.-][a-fA-F0-9]{8,64}(\.[a-zA-Z0-9]+)$",".ks-anyhash$1");
                if(stable!=name)candidate=Path.Combine(Path.GetDirectoryName(candidate)!,stable);
            }
            var f=new FileInfo(candidate);
            if(!f.Exists){Interlocked.Increment(ref unmatched);return null;}
            if(f.Attributes.HasFlag(FileAttributes.ReparsePoint)||f.Length<=0||f.Length>16*1024*1024)return null;
            return candidate;
        }catch{return null;}
    }
    internal static string GetMime(string path)=>Mime.TryGetValue(Path.GetExtension(path),out var mime)?mime:"application/octet-stream";
}

internal sealed class KSResourceRequestHandler : CefSharp.Handler.ResourceRequestHandler
{
    private readonly string file;
    internal KSResourceRequestHandler(string file){this.file=file;}
    protected override IResourceHandler GetResourceHandler(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,IRequest request)
    {
        try{var handler=ResourceHandler.FromFilePath(file,KSResourceSwap.GetMime(file));KSResourceSwap.Served();return handler;}
        catch{return ResourceHandler.ForErrorMessage("Local asset not available",System.Net.HttpStatusCode.NotFound);}
    }
}
