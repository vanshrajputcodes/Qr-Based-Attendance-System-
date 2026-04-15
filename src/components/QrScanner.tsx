import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const containerId = useId().replace(/:/g, "-");

  useEffect(() => {
    let active = true;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    const stopScanner = async () => {
      const currentScanner = scannerRef.current;
      if (!currentScanner) return;

      try {
        await currentScanner.stop();
      } catch {
        // scanner may already be stopped
      }

      try {
        await currentScanner.clear();
      } catch {
        // no-op
      }

      if (scannerRef.current === currentScanner) {
        scannerRef.current = null;
      }
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!active || hasScannedRef.current) return;
          hasScannedRef.current = true;
          void stopScanner().finally(() => {
            onScan(decodedText);
          });
        },
        () => {} // ignore scan failures
      )
      .catch((err) => {
        if (!active) return;
        setError("Camera access denied. Please allow camera permissions.");
        console.error("QR Scanner error:", err);
      });

    return () => {
      active = false;
      void stopScanner();
    };
  }, [containerId, onScan]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">Scan QR Code</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      {error ? (
        <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
      ) : (
        <div id={containerId} className="overflow-hidden rounded-lg" />
      )}
    </div>
  );
}
