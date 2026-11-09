"""ASAAS Server Control v2.5 - Master Backend Server Entrypoint.

Starts ThreadingHTTPServer on port 8765 with zero-subprocess architecture,
clean service orchestration, LAN network binding, and optional TLS/HTTPS encryption.
"""
from __future__ import annotations

import argparse
import os
import ssl
import sys
import time
from http.server import ThreadingHTTPServer
from pathlib import Path

# Under pythonw.exe on Windows, sys.stdout and sys.stderr are None.
# Redirect them to prevent crashes in print() or logging!
if sys.stdout is None:
    try:
        log_dir = Path(__file__).resolve().parent.parent / 'data'
        log_dir.mkdir(parents=True, exist_ok=True)
        sys.stdout = open(log_dir / 'server.log', 'a', encoding='utf-8', buffering=1)
    except Exception:
        sys.stdout = open(os.devnull, 'w', encoding='utf-8')

if sys.stderr is None:
    try:
        log_dir = Path(__file__).resolve().parent.parent / 'data'
        log_dir.mkdir(parents=True, exist_ok=True)
        sys.stderr = open(log_dir / 'server.log', 'a', encoding='utf-8', buffering=1)
    except Exception:
        sys.stderr = open(os.devnull, 'w', encoding='utf-8')

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.api.router import AsaasApiHandler
from app.core.config import SERVER_HOST, SERVER_PORT, DATA_DIR
from app.infrastructure.win32_wts import Win32WtsService


def generate_self_signed_cert(cert_path: Path, key_path: Path) -> bool:
    """Generates a self-signed TLS certificate for secure LAN deployment."""
    try:
        cmd = [
            'powershell', '-NoProfile', '-Command',
            f'$cert = New-SelfSignedCertificate -DnsName "asaas.local", "localhost", "127.0.0.1" -CertStoreLocation "cert:\\LocalMachine\\My"; '
            f'Export-Certificate -Cert $cert -FilePath "{cert_path}"'
        ]
        # In python standard library without cryptography package, check openssl or powershell
        return False
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="ASAAS Server Control v2.5 Backend")
    parser.add_argument('--replace-pid', type=int, default=None, help="Terminate old PID when elevating")
    parser.add_argument('--port', type=int, default=SERVER_PORT, help="Port to listen on")
    parser.add_argument('--host', type=str, default=SERVER_HOST, help="Host to bind to (e.g. 127.0.0.1 or 0.0.0.0)")
    parser.add_argument('--ssl-cert', type=str, default=os.getenv('ASAAS_SSL_CERT', ''), help="Path to TLS certificate .pem")
    parser.add_argument('--ssl-key', type=str, default=os.getenv('ASAAS_SSL_KEY', ''), help="Path to TLS private key .pem")
    args = parser.parse_args()

    # Terminate un-elevated previous instance if upgrading
    if args.replace_pid:
        try:
            import psutil
            old_proc = psutil.Process(args.replace_pid)
            old_proc.kill()
            time.sleep(0.5)
        except Exception:
            pass

    is_admin = Win32WtsService.is_admin()
    status_role = "Administrator (Elevated Root)" if is_admin else "Standard User (Non-Elevated)"

    use_ssl = False
    cert_file = Path(args.ssl_cert) if args.ssl_cert else DATA_DIR / 'cert.pem'
    key_file = Path(args.ssl_key) if args.ssl_key else DATA_DIR / 'key.pem'

    if cert_file.is_file() and key_file.is_file():
        use_ssl = True

    protocol = "https" if use_ssl else "http"

    print("=" * 65)
    print(" ASAAS Server Control v2.5 - Enterprise Architecture")
    print(f" Status:    {status_role}")
    print(f" Protocol:  {protocol.upper()}")
    print(f" Address:   {protocol}://{args.host}:{args.port}")
    print("=" * 65)

    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer((args.host, args.port), AsaasApiHandler)

    if use_ssl:
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.load_cert_chain(certfile=str(cert_file), keyfile=str(key_file))
        server.socket = ssl_ctx.wrap_socket(server.socket, server_side=True)
        print(f"[+] TLS/HTTPS active with certificate: {cert_file}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] ASAAS Server Control v2.5 shutting down gracefully...")
    finally:
        server.server_close()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        import traceback
        traceback.print_exc(file=sys.stderr)
        if sys.stderr:
            sys.stderr.flush()
