using CefSharp;

namespace KSClient.CefHost;

// Called at V8 context creation, before the game's normal DOM-ready UI.
// FrameLoadStart/End remain as idempotent fallbacks for unusual CEF timing.
internal sealed class KSEarlyIntegrationHandler : IRenderProcessMessageHandler
{
    private readonly string earlyGameJS;
    internal KSEarlyIntegrationHandler(string earlyGameJS)
    {
        this.earlyGameJS=earlyGameJS;
    }
    public void OnContextCreated(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame)
    {
        if(!frame.IsMain||!ClientForm.Trust(frame.Url,gameOnly:true))return;
        try
        {
            frame.ExecuteJavaScriptAsync(earlyGameJS);
        }
        catch(Exception ex){Program.Log("CEF early render context injection: "+ex.Message);}
    }
    public void OnContextReleased(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame){}
    public void OnFocusedNodeChanged(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,IDomNode node){}
    public void OnUncaughtException(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,JavascriptException exception){}
}
