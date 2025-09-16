import sys
import os
from pathlib import Path

# Ensure project's src directory is on sys.path so tests can import backend.*
ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

# End of file