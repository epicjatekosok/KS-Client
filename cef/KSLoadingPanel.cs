using System.Drawing.Drawing2D;
using System.Drawing.Text;

namespace KSClient.CefHost;

/// <summary>
/// Native WinForms splash: does not create a second Chromium browser or
/// intercept game input after the initial main-frame document is ready.
/// </summary>
internal sealed class KSLoadingPanel : Panel
{
    private readonly System.Windows.Forms.Timer animation = new() { Interval = 35 };
    private Image? logo;
    private int tick;
    private string message = "LOADING KS CLIENT";
    internal KSLoadingPanel(string logoFile)
    {
        DoubleBuffered = true;
        Dock = DockStyle.Fill;
        BackColor = Color.FromArgb(13,16,21);
        try { if (File.Exists(logoFile)) logo = Image.FromFile(logoFile); } catch { }
        animation.Tick += (_, _) => { tick++; Invalidate(); };
        animation.Start();
    }

    internal void Status(string text)
    {
        message = text;
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
        var w = Math.Max(1,Width);
        var h = Math.Max(1,Height);
        g.Clear(Color.FromArgb(14,13,13));
        using (var background = new LinearGradientBrush(ClientRectangle,
            Color.FromArgb(27,22,18),Color.FromArgb(14,13,13),LinearGradientMode.Vertical))
            g.FillRectangle(background,ClientRectangle);
        var amber = Color.FromArgb(255,157,24);
        using (var top = new Pen(amber,3))
            g.DrawLine(top,0,1,w,1);

        // Place the entire mark in the center; resize to match any CEF window.
        var centerX = w/2f;
        var centerY = h/2f - 45f;
        // Native CEF loading panel and Electron splash share the same
        // dark charcoal, copper border and warm amber layout as Settings.
        var cardWidth=Math.Max(180f,Math.Min(430f,w-34f));
        var cardHeight=Math.Min(330f,Math.Max(205f,h-34f));
        var card=new RectangleF(centerX-cardWidth/2,centerY-113,cardWidth,cardHeight);
        using(var cardBg=new LinearGradientBrush(card,Color.FromArgb(35,27,21),
            Color.FromArgb(21,19,18),LinearGradientMode.Vertical))g.FillRectangle(cardBg,card);
        using(var cardBorder=new Pen(Color.FromArgb(78,56,38),1.5f))g.DrawRectangle(cardBorder,card.X,card.Y,card.Width,card.Height);
        using(var cardAccent=new SolidBrush(amber))g.FillRectangle(cardAccent,card.X,card.Y+15,3,card.Height-30);
        using(var eyebrow = new Font("Segoe UI",10,FontStyle.Bold,GraphicsUnit.Pixel))
        using(var eyebrowBrush=new SolidBrush(amber))
        using(var centered=new StringFormat{Alignment=StringAlignment.Center})
            g.DrawString("KS CLIENT  •  BETA",eyebrow,eyebrowBrush,new PointF(centerX,centerY-97),centered);
        float phase = (tick * 5f) % 360f;
        var ring = new RectangleF(centerX-52,centerY-52,104,104);
        using (var inactive = new Pen(Color.FromArgb(40,255,157,24),3))
            g.DrawArc(inactive,ring,0,360);
        using (var active = new Pen(amber,3) { StartCap=LineCap.Round,EndCap=LineCap.Round })
            g.DrawArc(active,ring,phase,90);
        if (logo is not null)
        {
            var ratio = Math.Min(66f/logo.Width,66f/logo.Height);
            var lw = logo.Width*ratio;var lh=logo.Height*ratio;
            g.DrawImage(logo,centerX-lw/2,centerY-lh/2,lw,lh);
        }
        using var heading = new Font("Segoe UI",22,FontStyle.Bold,GraphicsUnit.Pixel);
        using var sub = new Font("Segoe UI",11,FontStyle.Bold,GraphicsUnit.Pixel);
        using var status = new Font("Segoe UI",12,FontStyle.Regular,GraphicsUnit.Pixel);
        using var amberBrush = new SolidBrush(amber);
        using var white = new SolidBrush(Color.FromArgb(246,242,237));
        using var soft = new SolidBrush(Color.FromArgb(171,160,151));
        var textCenter = new StringFormat { Alignment=StringAlignment.Center };
        g.DrawString("KS CLIENT",heading,white,new PointF(centerX,centerY+66),textCenter);
        g.DrawString("KIRKA.IO GAME INTEGRATION",sub,amberBrush,new PointF(centerX,centerY+100),textCenter);

        var barWidth = Math.Min(300f,w*0.55f);
        var bar = new RectangleF(centerX-barWidth/2,centerY+140,barWidth,5);
        using(var track = new SolidBrush(Color.FromArgb(66,46,34)))g.FillRectangle(track,bar);
        var progressWidth = barWidth*.3f;
        var offset = ((tick%80)/80f)*(barWidth+progressWidth)-progressWidth;
        g.SetClip(bar);
        g.FillRectangle(amberBrush,bar.X+offset,bar.Y,progressWidth,bar.Height);
        g.ResetClip();
        // Constrain status to the actual splash card so translated text cannot
        // render outside its panel on narrow / scaled Windows displays.
        var statusBounds=new RectangleF(card.Left+18f,centerY+152f,
            Math.Max(1f,card.Width-36f),Math.Min(30f,Math.Max(1f,card.Bottom-centerY-154f)));
        using(var fittedStatus=new StringFormat{Alignment=StringAlignment.Center,
            LineAlignment=StringAlignment.Center,Trimming=StringTrimming.EllipsisCharacter})
            g.DrawString(message,status,soft,statusBounds,fittedStatus);
        g.DrawString("BETA 1.0.12",sub,soft,new PointF(w-73,h-25),textCenter);
        textCenter.Dispose();
    }

    protected override void Dispose(bool disposing)
    {
        if(disposing) { animation.Stop();animation.Dispose();logo?.Dispose(); }
        base.Dispose(disposing);
    }
}
