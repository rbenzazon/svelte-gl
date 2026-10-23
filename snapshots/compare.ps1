# Compares the example screenshots of two folders, file by file (same names, PNG).
# Captured at 960 x 640 CSS px from the Vite dev server (http://localhost:8080/<example>), after 3 s (5 s for the
# HDR, glTF and scan viewer pages). Animated examples (rock, scene-update, vertex-anim, matrix, instances, text,
# lights, index) differ from run to run: judge them on the diff image.
#
#   ./snapshots/compare.ps1                                 baseline/ against current/
#   ./snapshots/compare.ps1 -Current C:\path\to\captures    baseline/ against another folder
#
# A pixel counts as changed when one channel differs by more than 8 (out of 255). For each changed example,
# diff/<name>.png shows the changed pixels in red over the dimmed baseline.
param(
	[string]$Baseline = (Join-Path $PSScriptRoot "baseline"),
	[string]$Current = (Join-Path $PSScriptRoot "current"),
	[string]$Diff = (Join-Path $PSScriptRoot "diff"),
	[int]$Threshold = 8
)

if (-not ("SnapshotDiff" -as [type])) {
	Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class SnapshotDiff {
	static byte[] Load(string path, out int width, out int height, out int stride) {
		using (var bitmap = new Bitmap(path)) {
			width = bitmap.Width; height = bitmap.Height;
			var data = bitmap.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
			stride = data.Stride;
			var bytes = new byte[stride * height];
			Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
			bitmap.UnlockBits(data);
			return bytes;
		}
	}
	public static string Compare(string before, string after, string diffPath, int threshold) {
		int w, h, s, w2, h2, s2;
		var a = Load(before, out w, out h, out s);
		var b = Load(after, out w2, out h2, out s2);
		if (w != w2 || h != h2) return "size differs";
		long changed = 0; int maxDiff = 0;
		var output = new byte[s * h];
		for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
			int o = y * s + x * 4, d = 0;
			for (int c = 0; c < 3; c++) d = Math.Max(d, Math.Abs(a[o + c] - b[o + c]));
			if (d > maxDiff) maxDiff = d;
			if (d > threshold) { changed++; output[o] = 0; output[o + 1] = 0; output[o + 2] = 255; }
			else { byte g = (byte)((a[o] + a[o + 1] + a[o + 2]) / 9); output[o] = g; output[o + 1] = g; output[o + 2] = g; }
			output[o + 3] = 255;
		}
		if (changed > 0) {
			using (var image = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
				var data = image.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
				Marshal.Copy(output, 0, data.Scan0, output.Length);
				image.UnlockBits(data);
				image.Save(diffPath, ImageFormat.Png);
			}
		}
		return String.Format("{0:F2}% changed, max channel diff {1}", 100.0 * changed / (w * h), maxDiff);
	}
}
"@
}

New-Item -ItemType Directory -Force $Diff | Out-Null
Get-ChildItem $Diff -Filter *.png | Remove-Item
foreach ($file in Get-ChildItem $Baseline -Filter *.png | Sort-Object Name) {
	$after = Join-Path $Current $file.Name
	$result = if (Test-Path $after) {
		[SnapshotDiff]::Compare($file.FullName, $after, (Join-Path $Diff $file.Name), $Threshold)
	} else {
		"missing in $Current"
	}
	"{0,-18} {1}" -f $file.BaseName, $result
}
