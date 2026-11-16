"""Guacamole (guacd) session gateway — outbound TCP proxy for RDP/SSH/VNC.

The browser opens ``/api/v1/gateway/{protocol}?token=<connection-token>`` as a
WebSocket; the control plane consumes the one-time token, resolves the sealed
account secret, performs the guacd handshake against ``ASAAS_GUACD_HOST`` and
then pumps instructions in both directions.

Wire format (Apache Guacamole protocol): instructions are comma-delimited
``LENGTH.VALUE`` elements terminated by ``;`` — e.g. ``6.select,3.rdp;``.
See https://guacamole.apache.org/doc/gug/guacamole-protocol.html
"""
from __future__ import annotations

import asyncio
import codecs
import logging
import os

log = logging.getLogger("asaas_control.gateway")

GUACD_HOST = os.getenv("ASAAS_GUACD_HOST", "")
GUACD_PORT = int(os.getenv("ASAAS_GUACD_PORT", "4822"))
CONNECT_TIMEOUT = float(os.getenv("ASAAS_GUACD_TIMEOUT", "10"))
DEFAULT_PORTS = {"rdp": "3389", "ssh": "22", "telnet": "23", "vnc": "5900"}
GUACAMOLE_VERSION = "1.5.0"
SCREEN = (os.getenv("ASAAS_GW_WIDTH", "1920"), os.getenv("ASAAS_GW_HEIGHT", "1080"), os.getenv("ASAAS_GW_DPI", "96"))

SUPPORTED_PROTOCOLS = frozenset(DEFAULT_PORTS)


def enabled() -> bool:
    return bool(GUACD_HOST)


def _elem(value: str) -> str:
    return f"{len(value)}.{value}"


def encode_instruction(opcode: str, *args: str) -> str:
    return ",".join([_elem(opcode), *(_elem(a) for a in args)]) + ";"


def parse_instruction(text: str) -> tuple[str, list[str]]:
    """Decode one ``...;`` instruction into (opcode, args)."""
    body = text[:-1] if text.endswith(";") else text
    elements: list[str] = []
    i = 0
    while i < len(body):
        dot = body.find(".", i)
        if dot < 0:
            break
        n = int(body[i:dot])
        i = dot + 1
        elements.append(body[i:i + n])
        i += n
        if i < len(body) and body[i] == ",":
            i += 1
    if not elements:
        raise ValueError("empty guacd instruction")
    return elements[0], elements[1:]


class _GuacdReader:
    """Incremental UTF-8 decoder + instruction splitter over a TCP stream."""

    def __init__(self, reader: asyncio.StreamReader):
        self._reader = reader
        self._buf = b""
        self._decoder = codecs.getincrementaldecoder("utf-8")()

    async def read_instruction(self) -> str | None:
        while True:
            text = self._decoder.decode(self._buf, final=False)
            idx = text.find(";")
            if idx >= 0:
                instr = text[:idx + 1]
                self._buf = self._buf[len(instr.encode("utf-8")):]
                return instr
            chunk = await self._reader.read(65536)
            if not chunk:
                tail = self._decoder.decode(b"", final=True)
                return tail if tail.strip() else None
            self._buf += chunk


class GuacdSession:
    """One proxied guacd connection: handshake once, then raw pump."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self._reader = _GuacdReader(reader)
        self._writer = writer

    async def _send(self, instruction: str) -> None:
        self._writer.write(instruction.encode("utf-8"))
        await self._writer.drain()

    async def handshake(self, protocol: str, params: dict[str, str]) -> None:
        await self._send(encode_instruction("select", protocol))
        args_instr = await asyncio.wait_for(self._reader.read_instruction(), CONNECT_TIMEOUT)
        if args_instr is None:
            raise ConnectionError("guacd closed during handshake")
        opcode, arg_names = parse_instruction(args_instr)
        if opcode != "args":
            raise ConnectionError(f"guacd expected args, got {opcode}")

        await self._send(encode_instruction("size", *SCREEN))
        await self._send(encode_instruction("audio"))
        await self._send(encode_instruction("video"))
        await self._send(encode_instruction("image", "image/png", "image/jpeg"))

        values = []
        for name in arg_names:
            if name.startswith("VERSION"):
                values.append(GUACAMOLE_VERSION)
            else:
                values.append(params.get(name, ""))
        await self._send(encode_instruction("connect", *values))

    async def pump_to_client(self, send_text) -> None:
        """Forward guacd instructions to the websocket until EOF."""
        while True:
            instr = await self._reader.read_instruction()
            if instr is None:
                return
            await send_text(instr)

    async def pump_from_client(self, receive_text) -> None:
        """Forward websocket instructions to guacd until the socket closes."""
        while True:
            message = await receive_text()
            if message is None:
                return
            self._writer.write(message.encode("utf-8") if isinstance(message, str) else message)
            await self._writer.drain()

    def close(self) -> None:
        try:
            self._writer.close()
        except Exception:
            pass


async def open_session(protocol: str, params: dict[str, str]) -> GuacdSession:
    """Connect to guacd and run the handshake. Raises on any failure."""
    if protocol not in SUPPORTED_PROTOCOLS:
        raise ValueError(f"Unsupported gateway protocol: {protocol}")
    if not enabled():
        raise ConnectionError("guacd is not configured (set ASAAS_GUACD_HOST)")
    reader, writer = await asyncio.wait_for(
        asyncio.open_connection(GUACD_HOST, GUACD_PORT), timeout=CONNECT_TIMEOUT
    )
    session = GuacdSession(reader, writer)
    try:
        await session.handshake(protocol, params)
    except Exception:
        session.close()
        raise
    return session
