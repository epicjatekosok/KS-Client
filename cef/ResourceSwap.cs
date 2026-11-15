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
      [".gif"]="image/gif",[".svg"]="image/svg+xml",[".mp3"]="audio/mpeg",
      [".wav"]="audio/wav",[".ogg"]="audio/ogg",[".css"]="text/css"
    };
    private static readonly Dictionary<string,string[]> Types=new(StringComparer.Ordinal){
      ["img"]=new[]{".png",".jpg",".jpeg",".webp",".gif",".svg"},
      ["media"]=new[]{".mp3",".wav",".ogg"},
      ["css"]=new[]{".css"}
    };
    internal static bool Enabled()
    {
        try {using var doc=JsonDocument.Parse(File.ReadAllText(Settings));return doc.RootElement.TryGetProperty("enabled",out var state)&&state.ValueKind==JsonValueKind.True;}
        catch{return false;}
    }
    internal static void SetEnabled(bool enabled)
    {
        Directory.CreateDirectory(Program.Root);
        File.WriteAllText(Settings,JsonSerializer.Serialize(new{enabled}));
    }
    internal static string Folder()
    {
        foreach(var x in Types.Keys)Directory.CreateDirectory(Path.Combine(Assets,x));
        return Path.GetDirectoryName(Assets)!;
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
        return new{count,bytes,enabled=Enabled(),folder=Assets};
    }
    internal static string? Match(string url, string initiator)
    {
        if(!Enabled())return null;
        if(!Uri.TryCreate(url,UriKind.Absolute,out var uri)||uri.Scheme!="https"||
            (uri.Host!="kirka.io"&&uri.Host!="www.kirka.io")||uri.Port!=443)return null;
        if(!Uri.TryCreate(initiator,UriKind.Absolute,out var from)||from.Scheme!="https"||
            (from.Host!="kirka.io"&&from.Host!="www.kirka.io"))return null;
        var parts=uri.AbsolutePath.Split('/',StringSplitOptions.RemoveEmptyEntries)
            .Select(Uri.UnescapeDataString).ToArray();
        if(parts.Length<3||parts[0]!="assets"||!Types.TryGetValue(parts[1],out var allowed))return null;
        if(parts.Any(x=>x is "." or ".."||x.Contains('/')||x.Contains('\\')||x.Contains('\0')||x.Contains(':')))return null;
        var candidate=Path.GetFullPath(Path.Combine(new[]{Assets}.Concat(parts.Skip(1)).ToArray()));
        if(!candidate.StartsWith(Path.GetFullPath(Assets)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))return null;
        var ext=Path.GetExtension(candidate);
        if(!allowed.Contains(ext,StringComparer.OrdinalIgnoreCase))return null;
        try{
            var f=new FileInfo(candidate);
            if(!f.Exists||f.Attributes.HasFlag(FileAttributes.ReparsePoint)||f.Length<=0||f.Length>16*1024*1024)return null;
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
        try{return ResourceHandler.FromFilePath(file,KSResourceSwap.GetMime(file));}
        catch{return ResourceHandler.ForErrorMessage("Local asset not available",System.Net.HttpStatusCode.NotFound);}
    }
}
