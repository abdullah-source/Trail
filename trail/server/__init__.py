"""Signing service. Holds no document text: it receives chain heads, signs
checkpoints, keeps a transparency log, and optionally builds an evidence pack
from a record uploaded for that one request (processed in memory, not stored)."""
