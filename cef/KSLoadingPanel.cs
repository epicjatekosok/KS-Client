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
    private string message = "KLIENS BETÖLTÉSE";
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
        g.Clear(Color.FromArgb(13,16,21));
        using (var background = new LinearGradientBrush(ClientRectangle,
            Color.FromArgb(24,31,44),Color.FromArgb(13,16,21),LinearGradientMode.Vertical))
            g.FillRectangle(background,ClientRectangle);
        var amber = Color.FromArgb(240,170,53);
        using (var top = new Pen(amber,3))
            g.DrawLine(top,0,1,w,1);

        // Place the entire mark in the center; resize to match any CEF window.
        var centerX = w/2f;
        var centerY = h/2f - 45f;
        float phase = (tick * 5f) % 360f;
        var ring = new RectangleF(centerX-52,centerY-52,104,104);
        using (var inactive = new Pen(Color.FromArgb(40,240,170,53),3))
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
        using var white = new SolidBrush(Color.FromArgb(232,234,240));
        using var soft = new SolidBrush(Color.FromArgb(169,177,194));
        var textCenter = new StringFormat { Alignment=StringAlignment.Center };
        g.DrawString("KS CLIENT",heading,white,new PointF(centerX,centerY+66),textCenter);
        g.DrawString("KIRKA.IO GAME INTEGRATION",sub,amberBrush,new PointF(centerX,centerY+100),textCenter);

        var barWidth = Math.Min(300f,w*0.55f);
        var bar = new RectangleF(centerX-barWidth/2,centerY+140,barWidth,5);
        using(var track = new SolidBrush(Color.FromArgb(48,55,66)))g.FillRectangle(track,bar);
        var progressWidth = barWidth*.3f;
        var offset = ((tick%80)/80f)*(barWidth+progressWidth)-progressWidth;
        g.SetClip(bar);
        g.FillRectangle(amberBrush,bar.X+offset,bar.Y,progressWidth,bar.Height);
        g.ResetClip();
        g.DrawString(message,status,soft,new PointF(centerX,centerY+156),textCenter);
        g.DrawString("ALPHA 1.1.20",sub,soft,new PointF(w-73,h-25),textCenter);
        textCenter.Dispose();
    }

    protected override void Dispose(bool disposing)
    {
        if(disposing) { animation.Stop();animation.Dispose();logo?.Dispose(); }
        base.Dispose(disposing);
    }
}
