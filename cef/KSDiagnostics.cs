using System.Diagnostics;
using System.Runtime.InteropServices;

namespace KSClient.CefHost;

/// <summary>Read-only, locally sampled metrics. Never inspect game data.</summary>
internal static class KSDiagnostics
{
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessBasicInformation
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2_0;
        public IntPtr Reserved2_1;
        public IntPtr UniqueProcessId;
        public IntPtr InheritedFromUniqueProcessId;
    }

    [DllImport("ntdll.dll", ExactSpelling=true)]
    private static extern int NtQueryInformationProcess(
        IntPtr processHandle, int informationClass, out ProcessBasicInformation info,
        int informationLength, out int returnLength);

    private static readonly object Gate = new();
    private static DateTime previousTime = DateTime.MinValue;
    private static double previousHostCpu;
    private static double previousBrowserCpu;

    private static bool IsDirectChild(Process subprocess, int hostPid)
    {
        try
        {
            int status = NtQueryInformationProcess(
                subprocess.Handle, 0, out var basic,
                Marshal.SizeOf<ProcessBasicInformation>(), out _);
            return status == 0 && basic.InheritedFromUniqueProcessId.ToInt64() == hostPid;
        }
        catch { return false; } // Access denied or process already exited.
    }

    public static object Sample()
    {
        lock (Gate)
        {
            using var host = Process.GetCurrentProcess();
            host.Refresh();
            double hostMs = host.TotalProcessorTime.TotalMilliseconds;
            long hostBytes = host.WorkingSet64;
            double childrenMs = 0;
            long childrenBytes = 0;
            int children = 0;
            // Only include browser subprocesses whose direct parent is OUR
            // host, not processes belonging to another user's CEF application.
            foreach (var child in Process.GetProcessesByName("CefSharp.BrowserSubprocess"))
            {
                using (child)
                {
                    if (!IsDirectChild(child, host.Id)) continue;
                    try
                    {
                        child.Refresh();
                        childrenMs += child.TotalProcessorTime.TotalMilliseconds;
                        childrenBytes += child.WorkingSet64;
                        children++;
                    }
                    catch { /* Short-lived Chromium subprocess. */ }
                }
            }
            var now = DateTime.UtcNow;
            var elapsed = (now - previousTime).TotalMilliseconds;
            double hostPercent = 0, browserPercent = 0;
            if (previousTime != DateTime.MinValue && elapsed > 100)
            {
                double capacity = elapsed * Math.Max(1, Environment.ProcessorCount);
                hostPercent = Math.Clamp(100 * (hostMs - previousHostCpu) / capacity, 0, 100);
                browserPercent = Math.Clamp(100 * (childrenMs - previousBrowserCpu) / capacity, 0, 100);
            }
            previousTime = now;
            previousHostCpu = hostMs;
            previousBrowserCpu = childrenMs;

            return new
            {
                browserCPU = Math.Round(browserPercent, 1),
                clientCPU = Math.Round(hostPercent, 1),
                browserRAM = Math.Round(childrenBytes / 1048576.0, 1),
                clientRAM = Math.Round(hostBytes / 1048576.0, 1),
                browserProcesses = 1 + children,
                engine = "CEF",
                sampling = "CEF host and directly owned CefSharp subprocesses. CPU uses total logical processor capacity and the previous sample; first reading may show zero."
            };
        }
    }
}
