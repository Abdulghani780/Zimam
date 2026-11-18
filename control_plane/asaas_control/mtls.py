"""Local mTLS certificate authority for ASAAS control-plane issuance.

Provides a small self-contained CA rooted under the data directory
(``ASAAS_MTLS_DIR``, default ``data/pki``):

- ``ca.crt`` / ``ca.key`` — the CA pair (key written 0600, never served)
- ``issued/<cn>-<serial>.crt`` / ``.key`` — issued client certificates

This implements the *issuance* half of the mTLS release gate. Terminating
TLS with client-cert verification is a deployment concern (reverse proxy or
uvicorn ``--ssl-*`` flags) documented in CONTROL_PLANE.md; agents fetch their
certificate bundle through the admin API and present it on their HTTP client.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from .config import resolve_data_path

_CA_DAYS = 3650
_CLIENT_DAYS = 397  # ~13 months, inside common CA/browser limits


def _pki_dir() -> Path:
    return resolve_data_path(os.getenv("ASAAS_MTLS_DIR", "data/pki"))


def _ca_paths() -> tuple[Path, Path]:
    d = _pki_dir()
    return d / "ca.crt", d / "ca.key"


def _load_or_none(path: Path):
    try:
        return path.read_bytes()
    except OSError:
        return None


@dataclass(frozen=True)
class IssuedCert:
    serial: str
    common_name: str
    cert_pem: str
    key_pem: str
    expires_at: datetime
    cert_path: Path
    key_path: Path


def ca_status() -> dict:
    cert_path, key_path = _ca_paths()
    cert_pem = _load_or_none(cert_path)
    key_pem = _load_or_none(key_path)
    if not cert_pem or not key_pem:
        return {"initialized": False, "dir": str(_pki_dir())}
    try:
        cert = x509.load_pem_x509_certificate(cert_pem)
        return {
            "initialized": True,
            "dir": str(_pki_dir()),
            "subject": cert.subject.rfc4514_string(),
            "not_before": cert.not_valid_before_utc.isoformat(),
            "not_after": cert.not_valid_after_utc.isoformat(),
            "fingerprint_sha256": cert.fingerprint(hashes.SHA256()).hex(),
        }
    except Exception:
        return {"initialized": False, "dir": str(_pki_dir()), "error": "corrupt CA files"}


def ensure_ca() -> tuple[x509.Certificate, ec.EllipticCurvePrivateKey]:
    """Load the CA pair, generating a fresh ECDSA P-256 CA when absent."""
    cert_path, key_path = _ca_paths()
    cert_pem = _load_or_none(cert_path)
    key_pem = _load_or_none(key_path)
    if cert_pem and key_pem:
        try:
            return (
                x509.load_pem_x509_certificate(cert_pem),
                serialization.load_pem_private_key(key_pem, password=None),
            )
        except Exception as exc:
            raise RuntimeError(f"PKI CA files are corrupt: {exc}") from exc
    d = _pki_dir()
    d.mkdir(parents=True, exist_ok=True)
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "ASAAS Local CA")])
    now = datetime.now(UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=_CA_DAYS))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=False,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False
        )
        .sign(key, hashes.SHA256())
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    try:
        key_path.chmod(0o600)
    except OSError:
        pass
    return cert, key


def rotate_ca() -> dict:
    """Generate a fresh CA, archiving the old pair under ``pki/archive/``."""
    cert_path, key_path = _ca_paths()
    archive = _pki_dir() / "archive"
    archive.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    for p in (cert_path, key_path):
        data = _load_or_none(p)
        if data:
            (archive / f"{p.stem}-{stamp}{p.suffix}").write_bytes(data)
    return ca_status() | {"rotated": True}


def ca_cert_pem() -> str | None:
    data = _load_or_none(_ca_paths()[0])
    return data.decode() if data else None


def issue_client_cert(
    common_name: str,
    *,
    san_dns: tuple[str, ...] = (),
    days: int = _CLIENT_DAYS,
) -> IssuedCert:
    """Issue an ECDSA client-auth certificate signed by the local CA."""
    ca_cert, ca_key = ensure_ca()
    key = ec.generate_private_key(ec.SECP256R1())
    now = datetime.now(UTC)
    builder = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)]))
        .issuer_name(ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=days))
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]), critical=False
        )
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
    )
    if san_dns:
        builder = builder.add_extension(
            x509.SubjectAlternativeName([x509.DNSName(n) for n in san_dns]),
            critical=False,
        )
    cert = builder.sign(ca_key, hashes.SHA256())

    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
    key_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()

    serial = f"{cert.serial_number:x}"
    safe_cn = "".join(c if c.isalnum() or c in "-_." else "_" for c in common_name)
    out_dir = _pki_dir() / "issued"
    out_dir.mkdir(parents=True, exist_ok=True)
    cert_path = out_dir / f"{safe_cn}-{serial[:16]}.crt"
    key_path = out_dir / f"{safe_cn}-{serial[:16]}.key"
    cert_path.write_text(cert_pem)
    key_path.write_text(key_pem)
    try:
        key_path.chmod(0o600)
    except OSError:
        pass
    return IssuedCert(
        serial=serial,
        common_name=common_name,
        cert_pem=cert_pem,
        key_pem=key_pem,
        expires_at=cert.not_valid_after_utc,
        cert_path=cert_path,
        key_path=key_path,
    )
