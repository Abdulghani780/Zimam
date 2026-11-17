"""Issue a local mTLS CA plus server and agent client certificates.

Generates a self-signed root CA, a server certificate for the control
plane (SANs: localhost, 127.0.0.1) and one agent client certificate. This is
a development/bootstrap tool — production should use an internal CA or a
managed PKI and shorter-lived certificates.

Usage:
    python control_plane/scripts/issue_mtls_certs.py --out data/mtls [--days 825]

Outputs:
    ca.crt / ca.key            root CA (keep ca.key offline in production)
    server.crt / server.key    control-plane TLS identity
    agent.crt / agent.key      agent client identity (PKCS#12 optional)
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


def _key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=3072)


def _name(cn: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def _cert(*, subject: x509.Name, issuer: x509.Name, public_key, sign_key, serial: int,
          days: int, is_ca: bool, san_dns=(), san_ips=(), eku=()):
    now = dt.datetime.now(dt.UTC)
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(public_key)
        .serial_number(serial)
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=days))
        .add_extension(x509.BasicConstraints(ca=is_ca, path_length=None), critical=True)
        .add_extension(x509.KeyUsage(
            digital_signature=True,
            content_commitment=False,
            key_encipherment=True,
            data_encipherment=False,
            key_agreement=False,
            key_cert_sign=is_ca,
            crl_sign=is_ca,
            encipher_only=False,
            decipher_only=False,
        ), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(public_key), critical=False)
    )
    if san_dns or san_ips:
        builder = builder.add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName(d) for d in san_dns] + [x509.IPAddress(ipaddress.ip_address(i)) for i in san_ips]
            ),
            critical=False,
        )
    if eku:
        builder = builder.add_extension(x509.ExtendedKeyUsage(list(eku)), critical=False)
    return builder.sign(sign_key, hashes.SHA256())


def _write_pair(path: Path, cert, key) -> None:
    path.with_suffix(".crt").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    path.with_suffix(".key").write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="data/mtls", help="output directory")
    parser.add_argument("--days", type=int, default=825, help="certificate validity in days")
    parser.add_argument("--server-dns", default="localhost,127.0.0.1", help="comma-separated server DNS names/IPs")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    ca_key = _key()
    ca_name = _name("ASAAS Local Root CA")
    ca_cert = _cert(
        subject=ca_name, issuer=ca_name, public_key=ca_key.public_key(), sign_key=ca_key,
        serial=1, days=args.days * 3, is_ca=True,
    )
    _write_pair(out / "ca", ca_cert, ca_key)

    server_key = _key()
    dns = [s.strip() for s in args.server_dns.split(",") if s.strip()]
    server_cert = _cert(
        subject=_name("asaas-control-plane"), issuer=ca_name,
        public_key=server_key.public_key(), sign_key=ca_key, serial=2, days=args.days,
        is_ca=False,
        san_dns=[d for d in dns if not d.replace(".", "").isdigit()],
        san_ips=[d for d in dns if d.replace(".", "").isdigit()],
        eku=[x509.oid.ExtendedKeyUsageOID.SERVER_AUTH],
    )
    _write_pair(out / "server", server_cert, server_key)

    agent_key = _key()
    agent_cert = _cert(
        subject=_name("asaas-windows-agent"), issuer=ca_name,
        public_key=agent_key.public_key(), sign_key=ca_key, serial=3, days=args.days,
        is_ca=False, eku=[x509.oid.ExtendedKeyUsageOID.CLIENT_AUTH],
    )
    _write_pair(out / "agent", agent_cert, agent_key)

    print(f"mTLS material written to {out.resolve()}")
    print("  server: uvicorn --ssl-keyfile server.key --ssl-certfile server.crt")
    print("  agent : ASAAS_AGENT_CERT_PATH=agent.crt  (concatenate agent.crt+ca.crt if the server requires the chain)")


if __name__ == "__main__":
    main()
