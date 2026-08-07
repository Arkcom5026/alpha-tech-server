$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Set-Location ((git rev-parse --show-toplevel).Trim())
$target = (Resolve-Path 'prisma/schema.prisma').Path

$source = @'
using System;
using System.Runtime.InteropServices;

public static class RestartManagerNative
{
    public const int CCH_RM_SESSION_KEY = 32;
    public const int CCH_RM_MAX_APP_NAME = 255;
    public const int CCH_RM_MAX_SVC_NAME = 63;
    public const int ERROR_MORE_DATA = 234;

    [StructLayout(LayoutKind.Sequential)]
    public struct RM_UNIQUE_PROCESS
    {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    public enum RM_APP_TYPE
    {
        RmUnknownApp = 0,
        RmMainWindow = 1,
        RmOtherWindow = 2,
        RmService = 3,
        RmExplorer = 4,
        RmConsole = 5,
        RmCritical = 1000
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct RM_PROCESS_INFO
    {
        public RM_UNIQUE_PROCESS Process;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_APP_NAME + 1)]
        public string strAppName;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_SVC_NAME + 1)]
        public string strServiceShortName;

        public RM_APP_TYPE ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;

        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmRegisterResources(
        uint pSessionHandle,
        uint nFiles,
        string[] rgsFilenames,
        uint nApplications,
        RM_UNIQUE_PROCESS[] rgApplications,
        uint nServices,
        string[] rgsServiceNames);

    [DllImport("rstrtmgr.dll")]
    public static extern int RmGetList(
        uint dwSessionHandle,
        out uint pnProcInfoNeeded,
        ref uint pnProcInfo,
        [In, Out] RM_PROCESS_INFO[] rgAffectedApps,
        ref uint lpdwRebootReasons);

    [DllImport("rstrtmgr.dll")]
    public static extern int RmEndSession(uint pSessionHandle);
}
'@

if (-not ('RestartManagerNative' -as [type])) {
    Add-Type -TypeDefinition $source -Language CSharp
}

$session = 0
$key = [Guid]::NewGuid().ToString('N').Substring(0, 32)
$result = [RestartManagerNative]::RmStartSession([ref]$session, 0, $key)
if ($result -ne 0) { throw "RmStartSession failed: $result" }

try {
    $files = [string[]]@($target)
    $result = [RestartManagerNative]::RmRegisterResources($session, 1, $files, 0, $null, 0, $null)
    if ($result -ne 0) { throw "RmRegisterResources failed: $result" }

    [uint32]$needed = 0
    [uint32]$count = 0
    [uint32]$rebootReasons = 0

    $result = [RestartManagerNative]::RmGetList($session, [ref]$needed, [ref]$count, $null, [ref]$rebootReasons)

    if ($result -eq 0 -and $needed -eq 0) {
        Write-Host "No process reported by Restart Manager for: $target"
        Write-Host "If WriteAllText still fails, the mapping may be held by a kernel/filter driver or a process that Restart Manager cannot enumerate."
        exit 0
    }

    if ($result -ne [RestartManagerNative]::ERROR_MORE_DATA -and $result -ne 0) {
        throw "RmGetList sizing call failed: $result"
    }

    $count = $needed
    $apps = New-Object 'RestartManagerNative+RM_PROCESS_INFO[]' $count
    $result = [RestartManagerNative]::RmGetList($session, [ref]$needed, [ref]$count, $apps, [ref]$rebootReasons)
    if ($result -ne 0) { throw "RmGetList failed: $result" }

    $rows = foreach ($app in $apps[0..([Math]::Max(0, [int]$count - 1))]) {
        $pidValue = $app.Process.dwProcessId
        $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            PID          = $pidValue
            ProcessName  = if ($proc) { $proc.ProcessName } else { '<unavailable>' }
            AppName      = $app.strAppName
            Service      = $app.strServiceShortName
            Type         = $app.ApplicationType
            Restartable  = $app.bRestartable
            StartTime    = if ($proc) { try { $proc.StartTime } catch { $null } } else { $null }
            Path         = if ($proc) { try { $proc.Path } catch { $null } } else { $null }
        }
    }

    Write-Host "Processes reported as using: $target"
    $rows | Sort-Object PID | Format-Table -AutoSize
}
finally {
    [void][RestartManagerNative]::RmEndSession($session)
}

Write-Host ''
Write-Host 'Diagnostic only. No process was stopped and no repository file was modified.'
