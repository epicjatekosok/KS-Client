using CefSharp;

namespace KSClient.CefHost;

// Called at V8 context creation, before the game's normal DOM-ready UI.
// FrameLoadStart/End remain as idempotent fallbacks for unusual CEF timing.
internal sealed class KSEarlyIntegrationHandler : IRenderProcessMessageHandler
{
    private readonly string pacer;
    private readonly string observer;
    private readonly string cosmetics;
    private readonly string freeze;
    internal KSEarlyIntegrationHandler(string pacer,string observer,string cosmetics,string freeze)
    {
        this.pacer=pacer;this.observer=observer;this.cosmetics=cosmetics;this.freeze=freeze;
    }
    public void OnContextCreated(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame)
    {
        if(!frame.IsMain||!ClientForm.Trust(frame.Url,gameOnly:true))return;
        try
        {
            frame.ExecuteJavaScriptAsync(pacer);
            frame.ExecuteJavaScriptAsync(observer);
            frame.ExecuteJavaScriptAsync(cosmetics);
            frame.ExecuteJavaScriptAsync(freeze);
        }
        catch(Exception ex){Program.Log("CEF early render context injection: "+ex.Message);}
    }
    public void OnContextReleased(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame){}
    public void OnFocusedNodeChanged(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,IDomNode node){}
    public void OnUncaughtException(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,JavascriptException exception){}
}
