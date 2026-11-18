"""Generate a self-signed TLS certificate for the ASAAS control plane.

Usage (from repo root, venv python):

    python tools/gen-server-cert.py [--days 825] [--host NAME-OR-IP ...] [--out data/tls]

Defaults cover localhost/127.0.0.1/::1. Pass --host for each LAN name/IP the
console will be reached by (SANs are what browsers/agents actually verify).
Self-signed certs trigger warnings — for production prefer a cert from your
internal CA or a reverse proxy (see docs/PRODUCTIZATION_PLAN.md Phase B-7).
"""
from __future__ import annotations

import argparse
import datetime as dt
import ipaddress
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def main() -> None:
    parser = argparse.ArgumentParser(description="Self-signed TLS cert for ASAAS")
    parser.add_argument("--days", type=int, default=825, help="validity in days (max ~825 for browser trust)")
    parser.add_argument("--host", action="append", default=[], help="extra DNS name or IP for SANs (repeatable)")
    parser.add_argument("--out", default="data/tls", help="output directory for cert.pem/key.pem")
    parser.add_argument("--cn", default="ASAAS", help="certificate CN")
    args = parser.parse_args()

    sans: list[x509.GeneralName] = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
        x509.IPAddress(ipaddress.ip_address("::1")),
    ]
    for host in args.host:
        try:
            sans.append(x509.IPAddress(ipaddress.ip_address(host)))
        except ValueError:
            sans.append(x509.DNSName(host))

    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    now = dt.datetime.now(dt.UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, args.cn)]))
        .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, args.cn)]))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=args.days))
        .add_extension(x509.SubjectAlternativeName(sans), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, key_encipherment=True,
                key_cert_sign=False, crl_sign=False,
                content_commitment=False, data_encipherment=False,
                encipher_only=False, decipher_only=False,
                key_agreement=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]), critical=False
        )
        .sign(key, hashes.SHA256())
    )

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cert_path = out / "cert.pem"
    key_path = out / "key.pem"
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    # Restrict key file permissions where the platform supports it.
    try:
        key_path.chmod(0o600)
    except OSError:
        pass
    print(f"wrote {cert_path}")
    print(f"wrote {key_path}")
    print("serve with: ASAAS_TLS_CERT=<cert.pem> ASAAS_TLS_KEY=<key.pem>")


if __name__ == "__main__":
    main()
